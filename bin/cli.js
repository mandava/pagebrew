#!/usr/bin/env node

const { program } = require('commander');
const { generate, watch } = require('../src/generator');
const { createServer } = require('../src/server');

program
  .name('pagebrew')
  .description('Modern static site generator with Tailwind JIT')
  .argument('<input>', 'Input directory containing markdown files')
  .argument('<output>', 'Output directory for generated site')
  .option('-w, --watch', 'Watch for file changes')
  .option('-s, --serve', 'Serve output files on local server')
  .action((input, output, options) => {
    if (options.serve || options.watch) {
      watch(input, output);
    } else {
      generate(input, output, options);
    }
    
    if (options.serve) {
      createServer(output);
    }
  });

program.parse(); 