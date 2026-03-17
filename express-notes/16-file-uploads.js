/** ============================================================
 *  FILE 16: File Uploads — Multipart Form-Data Parsing
 *  WHY: Understanding multipart parsing demystifies multer/busboy
 *  and teaches how HTTP transmits binary data.
 *  ============================================================ */

// PASSPORT SEVA KENDRA
// ──────────────────────────────────────────────────────────────
// The Passport Seva Kendra receives document submissions as
// "multipart" packages — multiple documents with separator
// labels. The scanning counter must unwrap each package, catalog
// every document, and validate before storing. In HTTP, browsers
// wrap files into multipart/form-data with boundary separators.
// ──────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ============================================================
// BLOCK 1 — Basic Multipart Parser Middleware
// ============================================================
// Multipart body structure:
//   --boundary\r\n
//   Content-Disposition: form-data; name="field"; filename="file.jpg"\r\n
//   Content-Type: image/jpeg\r\n
//   \r\n
//   <binary data>\r\n
//   --boundary--\r\n

function extractBoundary(contentType) {
  if (!contentType || !contentType.includes('multipart/form-data')) return null;
  // Find "boundary=" and extract the value (up to next space or semicolon)
  const marker = 'boundary=';
  const startIdx = contentType.indexOf(marker);
  if (startIdx === -1) return null;
  let value = contentType.substring(startIdx + marker.length);
  // Trim at first space or semicolon
  for (let i = 0; i < value.length; i++) {
    if (value[i] === ' ' || value[i] === ';') { value = value.substring(0, i); break; }
  }
  return value.length > 0 ? value : null;
}

// Helper: extract a quoted value after a key like name="value" or filename="value"
function extractQuotedValue(line, key) {
  const marker = key + '="';
  const startIdx = line.indexOf(marker);
  if (startIdx === -1) return null;
  const valueStart = startIdx + marker.length;
  const valueEnd = line.indexOf('"', valueStart);
  if (valueEnd === -1) return null;
  return line.substring(valueStart, valueEnd);
}

function parsePartHeaders(headerSection) {
  const headers = {};
  for (const line of headerSection.split('\r\n')) {
    if (line.toLowerCase().startsWith('content-disposition:')) {
      const name = extractQuotedValue(line, 'name');
      const filename = extractQuotedValue(line, 'filename');
      if (name) headers.name = name;
      if (filename) headers.filename = filename;
    }
    if (line.toLowerCase().startsWith('content-type:')) headers.contentType = line.split(':')[1].trim();
  }
  return headers;
}

function parseMultipartBody(body, boundary) {
  const parts = [];
  const bodyStr = body.toString('binary');
  const rawParts = bodyStr.split(`--${boundary}`);

  for (let i = 1; i < rawParts.length; i++) {
    const rawPart = rawParts[i];
    if (rawPart.startsWith('--')) continue;
    const headerEnd = rawPart.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = parsePartHeaders(rawPart.substring(2, headerEnd));
    let partBody = rawPart.substring(headerEnd + 4);
    if (partBody.endsWith('\r\n')) partBody = partBody.substring(0, partBody.length - 2);

    if (headers.filename) {
      parts.push({ type: 'file', fieldName: headers.name, filename: headers.filename,
        contentType: headers.contentType || 'application/octet-stream',
        data: Buffer.from(partBody, 'binary'), size: Buffer.byteLength(partBody, 'binary') });
    } else {
      parts.push({ type: 'field', fieldName: headers.name, value: partBody });
    }
  }
  return parts;
}

function basicMultipartParser(options = {}) {
  const uploadDir = options.uploadDir || os.tmpdir();
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  return (req, res, next) => {
    const boundary = extractBoundary(req.headers['content-type'] || '');
    if (!boundary) return next();

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const parts = parseMultipartBody(Buffer.concat(chunks), boundary);
        req.files = []; req.fields = {};
        for (const part of parts) {
          if (part.type === 'file') {
            const ext = path.extname(part.filename);
            const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
            const filePath = path.join(uploadDir, uniqueName);
            fs.writeFileSync(filePath, part.data);
            req.files.push({ fieldName: part.fieldName, originalName: part.filename, savedAs: uniqueName, path: filePath, contentType: part.contentType, size: part.size });
          } else { req.fields[part.fieldName] = part.value; }
        }
        next();
      } catch (err) { next(err); }
    });
    req.on('error', (err) => next(err));
  };
}

// ============================================================
// BLOCK 2 — Validated Uploads: Size, Type, Count Limits
// ============================================================

function enhancedMultipartParser(options = {}) {
  const uploadDir = options.uploadDir || os.tmpdir();
  const maxFileSize = options.maxFileSize || 5 * 1024 * 1024;
  const maxFiles = options.maxFiles || 10;
  const maxTotalSize = options.maxTotalSize || 20 * 1024 * 1024;
  const allowedTypes = options.allowedTypes || null;
  const allowedExtensions = options.allowedExtensions || null;
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  return (req, res, next) => {
    const boundary = extractBoundary(req.headers['content-type'] || '');
    if (!boundary) return next();

    const chunks = []; let totalBytes = 0;
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxTotalSize) { req.destroy(new Error(`Total size exceeds ${maxTotalSize} bytes`)); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const parts = parseMultipartBody(Buffer.concat(chunks), boundary);
        req.files = []; req.fields = {};
        const savedPaths = []; let fileCount = 0;

        for (const part of parts) {
          if (part.type === 'file') {
            fileCount++;
            if (fileCount > maxFiles) { cleanupFiles(savedPaths); const e = new Error(`Too many files. Max: ${maxFiles}`); e.status = 400; return next(e); }
            if (part.size > maxFileSize) { cleanupFiles(savedPaths); const e = new Error(`"${part.filename}" (${part.size}b) exceeds ${maxFileSize}b limit`); e.status = 400; return next(e); }
            if (allowedTypes && !allowedTypes.includes(part.contentType)) { cleanupFiles(savedPaths); const e = new Error(`Type "${part.contentType}" not allowed`); e.status = 400; return next(e); }
            const ext = path.extname(part.filename).toLowerCase();
            if (allowedExtensions && !allowedExtensions.includes(ext)) { cleanupFiles(savedPaths); const e = new Error(`Extension "${ext}" not allowed`); e.status = 400; return next(e); }

            const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
            const filePath = path.join(uploadDir, uniqueName);
            fs.writeFileSync(filePath, part.data);
            savedPaths.push(filePath);
            req.files.push({ fieldName: part.fieldName, originalName: part.filename, savedAs: uniqueName, path: filePath, contentType: part.contentType, size: part.size });
          } else { req.fields[part.fieldName] = part.value; }
        }
        req.cleanupFiles = () => cleanupFiles(savedPaths);
        next();
      } catch (err) { next(err); }
    });
    req.on('error', (err) => next(err));
  };
}

function cleanupFiles(paths) {
  for (const fp of paths) { try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {} }
}

// Helper: build multipart body for testing
function buildMultipartBody(boundary, parts) {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: ${part.contentType || 'application/octet-stream'}\r\n\r\n`));
      chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
      chunks.push(Buffer.from(part.value));
    }
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function makeRequest(url, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname, method, headers };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const raw = Buffer.concat(chunks).toString(); let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; } resolve({ status: res.statusCode, headers: res.headers, body: parsed }); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ============================================================
// SELF-TEST
// ============================================================
async function runTests() {
  const app = express();
  const testUploadDir = path.join(os.tmpdir(), `passport-seva-${Date.now()}`);
  fs.mkdirSync(testUploadDir, { recursive: true });

  app.post('/upload/basic', basicMultipartParser({ uploadDir: testUploadDir }), (req, res) => {
    res.json({ fields: req.fields, files: req.files.map(f => ({ name: f.originalName, type: f.contentType, size: f.size })) });
  });

  app.post('/upload/validated', enhancedMultipartParser({
    uploadDir: testUploadDir, maxFileSize: 1024, maxFiles: 2,
    allowedTypes: ['image/png', 'image/jpeg', 'text/plain'], allowedExtensions: ['.png', '.jpg', '.jpeg', '.txt']
  }), (req, res) => {
    res.json({ fields: req.fields, files: req.files.map(f => ({ name: f.originalName, size: f.size })) });
    req.cleanupFiles();
  });

  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    console.log(`Passport Seva Kendra on port ${port}\n`);

    try {
      // ── Test 1: Basic single file upload ──────────────────
      console.log('--- Test 1: Basic Upload ---');
      const b1 = 'Boundary123';
      const body1 = buildMultipartBody(b1, [
        { name: 'applicant', value: 'Rajesh Sharma' },
        { name: 'doc', filename: 'aadhaar.txt', contentType: 'text/plain', data: 'Aadhaar scan data' }
      ]);
      const r1 = await makeRequest(`${base}/upload/basic`, 'POST', { 'Content-Type': `multipart/form-data; boundary=${b1}` }, body1);
      console.log('Status:', r1.status);                          // Output: 200
      console.log('Fields:', JSON.stringify(r1.body.fields));
      console.log('Files:', r1.body.files.length);                // Output: 1
      console.log();

      // ── Test 2: File too large → rejected ─────────────────
      console.log('--- Test 2: File Too Large ---');
      const b3 = 'SizeBound';
      const body3 = buildMultipartBody(b3, [
        { name: 'big', filename: 'huge.txt', contentType: 'text/plain', data: Buffer.alloc(2000, 0x41) }
      ]);
      const r3 = await makeRequest(`${base}/upload/validated`, 'POST', { 'Content-Type': `multipart/form-data; boundary=${b3}` }, body3);
      console.log('Status:', r3.status);  // Output: 400
      console.log('Error:', r3.body.error);
      console.log();

      // ── Test 3: Wrong file type → rejected ────────────────
      console.log('--- Test 3: Wrong Type ---');
      const b4 = 'TypeBound';
      const body4 = buildMultipartBody(b4, [
        { name: 'bad', filename: 'script.exe', contentType: 'application/x-executable', data: 'MZ' }
      ]);
      const r4 = await makeRequest(`${base}/upload/validated`, 'POST', { 'Content-Type': `multipart/form-data; boundary=${b4}` }, body4);
      console.log('Status:', r4.status);  // Output: 400
      console.log('Error:', r4.body.error);
      console.log();

      // ── Test 4: Too many files → rejected ─────────────────
      console.log('--- Test 4: Too Many Files ---');
      const b5 = 'CountBound';
      const body5 = buildMultipartBody(b5, [
        { name: 'f1', filename: 'a.txt', contentType: 'text/plain', data: 'a' },
        { name: 'f2', filename: 'b.txt', contentType: 'text/plain', data: 'b' },
        { name: 'f3', filename: 'c.txt', contentType: 'text/plain', data: 'c' }
      ]);
      const r5 = await makeRequest(`${base}/upload/validated`, 'POST', { 'Content-Type': `multipart/form-data; boundary=${b5}` }, body5);
      console.log('Status:', r5.status);  // Output: 400
      console.log('Error:', r5.body.error);

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      try { fs.rmSync(testUploadDir, { recursive: true, force: true }); } catch {}
      server.close(() => {
        console.log('\nServer closed.\n');
        console.log('KEY TAKEAWAYS:');
        console.log('1. Multipart uses boundary strings to separate parts.');
        console.log('2. Parts with "filename" = file uploads; without = text fields.');
        console.log('3. Validate size, type, and count BEFORE saving to disk.');
        console.log('4. Track saved paths for cleanup on error.');
        console.log('5. In production, stream large files instead of buffering.');
        console.log('6. Never trust client filename or Content-Type.');
      });
    }
  });
}

runTests();
