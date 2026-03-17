/** ============================================================
 *  FILE 20: Logging Middleware — Build It from Scratch
 *  ============================================================ */

// STORY: Clerk Ramesh maintains the RTI office log register.
// Express logging works the same way — intercept res.end() to
// capture response status, timing, and client details.

const express = require('express');
const fs = require('fs');
const path = require('path');


// ════════════════════════════════════════════════════════════════
// BLOCK 1 — Logger Middleware with res.end() Interception
// ════════════════════════════════════════════════════════════════
// WHY: When middleware runs, the response hasn't been sent yet.
// Replace res.end() with a wrapper that captures details BEFORE
// calling the original. This is how morgan works internally.

function createLogger(options = {}) {
  const format = options.format || 'dev';
  const skipFn = options.skip || null;
  const output = options.stream || process.stdout;

  const colors = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
  };

  function colorForStatus(status) {
    if (status >= 500) return colors.red;
    if (status >= 400) return colors.yellow;
    if (status >= 300) return colors.cyan;
    return colors.green;
  }

  const formatters = {
    dev(info) {
      const c = colorForStatus(info.status);
      return `${info.method} ${info.url} ${c}${info.status}${colors.reset} ${info.responseTime}ms - ${info.contentLength}`;
    },
    combined(info) {
      return `${info.ip} - - [${info.timestamp}] "${info.method} ${info.url} HTTP/${info.httpVersion}" ${info.status} ${info.contentLength} "-" "${info.userAgent}"`;
    },
    json(info) {
      return JSON.stringify({
        method: info.method, url: info.url, status: info.status,
        responseTime: info.responseTime, contentLength: info.contentLength,
        ip: info.ip, userAgent: info.userAgent, timestamp: info.timestamp,
      });
    },
  };

  return function loggerMiddleware(req, res, next) {
    // WHY: process.hrtime.bigint() gives nanosecond precision
    const startTime = process.hrtime.bigint();

    const reqInfo = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.get('user-agent') || '-',
      httpVersion: req.httpVersion,
    };

    // WHY: Monkey-patch res.end() to capture response details
    const originalEnd = res.end;
    res.end = function patchedEnd(chunk, encoding) {
      res.end = originalEnd; // restore to prevent double-logging

      const elapsed = process.hrtime.bigint() - startTime;
      const info = {
        ...reqInfo,
        status: res.statusCode,
        responseTime: (Number(elapsed) / 1e6).toFixed(2),
        contentLength: res.get('content-length') || '0',
        timestamp: new Date().toISOString(),
      };

      if (skipFn && skipFn(req, res)) return res.end(chunk, encoding);

      const formatter = formatters[format] || formatters.dev;
      output.write(formatter(info) + '\n');
      return res.end(chunk, encoding);
    };

    next();
  };
}


// ════════════════════════════════════════════════════════════════
// BLOCK 2 — Multiple Formats, Skip, File Logging
// ════════════════════════════════════════════════════════════════

async function runTests() {
  // --- Block 1: Basic logger ---
  await new Promise((resolve) => {
    const app = express();
    const logLines = [];
    const mockStream = { write(line) { logLines.push(line.trim()); } };

    app.use(createLogger({ format: 'dev', stream: mockStream }));

    app.get('/api/applications', (req, res) => {
      res.json([{ id: 1, name: 'Ramesh Verma' }]);
    });
    app.get('/api/missing', (req, res) => res.status(404).json({ error: 'Not found' }));

    const server = app.listen(0, async () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      console.log('=== BLOCK 1: Logger with Response Time ===');

      try {
        await fetch(`${base}/api/applications`);
        console.log('Log entry:', logLines[0]);
        // Output: Log entry: GET /api/applications [green]200[reset] X.XXms - XX

        await fetch(`${base}/api/missing`);
        console.log('404 log:', logLines[1]);
        // Output: 404 log: GET /api/missing [yellow]404[reset] X.XXms - XX

        const hasTime = logLines.every((l) => /\d+\.\d+ms/.test(l));
        console.log('All entries have response time:', hasTime);
        // Output: All entries have response time: true
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('Block 1 closed.\n'); resolve(); });
    });
  });

  // --- Block 2: Multiple formats + skip ---
  await new Promise((resolve) => {
    const app = express();
    const devLogs = [], jsonLogs = [];
    const devStream = { write(l) { devLogs.push(l.trim()); } };
    const jsonStream = { write(l) { jsonLogs.push(l.trim()); } };

    // WHY: Skip health checks — load balancers hit them constantly
    const skipHealth = (req) => req.url === '/health';

    app.use(createLogger({ format: 'dev', stream: devStream, skip: skipHealth }));
    app.use(createLogger({ format: 'json', stream: jsonStream }));

    app.get('/api/departments', (req, res) => res.json([{ id: 1, name: 'Revenue' }]));
    app.get('/health', (req, res) => res.sendStatus(200));
    app.get('/api/error-demo', (req, res) => res.status(500).json({ error: 'ISE' }));

    const server = app.listen(0, async () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      console.log('=== BLOCK 2: Multiple Formats, Skip ===');

      try {
        await fetch(`${base}/api/departments`);
        await fetch(`${base}/health`);
        await fetch(`${base}/api/error-demo`);

        console.log('Dev log count (health skipped):', devLogs.length);
        // Output: Dev log count (health skipped): 2
        console.log('JSON log count (all requests):', jsonLogs.length);
        // Output: JSON log count (all requests): 3

        const healthInDev = devLogs.some((l) => l.includes('/health'));
        const healthInJson = jsonLogs.some((l) => l.includes('/health'));
        console.log('/health in dev logs:', healthInDev);
        // Output: /health in dev logs: false
        console.log('/health in json logs:', healthInJson);
        // Output: /health in json logs: true
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('Block 2 closed.\n'); resolve(); });
    });
  });

  console.log('=== KEY TAKEAWAYS ===');
  console.log('1. Intercept res.end() to capture response details (status, time, size).');
  console.log('2. process.hrtime.bigint() gives nanosecond-precision timing.');
  console.log('3. Restore original res.end() BEFORE calling it to avoid loops.');
  console.log('4. Multiple formats serve different consumers: dev, combined, json.');
  console.log('5. Skip functions reduce noise by filtering health checks and probes.');
  console.log('6. Stack multiple loggers — each with its own format and skip rules.');

  process.exit(0);
}

runTests();
