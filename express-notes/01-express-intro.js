/** ============================================================
 *  FILE 1: Express.js Introduction — From Raw HTTP to Express
 *  Express sits on TOP of Node's http module and adds routing,
 *  middleware, and convenient request/response helpers.
 *  ============================================================ */

// ─── Amma's Dhaba Upgrade ─────────────────────────────────────
// Amma ran her dhaba's ordering with raw http.createServer —
// parsing URLs by hand and setting headers manually. Express
// is the mixer that does the tedious work for her.

const express = require('express');

// ════════════════════════════════════════════════════════════════
// BLOCK 1 — Basic Server with GET and POST
// ════════════════════════════════════════════════════════════════

// ─── Raw http vs Express — side by side (comments only) ───────
//
// RAW HTTP:
//   const server = http.createServer((req, res) => {
//     if (req.method === 'GET' && req.url === '/menu') {
//       res.writeHead(200, { 'Content-Type': 'application/json' });
//       res.end(JSON.stringify({ items: ['thali', 'biryani'] }));
//     } else if (req.method === 'POST' && req.url === '/order') {
//       let body = '';
//       req.on('data', chunk => body += chunk);
//       req.on('end', () => {
//         res.writeHead(201, { 'Content-Type': 'application/json' });
//         res.end(JSON.stringify({ status: 'received' }));
//       });
//     }
//   });
//
// EXPRESS:
//   const app = express();
//   app.use(express.json());
//   app.get('/menu',  (req, res) => res.json({ items: ['thali','biryani'] }));
//   app.post('/order', (req, res) => res.status(201).json({ status: 'received', order: req.body }));

function block1_basicServer() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());    // Parses incoming JSON bodies

    // ─── GET route ─────────────────────────────────────────────
    app.get('/menu', (req, res) => {
      // app.get() registers a handler for GET at this path.
      // res.json() sets Content-Type AND serialises — two steps in one.
      res.json({ items: ['thali', 'biryani'] });
    });

    // ─── POST route ────────────────────────────────────────────
    app.post('/order', (req, res) => {
      // JSON body is already parsed by express.json() above.
      // res.status(201).json() — chainable for clean one-liners.
      res.status(201).json({ status: 'received', order: req.body });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 1: Basic Express Server ===');
      console.log(`Server running on port ${port}\n`);

      try {
        const menuRes = await fetch(`${base}/menu`);
        console.log('GET /menu:', JSON.stringify(await menuRes.json()));
        // Output: GET /menu: {"items":["thali","biryani"]}

        const orderRes = await fetch(`${base}/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish: 'biryani', qty: 2 }),
        });
        console.log('POST /order:', JSON.stringify(await orderRes.json()));
        // Output: POST /order: {"status":"received","order":{"dish":"biryani","qty":2}}
        console.log(`POST status code: ${orderRes.status}`);
        // Output: POST status code: 201
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
// BLOCK 2 — Response Methods (send, json, status, redirect, end)
// ════════════════════════════════════════════════════════════════

//  res.send(body)     — smart send: sets Content-Type by type
//  res.json(obj)      — always JSON, calls JSON.stringify
//  res.status(code)   — sets status, returns res for chaining
//  res.redirect(url)  — 302 redirect (or supply status first)
//  res.end()          — end response with no body
//  res.sendStatus(c)  — sets status AND sends status text as body

function block2_responseMethods() {
  return new Promise((resolve) => {
    const app = express();

    // res.send() — string sets Content-Type to text/html
    app.get('/text', (req, res) => {
      res.send('Namaste from Amma\'s Dhaba!');
    });

    // res.json() — always application/json
    app.get('/json', (req, res) => {
      res.json({ framework: 'Express', version: '5.x' });
    });

    // res.status() + chaining
    app.get('/not-found', (req, res) => {
      res.status(404).json({ error: 'Resource not found' });
    });

    // res.sendStatus() — status + text body in one call
    app.get('/health', (req, res) => {
      res.sendStatus(200);   // Sends "OK" as the body
    });

    // res.redirect() — 301 permanent, 302 temporary (default)
    app.get('/old-menu', (req, res) => {
      res.redirect(301, '/new-menu');
    });
    app.get('/new-menu', (req, res) => {
      res.json({ menu: 'This is the new menu!' });
    });

    // res.end() — end with no body (e.g. 204 No Content)
    app.get('/no-content', (req, res) => {
      res.status(204).end();
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 2: Response Methods ===');
      console.log(`Server running on port ${port}\n`);

      try {
        const textRes = await fetch(`${base}/text`);
        console.log('GET /text:', await textRes.text());
        // Output: GET /text: Namaste from Amma's Dhaba!
        console.log('  Content-Type:', textRes.headers.get('content-type'));
        // Output:   Content-Type: text/html; charset=utf-8

        const jsonRes = await fetch(`${base}/json`);
        console.log('GET /json:', JSON.stringify(await jsonRes.json()));
        // Output: GET /json: {"framework":"Express","version":"5.x"}

        const nfRes = await fetch(`${base}/not-found`);
        console.log('GET /not-found status:', nfRes.status);
        // Output: GET /not-found status: 404

        const healthRes = await fetch(`${base}/health`);
        console.log('GET /health:', healthRes.status, await healthRes.text());
        // Output: GET /health: 200 OK

        const redirRes = await fetch(`${base}/old-menu`, { redirect: 'manual' });
        console.log('GET /old-menu status:', redirRes.status, 'Location:', redirRes.headers.get('location'));
        // Output: GET /old-menu status: 301 Location: /new-menu

        const ncRes = await fetch(`${base}/no-content`);
        console.log('GET /no-content status:', ncRes.status);
        // Output: GET /no-content status: 204
      } catch (err) {
        console.error('Test error:', err.message);
      }

      server.close(() => {
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
  await block1_basicServer();
  await block2_responseMethods();

  console.log('\n=== KEY TAKEAWAYS ===');
  console.log('1. express() creates an app wrapping Node\'s http module.');
  console.log('2. app.get/post/put/delete register route handlers by HTTP method.');
  console.log('3. res.json() sends JSON; res.send() auto-detects; res.status() is chainable.');
  console.log('4. res.redirect(), res.sendStatus(), res.end() cover common needs.');
  console.log('5. app.listen(0) lets the OS pick a free port — perfect for testing.');

  process.exit(0);
}

main();
