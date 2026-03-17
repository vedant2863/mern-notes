/** ============================================================
 *  FILE 06 — The Request Object in Express 5
 *  req properties, methods, and content negotiation.
 *  Master req and you can extract any data a client sends.
 *  ============================================================ */

// ─── STORY: Police Station FIR ────────────────────────────────
// SHO Pandey fills out every detail — where the request came
// from, what it carries, what language it speaks. The Express
// req object IS that intake form.

const express = require('express');
const http = require('http');

// ─── Helper — HTTP request returning { status, headers, body }
function request(port, method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port, path, method, headers: { ...(headers || {}) } };
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
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// =============================================================
// BLOCK 1 — Inspecting Request Properties
// =============================================================

async function block1() {
  console.log('=== BLOCK 1: Inspecting Request Properties ===\n');
  const app = express();
  app.use(express.json());

  app.get('/inspect/:id', (req, res) => {
    res.json({
      basics: {
        method: req.method,           // 'GET'
        path: req.path,               // '/inspect/42'
        originalUrl: req.originalUrl, // '/inspect/42?sort=name'
        protocol: req.protocol,       // 'http'
        hostname: req.hostname,       // '127.0.0.1'
      },
      extracted: {
        query: req.query,             // { sort: 'name' }
        params: req.params,           // { id: '42' }
      },
      headerInfo: {
        customHeader: req.get('X-FIR-Priority'),  // case-insensitive
      },
    });
  });

  app.post('/complaints', (req, res) => {
    res.json({
      receivedBody: req.body,
      contentType: req.get('Content-Type'),
    });
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  SHO Pandey's thana open on port ${port}\n`);

  // Test: GET with query, params, custom header
  const r1 = await request(port, 'GET', '/inspect/42?sort=name', {
    headers: { 'X-FIR-Priority': 'urgent' },
  });
  console.log('  method:     ', r1.body.basics.method);       // GET
  console.log('  path:       ', r1.body.basics.path);          // /inspect/42
  console.log('  originalUrl:', r1.body.basics.originalUrl);   // /inspect/42?sort=name
  console.log('  query:      ', r1.body.extracted.query);      // { sort: 'name' }
  console.log('  params:     ', r1.body.extracted.params);     // { id: '42' }
  console.log('  custom hdr: ', r1.body.headerInfo.customHeader); // urgent
  console.log();

  // Test: POST with JSON body
  const r2 = await request(port, 'POST', '/complaints', {
    body: { title: 'Chain snatching', suspect: 'Unknown' },
  });
  console.log('  receivedBody:', r2.body.receivedBody);
  console.log('  contentType: ', r2.body.contentType);
  console.log();

  server.close();
}

// =============================================================
// BLOCK 2 — Content Negotiation: req.accepts(), req.is()
// =============================================================

async function block2() {
  console.log('=== BLOCK 2: Content Negotiation ===\n');
  const app = express();
  app.use(express.json());
  app.use(express.text());

  // req.accepts() — what does the client want to RECEIVE?
  app.get('/evidence', (req, res) => {
    const preferred = req.accepts(['json', 'html', 'text']);
    if (preferred === 'json') return res.json({ preferred, acceptsXml: req.accepts('xml') !== false });
    if (preferred === 'html') return res.type('html').send('<pre>Evidence report</pre>');
    res.type('text').send('Evidence report (text)');
  });

  // req.is() — what did the client actually SEND?
  app.post('/evidence', (req, res) => {
    res.json({
      isJson: req.is('json'),
      isText: req.is('text/*'),
      bodyReceived: req.body,
    });
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  Evidence room on port ${port}\n`);

  const r1 = await request(port, 'GET', '/evidence', {
    headers: { 'Accept': 'application/json' },
  });
  console.log('  preferred:  ', r1.body.preferred);   // json
  console.log('  acceptsXml: ', r1.body.acceptsXml);  // false
  console.log();

  const r2 = await request(port, 'POST', '/evidence', { body: { clue: 'fingerprint' } });
  console.log('  isJson:     ', r2.body.isJson);       // json
  console.log('  isText:     ', r2.body.isText);       // false
  console.log('  body:       ', r2.body.bodyReceived);  // { clue: 'fingerprint' }
  console.log();

  server.close();
}

// =============================================================
// RUN ALL BLOCKS
// =============================================================
async function main() {
  await block1();
  await block2();

  console.log('=== KEY TAKEAWAYS ===\n');
  console.log('  1. req.method, req.path, req.originalUrl — every angle on WHAT was requested.');
  console.log('  2. req.params holds :segments; req.query holds ?key=val — both auto-parsed.');
  console.log('  3. req.body needs middleware (express.json(), express.text(), express.urlencoded()).');
  console.log('  4. req.get(header) is case-insensitive; req.headers is the raw object.');
  console.log('  5. req.accepts() checks what the client wants to RECEIVE.');
  console.log('  6. req.is() checks what the client actually SENT.\n');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
