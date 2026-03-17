/** ============================================================
    FILE 30: Doordarshan Media Server — Static File Server
    ============================================================
    Topic: HTTP server with streaming file delivery
    Combines: http, fs, path, url, streams

    USAGE:
      node 30-project-static-file-server.js serve [port]
    DEMO MODE (no arguments):
      node 30-project-static-file-server.js
    ============================================================ */

'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const url = require('url');
const os = require('os');

// ============================================================
// SECTION 1: Configuration
// ============================================================
const DEMO_MODE = process.argv.length <= 2 || process.argv[2] === '--demo';
const DEMO_PUBLIC = path.join(os.tmpdir(), 'dd-media-demo-' + process.pid);

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';

function banner(text) {
  const rule = '='.repeat(60);
  console.log(`\n${CYAN}${rule}${RESET}`);
  console.log(`${BOLD}  ${text}${RESET}`);
  console.log(`${CYAN}${rule}${RESET}`);
}
function thinRule() { console.log(DIM + '\u2500'.repeat(60) + RESET); }

// ============================================================
// SECTION 2: MIME Types
// ============================================================

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.txt':  'text/plain; charset=utf-8',
  '.ico':  'image/x-icon'
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// ============================================================
// SECTION 3: Security — Directory Traversal Protection
// ============================================================

function isSafePath(publicRoot, requestedPath) {
  const resolved = path.resolve(publicRoot, requestedPath);
  return resolved.startsWith(path.resolve(publicRoot));
}

// ============================================================
// SECTION 4: Response Helpers
// ============================================================

function send404(res) {
  const body = `<!DOCTYPE html><html><body style="font-family:monospace;text-align:center;padding:60px">
<h1>404 &mdash; Not Found</h1></body></html>`;
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function send403(res) {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end('403 Forbidden\n');
}

function send500(res) {
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('500 Internal Server Error\n');
}

// ============================================================
// SECTION 5: Request Handler (Stream-Based)
// ============================================================
// Instead of readFileSync (loads entire file into memory),
// we pipe a read stream to the response — constant memory.

function createHandler(publicRoot) {
  return (req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === '/') pathname = '/bulletin.html';

    if (!isSafePath(publicRoot, '.' + pathname)) {
      console.log(`  [${req.method}] ${pathname} \u2014 ${RED}403${RESET}`);
      return send403(res);
    }

    const filePath = path.join(publicRoot, pathname);
    const mime = getMimeType(filePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        console.log(`  [${req.method}] ${pathname} \u2014 ${YELLOW}404${RESET}`);
        return send404(res);
      }

      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stats.size });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', () => send500(res));

      console.log(`  [${req.method}] ${pathname} \u2014 ${GREEN}200${RESET} (${mime.split(';')[0]}, ${stats.size}B)`);
    });
  };
}

// ============================================================
// SECTION 6: Server Factory
// ============================================================

function createServer(publicRoot, port) {
  return new Promise((resolve) => {
    const server = http.createServer(createHandler(publicRoot));
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      console.log(`\n  DD Media Server on http://127.0.0.1:${addr.port}`);
      console.log(`  Serving: ${DIM}${publicRoot}${RESET}\n`);
      resolve(server);
    });
  });
}

// ============================================================
// SECTION 7: Demo Assets
// ============================================================

async function createDemoAssets() {
  await fsp.mkdir(DEMO_PUBLIC, { recursive: true });

  await Promise.all([
    fsp.writeFile(path.join(DEMO_PUBLIC, 'bulletin.html'), `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>DD News</title>
<link rel="stylesheet" href="/ticker.css"></head>
<body><h1>Doordarshan Samachar</h1>
<p>Served by the DD Node.js static media server.</p></body></html>`),
    fsp.writeFile(path.join(DEMO_PUBLIC, 'ticker.css'),
      `body { font-family: system-ui; max-width: 640px; margin: 40px auto; background: #1a1a2e; color: #e0e0e0; }
h1 { color: #ff9933; }`),
    fsp.writeFile(path.join(DEMO_PUBLIC, 'schedule.json'),
      JSON.stringify({ server: 'DD Media', version: '1.0.0' }, null, 2))
  ]);
  console.log(`  Created demo assets in ${DIM}${DEMO_PUBLIC}${RESET}`);
}

// ============================================================
// SECTION 8: HTTP Test Client
// ============================================================

function httpGet(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: reqPath }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// ============================================================
// SECTION 9: Demo Mode
// ============================================================

async function runDemo() {
  banner('Doordarshan Media Server (DEMO)');

  thinRule();
  console.log(`${BOLD}  Step 1: Create demo assets${RESET}`);
  thinRule();
  await createDemoAssets();

  thinRule();
  console.log(`${BOLD}  Step 2: Start server${RESET}`);
  thinRule();
  const server = await createServer(DEMO_PUBLIC, 0);
  const port = server.address().port;

  thinRule();
  console.log(`${BOLD}  Step 3: Test requests${RESET}`);
  thinRule();

  const tests = [
    ['/', 200], ['/ticker.css', 200], ['/schedule.json', 200],
    ['/news-anchor.jpg', 404], ['/../../etc/passwd', 403]
  ];

  const results = [];
  for (const [reqPath, expected] of tests) {
    console.log(`\n  ${CYAN}GET ${reqPath}${RESET}`);
    const r = await httpGet(port, reqPath);
    console.log(`  Status: ${r.status}, ${r.body.length} bytes`);
    results.push({ path: reqPath, expected, got: r.status });
  }

  console.log('');
  thinRule();
  console.log(`${BOLD}  Test Summary${RESET}`);
  thinRule();
  for (const r of results) {
    const ok = r.expected === r.got;
    const icon = ok ? `${GREEN}\u2713${RESET}` : `${RED}\u2717${RESET}`;
    console.log(`  ${icon}  ${r.path.padEnd(28)} expected=${r.expected} got=${r.got}`);
  }

  console.log('');
  thinRule();
  console.log(`${BOLD}  Shutdown${RESET}`);
  thinRule();
  await new Promise((resolve) => server.close(resolve));
  await fsp.rm(DEMO_PUBLIC, { recursive: true, force: true });
  console.log(`  Cleaned up.`);

  banner('KEY TAKEAWAYS');
  console.log(`
  1. fs.createReadStream().pipe(res) serves files with O(1) memory
  2. MIME types are essential — browsers need Content-Type
  3. path.resolve + startsWith blocks directory traversal
  4. url.parse + decodeURIComponent handles encoded paths
  5. Port 0 avoids conflicts in tests
  6. Stream error handling prevents server crashes
`);
}

// ============================================================
// SECTION 10: Interactive + Entry Point
// ============================================================

async function runInteractive() {
  const port = parseInt(process.argv[3], 10) || 3000;
  const publicDir = path.join(process.cwd(), 'public');
  try { await fsp.access(publicDir); }
  catch {
    console.log(`${RED}Error: ./public not found${RESET}`);
    process.exit(1);
  }
  const server = await createServer(publicDir, port);
  console.log('  Press Ctrl+C to stop.\n');
  process.on('SIGINT', () => { server.close(() => process.exit(0)); });
}

async function main() {
  if (DEMO_MODE) await runDemo();
  else if (process.argv[2] === 'serve') await runInteractive();
  else {
    console.log('Usage:');
    console.log('  node 30-project-static-file-server.js           # demo');
    console.log('  node 30-project-static-file-server.js serve [port]');
  }
}

main().catch(err => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
