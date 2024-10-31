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

      const filename = src.split('/').pop();
      const newSrc = `/public/${filename}`;
      return `<img${before}src="${newSrc}"${after}>`;
    }
  );
}

async function processMarkdown(content, posts = [], options = {}) {
  const { attributes, body } = frontMatter(content);
  debug(`Processing markdown with attributes: ${JSON.stringify(attributes)}`, options);

  marked.use({
    gfm: true,
    breaks: true,
    headerIds: true
  });

  let html = marked.parse(body);

  html = updateImagePaths(html);

  // Extract first image from HTML content
  let image = '';
  const imageMatch = html.match(/<img[^>]+src="([^">]+)"/);
  if (imageMatch) {
    image = imageMatch[1];
  }

  // Find current post index if posts array is provided
  let nextPost = null;
  let previousPost = null;

  if (posts.length > 0 && attributes.date) {
    const currentDate = new Date(attributes.date);
    const sortedPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    const currentIndex = sortedPosts.findIndex(post =>
      new Date(post.date).getTime() === currentDate.getTime()
    );

    if (currentIndex > 0) {
      nextPost = sortedPosts[currentIndex - 1];
    }
    if (currentIndex < sortedPosts.length - 1) {
      previousPost = sortedPosts[currentIndex + 1];
    }
  }

  return {
    html,
    metadata: {
      ...attributes,
      date: attributes.date ? new Date(attributes.date) : new Date(),
      title: attributes.title || 'Untitled',
      description: attributes.description || '',
      tags: attributes.tags || [],
      image,
      nextPost,
      previousPost
    }
  };
}

module.exports = { processMarkdown };
