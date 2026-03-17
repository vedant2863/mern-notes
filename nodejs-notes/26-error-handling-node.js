/** ============================================================
    FILE 26: Error Handling in Node.js
    ============================================================
    Topic: Callbacks, global handlers, abort, graceful shutdown
    WHY THIS MATTERS:
    Node has error patterns unique to its async nature. Error-first
    callbacks, unhandled rejections, and uncaught exceptions each
    need different handling. Getting this wrong means silent
    failures or crashed servers at 3 AM.
    ============================================================ */

// ============================================================
// STORY: AIIMS Hospital Error Handling
// Dr. Sharma runs the AIIMS Emergency Ward. Known conditions
// get standard callbacks, serious complications trigger global
// alarms, and code blue (uncaught exception) means the entire
// ward evacuates gracefully.
// ============================================================

const fs = require('fs');
const path = require('path');

// ============================================================
// EXAMPLE BLOCK 1 — Error-First Callback Pattern
// ============================================================

console.log('=== Dr. Sharma opens the AIIMS Emergency Ward ===\n');

// The error-first callback convention: (err, result)
function divideAsync(a, b, callback) {
  setImmediate(() => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      return callback(new TypeError('Arguments must be numbers'));
    }
    if (b === 0) return callback(new RangeError('Division by zero'));
    callback(null, a / b);
  });
}

divideAsync(10, 3, (err, result) => {
  if (err) { console.log(`Error: ${err.message}`); return; }
  console.log(`10 / 3 = ${result.toFixed(4)}`);
});

divideAsync(10, 0, (err) => {
  if (err) console.log(`Error (expected): ${err.constructor.name}: ${err.message}`);
  // Output: RangeError: Division by zero
});

// ──────────────────────────────────────────────────────────
// System error codes from the OS
// ──────────────────────────────────────────────────────────
// ENOENT — file not found    ECONNREFUSED — server down
// EACCES — permission denied EADDRINUSE — port taken
// ECONNRESET — reset         ETIMEDOUT — timed out

const fakeFile = path.join(__dirname, 'this-file-does-not-exist.txt');
try {
  fs.readFileSync(fakeFile);
} catch (err) {
  console.log(`\nTriggered: ${err.code} — ${err.message.split(',')[0]}`);
  console.log(`  err.code: ${err.code}, err.syscall: ${err.syscall}`);
  // Use err.code (not err.message) for programmatic handling.
}

// ──────────────────────────────────────────────────────────
// Custom errors with codes
// ──────────────────────────────────────────────────────────
class MedicalError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'MedicalError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const err = new MedicalError('Patient record not found', 'PATIENT_NOT_FOUND', 404);
console.log(`\nCustom: [${err.code}] ${err.message} (${err.statusCode})`);

// ============================================================
// EXAMPLE BLOCK 2 — Global Error Handlers
// ============================================================

console.log('\n--- BLOCK 2: Global Error Handlers ---\n');

let rejectionCaught = false;

const rejectionHandler = (reason) => {
  rejectionCaught = true;
  console.log(`[Global] Unhandled Rejection: ${reason}`);
};

const exceptionHandler = (err) => {
  console.log(`[Global] Uncaught Exception: ${err.message}`);
  // After uncaughtException, process state is UNRELIABLE.
  // Log, flush, exit. Let PM2/systemd restart.
};

process.on('unhandledRejection', rejectionHandler);
process.on('uncaughtException', exceptionHandler);

// Trigger an unhandled rejection
Promise.reject('OPD registration system failed');

setTimeout(() => {
  console.log(`  rejectionCaught: ${rejectionCaught}`);

  // uncaughtException — when a throw escapes all try/catch
  console.log('\n  Why uncaughtException should shut down:');
  console.log('  1. Process state is unknown/corrupted');
  console.log('  2. Resources may be leaked');
  console.log('  3. Use PM2/systemd to auto-restart');

  runBlock3();
}, 100);

// ============================================================
// EXAMPLE BLOCK 3 — AbortController and Graceful Shutdown
// ============================================================

function runBlock3() {
  console.log('\n--- BLOCK 3: AbortController and Graceful Shutdown ---\n');

  // ──────────────────────────────────────────────────────────
  // AbortController — cancel async operations
  // ──────────────────────────────────────────────────────────
  const controller = new AbortController();
  const { signal } = controller;

  const timeoutId = setTimeout(() => {
    console.log('  Timer fired (should NOT appear)');
  }, 5000);

  signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    console.log(`  Cancelled! Reason: ${signal.reason}`);
  });

  setTimeout(() => controller.abort('Patient discharged early'), 50);

  // AbortSignal.timeout() — auto-cancel after duration
  const autoSignal = AbortSignal.timeout(100);
  autoSignal.addEventListener('abort', () => {
    console.log(`  Auto-timeout: ${autoSignal.reason.message}`);
  });

  // ──────────────────────────────────────────────────────────
  // Graceful shutdown pattern — SIGTERM / SIGINT
  // ──────────────────────────────────────────────────────────
  // On kill signal: stop accepting work, finish in-flight
  // requests, close DB, flush logs, exit cleanly.

  console.log('\n  Graceful shutdown pattern:');
  const resources = {
    server: { close: () => console.log('    [Shutdown] Server closed') },
    db:     { end:   () => console.log('    [Shutdown] Database closed') },
    cache:  { quit:  () => console.log('    [Shutdown] Cache disconnected') },
  };

  function gracefulShutdown(sig) {
    console.log(`\n    [Shutdown] Received ${sig}...`);
    resources.server.close();
    resources.db.end();
    resources.cache.quit();
    console.log('    [Shutdown] All resources released.');
  }

  gracefulShutdown('SIGTERM');

  // In real code:
  // process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  // process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  // setTimeout(() => { process.exit(1); }, 10000).unref();

  setTimeout(() => {
    process.removeListener('unhandledRejection', rejectionHandler);
    process.removeListener('uncaughtException', exceptionHandler);
    console.log('\n=== Dr. Sharma clocks out. AIIMS is stable. ===');
  }, 300);
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Error-first callbacks: always check err first, return after.
// 2. System errors have .code (ENOENT, ECONNREFUSED).
//    Use .code for programmatic checks, not .message.
// 3. unhandledRejection: log + consider shutdown.
//    In Node 15+, unhandled rejections crash by default.
// 4. uncaughtException: log + ALWAYS shut down.
// 5. AbortController cancels async ops via signal.
// 6. Graceful shutdown: SIGTERM -> close server -> close DB
//    -> flush logs -> process.exit(0).
// 7. Use .unref() on shutdown timers so they don't keep
//    the process alive.
// ============================================================
