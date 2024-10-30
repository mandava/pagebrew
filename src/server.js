const http = require('http');
const fs = require('fs');
const path = require('path');

function createServer(outputDir, port = 3000) {
  const server = http.createServer((req, res) => {
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

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  return server;
}

module.exports = { createServer }; 