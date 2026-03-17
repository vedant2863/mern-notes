/** ============================================================
 *  FILE 18: Security Headers — Fortifying Your Express App
 *  WHY: Security headers are the first defense against XSS,
 *  clickjacking, and MIME-sniffing. Understanding each one
 *  lets you configure correctly instead of cargo-culting helmet.
 *  ============================================================ */

// THE CASTLE FORTIFICATIONS
// ──────────────────────────────────────────────────────────────
// Each fortification serves a purpose: the drawbridge (X-Frame)
// prevents embedding, the food taster (nosniff) verifies MIME
// types, the royal decree (CSP) whitelists trusted sources, the
// sealed road (HSTS) forces HTTPS, and the banner remover hides
// which framework built the castle.
// ──────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');

// ============================================================
// BLOCK 1 — Security Headers Middleware
// ============================================================
// 1. X-Content-Type-Options: nosniff — stop MIME guessing
// 2. X-Frame-Options: DENY — prevent clickjacking iframes
// 3. X-XSS-Protection: 0 — disable buggy legacy filter, use CSP
// 4. HSTS — force HTTPS, prevent downgrade attacks
// 5. CSP — whitelist script/style/image sources (strongest XSS defense)
// 6. Referrer-Policy — control URL info leaked on navigation
// 7. Permissions-Policy — disable camera/mic/geo your app doesn't use
// 8. Remove X-Powered-By — hide framework from attackers

function securityHeaders(options = {}) {
  const { frameOptions = 'DENY', noSniff = true, xssProtection = true,
    hsts = null, referrerPolicy = 'strict-origin-when-cross-origin',
    permissionsPolicy = null, csp = null, removePoweredBy = true } = options;

  return (req, res, next) => {
    if (noSniff) res.setHeader('X-Content-Type-Options', 'nosniff');
    if (frameOptions) res.setHeader('X-Frame-Options', frameOptions);
    if (xssProtection) res.setHeader('X-XSS-Protection', '0');

    if (hsts) {
      let val = `max-age=${hsts.maxAge || 31536000}`;
      if (hsts.includeSubDomains) val += '; includeSubDomains';
      if (hsts.preload) val += '; preload';
      res.setHeader('Strict-Transport-Security', val);
    }

    if (csp) res.setHeader('Content-Security-Policy', csp);
    if (referrerPolicy) res.setHeader('Referrer-Policy', referrerPolicy);

    if (permissionsPolicy) {
      const directives = Object.entries(permissionsPolicy)
        .map(([feat, allow]) => `${feat}=(${allow})`).join(', ');
      res.setHeader('Permissions-Policy', directives);
    }

    if (removePoweredBy) res.removeHeader('X-Powered-By');
    next();
  };
}

// ============================================================
// BLOCK 2 — CSP Builder + Per-Route Overrides
// ============================================================

class CSPBuilder {
  constructor() { this.directives = {}; }
  add(directive, ...sources) { this.directives[directive] = sources; return this; }
  defaultSrc(...s) { return this.add('default-src', ...s); }
  scriptSrc(...s)  { return this.add('script-src', ...s); }
  styleSrc(...s)   { return this.add('style-src', ...s); }
  imgSrc(...s)     { return this.add('img-src', ...s); }
  fontSrc(...s)    { return this.add('font-src', ...s); }
  connectSrc(...s) { return this.add('connect-src', ...s); }
  frameSrc(...s)   { return this.add('frame-src', ...s); }
  objectSrc(...s)  { return this.add('object-src', ...s); }
  baseUri(...s)    { return this.add('base-uri', ...s); }
  formAction(...s) { return this.add('form-action', ...s); }
  build() { return Object.entries(this.directives).map(([d, s]) => `${d} ${s.join(' ')}`).join('; '); }
}

// Per-route overrides: apply just before response is sent
function overrideHeaders(headerOverrides) {
  return (req, res, next) => {
    const originalEnd = res.end.bind(res);
    res.end = function (...args) {
      for (const [header, value] of Object.entries(headerOverrides)) {
        if (value === null) res.removeHeader(header); else res.setHeader(header, value);
      }
      return originalEnd(...args);
    };
    next();
  };
}

// ============================================================
// SELF-TEST
// ============================================================
async function runTests() {
  const app = express();
  app.disable('x-powered-by');

  const cspPolicy = new CSPBuilder()
    .defaultSrc("'self'")
    .scriptSrc("'self'", 'https://cdn.example.com')
    .styleSrc("'self'", "'unsafe-inline'")
    .imgSrc("'self'", 'data:', 'https:')
    .connectSrc("'self'", 'https://api.example.com')
    .frameSrc("'none'").objectSrc("'none'")
    .baseUri("'self'").formAction("'self'")
    .build();

  app.use(securityHeaders({
    frameOptions: 'DENY', noSniff: true, xssProtection: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: { camera: '', microphone: '', geolocation: 'self' },
    csp: cspPolicy, removePoweredBy: true
  }));

  // Standard page — all headers
  app.get('/page', (req, res) => res.json({ page: 'standard' }));

  // API — relaxed frame, no CSP (returns JSON, not HTML)
  app.get('/api/data',
    overrideHeaders({ 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': null }),
    (req, res) => res.json({ api: true })
  );

  // Widget — embeddable, custom CSP
  app.get('/widget',
    overrideHeaders({
      'X-Frame-Options': null,
      'Content-Security-Policy': new CSPBuilder().defaultSrc("'self'").scriptSrc("'self'").styleSrc("'self'", "'unsafe-inline'").build()
    }),
    (req, res) => res.json({ widget: true })
  );

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    console.log(`Castle Fortifications on port ${port}\n`);

    try {
      // ── Test 1: All security headers ───────────────────────
      console.log('--- Test 1: Standard Page ---');
      const r1 = await makeRequest(`${base}/page`);
      console.log('nosniff:', r1.headers['x-content-type-options']);          // Output: nosniff
      console.log('X-Frame-Options:', r1.headers['x-frame-options']);        // Output: DENY
      console.log('XSS-Protection:', r1.headers['x-xss-protection']);        // Output: 0
      console.log('HSTS:', r1.headers['strict-transport-security']);
      console.log('Referrer:', r1.headers['referrer-policy']);
      console.log('Permissions:', r1.headers['permissions-policy']);
      console.log('X-Powered-By:', r1.headers['x-powered-by']);              // Output: undefined
      console.log();

      // ── Test 2: CSP content ────────────────────────────────
      console.log('--- Test 2: CSP ---');
      const csp = r1.headers['content-security-policy'];
      console.log('Has default-src:', csp.includes("default-src 'self'"));   // Output: true
      console.log('Blocks objects:', csp.includes("object-src 'none'"));     // Output: true
      console.log();

      // ── Test 3: API route — relaxed ────────────────────────
      console.log('--- Test 3: API Route ---');
      const r3 = await makeRequest(`${base}/api/data`);
      console.log('X-Frame-Options:', r3.headers['x-frame-options']);        // Output: SAMEORIGIN
      console.log('CSP present:', r3.headers['content-security-policy'] !== undefined); // Output: false
      console.log();

      // ── Test 4: Widget — no frame restriction ──────────────
      console.log('--- Test 4: Widget ---');
      const r4 = await makeRequest(`${base}/widget`);
      console.log('X-Frame-Options:', r4.headers['x-frame-options']);        // Output: undefined
      console.log('Custom CSP:', r4.headers['content-security-policy']);
      console.log('Still has HSTS:', r4.headers['strict-transport-security'] !== undefined); // Output: true

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close(() => {
        console.log('\nServer closed.\n');
        console.log('KEY TAKEAWAYS:');
        console.log('1. nosniff stops MIME-type guessing (script injection via uploads).');
        console.log('2. X-Frame-Options: DENY blocks clickjacking.');
        console.log('3. X-XSS-Protection: "0" — legacy filter has bypasses. Use CSP.');
        console.log('4. HSTS prevents HTTPS downgrade attacks.');
        console.log('5. CSP is the strongest XSS defense — whitelist trusted sources.');
        console.log('6. Referrer-Policy controls URL info leaked on navigation.');
        console.log('7. Permissions-Policy disables unused browser features.');
        console.log('8. Remove X-Powered-By — free recon denial.');
        console.log('9. Use per-route overrides for APIs and embeddable widgets.');
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
