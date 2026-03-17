/** ============================================================
 *  FILE 21: App Settings — Configure Express Behavior
 *  ============================================================ */

// STORY: Commissioner Meena's Nagar Nigam office has switches
// and dials that control city services. Express's app.set() is
// your control panel — each setting changes framework behavior.

const express = require('express');


// ════════════════════════════════════════════════════════════════
// BLOCK 1 — App Settings Demo
// ════════════════════════════════════════════════════════════════
//
//  Setting              Default     What it does
//  ──────────────────── ─────────── ────────────────────────────
//  env                  NODE_ENV    'development' or 'production'
//  etag                 'weak'      ETag generation for caching
//  query parser         'simple'    URL query string parser
//  strict routing       false       /foo and /foo/ are same
//  case sensitive routing false     /Foo and /foo are same
//  json spaces          undefined   Pretty-print JSON responses
//  trust proxy          false       Trust X-Forwarded-* headers
//  x-powered-by         true        Send X-Powered-By header

function block1_appSettings() {
  return new Promise((resolve) => {
    const app = express();
    console.log('=== BLOCK 1: App Settings ===\n');

    // WHY: Set routing options BEFORE any route definitions.
    // Express 5 compiles routes at registration time.
    app.set('json spaces', 2);
    app.enable('strict routing');
    app.enable('case sensitive routing');
    app.disable('x-powered-by');
    app.disable('etag');
    app.set('trust proxy', 'loopback');

    app.use(express.json());

    // JSON spaces test
    app.get('/api/config', (req, res) => {
      res.json({ name: 'NagarNigam', version: 3 });
    });

    // Strict routing — /strict and /strict/ are different
    app.get('/strict', (req, res) => res.json({ trailing: false }));
    app.get('/strict/', (req, res) => res.json({ trailing: true }));

    // Case sensitive — /CasePath vs /casepath
    app.get('/CasePath', (req, res) => res.json({ matched: true }));

    // Trust proxy — show real client IP
    app.get('/my-ip', (req, res) => res.json({ ip: req.ip }));

    const server = app.listen(0, async () => {
      const base = `http://127.0.0.1:${server.address().port}`;

      try {
        // Pretty-printed JSON
        const configText = await (await fetch(`${base}/api/config`)).text();
        console.log('Pretty-printed:\n' + configText);
        // Output: { "name": "NagarNigam", "version": 3 }

        // x-powered-by disabled
        const configRes = await fetch(`${base}/api/config`);
        console.log('X-Powered-By:', configRes.headers.get('x-powered-by'));
        // Output: X-Powered-By: null

        // Strict routing
        const strict1 = await (await fetch(`${base}/strict`)).json();
        const strict2 = await (await fetch(`${base}/strict/`)).json();
        console.log('/strict:', strict1.trailing, '| /strict/:', strict2.trailing);
        // Output: /strict: false | /strict/: true

        // Case sensitive routing
        console.log('/CasePath:', (await fetch(`${base}/CasePath`)).status);
        // Output: /CasePath: 200
        console.log('/casepath:', (await fetch(`${base}/casepath`)).status);
        // Output: /casepath: 404

        // Trust proxy
        const ipRes = await fetch(`${base}/my-ip`, {
          headers: { 'X-Forwarded-For': '203.0.113.50' },
        });
        console.log('req.ip:', (await ipRes.json()).ip);
        // Output: req.ip: 203.0.113.50
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('\nBlock 1 closed.\n'); resolve(); });
    });
  });
}


// ════════════════════════════════════════════════════════════════
// BLOCK 2 — app.locals, res.locals, Sub-App Mounting
// ════════════════════════════════════════════════════════════════
// app.locals = persistent app-wide data (config, version)
// res.locals = per-request data (user info, request ID)

function block2_localsAndMounting() {
  return new Promise((resolve) => {
    const app = express();

    app.locals.appName = 'NagarNigam';
    app.locals.version = '2.5.0';

    // WHY: res.locals is scoped to a single request — never leaks
    app.use((req, res, next) => {
      res.locals.requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      next();
    });

    app.get('/status', (req, res) => {
      res.json({
        app: { name: req.app.locals.appName, version: req.app.locals.version },
        requestId: res.locals.requestId,
      });
    });

    // WHY: res.locals accumulates data through middleware chain
    app.get('/profile',
      (req, res, next) => { res.locals.user = { id: 42, name: 'Meena', role: 'commissioner' }; next(); },
      (req, res, next) => {
        res.locals.permissions = res.locals.user.role === 'commissioner'
          ? ['read', 'write', 'admin'] : ['read'];
        next();
      },
      (req, res) => res.json({ user: res.locals.user, permissions: res.locals.permissions })
    );

    // WHY: Sub-apps are full Express instances with own settings and locals
    const taxApp = express();
    taxApp.locals.section = 'tax';
    taxApp.get('/dashboard', (req, res) => {
      res.json({
        section: req.app.locals.section,
        mountpath: req.app.mountpath,
        parentApp: req.app.parent ? req.app.parent.locals.appName : 'none',
      });
    });

    console.log('=== BLOCK 2: app.locals, res.locals, Sub-App ===\n');
    app.use('/tax', taxApp);

    const server = app.listen(0, async () => {
      const base = `http://127.0.0.1:${server.address().port}`;

      try {
        const status = await (await fetch(`${base}/status`)).json();
        console.log('app.name:', status.app.name, '| requestId:', status.requestId.slice(0, 8) + '...');
        // Output: app.name: NagarNigam | requestId: req-XXXX...

        const profile = await (await fetch(`${base}/profile`)).json();
        console.log('permissions:', JSON.stringify(profile.permissions));
        // Output: permissions: ["read","write","admin"]

        // Per-request isolation
        const [r1, r2] = await Promise.all([
          fetch(`${base}/status`).then(r => r.json()),
          fetch(`${base}/status`).then(r => r.json()),
        ]);
        console.log('IDs different:', r1.requestId !== r2.requestId);
        // Output: IDs different: true

        // Sub-app
        const dash = await (await fetch(`${base}/tax/dashboard`)).json();
        console.log('Sub-app mountpath:', dash.mountpath, '| parent:', dash.parentApp);
        // Output: Sub-app mountpath: /tax | parent: NagarNigam
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('\nBlock 2 closed.\n'); resolve(); });
    });
  });
}


// ════════════════════════════════════════════════════════════════
// Run blocks
// ════════════════════════════════════════════════════════════════

async function main() {
  await block1_appSettings();
  await block2_localsAndMounting();

  console.log('=== KEY TAKEAWAYS ===');
  console.log('1. app.set()/app.get() control Express behavior; app.enable()/disable() for booleans.');
  console.log('2. "trust proxy" is REQUIRED behind reverse proxies for correct req.ip.');
  console.log('3. "strict routing" and "case sensitive routing" change URL matching.');
  console.log('4. Disable "x-powered-by" in production to hide your tech stack.');
  console.log('5. app.locals persist for app lifetime — use for config and constants.');
  console.log('6. res.locals are per-request — use for user data, request IDs, timing.');
  console.log('7. Sub-apps have own locals and settings, mounted at a path prefix.');

  process.exit(0);
}

main();
