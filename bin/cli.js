#!/usr/bin/env node

const { program } = require('commander');
const { generate, watch } = require('../src/generator');
const { createServer } = require('../src/server');

program
  .name('pagebrew')
  .description('Zero-config static site generator for your markdown files')
  .argument('[input]', 'Input directory containing markdown files')
  .argument('[output]', 'Output directory for generated site')
  .option('-w, --watch', 'Watch for file changes')
  .option('-s, --serve', 'Serve output files on local server')
  .option('-t, --theme <theme>', 'Theme to use (default: default)')
  .action(async (input, output, options) => {
    if (!input || !output) {
      program.help();
      return;
    }

    if (options.serve || options.watch) {
      await watch(input, output, options);
    } else {
      await generate(input, output, options);
    }
    
    if (options.serve) {
      createServer(output);
    }
  });

program.parse(); 