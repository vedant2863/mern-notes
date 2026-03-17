/** ============================================================
 *  FILE 26: Railway Signal Cabin — Middleware Pipeline Project
 *  ============================================================ */

// STORY: Mughalsarai Junction needed LAYERS — CORS, rate limiter,
// auth, validation, logger — seven interlocking levers in the
// signal cabin. This file builds every lever from raw code.

const express = require('express');
const crypto = require('crypto');
const zlib = require('zlib');
const { Buffer } = require('buffer');


// ════════════════════════════════════════════════════════════════
// SECTION 1 — Security Headers (what helmet does)
// ════════════════════════════════════════════════════════════════

function securityHeaders() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.removeHeader('X-Powered-By');
    next();
  };
}


// ════════════════════════════════════════════════════════════════
// SECTION 2 — CORS from Scratch
// ════════════════════════════════════════════════════════════════

function corsMiddleware(options = {}) {
  const { allowedOrigins = ['*'], allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'], maxAge = 86400, credentials = false } = options;

  return (req, res, next) => {
    const origin = req.headers.origin;
    const allow = allowedOrigins.includes('*') ? '*' : (origin && allowedOrigins.includes(origin) ? origin : '');
    if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Vary', 'Origin');
    if (credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');

    // WHY: Browsers send OPTIONS before PUT/DELETE to ask "is this allowed?"
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', String(maxAge));
      return res.status(204).end();
    }
    next();
  };
}


// ════════════════════════════════════════════════════════════════
// SECTION 3 — Rate Limiter
// ════════════════════════════════════════════════════════════════

function rateLimiter(options = {}) {
  const { windowMs = 60000, maxRequests = 100 } = options;
  const clients = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, d] of clients) { if (d.resetTime <= now) clients.delete(ip); }
  }, windowMs);
  if (cleanup.unref) cleanup.unref();

  function middleware(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let d = clients.get(ip);
    if (!d || d.resetTime <= now) { d = { count: 0, resetTime: now + windowMs }; clients.set(ip, d); }
    d.count++;
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - d.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(d.resetTime / 1000)));

    if (d.count > maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((d.resetTime - now) / 1000)));
      return res.status(429).json({ success: false, error: 'Too many requests.', retryAfter: Math.ceil((d.resetTime - now) / 1000) });
    }
    next();
  }
  middleware.cleanup = () => clearInterval(cleanup);
  return middleware;
}


// ════════════════════════════════════════════════════════════════
// SECTION 4 — Request Logger
// ════════════════════════════════════════════════════════════════

function requestLogger() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    res.on('finish', () => {
      const ms = (Number(process.hrtime.bigint() - start) / 1e6).toFixed(2);
      req.app.locals.requestLogs = req.app.locals.requestLogs || [];
      req.app.locals.requestLogs.push(`[${requestId.slice(0, 8)}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  };
}


// ════════════════════════════════════════════════════════════════
// SECTION 5 — Schema Validation
// ════════════════════════════════════════════════════════════════

function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const v = req.body[field];
      if (rules.required && (v === undefined || v === null || v === '')) { errors.push(`${field} is required`); continue; }
      if (v === undefined) continue;
      if (rules.type === 'string' && typeof v !== 'string') errors.push(`${field} must be a string`);
      if (rules.minLength && typeof v === 'string' && v.length < rules.minLength) errors.push(`${field} min ${rules.minLength} chars`);
      if (rules.pattern && typeof v === 'string' && !rules.pattern.test(v)) errors.push(`${field} format is invalid`);
    }
    if (errors.length) return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    next();
  };
}


// ════════════════════════════════════════════════════════════════
// SECTION 6 — Compression
// ════════════════════════════════════════════════════════════════

function compressionMiddleware() {
  return (req, res, next) => {
    if (!(req.headers['accept-encoding'] || '').includes('gzip')) return next();
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const raw = JSON.stringify(body);
      if (raw.length < 1024) return originalJson(body);
      const compressed = zlib.gzipSync(Buffer.from(raw));
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Length', compressed.length);
      return res.end(compressed);
    };
    next();
  };
}


// ════════════════════════════════════════════════════════════════
// SECTION 7 — 404 & Error Handler
// ════════════════════════════════════════════════════════════════

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: `Cannot ${req.method} ${req.path}`, hint: 'Check URL and method' });
}

function errorHandler(err, req, res, next) {
  res.status(err.statusCode || 500).json({ success: false, error: err.expose ? err.message : 'Internal Server Error' });
}


// ════════════════════════════════════════════════════════════════
// SECTION 8 — App Assembly (ORDER MATTERS)
// ════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();

  // WHY: Security first, error handler last
  app.use(securityHeaders());
  app.use(corsMiddleware({ allowedOrigins: ['http://localhost:3000', 'http://indianrailways.gov.in'], credentials: true }));
  const limiter = rateLimiter({ windowMs: 60000, maxRequests: 100 });
  app.use(limiter);
  app.use(requestLogger());
  app.use(express.json({ limit: '10kb' }));
  app.use(compressionMiddleware());

  app.get('/health', (req, res) => res.json({ success: true, data: { status: 'healthy' } }));
  app.get('/api/info', (req, res) => res.json({ success: true, data: { name: 'Railway Signal Cabin API' } }));

  const grievanceSchema = {
    name: { required: true, type: 'string', minLength: 2 },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    message: { required: true, type: 'string', minLength: 10 },
  };
  app.post('/api/grievance', validate(grievanceSchema), (req, res) => {
    res.status(201).json({ success: true, data: { id: crypto.randomUUID(), ...req.body, receivedAt: new Date().toISOString() } });
  });

  app.get('/api/error', (req, res) => { const e = new Error('Test error'); e.statusCode = 500; e.expose = true; throw e; });

  app.get('/api/large', (req, res) => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, name: `Coach ${i + 1}`, desc: `Description for coach ${i + 1} in the Rajdhani Express.` }));
    res.json({ success: true, data: items, count: items.length });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  app.locals.limiter = limiter;
  return app;
}


// ════════════════════════════════════════════════════════════════
// SECTION 9 — Self-Test Suite
// ════════════════════════════════════════════════════════════════

async function runTests(baseURL) {
  let passed = 0, failed = 0;
  async function test(name, fn) {
    try { await fn(); passed++; console.log(`  [PASS] ${name}`); }
    catch (e) { failed++; console.log(`  [FAIL] ${name} — ${e.message}`); }
  }
  function assert(c, m) { if (!c) throw new Error(m); }
  async function req(method, path, body = null, headers = {}) {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${baseURL}${path}`, opts);
    let data;
    if (r.headers.get('content-encoding') === 'gzip') {
      data = JSON.parse(zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString());
    } else { data = await r.json().catch(() => null); }
    return { status: r.status, body: data, headers: r.headers };
  }

  console.log('\n  Railway Signal Cabin — Tests');
  console.log('  ' + '─'.repeat(40));

  await test('Security headers set', async () => {
    const { headers } = await req('GET', '/health');
    assert(headers.get('x-content-type-options') === 'nosniff', 'Missing nosniff');
    assert(headers.get('x-frame-options') === 'DENY', 'Missing frame');
    assert(headers.get('content-security-policy') === "default-src 'self'", 'Missing CSP');
    assert(!headers.get('x-powered-by'), 'X-Powered-By leaked');
  });

  await test('CORS preflight 204', async () => {
    const r = await fetch(`${baseURL}/api/info`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' },
    });
    assert(r.status === 204 && r.headers.get('access-control-allow-methods'), 'Preflight failed');
  });

  await test('CORS blocks disallowed origin', async () => {
    const r = await fetch(`${baseURL}/health`, { headers: { Origin: 'http://evil.com' } });
    assert(!r.headers.get('access-control-allow-origin'), 'Should not allow evil.com');
  });

  await test('Rate limit headers present', async () => {
    const { headers } = await req('GET', '/health');
    assert(headers.get('x-ratelimit-limit') === '100', 'Missing limit header');
  });

  await test('X-Request-ID generated', async () => {
    const { headers } = await req('GET', '/health');
    assert(headers.get('x-request-id')?.length >= 32, 'Missing request ID');
  });

  await test('Validation passes', async () => {
    const { status } = await req('POST', '/api/grievance', {
      name: 'Sunita', email: 'sunita@rail.in', message: 'Platform 3 needs water arrangement.',
    });
    assert(status === 201, `Expected 201, got ${status}`);
  });

  await test('Validation rejects missing fields', async () => {
    const { status, body } = await req('POST', '/api/grievance', { name: 'Sunita' });
    assert(status === 400 && body.details.length >= 2, 'Should reject');
  });

  await test('Error handler catches thrown', async () => {
    const { status, body } = await req('GET', '/api/error');
    assert(status === 500 && body.error === 'Test error', 'Error not caught');
  });

  await test('404 for unknown routes', async () => {
    const { status, body } = await req('GET', '/nonexistent');
    assert(status === 404 && body.error.includes('Cannot GET'), '404 failed');
  });

  await test('Compression for large responses', async () => {
    const http = require('http');
    const u = new URL(`${baseURL}/api/large`);
    const data = await new Promise((resolve, reject) => {
      const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
        const chunks = []; res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          if (res.headers['content-encoding'] === 'gzip') {
            const full = zlib.gunzipSync(raw);
            resolve({ compressed: true, rawSize: raw.length, fullSize: full.length });
          } else resolve({ compressed: false, rawSize: raw.length, fullSize: raw.length });
        });
      });
      r.on('error', reject); r.end();
    });
    assert(data.compressed && data.rawSize < data.fullSize, 'Not compressed');
  });

  console.log('  ' + '─'.repeat(40));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
}


// ════════════════════════════════════════════════════════════════
// SECTION 10 — Start, Test, Shutdown
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log('FILE 26 — Railway Signal Cabin: Middleware Pipeline');
  const app = createApp();
  const server = app.listen(0, async () => {
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    try { await runTests(baseURL); } catch (e) { console.error(e.message); }
    finally {
      if (app.locals.limiter?.cleanup) app.locals.limiter.cleanup();
      server.close(() => {
        console.log('\n  KEY TAKEAWAYS');
        console.log('  1. Middleware order: security headers first, error handler last.');
        console.log('  2. CORS handles preflight OPTIONS before real requests reach routes.');
        console.log('  3. Rate limiting: 429 Too Many Requests is the standard code.');
        console.log('  4. X-Request-ID traces a request through logs and downstream services.');
        console.log('  5. Schema validation middleware keeps route handlers clean.');
        console.log('  6. Security headers (CSP, HSTS, X-Frame-Options) instruct browser protections.');
        console.log('  7. 404 handler after routes, error handler after 404.');
        process.exit(0);
      });
    }
  });
}

main();
