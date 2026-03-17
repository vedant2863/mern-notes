/** ============================================================
 *  FILE 07 — The Response Object in Express 5
 *  res methods for status, headers, body, files, redirects,
 *  and content negotiation — full control over what the client
 *  receives.
 *  ============================================================ */

// ─── STORY: Kumhar's Potter Workshop ──────────────────────────
// Kumhar Ramu packages every order differently — brass pot
// (JSON), tissue paper (HTML), raw clay (text). He stamps
// status tags, wraps headers, and sometimes redirects clients.

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Helper — HTTP request (does NOT follow redirects)
function request(port, method, urlPath, { body, headers, raw } = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port, path: urlPath, method, headers: { ...(headers || {}) } };
    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
      if (typeof body === 'object' && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        if (raw) parsed = data;
        else { try { parsed = JSON.parse(data); } catch { parsed = data; } }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// =============================================================
// BLOCK 1 — Status Codes, JSON, send/end
// =============================================================

async function block1() {
  console.log('=== BLOCK 1: Status Codes, JSON, send/end ===\n');
  const app = express();

  app.get('/api/item', (req, res) => {
    res.json({ name: 'Terracotta matka', price: 250 });
  });

  app.get('/api/created', (req, res) => {
    // res.status() returns res for chaining — doesn't send.
    res.status(201).json({ message: 'Order created', id: 'ord-99' });
  });

  app.delete('/api/item/:id', (req, res) => {
    res.sendStatus(204);  // Status + status-text body in one call
  });

  app.get('/api/text', (req, res) => {
    res.send('Shaped with care on the potter\'s wheel');
    // send() with string -> Content-Type: text/html
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  Workshop on port ${port}\n`);

  const r1 = await request(port, 'GET', '/api/item');
  console.log('  res.json():', r1.status, r1.body);

  const r2 = await request(port, 'GET', '/api/created');
  console.log('  status+json:', r2.status, r2.body);

  const r3 = await request(port, 'DELETE', '/api/item/5');
  console.log('  sendStatus:', r3.status);

  const r4 = await request(port, 'GET', '/api/text');
  console.log('  send(string):', r4.headers['content-type']);
  console.log();
  server.close();
}

// =============================================================
// BLOCK 2 — Headers, Redirect, Content Negotiation
// =============================================================

async function block2() {
  console.log('=== BLOCK 2: Headers, Redirect, res.format() ===\n');
  const app = express();

  // res.set(), res.append(), res.type()
  app.get('/api/headers-demo', (req, res) => {
    res.set('X-Workshop', 'Kumhar-Ramu');
    res.append('X-Finish', 'glazed');
    res.append('X-Finish', 'painted');
    res.json({ xFinish: res.get('X-Finish') });
  });

  // Redirects: 302 (default), 301 (permanent), 307 (preserve method)
  app.get('/old-catalog', (req, res) => res.redirect('/new-catalog'));
  app.get('/legacy', (req, res) => res.redirect(301, '/modern'));
  app.get('/new-catalog', (req, res) => res.send('New pottery catalog'));
  app.get('/modern', (req, res) => res.send('Modern workshop'));

  // res.format() — server-driven content negotiation
  app.get('/api/pot', (req, res) => {
    res.format({
      'application/json': () => res.json({ title: 'Surahi', medium: 'terracotta' }),
      'text/html': () => res.send('<h1>Surahi</h1><p>terracotta</p>'),
      default: () => res.status(406).send('Not Acceptable'),
    });
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  Packaging station on port ${port}\n`);

  const r1 = await request(port, 'GET', '/api/headers-demo');
  console.log('  X-Workshop:', r1.headers['x-workshop']);
  console.log('  X-Finish:  ', r1.headers['x-finish']);

  const r2 = await request(port, 'GET', '/old-catalog');
  console.log('  redirect:  ', r2.status, r2.headers['location']);

  const r3 = await request(port, 'GET', '/api/pot', { headers: { 'Accept': 'application/json' } });
  console.log('  format/json:', r3.body);

  const r4 = await request(port, 'GET', '/api/pot', { headers: { 'Accept': 'text/html' } });
  console.log('  format/html:', r4.body);
  console.log();
  server.close();
}

// =============================================================
// BLOCK 3 — sendFile and download
// =============================================================

async function block3() {
  console.log('=== BLOCK 3: sendFile, download ===\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'express-workshop-'));
  const blueprintPath = path.join(tmpDir, 'blueprint.txt');
  const dataPath = path.join(tmpDir, 'data.csv');
  fs.writeFileSync(blueprintPath, 'Surahi blueprint: height=30cm, diameter=15cm\n');
  fs.writeFileSync(dataPath, 'id,name,price\n1,Matka,250\n2,Surahi,450\n');

  const app = express();

  // sendFile — streams file for viewing (auto Content-Type)
  app.get('/view/blueprint', (req, res) => {
    res.sendFile(blueprintPath);
  });

  // download — sets Content-Disposition: attachment
  app.get('/download/data', (req, res) => {
    res.download(dataPath, 'pottery-inventory.csv');
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  File delivery on port ${port}\n`);

  const r1 = await request(port, 'GET', '/view/blueprint', { raw: true });
  console.log('  sendFile type:', r1.headers['content-type']);
  console.log('  sendFile body:', r1.body.trim());

  const r2 = await request(port, 'GET', '/download/data', { raw: true });
  console.log('  disposition:  ', r2.headers['content-disposition']);
  console.log();

  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// =============================================================
// RUN ALL BLOCKS
// =============================================================
async function main() {
  await block1();
  await block2();
  await block3();

  console.log('=== KEY TAKEAWAYS ===\n');
  console.log('  1. res.json() — API workhorse; sets Content-Type + stringifies.');
  console.log('  2. res.status() only SETS the code — still need .json()/.send()/.end().');
  console.log('  3. res.send() auto-detects: string->html, object->json, Buffer->octet.');
  console.log('  4. res.set()/res.append()/res.type() give full header control.');
  console.log('  5. res.redirect() defaults to 302; use 301 permanent, 307 preserve method.');
  console.log('  6. res.format() does content negotiation via the Accept header.');
  console.log('  7. res.sendFile() streams for viewing; res.download() triggers save.\n');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
