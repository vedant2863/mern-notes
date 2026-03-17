/** ============================================================
 *  FILE 22: Express 5 Features — Breaking Changes & New Wins
 *  ============================================================ */

// STORY: Delhi Metro upgrades from Phase 1 (Express 4) to Phase 2
// (Express 5). Same foundation, but the signaling system changed —
// promises auto-caught, path syntax updated, legacy APIs removed.

const express = require('express');


// ════════════════════════════════════════════════════════════════
// BLOCK 1 — Async Error Handling & Path Matching
// ════════════════════════════════════════════════════════════════

function block1_asyncAndPaths() {
  return new Promise((resolve) => {
    const app = express();
    console.log('=== BLOCK 1: Async Errors & Path Matching ===\n');

    // WHY: In Express 5, rejected promises are caught AUTOMATICALLY.
    // No more try/catch in every async handler.
    app.get('/async-success', async (req, res) => {
      const data = await Promise.resolve({ id: 1, name: 'Rajiv Kumar' });
      res.json(data);
    });

    app.get('/async-error', async (req, res) => {
      await Promise.reject(new Error('Signal relay connection lost'));
    });

    app.get('/async-throw', async (req, res) => {
      throw new Error('Unexpected null reference');
    });

    // --- Path matching changes ---
    //   Express 4              Express 5
    //   /line/*                /line/*name (named, returns array)
    //   /station/:id?          /station{/:id}  (braces wrap optional)
    //   /:id(\d+)              REMOVED — validate in handler

    app.get('/station/:id', (req, res) => {
      res.json({ params: req.params });
    });

    // WHY: Named wildcard — returns array of path segments
    app.get('/files/*filepath', (req, res) => {
      res.json({ filepath: req.params.filepath, joined: req.params.filepath.join('/') });
    });

    // WHY: {/:month} makes both slash and param optional
    app.get('/schedule/:line{/:month}', (req, res) => {
      res.json({ line: req.params.line, month: req.params.month || 'not provided' });
    });

    // WHY: Express 5 auto-decodes params (no manual decodeURIComponent)
    app.get('/search/:query', (req, res) => {
      res.json({ rawQuery: req.params.query });
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message, caught: true });
    });

    const server = app.listen(0, async () => {
      const base = `http://127.0.0.1:${server.address().port}`;

      try {
        console.log('--- Async Error Handling ---');
        const success = await (await fetch(`${base}/async-success`)).json();
        console.log('/async-success:', JSON.stringify(success));
        // Output: /async-success: {"id":1,"name":"Rajiv Kumar"}

        const err = await (await fetch(`${base}/async-error`)).json();
        console.log('/async-error caught:', err.caught, '|', err.error);
        // Output: /async-error caught: true | Signal relay connection lost

        const thrown = await (await fetch(`${base}/async-throw`)).json();
        console.log('/async-throw caught:', thrown.caught);
        // Output: /async-throw caught: true

        console.log('\n--- Path Matching ---');
        const station = await (await fetch(`${base}/station/42`)).json();
        console.log('/station/42:', JSON.stringify(station.params));
        // Output: /station/42: {"id":"42"}

        const file = await (await fetch(`${base}/files/docs/report/final.pdf`)).json();
        console.log('Wildcard joined:', file.joined);
        // Output: Wildcard joined: docs/report/final.pdf

        const sched1 = await (await fetch(`${base}/schedule/blue/march`)).json();
        console.log('/schedule/blue/march:', sched1.month);
        // Output: /schedule/blue/march: march

        const sched2 = await (await fetch(`${base}/schedule/blue`)).json();
        console.log('/schedule/blue:', sched2.month);
        // Output: /schedule/blue: not provided

        const search = await (await fetch(`${base}/search/hello%20world`)).json();
        console.log('Auto-decoded:', search.rawQuery);
        // Output: Auto-decoded: hello world
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('\nBlock 1 closed.\n'); resolve(); });
    });
  });
}


// ════════════════════════════════════════════════════════════════
// BLOCK 2 — Removed/Changed APIs
// ════════════════════════════════════════════════════════════════
//
//  Removed                 Replacement
//  app.del()               app.delete()
//  req.param(name)         req.params / req.body / req.query
//  res.json(obj, status)   res.status(s).json(obj)
//  res.send(number)        res.sendStatus(number)
//  req.host                req.hostname (no port)
//  res.redirect('back')    Manual Referer check

function block2_removedAndChanged() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    console.log('=== BLOCK 2: Removed/Changed APIs ===\n');

    app.get('/hostname-demo', (req, res) => {
      res.json({ hostname: req.hostname });
    });

    // WHY: Express 5 uses 'simple' parser by default — no nested objects
    app.get('/query-demo', (req, res) => {
      res.json({ query: req.query });
    });

    app.delete('/booking/:id', (req, res) => {
      res.json({ deleted: req.params.id });
    });

    app.get('/correct-status-json', (req, res) => {
      res.status(201).json({ created: true });
    });

    // WHY: Explicit param lookup replaces req.param() magic search
    app.post('/explicit-params/:line', (req, res) => {
      res.json({
        line: req.params.line,
        search: req.query.search || '',
        coach: req.body?.coach || '',
      });
    });

    app.get('/redirect-demo', (req, res) => {
      // WHY: 'back' removed — read Referer manually
      res.redirect(req.get('referer') || '/fallback');
    });
    app.get('/fallback', (req, res) => res.json({ page: 'fallback' }));

    app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

    const server = app.listen(0, async () => {
      const base = `http://127.0.0.1:${server.address().port}`;

      try {
        const host = await (await fetch(`${base}/hostname-demo`)).json();
        console.log('req.hostname:', host.hostname);
        // Output: req.hostname: 127.0.0.1

        const q = await (await fetch(`${base}/query-demo?line=blue&direction=north`)).json();
        console.log('Simple query:', JSON.stringify(q.query));
        // Output: Simple query: {"line":"blue","direction":"north"}

        const del = await fetch(`${base}/booking/42`, { method: 'DELETE' });
        console.log('DELETE status:', del.status);
        // Output: DELETE status: 200

        const create = await fetch(`${base}/correct-status-json`);
        console.log('res.status(201).json():', create.status);
        // Output: res.status(201).json(): 201

        const param = await (await fetch(`${base}/explicit-params/violet?search=hauz-khas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coach: 'ladies-special' }),
        })).json();
        console.log('Explicit params:', param.line, param.search, param.coach);
        // Output: Explicit params: violet hauz-khas ladies-special

        console.log('\napp.del exists:', typeof app.del);
        // Output: app.del exists: undefined
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('\nBlock 2 closed.\n'); resolve(); });
    });
  });
}


// ════════════════════════════════════════════════════════════════

async function main() {
  await block1_asyncAndPaths();
  await block2_removedAndChanged();

  console.log('=== KEY TAKEAWAYS ===');
  console.log('1. Express 5 auto-catches rejected promises — no more try/catch wrappers.');
  console.log('2. Wildcards must be named: /files/*filepath (returns array).');
  console.log('3. Optional params use braces: /route{/:param}.');
  console.log('4. req.params values are auto-decoded.');
  console.log('5. req.query uses simple parser by default — no nested object support.');
  console.log('6. app.del(), req.param(), res.json(obj,status) are REMOVED.');
  console.log('7. req.host gone — use req.hostname. res.redirect("back") — check Referer manually.');

  process.exit(0);
}

main();
