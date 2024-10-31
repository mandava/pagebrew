const ejs = require('ejs');
const fs = require('fs-extra');

const templateCache = new Map();

async function getTemplate(templatePath) {
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath);
  }

  const templateContent = await fs.readFile(templatePath, 'utf-8');

  // Create template function
  const template = (data) => {
    return ejs.render(templateContent, data, {
      filename: templatePath,
      async: false
    });
  };

  templateCache.set(templatePath, template);
  return template;
}

const debug = (msg, options = {}) => {
  if (options.debug) {
    console.log(msg);
  }
};

module.exports = {
  getTemplate,
  debug
};
