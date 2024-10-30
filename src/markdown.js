const { marked } = require('marked');
const frontMatter = require('front-matter');

async function processMarkdown(content) {
  const { attributes, body } = frontMatter(content);
  
  marked.use({
    gfm: true,
    breaks: true,
    headerIds: true
  });

  const html = marked.parse(body);
  
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