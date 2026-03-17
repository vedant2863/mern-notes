/** ============================================================
 *  FILE 09 — Error Handling in Express 5
 *  Error middleware, sync/async errors, custom error classes,
 *  404 handlers. Express 5 auto-catches async errors!
 *  ============================================================ */

// ─── STORY: AIIMS Emergency Ward ──────────────────────────────
// Dr. Mehra's triage nurse (error middleware) examines every
// case, classifies severity, and sends the right response.
// No patient leaves without being seen.

const express = require('express');
const http = require('http');

// ─── Helper — HTTP request
function request(port, method, urlPath, { body, headers } = {}) {
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
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function simulateDbCall(succeed) {
  return new Promise((resolve, reject) => {
    setTimeout(() => succeed ? resolve({ patient: 'stable', vitals: 'normal' }) : reject(new Error('DB connection failed')), 10);
  });
}

// =============================================================
// BLOCK 1 — Sync Errors, Async Errors, next(err)
// =============================================================
// Express 5 BIG CHANGE: Both sync throws AND rejected promises
// are automatically caught. No more manual wrappers!

async function block1() {
  console.log('=== BLOCK 1: Sync Errors, Async Errors, next(err) ===\n');
  const app = express();

  // Sync throw — Express 5 catches this (would crash in v4!)
  app.get('/sync-error', (req, res) => {
    throw new Error('Sync collapse in the corridor');
  });

  // Async error — Express 5 catches rejected promises
  app.get('/async-error', async (req, res) => {
    await simulateDbCall(false);
  });

  // Explicit next(err) — works in all versions
  app.get('/next-error', (req, res, next) => {
    const err = new Error('Patient referred to specialist');
    err.status = 503;
    next(err);
  });

  // Happy path for contrast
  app.get('/async-success', async (req, res) => {
    res.json(await simulateDbCall(true));
  });

  // Error middleware — identified by its 4 parameters
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, status });
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  Emergency ward on port ${port}\n`);

  const r1 = await request(port, 'GET', '/sync-error');
  console.log('  sync throw:', r1.status, r1.body.error);

  const r2 = await request(port, 'GET', '/async-error');
  console.log('  async reject:', r2.status, r2.body.error);

  const r3 = await request(port, 'GET', '/next-error');
  console.log('  next(err):', r3.status, r3.body.error);

  const r4 = await request(port, 'GET', '/async-success');
  console.log('  happy path:', r4.status, r4.body);
  console.log();
  server.close();
}

// =============================================================
// BLOCK 2 — Custom Error Classes
// =============================================================

class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = true;  // Expected error, not a bug
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} '${id}' not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(fields) {
    super('Validation failed', 422, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

async function block2() {
  console.log('=== BLOCK 2: Custom Error Classes ===\n');
  const app = express();
  app.use(express.json());

  app.get('/patients/:id', (req, res) => {
    if (!['1', '2'].includes(req.params.id)) throw new NotFoundError('Patient', req.params.id);
    res.json({ id: req.params.id, name: 'Patient ' + req.params.id });
  });

  app.post('/patients', (req, res) => {
    const errors = {};
    if (!req.body.name) errors.name = 'required';
    if (!req.body.age) errors.age = 'required';
    if (Object.keys(errors).length) throw new ValidationError(errors);
    res.status(201).json({ created: req.body });
  });

  // Unexpected error (programmer bug)
  app.get('/unexpected', (req, res) => {
    null.property;  // TypeError
  });

  // Error middleware — classifies operational vs unexpected
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      const resp = { error: { message: err.message, code: err.code, status: err.status } };
      if (err instanceof ValidationError) resp.error.fields = err.fields;
      return res.status(err.status).json(resp);
    }
    // Unexpected: don't leak internals
    res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  Specialized wards on port ${port}\n`);

  const r1 = await request(port, 'GET', '/patients/99');
  console.log('  NotFound:', r1.status, r1.body.error.code);

  const r2 = await request(port, 'POST', '/patients', { body: {} });
  console.log('  Validation:', r2.status, r2.body.error.fields);

  const r3 = await request(port, 'GET', '/unexpected');
  console.log('  Bug:', r3.status, r3.body.error.message);
  console.log();
  server.close();
}

// =============================================================
// BLOCK 3 — 404 Handler + Chained Error Middleware
// =============================================================

async function block3() {
  console.log('=== BLOCK 3: 404 Handler, Error Pipeline ===\n');
  const errorLog = [];
  const app = express();

  app.get('/api/status', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/fail', (req, res) => { throw new AppError('Maintenance', 503, 'MAINTENANCE'); });

  // 404 handler — AFTER all routes, BEFORE error middleware
  app.use((req, res, next) => {
    next(new AppError(`Not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  });

  // Error handler 1: Logger — then pass along
  app.use((err, req, res, next) => {
    errorLog.push({ status: err.status || 500, url: req.originalUrl });
    next(err);
  });

  // Error handler 2: Responder
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
      error: {
        message: err.isOperational ? err.message : 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
      },
    });
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  Full pipeline on port ${port}\n`);

  const r1 = await request(port, 'GET', '/api/status');
  console.log('  normal:', r1.status, r1.body);

  const r2 = await request(port, 'GET', '/api/nonexistent');
  console.log('  404:', r2.status, r2.body.error.code);

  const r3 = await request(port, 'GET', '/api/fail');
  console.log('  503:', r3.status, r3.body.error.message);

  console.log('  errors logged:', errorLog.length);
  console.log();
  server.close();
}

// =============================================================
// RUN ALL BLOCKS
// =============================================================
async function main() {
  await block1();
  await block2();
  await block3();

  console.log('=== KEY TAKEAWAYS ===\n');
  console.log('  1. Error middleware needs FOUR params: (err, req, res, next).');
  console.log('  2. Express 5 auto-catches sync throws AND rejected promises.');
  console.log('  3. next(err) skips to error middleware, bypassing normal handlers.');
  console.log('  4. Custom error classes carry status, code, and details.');
  console.log('  5. isOperational distinguishes expected errors from bugs.');
  console.log('  6. 404 handler is regular middleware AFTER routes — creates error + next(err).');
  console.log('  7. Chain error handlers: logger -> responder, each calling next(err).\n');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
