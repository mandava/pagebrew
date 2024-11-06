const http = require('http');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('./config');

async function createServer(port = 3000) {
  const server = http.createServer(async (req, res) => {
    const config = await getConfig();
    const outputDir = config.outputDir || 'dist';

    // Convert URL to filesystem path, default to index.html
    let filePath = path.join(outputDir, req.url === '/' ? 'index.html' : req.url);

    // Get file extension
    const ext = path.extname(filePath);

    // Basic MIME type mapping
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
    };

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(content);
      }
    });
  });

  const startServer = (portToUse) => {
    // Remove any existing listeners before adding new ones
    server.removeAllListeners('error');
    server.removeAllListeners('listening');

    server.listen(portToUse)
      .on('error', (err) => {
        let newPort = Number(portToUse) + 1;
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${portToUse} is busy, trying ${newPort}...`);
          startServer(newPort);
        }
      })
      .once('listening', () => {
        console.log(`Server running at http://localhost:${portToUse}`);
      });
  };

  startServer(port);
  return server;
}

module.exports = { createServer };
