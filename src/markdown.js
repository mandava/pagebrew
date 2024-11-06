const { marked } = require('marked');
const frontMatter = require('front-matter');
const { debug } = require('./utils');

async function processMarkdown(content) {
  const { attributes, body } = frontMatter(content);

  marked.use({
    gfm: true,
    breaks: true,
    headerIds: true
  });

  let html = marked.parse(body);

  // Update image paths
  html = updateImagePaths(html);

  // Extract first image from HTML content
  let thumbnail = '';
  const imageMatch = html.match(/<img[^>]+src="([^">]+)"/);
  if (imageMatch) {
    thumbnail = imageMatch[1];
  }

  return {
    html,
    metadata: {
      ...attributes,
      date: attributes.date ? new Date(attributes.date) : new Date(),
      title: attributes.title || 'Untitled',
      description: attributes.description || '',
      tags: attributes.tags || [],
      thumbnail
    }
  };
}

function updateImagePaths(html) {
  // Replace image src paths to point to the public directory
  return html.replace(
    /<img([^>]*?)src="([^"]*?)"([^>]*?)>/g,
    (match, before, src, after) => {
      // Don't modify absolute URLs or URLs that already start with /public
      if (src.startsWith('http') || src.startsWith('/public')) {
        return match;
      }

      const filename = src.split('/').pop();
      const newSrc = `/public/${filename}`;
      return `<img${before}src="${newSrc}"${after}>`;
    }
  );
}

module.exports = { processMarkdown };
