/** ============================================================
 *  FILE 5: Built-in Middleware — JSON, URL-encoded, and Static
 *  Express ships three built-in middleware for the most common
 *  tasks: parsing JSON, parsing forms, and serving static files.
 *  ============================================================ */

// ─── Swiggy Order Processing ──────────────────────────────────
// Orders arrive as JSON from the app, form-encoded from partners,
// and static files (images, menus) are served directly.

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ════════════════════════════════════════════════════════════════
// BLOCK 1 — express.json() and express.urlencoded()
// ════════════════════════════════════════════════════════════════

//  express.json({ limit: '100kb', strict: true })
//  express.urlencoded({ extended: true, limit: '100kb' })
//    extended: true uses qs (nested objects), false uses querystring

function block1_bodyParsing() {
  return new Promise((resolve) => {
    const app = express();

    app.use(express.json({ limit: '50kb' }));
    // Without this, req.body is undefined for JSON requests.

    app.use(express.urlencoded({ extended: true, limit: '50kb' }));
    // extended: true supports nested objects like address[city]=Mumbai.

    // ─── JSON endpoint ────────────────────────────────────────
    app.post('/orders/json', (req, res) => {
      res.json({ received: 'json', body: req.body });
    });

    // ─── Form-encoded endpoint ────────────────────────────────
    app.post('/orders/form', (req, res) => {
      res.json({ received: 'urlencoded', body: req.body });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 1: express.json() and express.urlencoded() ===');
      console.log(`Server running on port ${port}\n`);

      try {
        const jsonRes = await fetch(`${base}/orders/json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurant: 'Biryani House', amount: 349 }),
        });
        console.log('POST /orders/json:', JSON.stringify(await jsonRes.json()));
        // Output: {"received":"json","body":{"restaurant":"Biryani House","amount":349}}

        const formRes = await fetch(`${base}/orders/form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'restaurant=Tandoor+Nights&amount=199',
        });
        console.log('POST /orders/form:', JSON.stringify(await formRes.json()));
        // Output: {"received":"urlencoded","body":{"restaurant":"Tandoor Nights","amount":"199"}}

        // Nested objects with extended: true
        const nestedRes = await fetch(`${base}/orders/form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'address[city]=Mumbai&address[pin]=400001',
        });
        console.log('POST /orders/form (nested):', JSON.stringify(await nestedRes.json()));
        // Output: {"received":"urlencoded","body":{"address":{"city":"Mumbai","pin":"400001"}}}
      } catch (err) {
        console.error('Test error:', err.message);
      }

      server.close(() => {
        console.log('\nBlock 1 server closed.\n');
        resolve();
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// BLOCK 2 — express.static() with Temp Directory
// ════════════════════════════════════════════════════════════════

//  express.static(root, {
//    dotfiles: 'ignore', index: 'index.html',
//    maxAge: 0, etag: true, lastModified: true
//  })

function block2_staticFiles() {
  return new Promise((resolve) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'express-static-'));
    const publicDir = path.join(tmpDir, 'public');
    fs.mkdirSync(publicDir, { recursive: true });

    fs.writeFileSync(path.join(publicDir, 'index.html'),
      '<!DOCTYPE html><html><body><h1>Swiggy Order Center</h1></body></html>');
    fs.writeFileSync(path.join(publicDir, 'about.txt'),
      'Swiggy: delivering happiness since 2014.');
    fs.writeFileSync(path.join(publicDir, '.secret'), 'hidden');

    const app = express();

    // Mount static with options at /static prefix
    app.use('/static', express.static(publicDir, {
      dotfiles: 'ignore',
      index: 'index.html',
      maxAge: '1h',
    }));

    // Dynamic route coexists with static
    app.get('/api/status', (req, res) => {
      res.json({ status: 'operational' });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 2: express.static() ===');
      console.log(`Server running on port ${port}\n`);

      try {
        const htmlRes = await fetch(`${base}/static/index.html`);
        console.log('GET /static/index.html:', htmlRes.status);
        console.log('  Content-Type:', htmlRes.headers.get('content-type'));
        // Output: text/html; charset=utf-8

        const dotRes = await fetch(`${base}/static/.secret`);
        console.log('GET /static/.secret status:', dotRes.status);
        // Output: 404 (dotfiles: 'ignore')

        const cacheRes = await fetch(`${base}/static/about.txt`);
        console.log('Cache-Control:', cacheRes.headers.get('cache-control'));
        // Output: public, max-age=3600

        const apiRes = await fetch(`${base}/api/status`);
        console.log('GET /api/status:', JSON.stringify(await apiRes.json()));
        // Output: {"status":"operational"}
      } catch (err) {
        console.error('Test error:', err.message);
      }

      server.close(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log('\nBlock 2 server closed.');
        resolve();
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// Run all blocks sequentially, then exit
// ════════════════════════════════════════════════════════════════

async function main() {
  await block1_bodyParsing();
  await block2_staticFiles();

  console.log('\n=== KEY TAKEAWAYS ===');
  console.log('1. express.json() parses JSON bodies — without it, req.body is undefined.');
  console.log('2. express.urlencoded({ extended: true }) parses forms, including nested objects.');
  console.log('3. Both parsers check Content-Type — they only parse matching requests.');
  console.log('4. express.static(dir) serves files with proper MIME types and caching.');
  console.log('5. Static middleware passes through when no file matches — coexists with routes.');

  process.exit(0);
}

main();
