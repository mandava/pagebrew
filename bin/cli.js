#!/usr/bin/env node

const { program } = require('commander');
const { watch, build } = require('../src/generator');
const { createServer } = require('../src/server');
const { updateConfig } = require('../src/config');

program
  .name('pagebrew')
  .description('Create a static site from your markdown files');

// Serve command - development server
program
  .command('serve')
  .description('Start development server with hot reload')
  .option('-p , --port <number>', 'Port number', '3000')
  .option('-t, --theme <theme>', 'Theme to use (default: minimal | aurora | frappe)')
  .action(async (options) => {
    await watch(options);
    createServer(options.port);
  });

// Build command - production build
program
  .command('build')
  .description('Build site for production')
  .option('-t, --theme <theme>', 'Theme to use (default: minimal | aurora | frappe)')
  .action(async (options) => {
    await build(options);
  });

// Config command - update config
program
  .command('config')
  .description('Update config')
  .option('-t, --theme <theme>', 'Theme to use (default: minimal | aurora | frappe)')
  .option('-n, --name <name>', 'Name of the site')
  .option('-d, --description <description>', 'Description of the site')
  .option('-f, --footer <footer>', 'Footer text')
  .option('-o, --outputDir <outputDir>', 'Output directory')
  .action(async (options) => {
    let config = {};
    if (options.theme) config.theme = options.theme;
    if (options.name) config.name = options.name;
    if (options.description) config.description = options.description;
    if (options.footer) config.footer = options.footer;
    if (options.outputDir) config.outputDir = options.outputDir;

    await updateConfig(config);
  });

// Preview command - preview production build
program
  .command('preview')
  .description('Preview production build')
  .option('-p, --port <number>', 'Port number', '4000')
  .action(async (options) => {
    createServer(options.port);
  });

program.parse();
