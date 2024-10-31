const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const chokidar = require('chokidar');
const { processMarkdown } = require('./markdown');
const { getTemplate, debug } = require('./utils');

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico', 'avif', 'jfif', 'pjpeg', 'pjp', 'apng', 'heif', 'heic'];

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

async function getAllPages(inputDir) {
  let pages = [
    { url: '/', title: 'Home' }
  ];

  const files = await glob('**/*.md', { cwd: inputDir });

  for (const file of files) {
    if (file === 'index.md') continue;
    if (file.startsWith('blog/')) {
      // Only add the blog index page once
      if (!pages.find(p => p.url === '/blog.html')) {
        pages.push({ url: '/blog.html', title: 'Blog' });
      }
      continue;
    }

    const content = await fs.readFile(path.join(inputDir, file), 'utf-8');
    const { metadata } = await processMarkdown(content);
    pages.push({
      url: '/' + file.replace('.md', '.html'),
      title: metadata.title
    });
  }

  // Remove home page, sort remaining pages, then add home page back at start
  const homePage = pages.shift();
  pages.sort((a, b) => a.title.localeCompare(b.title));
  pages.unshift(homePage);

  return pages;
}

async function copyImages(inputDir, outputDir) {
  const publicDir = path.join(outputDir, 'public');
  const imagePattern = `**/*.{${IMAGE_EXTENSIONS.join(',')}}`;

  const imageFiles = await glob(imagePattern, { cwd: inputDir });

  for (const file of imageFiles) {
    const sourcePath = path.join(inputDir, file);
    const targetPath = path.join(publicDir, file);

    await fs.copy(sourcePath, targetPath);
  }
}

async function getSiteMetadata(inputDir) {
  const indexPath = path.join(inputDir, 'index.md');
  // Remove trailing slashes, split on dashes,   capitalize first letter
  let inputDirName = path.basename(inputDir).replace(/\/+$/, '').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  let siteMetadata = {
    name: inputDirName,
    tagline: ''
  };

  if (await fs.pathExists(indexPath)) {
    const content = await fs.readFile(indexPath, 'utf-8');
    const { metadata } = await processMarkdown(content);
    if (metadata.name) siteMetadata.name = metadata.name;
    if (metadata.tagline) siteMetadata.tagline = metadata.tagline;
  }

  return siteMetadata;
}

async function generate(inputDir, outputDir, options = {}) {
  try {
    if (!await fs.pathExists(inputDir)) {
      console.warn(`Input directory "${inputDir}" does not exist`);
      process.exit(1);
    }

    const mdFiles = await glob('**/*.md', { cwd: inputDir });
    if (mdFiles.length === 0) {
      console.warn('⚠️  Warning: No markdown files found in input directory');
    }

    const theme = options.theme || 'default';

    debug('🧹 Cleaning output directory...', options);
    await fs.emptyDir(outputDir);

    debug('📸 Copying images...', options);
    await copyImages(inputDir, outputDir);

    debug(`🎨 Using theme: ${theme}`, options);
    debug('🍺 Brewing your site...', options);
    await fs.ensureDir(path.join(outputDir, 'blog'));

    const templateDir = path.join(inputDir, 'templates');
    const hasCustomTemplates = await fs.pathExists(templateDir);

    debug('🎨 Processing styles...', options);
    await processCSS(outputDir, theme);

    const files = await glob('**/*.md', { cwd: inputDir });
    const posts = await getAllPosts(inputDir);
    const pages = await getAllPages(inputDir);
    const siteMetadata = await getSiteMetadata(inputDir);
    debug('📝 Processing markdown files...', options);

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

      let currentPage = '/';
      if (!isIndex) {
        currentPage = isBlogPost ? '/blog.html' : '/' + file.replace('.md', '.html');
      }

      const templateFn = await getTemplate(templatePath);
      const rendered = templateFn({
        content: html,
        metadata,
        posts,
        pages,
        currentPage,
        siteMetadata
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
    }

    // Then generate the blog index page
    const customBlogTemplatePath = path.join(templateDir, 'blog.ejs');
    const defaultBlogTemplatePath = path.join(__dirname, `themes/${theme}`, 'blog.ejs');

    if (await fs.pathExists(customBlogTemplatePath) || await fs.pathExists(defaultBlogTemplatePath)) {
      const blogTemplatePath = hasCustomTemplates && await fs.pathExists(customBlogTemplatePath)
        ? customBlogTemplatePath
        : defaultBlogTemplatePath;

      const blogTemplateFn = await getTemplate(blogTemplatePath);
      const blogRendered = blogTemplateFn({
        posts,
        pages,
        currentPage: '/blog.html',
        metadata: {
          title: 'Blog',
          description: 'All blog posts'
        },
        siteMetadata
      });

      await fs.outputFile(path.join(outputDir, 'blog.html'), blogRendered);
    }

    console.log(`🎉 Site built successfully!`);
  } catch (error) {
    console.error('Error generating site:', error);
    throw error;
  }
}

async function watch(inputDir, outputDir, options = {}) {
  const publicDir = path.join(outputDir, 'public');

  try {
    debug('👀 Watching for changes...', options);

    // Initial build
    await generate(inputDir, outputDir, options);

    chokidar.watch(inputDir, {
      ignoreInitial: true,
      ignored: (path, stats) =>
        stats?.isFile() &&
        !path.endsWith('.md') &&
        !IMAGE_EXTENSIONS.some(ext => path.endsWith(`.${ext}`))
    }).on('all', async (event, file) => {
      debug(`📝 ${event}: ${file}`, options);

      // If it's an image file, copy to public directory
      if (IMAGE_EXTENSIONS.some(ext => file.endsWith(`.${ext}`))) {
        const relativePath = path.relative(inputDir, file);
        const targetPath = path.join(publicDir, relativePath);

        if (event === 'unlink') {
          await fs.remove(targetPath);
          debug(`🗑️  Removed image: ${relativePath}`, options);
        } else {
          await fs.ensureDir(path.dirname(targetPath));
          await fs.copy(file, targetPath);
          debug(`📸 Updated image: ${relativePath}`, options);
        }
      } else {
        // Regenerate site for markdown changes
        await generate(inputDir, outputDir, options);
      }
    });

    chokidar.watch(inputDir, {
      ignoreInitial: true,
      ignored: (path, stats) =>
        stats?.isFile() &&
        !path.endsWith('.ejs') &&
        !path.endsWith('.html')
    }).on('all', async (event, file) => {
      debug(`🎨 ${event}: ${file}`, options);
      await processCSS(outputDir);
    });
  } catch (error) {
    console.error('Error in watch mode:', error);
    throw error;
  }
}

module.exports = { generate, watch };
