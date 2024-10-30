const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const chokidar = require('chokidar');
const { processMarkdown } = require('./markdown');
const { getTemplate } = require('./utils');

async function processCSS(outputDir, theme = 'default') {
  const defaultCssPath = path.join(__dirname, `themes/${theme}/css/style.css`);
  const cssContent = await fs.readFile(defaultCssPath, 'utf-8');

  const configPath = path.join(process.cwd(), 'tailwind.config.js');
  const tailwindConfig = await fs.pathExists(configPath)
    ? require(configPath)
    : require('./tailwind.config.js');

  tailwindConfig.content = [
    path.join(outputDir, '**/*.html'),
    path.join(__dirname, `themes/${theme}/**/*.ejs`)
  ];

  const result = await postcss([
    tailwindcss(tailwindConfig),
    autoprefixer
  ]).process(cssContent, {
    from: defaultCssPath,
    to: path.join(outputDir, 'css/style.css')
  });

  await fs.outputFile(path.join(outputDir, 'css/style.css'), result.css);
}

async function getAllPosts(inputDir) {
  const files = await glob('blog/**/*.md', { cwd: inputDir });
  const posts = [];

  for (const file of files) {
    if (file === 'blog/index.md') continue;
    const content = await fs.readFile(path.join(inputDir, file), 'utf-8');
    const { metadata } = await processMarkdown(content);
    posts.push({
      ...metadata,
      url: '/blog/' + path.basename(file).replace('.md', '.html')
    });
  }

  return posts.sort((a, b) => b.date - a.date);
}

async function generate(inputDir, outputDir, options = {}) {
  const theme = options.theme || 'default';
  
  console.log('🧹 Cleaning output directory...');
  await fs.emptyDir(outputDir);

  console.log(`🎨 Using theme: ${theme}`);
  console.log('🍺 Brewing your site...');
  await fs.ensureDir(path.join(outputDir, 'blog'));

  const templateDir = path.join(inputDir, 'templates');
  const hasCustomTemplates = await fs.pathExists(templateDir);

  console.log('🎨 Processing styles...');
  await processCSS(outputDir, theme);

  const files = await glob('**/*.md', { cwd: inputDir });
  const posts = await getAllPosts(inputDir);
  
  console.log('📝 Processing markdown files...');
  
  // First process all markdown files
  for (const file of files) {
    const content = await fs.readFile(path.join(inputDir, file), 'utf-8');
    const { html, metadata } = await processMarkdown(content);
    
    const isIndex = file === 'index.md';
    const isBlogPost = file.startsWith('blog/');
    const template = isBlogPost ? 'post' : (isIndex ? 'index' : 'base');
    
    const customTemplatePath = path.join(templateDir, `${template}.ejs`);
    const templatePath = hasCustomTemplates && await fs.pathExists(customTemplatePath)
      ? customTemplatePath
      : path.join(__dirname, `themes/${theme}`, `${template}.ejs`);
    
    const templateFn = await getTemplate(templatePath);
    const rendered = templateFn({
      content: html,
      metadata,
      posts
    });
    
    let outFile;
    if (isIndex) {
      outFile = path.join(outputDir, 'index.html');
    } else if (isBlogPost) {
      outFile = path.join(outputDir, 'blog', path.basename(file).replace('.md', '.html'));
    } else {
      outFile = path.join(outputDir, file.replace('.md', '.html'));
    }
    
    await fs.outputFile(outFile, rendered);
    console.log(`✨ Generated: ${file} -> ${outFile}`);
  }

  // Then generate the blog index page
  console.log('📚 Generating blog index...');
  const customBlogTemplatePath = path.join(templateDir, 'blog.ejs');
  const blogTemplatePath = hasCustomTemplates && await fs.pathExists(customBlogTemplatePath)
    ? customBlogTemplatePath
    : path.join(__dirname, `themes/${theme}`, 'blog.ejs');
  
  const blogTemplateFn = await getTemplate(blogTemplatePath);
  const blogRendered = blogTemplateFn({
    posts,
    metadata: {
      title: 'Blog',
      description: 'All blog posts'
    }
  });
  
  await fs.outputFile(path.join(outputDir, 'blog.html'), blogRendered);
  console.log('✨ Generated: blog.html');

  console.log('🎉 Site built successfully!');
}

async function watch(inputDir, outputDir, options = {}) {
  console.log('👀 Watching for changes...');
  
  // Initial build
  await generate(inputDir, outputDir, options);

  // Watch markdown files
  chokidar.watch('**/*.md', {
    cwd: inputDir,
    ignoreInitial: true
  }).on('all', (event, file) => {
    console.log(`📝 ${event}: ${file}`);
    generate(inputDir, outputDir, options);
  });

  // Watch template files and rebuild CSS
  chokidar.watch(['**/*.ejs', '**/*.html'], {
    cwd: inputDir,
    ignoreInitial: true
  }).on('all', async (event, file) => {
    console.log(`🎨 ${event}: ${file}`);
    await processCSS(outputDir);
  });
}

module.exports = { generate, watch };
