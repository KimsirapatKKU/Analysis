const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handle } = require('../server.js');

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    server.listen(0, '127.0.0.1', async () => {
      try { await fn(server.address().port); resolve(); }
      catch (e) { reject(e); }
      finally { server.close(); }
    });
  });
}

test('GET / serves the app and GET /engine.js serves the engine', () => withServer(async port => {
  const page = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /เอแม็ท/);
  const eng = await fetch(`http://127.0.0.1:${port}/engine.js`);
  assert.match(eng.headers.get('content-type'), /javascript/);
}));

test('unknown paths return 404', () => withServer(async port => {
  assert.equal((await fetch(`http://127.0.0.1:${port}/nope`)).status, 404);
}));
