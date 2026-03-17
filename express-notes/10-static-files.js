/** ============================================================
 *  FILE 10 — Static File Serving in Express 5
 *  Topic: express.static(), options, virtual paths, multiple dirs
 *  ============================================================ */

// ─────────────────────────────────────────────────────────────
// STORY: National Gallery of Modern Art (NGMA Delhi)
// Curator Meera arranges artworks in exhibition halls (static
// directories). She labels displays with cache signs (maxAge),
// controls hidden works (dotfiles), and maps virtual halls to
// storage rooms (virtual path prefixes). Visitors simply walk
// to the right hall — no route handler needed.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─────────────────────────────────────────────────────────────
// Helper — HTTP request
// ─────────────────────────────────────────────────────────────
function request(port, method, urlPath, { headers } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers: { ...(headers || {}) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// Helper — create temp directories with sample files
// ─────────────────────────────────────────────────────────────
function createTempAssets() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ngma-delhi-'));

  const publicDir = path.join(baseDir, 'public');
  fs.mkdirSync(publicDir);
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<!DOCTYPE html><html><body><h1>NGMA Delhi Home</h1></body></html>\n');
  fs.writeFileSync(path.join(publicDir, 'style.css'), 'body { font-family: sans-serif; }\n');
  fs.writeFileSync(path.join(publicDir, 'about.html'), '<!DOCTYPE html><html><body><h1>About NGMA</h1></body></html>\n');
  fs.writeFileSync(path.join(publicDir, '.secret'), 'Hidden config file\n');

  const uploadsDir = path.join(baseDir, 'uploads');
  fs.mkdirSync(uploadsDir);
  fs.writeFileSync(path.join(uploadsDir, 'painting1.txt'), '[PAINTING 1 — Amrita Sher-Gil]\n');

  const vendorDir = path.join(baseDir, 'vendor');
  fs.mkdirSync(vendorDir);
  fs.writeFileSync(path.join(vendorDir, 'framework.js'), '/* Vendor framework v1.0 */\n');

  return { baseDir, publicDir, uploadsDir, vendorDir };
}

function cleanupDir(dirPath) {
  if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
}

// =============================================================
// BLOCK 1 — Basic Static Serving
// =============================================================
// express.static(root) serves files from a directory.
// It handles Content-Type, ETag, Last-Modified, and streaming.
// If the file isn't found, it silently calls next().
// ─────────────────────────────────────────────────────────────

async function block1() {
  console.log('=== BLOCK 1: Basic Static File Serving ===\n');

  const dirs = createTempAssets();
  const app = express();

  // Serve the public directory at root
  app.use(express.static(dirs.publicDir));

  // Dynamic route coexists with static files
  app.get('/api/info', (req, res) => {
    res.json({ gallery: 'NGMA Delhi', version: 1 });
  });

  const server = app.listen(0);
  const port = server.address().port;

  // ── Test: GET / serves index.html with ETag ────────────────
  console.log('  --- GET / — serves index.html automatically ---');
  const r1 = await request(port, 'GET', '/');
  console.log('  status:', r1.status);           // Output: 200
  console.log('  type:  ', r1.headers['content-type']); // Output: text/html; charset=UTF-8
  console.log('  etag:  ', r1.headers['etag'] !== undefined); // Output: true
  // WHY: express.static() sets ETag by default for caching.
  console.log();

  // ── Test: Non-existent file falls through ──────────────────
  console.log('  --- GET /nonexistent.txt — falls through to 404 ---');
  const r5 = await request(port, 'GET', '/nonexistent.txt');
  console.log('  status:', r5.status); // Output: 404
  console.log();

  server.close();
  cleanupDir(dirs.baseDir);
}

// =============================================================
// BLOCK 2 — Options, Virtual Prefix, Multiple Directories
// =============================================================
// Configure maxAge (cache), dotfiles (security), extensions
// (auto-resolve), virtual path prefixes, and fallback dirs.
// ─────────────────────────────────────────────────────────────

async function block2() {
  console.log('=== BLOCK 2: Options, Virtual Prefix, Multiple Dirs ===\n');

  const dirs = createTempAssets();
  const app = express();

  // ── Main public with options ───────────────────────────────
  app.use(express.static(dirs.publicDir, {
    dotfiles: 'deny',            // 'ignore'|'deny'|'allow' — blocks .env, .git, etc.
    extensions: ['html', 'htm'], // GET /about → tries about.html
    index: 'index.html',         // default file for directory requests
    maxAge: '1h',                // Cache-Control: public, max-age=3600
    etag: true,
    lastModified: true,
  }));

  // ── Virtual path prefix — /assets maps to uploads dir ──────
  // Client requests /assets/painting1.txt, file lives in uploads/
  app.use('/assets', express.static(dirs.uploadsDir, { maxAge: '30m' }));

  // ── Vendor assets with long cache ──────────────────────────
  app.use('/vendor', express.static(dirs.vendorDir, { maxAge: '7d' }));

  const server = app.listen(0);
  const port = server.address().port;

  // ── Test: Cache-Control from maxAge ────────────────────────
  console.log('  --- GET /style.css — Cache-Control ---');
  const r1 = await request(port, 'GET', '/style.css');
  console.log('  cache-control:', r1.headers['cache-control']);
  // Output: public, max-age=3600
  console.log();

  // ── Test: extensions option resolves /about → about.html ───
  console.log('  --- GET /about — extensions resolves about.html ---');
  const r2 = await request(port, 'GET', '/about');
  console.log('  status:', r2.status); // Output: 200
  console.log('  body:  ', r2.body.includes('About NGMA')); // Output: true
  console.log();

  // ── Test: dotfiles: 'deny' blocks hidden files ─────────────
  console.log('  --- GET /.secret — dotfiles: "deny" ---');
  const r3 = await request(port, 'GET', '/.secret');
  console.log('  status:', r3.status); // Output: 404
  // Prevents leaking .env, .git, .htaccess
  console.log();

  // ── Test: Virtual prefix ───────────────────────────────────
  console.log('  --- GET /assets/painting1.txt — virtual prefix ---');
  const r4 = await request(port, 'GET', '/assets/painting1.txt');
  console.log('  status:       ', r4.status); // Output: 200
  console.log('  cache-control:', r4.headers['cache-control']); // Output: public, max-age=1800
  console.log();

  // ── Test: ETag conditional request → 304 ───────────────────
  console.log('  --- Conditional request with If-None-Match ---');
  const r7a = await request(port, 'GET', '/style.css');
  const etag = r7a.headers['etag'];
  const r7b = await request(port, 'GET', '/style.css', {
    headers: { 'If-None-Match': etag },
  });
  console.log('  second request status:', r7b.status); // Output: 304
  console.log('  body length:', r7b.body.length);       // Output: 0
  console.log();

  server.close();
  cleanupDir(dirs.baseDir);
}

// =============================================================
// RUN ALL BLOCKS
// =============================================================
async function main() {
  console.log('============================================================');
  console.log(' FILE 10 — Static File Serving (National Gallery of Modern Art)');
  console.log('============================================================\n');

  await block1();
  await block2();

  // ─────────────────────────────────────────────────────────────
  // KEY TAKEAWAYS
  // ─────────────────────────────────────────────────────────────
  console.log('=== KEY TAKEAWAYS ===\n');
  console.log('  1. express.static(root) serves files automatically — handles');
  console.log('     MIME types, ETags, and Last-Modified. Calls next() on miss.');
  console.log('  2. Options: dotfiles, extensions, index, maxAge, etag, lastModified.');
  console.log('  3. Virtual prefix: app.use("/assets", express.static(dir))');
  console.log('     maps URL /assets/* to files in dir/*.');
  console.log('  4. Multiple static dirs fall through in registration order.');
  console.log('  5. dotfiles: "deny" is essential security — blocks .env, .git.');
  console.log('  6. ETags enable 304 Not Modified, saving bandwidth.\n');

  console.log('Done. All servers closed, temp files cleaned up.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
