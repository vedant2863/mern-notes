/** ============================================================
 FILE 7: File System — Sync, Callbacks, and Promises
 ============================================================
 Topic: Three paradigms for file I/O in Node.js
 ============================================================ */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

// ============================================================
// STORY: Editor Kavita at Doordarshan lived through three eras:
// TELEGRAM (sync/blocking), SWITCHBOARD (callbacks), and
// DIGITAL (async/await). Each era shaped how DD handles news.
// ============================================================

const TEMP_DIR = path.join(__dirname, '_temp_dd_newsroom_07');

// ============================================================
// EXAMPLE BLOCK 1 — The Telegram Era (Synchronous)
// ============================================================

console.log('=== BLOCK 1: The Telegram Era (Synchronous) ===\n');

// ────────────────────────────────────────────────────
// SECTION 1 — Setup, Write, Read, Append
// ────────────────────────────────────────────────────

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
const telegramFile = path.join(TEMP_DIR, 'telegram.txt');

fs.writeFileSync(telegramFile, 'BREAKING: Republic Day parade coverage begins!\n', 'utf8');
console.log('writeFileSync — file written');

// Without encoding, readFileSync returns a Buffer. Pass 'utf8' for string.
const content = fs.readFileSync(telegramFile, 'utf8');
console.log('readFileSync:', content.trim());

fs.appendFileSync(telegramFile, 'UPDATE: Monsoon update from IMD!\n', 'utf8');
console.log('After append:', fs.readFileSync(telegramFile, 'utf8').trim());

// ────────────────────────────────────────────────────
// SECTION 2 — Existence Check and Error Handling
// ────────────────────────────────────────────────────

console.log('\nexistsSync:', fs.existsSync(telegramFile)); // true

try {
  fs.readFileSync(path.join(TEMP_DIR, 'does-not-exist.txt'), 'utf8');
} catch (err) {
  console.log('Sync error caught:', err.code); // ENOENT
}

// ============================================================
// EXAMPLE BLOCK 2 — The Switchboard Era (Callbacks)
// ============================================================

(async () => {
  console.log('\n=== BLOCK 2: The Switchboard Era (Callbacks) ===\n');

  // ────────────────────────────────────────────────────
  // SECTION 1 — Write and Read with Callbacks
  // ────────────────────────────────────────────────────
  // Pattern: (err, result) => { ... }  — error-first callback.

  const switchboardFile = path.join(TEMP_DIR, 'switchboard.txt');

  await new Promise((resolve, reject) => {
    fs.writeFile(switchboardFile, 'FLASH: DD correspondent reports from Parliament!\n', 'utf8', (err) => {
      if (err) return reject(err);
      console.log('fs.writeFile — callback fired, file written');
      resolve();
    });
  });

  await new Promise((resolve, reject) => {
    fs.readFile(switchboardFile, 'utf8', (err, data) => {
      if (err) return reject(err);
      console.log('fs.readFile:', data.trim());
      resolve();
    });
  });

  // ────────────────────────────────────────────────────
  // SECTION 2 — Nested Callbacks (Callback Hell)
  // ────────────────────────────────────────────────────

  await new Promise((resolve, reject) => {
    const nestedFile = path.join(TEMP_DIR, 'nested.txt');
    fs.writeFile(nestedFile, 'Step 1: Written\n', 'utf8', (err) => {
      if (err) return reject(err);
      fs.appendFile(nestedFile, 'Step 2: Appended\n', 'utf8', (err) => {
        if (err) return reject(err);
        fs.readFile(nestedFile, 'utf8', (err, data) => {
          if (err) return reject(err);
          console.log('\nNested callback result:', data.trim());
          console.log('(This is callback hell)');
          resolve();
        });
      });
    });
  });

  // ============================================================
  // EXAMPLE BLOCK 3 — The Digital Era (Promises + async/await)
  // ============================================================

  console.log('\n=== BLOCK 3: The Digital Era (Promises + async/await) ===\n');

  // ────────────────────────────────────────────────────
  // SECTION 1 — Write, Read, Append with fs/promises
  // ────────────────────────────────────────────────────

  const digitalFile = path.join(TEMP_DIR, 'digital.txt');
  await fsp.writeFile(digitalFile, 'HEADLINE: DD goes digital!\n', 'utf8');
  console.log('fsp.writeFile — done');

  const digitalContent = await fsp.readFile(digitalFile, 'utf8');
  console.log('fsp.readFile:', digitalContent.trim());

  // ────────────────────────────────────────────────────
  // SECTION 2 — Sequential Operations (No Nesting!)
  // ────────────────────────────────────────────────────

  const pipelineFile = path.join(TEMP_DIR, 'pipeline.txt');
  await fsp.writeFile(pipelineFile, 'Step 1\n', 'utf8');
  await fsp.appendFile(pipelineFile, 'Step 2\n', 'utf8');
  await fsp.appendFile(pipelineFile, 'Step 3\n', 'utf8');
  console.log('\nPipeline result:', (await fsp.readFile(pipelineFile, 'utf8')).trim());
  console.log('(Flat and readable — no callback hell!)');

  // ────────────────────────────────────────────────────
  // SECTION 3 — Error Handling with try/catch
  // ────────────────────────────────────────────────────

  try {
    await fsp.readFile(path.join(TEMP_DIR, 'phantom.txt'), 'utf8');
  } catch (err) {
    console.log('\nAsync error caught:', err.code); // ENOENT
  }

  // ────────────────────────────────────────────────────
  // CLEANUP
  // ────────────────────────────────────────────────────

  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('\nCleanup complete:', !fs.existsSync(TEMP_DIR));

})();

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Sync methods block the event loop — only for startup/CLI scripts.
// 2. Callback methods are non-blocking but lead to "callback hell."
// 3. fs/promises + async/await = non-blocking with flat, readable code.
// 4. Always handle errors: try/catch for sync and await, error-first
//    parameter for callbacks.
// 5. Common codes: ENOENT (not found), EACCES (permission), EEXIST.
// 6. Always clean up temp files in scripts and tests.
// ============================================================
