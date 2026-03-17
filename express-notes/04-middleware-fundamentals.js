/** ============================================================
 *  FILE 4: Middleware Fundamentals — The Heart of Express
 *  Middleware is Express's core abstraction. Every request
 *  passes through a pipeline of functions. Routing, parsing,
 *  auth, logging — they are ALL middleware.
 *  ============================================================ */

// ─── Delhi Metro Security Checkpoints ─────────────────────────
// Each checkpoint can inspect/modify (req, res), pass to the
// next checkpoint (next()), or stop and respond. ORDER MATTERS.

const express = require('express');

// ════════════════════════════════════════════════════════════════
// BLOCK 1 — Logger and Request Counter Middleware
// ════════════════════════════════════════════════════════════════

function block1_basicMiddleware() {
  return new Promise((resolve) => {
    const app = express();
    const logs = [];
    let requestCount = 0;

    // ─── Middleware #1: Logger — runs on ALL routes ────────────
    app.use((req, res, next) => {
      logs.push(`${req.method} ${req.url}`);
      next();    // Without next(), the request hangs forever.
    });

    // ─── Middleware #2: Counter ────────────────────────────────
    app.use((req, res, next) => {
      requestCount++;
      req.requestNumber = requestCount;
      next();
    });

    app.get('/lines', (req, res) => {
      res.json({ lines: ['Blue Line', 'Yellow Line'], requestNumber: req.requestNumber });
    });

    app.get('/stats', (req, res) => {
      res.json({ totalRequests: requestCount, logs });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 1: Logger, Counter Middleware ===');
      console.log(`Server running on port ${port}\n`);

      try {
        const d1 = await (await fetch(`${base}/lines`)).json();
        console.log('GET /lines:', JSON.stringify(d1));
        // Output: GET /lines: {"lines":["Blue Line","Yellow Line"],"requestNumber":1}

        const d2 = await (await fetch(`${base}/stats`)).json();
        console.log('GET /stats:', JSON.stringify(d2));
        // Output: GET /stats: {"totalRequests":2,"logs":["GET /lines","GET /stats"]}
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
// BLOCK 2 — Auth Middleware, Route-Level Middleware
// ════════════════════════════════════════════════════════════════

function block2_authAndConditional() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());

    // ─── Auth middleware — stops pipeline if invalid ───────────
    function authMiddleware(req, res, next) {
      const token = req.headers['x-auth-token'];
      if (!token) return res.status(401).json({ error: 'No token provided' });
      if (token !== 'secret-123') return res.status(403).json({ error: 'Invalid token' });
      req.user = { id: 1, name: 'Inspector Sharma', role: 'admin' };
      next();
    }

    // ─── Middleware factory — returns configured middleware ────
    function requireRole(role) {
      return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
          return res.status(403).json({ error: `Role '${role}' required` });
        }
        next();
      };
    }

    app.get('/public', (req, res) => {
      res.json({ message: 'This is public — no auth required' });
    });

    // Route-level middleware — only runs for this route
    app.get('/profile', authMiddleware, (req, res) => {
      res.json({ user: req.user });
    });

    // Multiple middleware stacked on one route
    app.get('/admin', authMiddleware, requireRole('admin'), (req, res) => {
      res.json({ message: 'Welcome to the admin panel', user: req.user });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 2: Auth, Route-Level Middleware ===');
      console.log(`Server running on port ${port}\n`);

      try {
        console.log('GET /public:', JSON.stringify(await (await fetch(`${base}/public`)).json()));

        const noToken = await fetch(`${base}/profile`);
        console.log('GET /profile (no token):', noToken.status, JSON.stringify(await noToken.json()));
        // Output: GET /profile (no token): 401 {"error":"No token provided"}

        const good = await fetch(`${base}/profile`, { headers: { 'x-auth-token': 'secret-123' } });
        console.log('GET /profile (valid):', JSON.stringify(await good.json()));
        // Output: GET /profile (valid): {"user":{"id":1,"name":"Inspector Sharma","role":"admin"}}

        const admin = await fetch(`${base}/admin`, { headers: { 'x-auth-token': 'secret-123' } });
        console.log('GET /admin (valid admin):', JSON.stringify(await admin.json()));
      } catch (err) {
        console.error('Test error:', err.message);
      }

      server.close(() => {
        console.log('\nBlock 2 server closed.\n');
        resolve();
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// BLOCK 3 — next('route') and Middleware Factories
// ════════════════════════════════════════════════════════════════

// next('route') skips remaining handlers for the CURRENT route
// and jumps to the NEXT matching route definition.

function block3_nextRouteAndFactories() {
  return new Promise((resolve) => {
    const app = express();

    // ─── Middleware factory — rate limiter ─────────────────────
    function rateLimit(maxRequests) {
      let count = 0;
      // Closure captures `count` — each rateLimit() call gets its own.
      return (req, res, next) => {
        if (++count > maxRequests) {
          return res.status(429).json({ error: 'Too many requests', limit: maxRequests });
        }
        next();
      };
    }

    // ─── Demo: next('route') ──────────────────────────────────
    app.get('/entry',
      (req, res, next) => {
        if (req.headers['x-metro-pass'] === 'true') return next('route');
        next();
      },
      (req, res) => {
        res.json({ lane: 'regular', message: 'Standard entry via token' });
      }
    );

    // Second route definition — pass holders land here
    app.get('/entry', (req, res) => {
      res.json({ lane: 'metro-pass', message: 'Priority entry!' });
    });

    // ─── Rate limiter demo ────────────────────────────────────
    app.get('/limited', rateLimit(2), (req, res) => {
      res.json({ message: 'Request allowed' });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 3: next(\'route\'), Factories ===');
      console.log(`Server running on port ${port}\n`);

      try {
        const reg = await (await fetch(`${base}/entry`)).json();
        console.log('GET /entry (regular):', JSON.stringify(reg));

        const pass = await (await fetch(`${base}/entry`, { headers: { 'x-metro-pass': 'true' } })).json();
        console.log('GET /entry (metro pass):', JSON.stringify(pass));

        for (let i = 1; i <= 3; i++) {
          const r = await fetch(`${base}/limited`);
          console.log(`  Attempt ${i}: ${r.status} ${JSON.stringify(await r.json())}`);
        }
        // Attempt 1: 200, Attempt 2: 200, Attempt 3: 429
      } catch (err) {
        console.error('Test error:', err.message);
      }

      server.close(() => {
        console.log('\nBlock 3 server closed.');
        resolve();
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// Run all blocks sequentially, then exit
// ════════════════════════════════════════════════════════════════

async function main() {
  await block1_basicMiddleware();
  await block2_authAndConditional();
  await block3_nextRouteAndFactories();

  console.log('\n=== KEY TAKEAWAYS ===');
  console.log('1. Middleware is any function with (req, res, next) — Express\'s core pattern.');
  console.log('2. app.use() mounts global middleware; inline args mount route-level.');
  console.log('3. next() passes control forward; without it the request hangs.');
  console.log('4. next(\'route\') skips to the next matching route definition.');
  console.log('5. Middleware factories (functions returning middleware) let you parameterise.');
  console.log('6. Auth pattern: check credentials -> reject or attach user -> next().');

  process.exit(0);
}

main();
