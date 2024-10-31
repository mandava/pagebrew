const { marked } = require('marked');
const frontMatter = require('front-matter');
const { debug } = require('./utils');

function updateImagePaths(html) {
  // Replace image src paths to point to the public directory
  return html.replace(
    /<img([^>]*?)src="([^"]*?)"([^>]*?)>/g,
    (match, before, src, after) => {
      // Don't modify absolute URLs or URLs that already start with /public
      if (src.startsWith('http') || src.startsWith('/public')) {
        return match;
      }

      // Add /public prefix to the src path
      const newSrc = `/public/${src}`;
      return `<img${before}src="${newSrc}"${after}>`;
    }
  );
}

async function processMarkdown(content, options = {}) {
  const { attributes, body } = frontMatter(content);
  debug(`Processing markdown with attributes: ${JSON.stringify(attributes)}`, options);

  marked.use({
    gfm: true,
    breaks: true,
    headerIds: true
  });

  let html = marked.parse(body);

  html = updateImagePaths(html);

  return {
    html,
    metadata: {
      ...attributes,
      date: attributes.date ? new Date(attributes.date) : new Date(),
      title: attributes.title || 'Untitled',
      description: attributes.description || '',
      tags: attributes.tags || []
    }
  };
}

module.exports = { processMarkdown };
