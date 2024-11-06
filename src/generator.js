const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const chokidar = require('chokidar');
const { processMarkdown } = require('./markdown');
const { getTemplate, debug } = require('./utils');
const { getConfig, updateConfig } = require('./config');

const inputDir = process.cwd();

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico', 'avif', 'jfif', 'pjpeg', 'pjp', 'apng', 'heif', 'heic'];

async function getOutputDir() {
  const config = await getConfig();
  return path.relative(process.cwd(), config.outputDir || 'dist');
}

async function getTheme() {
  const config = await getConfig();
  return config.theme || 'minimal';
}

async function createNavMenu() {
  const pages = await getAllPages();
  const menu = pages.map(page => {
    if (page.url === '/index.html') {
      return {
        title: 'Home',
        url: '/'
      };
    }
    return {
      title: page.title,
      url: page.url
    };
  });
  return menu;
}

async function processCSS() {
  const theme = await getTheme();
  const outputDir = await getOutputDir();
  const defaultCssPath = path.join(__dirname, `themes/${theme}/css/style.css`);

  let cssContent;
  if (await fs.pathExists(defaultCssPath)) {
    cssContent = await fs.readFile(defaultCssPath, 'utf-8');
  } else {
    let templateCssPath = path.join(__dirname, 'templates/css/style.css');
    if (await fs.pathExists(templateCssPath)) {
      cssContent = await fs.readFile(templateCssPath, 'utf-8');
    }
  }

  if (!cssContent) {
    console.error(`⚠️  Error: No CSS found`);
    process.exit(1);
  }

  // Look for theme-specific tailwind config first
  const themeConfigPath = path.join(__dirname, `themes/${theme}/tailwind.config.js`);
  const projectConfigPath = path.join(process.cwd(), 'tailwind.config.js');

  let tailwindConfig;

  if (await fs.pathExists(themeConfigPath)) {
    tailwindConfig = require(themeConfigPath);
  } else if (await fs.pathExists(projectConfigPath)) {
    tailwindConfig = require(projectConfigPath);
  } else {
    tailwindConfig = require('./tailwind.config.js');
  }

  tailwindConfig.content = [
    path.join(outputDir, '**/*.html'),
    path.join(__dirname, `themes/${theme}/**/*.ejs`),
    path.join(__dirname, 'templates/**/*.ejs')
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

async function getAllPosts() {
  const inputDir = process.cwd();
  const postFiles = await glob('blog/**/*.md', { cwd: inputDir });
  const posts = [];

  if (postFiles.length === 0) {
    return posts;
  }

  for (const postFile of postFiles) {
    const content = await fs.readFile(path.join(inputDir, postFile), 'utf-8');
    const { html, metadata } = await processMarkdown(content);

    posts.push({
      ...metadata,
      url: '/blog/' + path.basename(postFile).replace('.md', '.html'),
      content: html
    });
  }

  // Sort posts by date descending
  const sortedPosts = posts.sort((a, b) => b.date - a.date);

  // Add next/previous links
  for (let i = 0; i < sortedPosts.length; i++) {
    if (i > 0) {
      sortedPosts[i].nextPost = {
        title: sortedPosts[i - 1].title,
        url: sortedPosts[i - 1].url
      };
    }
    if (i < sortedPosts.length - 1) {
      sortedPosts[i].previousPost = {
        title: sortedPosts[i + 1].title,
        url: sortedPosts[i + 1].url
      };
    }
  }

  return sortedPosts;
}

async function getAllPages() {
  const inputDir = process.cwd();
  let pages = [];

  const allFiles = await glob('**/*.md', { cwd: inputDir });
  const pageFiles = allFiles.filter(file => !file.startsWith('blog/'));

  for (const file of pageFiles) {
    const content = await fs.readFile(path.join(inputDir, file), 'utf-8');
    const { html, metadata } = await processMarkdown(content);
    pages.push({
      ...metadata,
      url: '/' + file.replace('.md', '.html'),
      content: html
    });
  }

  // check if the index.html exists in the pages array
  const indexPage = pages.find(page => page.url === '/index.html');
  if (!indexPage) {
    pages.push({
      title: 'Home',
      url: '/index.html',
      content: ''
    });
  }

  // check if the theme has a blog page
  const theme = await getTheme();
  const themeBlogPath = path.join(__dirname, `themes/${theme}/blog.ejs`);
  const hasBlogPage = await fs.pathExists(themeBlogPath);
  const hasCustomBlogTemplate = await fs.pathExists(path.join(process.cwd(), 'templates/blog.ejs'));

  if (hasBlogPage || hasCustomBlogTemplate) {
    pages.push({
      title: 'Blog',
      description: 'All blog posts',
      url: '/blog.html',
      html: ''
    });
  }

  return pages;
}

async function copyImages() {
  const outputDir = await getOutputDir();
  const publicDir = path.join(outputDir, 'public');

  await fs.emptyDir(publicDir);

  const imagePattern = `**/*.{${IMAGE_EXTENSIONS.join(',')}}`;
  const imageFiles = await glob(imagePattern, { cwd: inputDir, ignore: outputDir + '/**' });

  for (const file of imageFiles) {
    const sourcePath = path.join(inputDir, file);
    const filename = path.basename(file);
    const targetPath = path.join(publicDir, filename);

    await fs.copy(sourcePath, targetPath);
  }
}

async function getSiteMetadata() {
  const config = await getConfig();
  let siteMetadata = {
    name: config.name,
    tagline: config.description
  };

  return siteMetadata;
}

async function getFooterContent() {
  const config = await getConfig();
  let currentYear = new Date().getFullYear();
  return config.footer || `© ${currentYear} ${config.name} | Built with <a href="https://pagebrew.dev" class="underline">Pagebrew</a>`;
}

async function generate(options = {}) {
  try {
    const inputDir = process.cwd();
    const outputDir = await getOutputDir();
    const config = await getConfig();

    const mdFiles = await glob('**/*.md', { cwd: inputDir });
    if (mdFiles.length === 0) {
      console.warn('⚠️  Warning: No markdown files found in input directory');
    }

    if (options.theme) {
      await updateConfig({ theme: options.theme });
    }

    const theme = await getTheme();

    await fs.emptyDir(outputDir);

    const templateDir = path.join(inputDir, 'templates');
    const hasCustomTemplates = await fs.pathExists(templateDir);

    const posts = await getAllPosts();
    const pages = await getAllPages();

    const siteMetadata = await getSiteMetadata();
    const footerContent = await getFooterContent();

    let themeDir = path.join(__dirname, `themes/${theme}`);
    let themeExists = await fs.pathExists(themeDir);

    if (hasCustomTemplates) {
      await fs.ensureDir(path.join(process.cwd(), 'templates'));
      if (themeExists) {
        await fs.copy(themeDir, path.join(__dirname, 'templates'));
      }
      await fs.copy(path.join(process.cwd(), 'templates'), path.join(__dirname, 'templates'));
    }

    if (!hasCustomTemplates && !themeExists) {
      console.error(`⚠️  Error: Either custom templates or theme must exist. \n Update your pagebrew.config.json file with a valid theme (minimal, aurora, frappe)`);
      process.exit(1);
    }

    // Create menu if not exists
    let menu = config.menu || [];
    if (!config.menu) {
      menu = await createNavMenu();
      await updateConfig({ menu });
    }

    // Generate blog posts
    for (const post of posts) {
      const currentPage = '/blog.html';
      const templatePath = hasCustomTemplates
        ? path.join(__dirname, 'templates', 'post.ejs')
        : path.join(__dirname, `themes/${theme}`, `post.ejs`);

      const templateFn = await getTemplate(templatePath);
      const rendered = templateFn({
        post,
        menu,
        siteMetadata,
        footerContent,
        currentPage
      });

      await fs.outputFile(path.join(outputDir, 'blog', path.basename(post.url)), rendered);
    }

    // Generate pages
    for (const page of pages) {
      const isIndex = page.url === '/index.html';
      const isBlog = page.url === '/blog.html';
      const template = isIndex ? 'index' : isBlog ? 'blog' : 'base';

      const templatePath = hasCustomTemplates
        ? path.join(__dirname, 'templates', `${template}.ejs`)
        : path.join(__dirname, `themes/${theme}`, `${template}.ejs`);

      let currentPage = '/';
      if (!isIndex) {
        currentPage = page.url;
      }

      const templateFn = await getTemplate(templatePath);
      const rendered = templateFn({
        page,
        posts,
        menu,
        currentPage,
        siteMetadata,
        footerContent
      });

      let outFile = path.join(outputDir, page.url);
      await fs.outputFile(outFile, rendered);
    }


    await copyImages();
    await processCSS();

    console.log(`🎉 Site built successfully!`);
  } catch (error) {
    console.error('Error generating site:', error);
    throw error;
  }
}

async function watch(options = {}) {
  const inputDir = process.cwd();
  const outputDir = await getOutputDir();
  const publicDir = path.join(outputDir, 'public');

  try {
    // Initial build
    await generate(options);

    // Watch for changes
    chokidar.watch(inputDir, {
      ignoreInitial: true,
      interval: 1000,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 1000
      }
    }).on('all', async (event, file) => {
      if (file.endsWith('.md')) {
        await generate(options);
      }
    });

  } catch (error) {
    console.error('Error in watch mode:', error);
    throw error;
  }
}

async function build(options = {}) {
  await generate(options);
}

module.exports = { generate, watch, build };
