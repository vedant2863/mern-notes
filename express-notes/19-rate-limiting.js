/** ============================================================
 *  FILE 19: Rate Limiting — Controlling Request Flow From Scratch
 *  ============================================================ */

// STORY: IRCTC can only handle so many tatkal booking requests
// per minute. We build the crowd-control system from scratch —
// fixed window, sliding window, and per-route limits.

const express = require('express');
const http = require('http');


// ============================================================
// BLOCK 1 — Fixed Window Rate Limiter
// ============================================================
// Each client (by IP) gets a counter that resets after a time
// window. If counter > max, reject with 429.

function fixedWindowLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    headers = true,
    keyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown'
  } = options;

  // WHY: In-memory Map. Production uses Redis for shared state
  // across multiple server instances.
  const store = new Map();

  function getRecord(key) {
    const now = Date.now();
    let record = store.get(key);
    if (!record || now >= record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      store.set(key, record);
    }
    return record;
  }

  const middleware = (req, res, next) => {
    const key = keyGenerator(req);
    const record = getRecord(key);
    record.count++;

    const remaining = Math.max(0, max - record.count);
    const resetTimeSeconds = Math.ceil(record.resetTime / 1000);

    if (headers) {
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(resetTimeSeconds));
    }

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfterSeconds, 1)));
      return res.status(statusCode).json({
        error: message,
        retryAfter: Math.max(retryAfterSeconds, 1)
      });
    }

    next();
  };

  middleware.store = store;
  middleware.resetKey = (key) => store.delete(key);
  middleware.resetAll = () => store.clear();
  return middleware;
}


// ============================================================
// BLOCK 2 — Sliding Window Limiter
// ============================================================
// Weights the previous window's count based on overlap with the
// current window, eliminating the "boundary burst" problem.

function slidingWindowLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    headers = true,
    cleanupIntervalMs = 60 * 1000,
    keyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown'
  } = options;

  const store = new Map();

  function getEffectiveCount(key) {
    const now = Date.now();
    let record = store.get(key);
    if (!record) {
      record = { prevCount: 0, prevStart: now - windowMs, currCount: 0, currStart: now };
      store.set(key, record);
    }

    if (now - record.currStart >= windowMs) {
      record.prevCount = record.currCount;
      record.prevStart = record.currStart;
      record.currCount = 0;
      record.currStart = now;
    }

    // WHY: effectiveCount = prevCount * overlapWeight + currCount
    const overlapWeight = Math.max(0, (windowMs - (now - record.currStart)) / windowMs);
    const effectiveCount = Math.floor(record.prevCount * overlapWeight) + record.currCount;
    return { record, effectiveCount };
  }

  // WHY: Purge entries unseen in 2 windows to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const expiry = Date.now() - (windowMs * 2);
    for (const [key, record] of store) {
      if (record.currStart < expiry) store.delete(key);
    }
  }, cleanupIntervalMs);
  cleanupTimer.unref();

  const middleware = (req, res, next) => {
    const key = keyGenerator(req);
    const { record, effectiveCount } = getEffectiveCount(key);
    record.currCount++;

    const remaining = Math.max(0, max - effectiveCount - 1);
    const resetTimeSeconds = Math.ceil((record.currStart + windowMs) / 1000);

    if (headers) {
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(resetTimeSeconds));
    }

    if (effectiveCount + 1 > max) {
      const retryAfterSeconds = Math.ceil((record.currStart + windowMs - Date.now()) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfterSeconds, 1)));
      return res.status(statusCode).json({
        error: message,
        retryAfter: Math.max(retryAfterSeconds, 1)
      });
    }

    next();
  };

  middleware.store = store;
  middleware.resetAll = () => store.clear();
  middleware.cleanup = () => clearInterval(cleanupTimer);
  return middleware;
}


// ============================================================
// SECTION: Self-Test
// ============================================================

async function runTests() {
  const app = express();

  const globalLimiter = fixedWindowLimiter({ windowMs: 60000, max: 10, message: 'Global rate limit exceeded' });

  const tatkalLimiter = fixedWindowLimiter({
    windowMs: 60000, max: 3, message: 'Too many tatkal attempts',
    keyGenerator: (req) => {
      const name = (req.body || {}).passengerName || 'anonymous';
      return `${req.ip || 'unknown'}:${name}`;
    }
  });

  const slidingLimiter = slidingWindowLimiter({ windowMs: 60000, max: 5, cleanupIntervalMs: 30000 });

  app.get('/api/trains', globalLimiter, (req, res) => {
    res.json({ data: 'train schedule' });
  });

  app.post('/tatkal/book', express.json(), tatkalLimiter, (req, res) => {
    res.json({ message: 'Booking processed', passenger: req.body?.passengerName });
  });

  app.get('/api/sliding', slidingLimiter, (req, res) => {
    res.json({ data: 'sliding window data' });
  });

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // Test 1: Normal request within limit
      console.log('--- Test 1: Normal Request ---');
      const res1 = await makeRequest(`${base}/api/trains`);
      console.log('Status:', res1.status);
      // Output: Status: 200
      console.log('X-RateLimit-Remaining:', res1.headers['x-ratelimit-remaining']);
      // Output: X-RateLimit-Remaining: 9

      // Test 2: Exceed the limit (10 requests)
      console.log('\n--- Test 2: Exceed Rate Limit ---');
      for (let i = 0; i < 9; i++) await makeRequest(`${base}/api/trains`);
      const res2 = await makeRequest(`${base}/api/trains`);
      console.log('Status:', res2.status);
      // Output: Status: 429
      console.log('Retry-After present:', !!res2.headers['retry-after']);
      // Output: Retry-After present: true

      // Test 3: Tatkal limiter (3 max)
      console.log('\n--- Test 3: Tatkal Limiter (3 Max) ---');
      for (let i = 1; i <= 4; i++) {
        const r = await makeRequest(`${base}/tatkal/book`, 'POST',
          { 'Content-Type': 'application/json' },
          JSON.stringify({ passengerName: 'Rajesh Kumar' }));
        console.log(`  Attempt ${i}: status=${r.status}, remaining=${r.headers['x-ratelimit-remaining']}`);
      }
      // Output:   Attempt 1: status=200, remaining=2
      // Output:   Attempt 2: status=200, remaining=1
      // Output:   Attempt 3: status=200, remaining=0
      // Output:   Attempt 4: status=429, remaining=0

      // Test 4: Sliding window limiter
      console.log('\n--- Test 4: Sliding Window (5 Max) ---');
      for (let i = 1; i <= 6; i++) {
        const r = await makeRequest(`${base}/api/sliding`);
        console.log(`  Request ${i}: status=${r.status}`);
      }
      // Output:   Request 6: status=429

      // Test 5: Reset and verify
      console.log('\n--- Test 5: Reset ---');
      globalLimiter.resetAll();
      const res5 = await makeRequest(`${base}/api/trains`);
      console.log('After reset, status:', res5.status);
      // Output: After reset, status: 200

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      slidingLimiter.cleanup();
      server.close(() => {
        console.log('\nServer closed.\n');

        // KEY TAKEAWAYS
        console.log('KEY TAKEAWAYS:');
        console.log('1. Fixed window is simple but has a "boundary burst" problem — sliding window fixes this.');
        console.log('2. Standard headers (X-RateLimit-Limit, Remaining, Reset) let consumers implement backoff.');
        console.log('3. Custom key generators let you rate-limit by IP, user, API key, or any combination.');
        console.log('4. Per-route limits protect sensitive endpoints more aggressively.');
        console.log('5. In-memory stores work single-server; use Redis for distributed rate limiting.');
        console.log('6. Use unref() on cleanup timers so they do not prevent clean process shutdown.');
      });
    }
  });
}

function makeRequest(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname, port: urlObj.port,
      path: urlObj.pathname + urlObj.search, method, headers
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

runTests();
