/* Local static server for the A-Math web app. No API key, no third-party packages. Requires Node.js 18+. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/engine.js': ['engine.js', 'text/javascript; charset=utf-8'],
};

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const entry = req.method === 'GET' ? FILES[url.pathname] : undefined;
  if (!entry) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'not found' }));
  }
  const [file, type] = entry;
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
  fs.createReadStream(path.join(ROOT, file)).pipe(res);
}

if (require.main === module) {
  http.createServer(handle).listen(PORT, '127.0.0.1', () => {
    console.log(`A-Math เปิดแล้วที่ http://localhost:${PORT}`);
  });
}

module.exports = { handle };
