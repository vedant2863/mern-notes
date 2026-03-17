/** ============================================================
 *  FILE 17: CORS From Scratch — Cross-Origin Requests
 *  WHY: CORS errors are the most common issue devs face.
 *  Understanding the headers lets you debug instantly.
 *  ============================================================ */

// THE EMBASSY VISA COUNTER
// ──────────────────────────────────────────────────────────────
// Each nation (origin = protocol + hostname + port) has its own
// domain. By default, citizens of one nation cannot access another
// (Same-Origin Policy). CORS is the visa system: the server stamps
// permission headers. For dangerous requests, a preflight check
// (OPTIONS) happens first — the visa interview.
// ──────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');

// SIMPLE requests (no preflight): GET/HEAD/POST with basic headers.
// PREFLIGHTED: PUT/DELETE/PATCH, custom headers, JSON content-type
// — browser sends OPTIONS first asking "is this OK?"

// ============================================================
// BLOCK 1 — Basic CORS (Allow All + Allow Specific)
// ============================================================

function corsAllowAll() {
  return (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}

function corsAllowSpecific(allowedOrigins) {
  const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
  return (req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && origins.includes(requestOrigin)) {
      // Echo back exact origin (not "*") and set Vary for CDN correctness
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    }
    // If not in list, no header = browser blocks response
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}

// ============================================================
// BLOCK 2 — Full CORS: Credentials, Expose Headers, Max-Age
// ============================================================

function corsMiddleware(options = {}) {
  const { origin = '*', methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders = ['Content-Type', 'Authorization'], exposedHeaders = [],
    credentials = false, maxAge = null } = options;

  function resolveOrigin(requestOrigin) {
    if (origin === '*') return '*';
    if (typeof origin === 'function') return origin(requestOrigin) ? requestOrigin : false;
    const list = Array.isArray(origin) ? origin : [origin];
    return list.includes(requestOrigin) ? requestOrigin : false;
  }

  return (req, res, next) => {
    const allowed = resolveOrigin(req.headers.origin);
    if (allowed && allowed !== false) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      if (allowed !== '*') res.setHeader('Vary', 'Origin');
    }
    // credentials: true + origin: "*" is REJECTED by browsers — must echo specific origin
    if (credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (exposedHeaders.length > 0) res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      if (maxAge !== null) res.setHeader('Access-Control-Max-Age', String(maxAge));
      return res.status(204).end();
    }
    next();
  };
}

// ============================================================
// SELF-TEST
// ============================================================
async function runTests() {
  const app = express();

  app.use('/open', corsAllowAll());
  app.get('/open/data', (req, res) => res.json({ zone: 'open' }));

  app.use('/restricted', corsAllowSpecific(['http://trusted-app.in', 'http://partner-site.gov.in']));
  app.get('/restricted/data', (req, res) => res.json({ zone: 'restricted' }));

  app.use('/full', corsMiddleware({
    origin: (o) => ['http://app.india.gov.in', 'http://admin.india.gov.in'].includes(o),
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
    credentials: true, maxAge: 86400
  }));
  app.get('/full/data', (req, res) => {
    res.setHeader('X-Total-Count', '42');
    res.json({ zone: 'full' });
  });

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    console.log(`Embassy Visa Counter on port ${port}\n`);

    try {
      // ── Test 1: Open CORS ──────────────────────────────────
      console.log('--- Test 1: Open CORS ---');
      const r1 = await makeRequest(`${base}/open/data`, 'GET', { Origin: 'http://random.com' });
      console.log('Allow-Origin:', r1.headers['access-control-allow-origin']); // Output: *
      console.log();

      // ── Test 2: Specific origin (trusted) ──────────────────
      console.log('--- Test 2: Trusted Origin ---');
      const r2 = await makeRequest(`${base}/restricted/data`, 'GET', { Origin: 'http://trusted-app.in' });
      console.log('Allow-Origin:', r2.headers['access-control-allow-origin']); // Output: http://trusted-app.in
      console.log('Vary:', r2.headers['vary']); // Output: Origin
      console.log();

      // ── Test 3: Untrusted origin — no header ───────────────
      console.log('--- Test 3: Untrusted Origin ---');
      const r3 = await makeRequest(`${base}/restricted/data`, 'GET', { Origin: 'http://evil.com' });
      console.log('Allow-Origin:', r3.headers['access-control-allow-origin']); // Output: undefined
      // CORS is enforced by BROWSERS. Server still returns 200.
      console.log();

      // ── Test 4: Preflight OPTIONS ──────────────────────────
      console.log('--- Test 4: Preflight ---');
      const r4 = await makeRequest(`${base}/open/data`, 'OPTIONS', {
        Origin: 'http://anywhere.com', 'Access-Control-Request-Method': 'PUT'
      });
      console.log('Status:', r4.status); // Output: 204
      console.log('Allow-Methods:', r4.headers['access-control-allow-methods']);
      console.log();

      // ── Test 5: Full CORS with credentials ─────────────────
      console.log('--- Test 5: Credentials + Expose Headers ---');
      const r5 = await makeRequest(`${base}/full/data`, 'GET', { Origin: 'http://app.india.gov.in' });
      console.log('Allow-Credentials:', r5.headers['access-control-allow-credentials']); // Output: true
      console.log('Expose-Headers:', r5.headers['access-control-expose-headers']);
      console.log('X-Total-Count:', r5.headers['x-total-count']); // Output: 42
      console.log();

      // ── Test 6: Preflight with Max-Age ─────────────────────
      console.log('--- Test 6: Preflight Max-Age ---');
      const r6 = await makeRequest(`${base}/full/data`, 'OPTIONS', {
        Origin: 'http://admin.india.gov.in', 'Access-Control-Request-Method': 'PUT'
      });
      console.log('Max-Age:', r6.headers['access-control-max-age']); // Output: 86400

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close(() => {
        console.log('\nServer closed.\n');
        console.log('KEY TAKEAWAYS:');
        console.log('1. CORS is enforced by BROWSERS, not servers.');
        console.log('2. Allow-Origin must match exactly, or be "*".');
        console.log('3. With credentials, origin CANNOT be "*" — echo specific origin.');
        console.log('4. Preflight (OPTIONS) happens for non-simple requests.');
        console.log('5. Max-Age caches preflight to avoid doubling requests.');
        console.log('6. Expose-Headers controls which response headers JS can read.');
        console.log('7. Always set "Vary: Origin" when reflecting specific origins.');
      });
    }
  });
}

function makeRequest(url, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const raw = Buffer.concat(chunks).toString(); let p; try { p = JSON.parse(raw); } catch { p = raw; } resolve({ status: res.statusCode, headers: res.headers, body: p }); });
    });
    req.on('error', reject);
    req.end();
  });
}

runTests();
