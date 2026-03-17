/** ============================================================
 *  FILE 23: Performance Patterns — Optimize Every Millisecond
 *  ============================================================ */

// STORY: Pit Crew Chief Vikram at Buddh Circuit knows races are
// won in the pit — compress responses, use ETags, set cache
// headers, and stream large files to avoid memory blowup.

const express = require('express');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
const { Readable } = require('stream');


// ════════════════════════════════════════════════════════════════
// BLOCK 1 — Compression & ETag from Scratch
// ════════════════════════════════════════════════════════════════

function createCompressionMiddleware(options = {}) {
  const threshold = options.threshold || 1024;

  return function compressionMiddleware(req, res, next) {
    const acceptEncoding = req.get('accept-encoding') || '';
    if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) return next();

    const originalEnd = res.end;
    const originalWrite = res.write;
    const chunks = [];

    res.write = function (chunk, encoding) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return true;
    };

    res.end = function (chunk, encoding) {
      res.write = originalWrite;
      res.end = originalEnd;
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));

      const body = Buffer.concat(chunks);
      const contentType = res.get('content-type') || '';

      // WHY: Skip small responses and already-compressed formats
      if (body.length < threshold || contentType.includes('image/')) {
        if (body.length > 0) res.set('Content-Length', body.length.toString());
        return res.end(body);
      }

      const compressed = acceptEncoding.includes('gzip')
        ? zlib.gzipSync(body) : zlib.deflateSync(body);

      res.set('Content-Encoding', acceptEncoding.includes('gzip') ? 'gzip' : 'deflate');
      res.set('Content-Length', compressed.length.toString());
      // WHY: Vary tells CDNs to cache separate versions per encoding
      res.set('Vary', 'Accept-Encoding');
      return res.end(compressed);
    };

    next();
  };
}

function createETagMiddleware() {
  return function (req, res, next) {
    const originalEnd = res.end;
    const originalWrite = res.write;
    const chunks = [];

    res.write = function (chunk, encoding) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return true;
    };

    res.end = function (chunk, encoding) {
      res.write = originalWrite;
      res.end = originalEnd;
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const body = Buffer.concat(chunks);

      if (body.length > 0 && res.statusCode === 200) {
        const etag = `"${crypto.createHash('md5').update(body).digest('hex')}"`;
        res.set('ETag', etag);

        // WHY: If client has this version, send 304 — no body
        if (req.get('if-none-match') === etag) {
          res.removeHeader('content-length');
          res.statusCode = 304;
          return res.end();
        }
      }
      return res.end(body);
    };
    next();
  };
}

function block1_compressionAndEtag() {
  return new Promise((resolve) => {
    const app = express();
    app.disable('etag');
    app.disable('x-powered-by');
    app.use(createETagMiddleware());
    app.use(createCompressionMiddleware({ threshold: 100 }));

    const largeData = {
      items: Array.from({ length: 50 }, (_, i) => ({
        id: i + 1, name: `Part ${i + 1}`,
        description: `Specification for spare part ${i + 1}`,
      })),
    };

    app.get('/api/parts', (req, res) => res.json(largeData));
    app.get('/api/version', (req, res) => res.json({ version: '2.5.0' }));

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log('=== BLOCK 1: Compression & ETag ===');

      function rawRequest(path, headers = {}) {
        return new Promise((res, rej) => {
          const req = http.request({ hostname: '127.0.0.1', port, path, headers }, (response) => {
            const chunks = [];
            response.on('data', c => chunks.push(c));
            response.on('end', () => res({
              status: response.statusCode, headers: response.headers,
              body: Buffer.concat(chunks),
            }));
          });
          req.on('error', rej);
          req.end();
        });
      }

      try {
        const raw = await rawRequest('/api/parts');
        const gz = await rawRequest('/api/parts', { 'Accept-Encoding': 'gzip' });
        const ratio = ((1 - gz.body.length / raw.body.length) * 100).toFixed(1);
        console.log(`Uncompressed: ${raw.body.length}B | Gzip: ${gz.body.length}B | ${ratio}% smaller`);
        console.log('Vary:', gz.headers['vary']);
        // Output: Vary: Accept-Encoding

        // ETag: first request gets tag, second returns 304
        const v1 = await fetch(`${base}/api/version`);
        const etag = v1.headers.get('etag');
        console.log('ETag:', etag);

        const v2 = await fetch(`${base}/api/version`, {
          headers: { 'If-None-Match': etag },
        });
        console.log('Conditional request status:', v2.status);
        // Output: Conditional request status: 304
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('Block 1 closed.\n'); resolve(); });
    });
  });
}


// ════════════════════════════════════════════════════════════════
// BLOCK 2 — Caching Headers, Streaming, Timeouts
// ════════════════════════════════════════════════════════════════

function block2_cachingAndStreaming() {
  return new Promise((resolve) => {
    const app = express();
    app.disable('etag');

    // WHY: Fingerprinted assets — cache forever
    app.get('/static/bundle.js', (req, res) => {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.type('application/javascript').send('console.log("v1.2.3");');
    });

    // WHY: API data — cache briefly, then must revalidate
    app.get('/api/lap-times', (req, res) => {
      res.set('Cache-Control', 'public, max-age=60, must-revalidate');
      res.json({ gold: 91.5, silver: 93.2 });
    });

    // WHY: Sensitive data — never cache in shared caches
    app.get('/api/driver-profile', (req, res) => {
      res.set('Cache-Control', 'private, no-store');
      res.json({ driver: 'Vikram', role: 'pit-crew-chief' });
    });

    // WHY: Stream large responses row-by-row — never buffer all in memory
    app.get('/api/stream/large', (req, res) => {
      res.set('Content-Type', 'application/json');
      let index = 0;
      const total = 100;
      res.write('[\n');

      function sendNext() {
        while (index < total) {
          const item = JSON.stringify({ id: index + 1, value: `telemetry-${index + 1}` });
          const sep = index < total - 1 ? ',\n' : '\n';
          const canContinue = res.write(item + sep);
          index++;
          if (!canContinue) { res.once('drain', sendNext); return; }
        }
        res.end(']\n');
      }
      sendNext();
    });

    // WHY: Pipe a Readable — handles backpressure automatically
    app.get('/api/stream/lines', (req, res) => {
      res.set('Content-Type', 'text/plain');
      let line = 0;
      const readable = new Readable({
        read() {
          if (line < 20) this.push(`Lap ${++line}: ${Math.random().toFixed(4)}s\n`);
          else this.push(null);
        },
      });
      readable.pipe(res);
    });

    const server = app.listen(0, async () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      server.setTimeout(5000);
      console.log('=== BLOCK 2: Caching, Streaming, Timeouts ===');

      try {
        const staticRes = await fetch(`${base}/static/bundle.js`);
        console.log('Static Cache-Control:', staticRes.headers.get('cache-control'));
        // Output: Static Cache-Control: public, max-age=31536000, immutable

        const profileRes = await fetch(`${base}/api/driver-profile`);
        console.log('Private Cache-Control:', profileRes.headers.get('cache-control'));
        // Output: Private Cache-Control: private, no-store

        const streamData = await (await fetch(`${base}/api/stream/large`)).json();
        console.log('Streamed items:', streamData.length);
        // Output: Streamed items: 100

        const linesText = await (await fetch(`${base}/api/stream/lines`)).text();
        console.log('Piped lines:', linesText.trim().split('\n').length);
        // Output: Piped lines: 20

        console.log('Server timeout:', server.timeout + 'ms');
        // Output: Server timeout: 5000ms
      } catch (err) { console.error('Test error:', err.message); }

      server.close(() => { console.log('Block 2 closed.\n'); resolve(); });
    });
  });
}


// ════════════════════════════════════════════════════════════════

async function main() {
  await block1_compressionAndEtag();
  await block2_cachingAndStreaming();

  console.log('=== KEY TAKEAWAYS ===');
  console.log('1. Compression: intercept res.end(), pipe through zlib. Skip tiny/image responses.');
  console.log('2. Vary: Accept-Encoding so CDNs cache correctly.');
  console.log('3. ETags let clients revalidate — 304 saves bandwidth.');
  console.log('4. Cache-Control: immutable for fingerprinted assets, no-store for sensitive data.');
  console.log('5. Stream large responses with res.write() + drain or pipe().');
  console.log('6. server.setTimeout() prevents hung connections from exhausting resources.');

  process.exit(0);
}

main();
