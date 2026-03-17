/**
 * ============================================================
 *  FILE 1: Node.js Architecture
 * ============================================================
 *  Topic  : V8 engine, libuv, single-threaded event-driven
 *           model, blocking vs non-blocking I/O.
 * ============================================================
 */

// ============================================================
// STORY: Operator Sharma ji (the single JS thread) sits at the
// NTPC Singrauli control desk, dispatching work to turbines
// (libuv thread pool). He never leaves — results come back via
// signals. One operator, entire plant.
// ============================================================

const fs = require("fs");
const path = require("path");
const os = require("os");

// ============================================================
// EXAMPLE BLOCK 1 — Under the Hood: V8, libuv & the Runtime
// ============================================================

// ──────────────────────────────────────────────────────────
// SECTION 1 — The Three Pillars of Node.js
// ──────────────────────────────────────────────────────────
// 1. V8 ENGINE (Google)
//    - JIT compiles JS to machine code. Manages heap & call stack.
//    - Knows nothing about files, networks, or timers.
//
// 2. LIBUV (C library)
//    - Event loop, thread pool (default 4), OS-level async I/O.
//    - Handles file system ops, DNS lookups, compression.
//
// 3. NODE.JS BINDINGS (C++ glue)
//    - Bridge between JS and C/C++. fs.readFile() -> libuv -> thread pool.
//
// SINGLE-THREADED MODEL:
//    JS runs on ONE thread. Libuv does heavy lifting on background
//    threads. Callbacks return results via the event loop.

console.log("=== BLOCK 1: Node.js Architecture Internals ===\n");

// ──────────────────────────────────────────────────────────
// SECTION 2 — process.versions: What Powers Your Runtime
// ──────────────────────────────────────────────────────────

console.log("--- Component Versions ---");
console.log("  Node.js :", process.versions.node);
console.log("  V8      :", process.versions.v8);
console.log("  libuv   :", process.versions.uv);
console.log("  OpenSSL :", process.versions.openssl);

// ──────────────────────────────────────────────────────────
// SECTION 3 — Platform & Architecture
// ──────────────────────────────────────────────────────────

console.log("\n--- Platform Info ---");
console.log("  process.arch     :", process.arch);
// Output: x64  (or arm64 on Apple Silicon)
console.log("  process.platform :", process.platform);
// Output: darwin  (or linux, win32)
console.log("  os.cpus().length :", os.cpus().length);
console.log("  os.totalmem() MB :", Math.round(os.totalmem() / 1024 / 1024));

// ============================================================
// EXAMPLE BLOCK 2 — Blocking vs Non-Blocking I/O
// ============================================================

// ──────────────────────────────────────────────────────────
// SECTION 4 — Blocking vs Non-Blocking in Action
// ──────────────────────────────────────────────────────────
// BLOCKING: Sharma ji walks to the turbine and waits. Nothing
//   else happens until it finishes.
// NON-BLOCKING: Sharma ji sends a work order, handles the next
//   task immediately, processes the result on callback.

console.log("\n=== BLOCK 2: Blocking vs Non-Blocking I/O ===\n");

const tmpDir = os.tmpdir();
const tmpFile = path.join(tmpDir, "node-arch-demo.txt");
const demoContent = "Operator Sharma ji dispatched this work order.\n".repeat(500);
fs.writeFileSync(tmpFile, demoContent);

// ──────────────────────────────────────────────────────────
// SECTION 5 — Synchronous Read (Blocking)
// ──────────────────────────────────────────────────────────

console.log("--- Synchronous (Blocking) Read ---");
const syncStart = Date.now();
const syncData = fs.readFileSync(tmpFile, "utf-8");
console.log("  Bytes read:", syncData.length, "| Time:", Date.now() - syncStart, "ms (thread BLOCKED)");

// ──────────────────────────────────────────────────────────
// SECTION 6 — Asynchronous Read (Non-Blocking)
// ──────────────────────────────────────────────────────────

console.log("\n--- Asynchronous (Non-Blocking) Read ---");
const asyncStart = Date.now();
console.log("  [before] Dispatching async read...");

fs.readFile(tmpFile, "utf-8", (err, data) => {
  if (err) throw err;
  console.log("  [callback] Bytes read:", data.length, "| Time:", Date.now() - asyncStart, "ms");

  // ──────────────────────────────────────────────────────
  // SECTION 7 — Interleaving Proof
  // ──────────────────────────────────────────────────────
  // The "interleaved work" log below ran WHILE the file was
  // being read — proof the thread stayed free.

  fs.unlink(tmpFile, (unlinkErr) => {
    if (unlinkErr) console.error("  Cleanup error:", unlinkErr.message);
    else console.log("  Temp file cleaned up.");

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    // 1. Node.js = V8 (JS engine) + libuv (async I/O) + C++ bindings.
    // 2. JS runs on a SINGLE THREAD; libuv uses a thread pool (default 4).
    // 3. BLOCKING (sync) calls freeze the thread — avoid in servers.
    // 4. NON-BLOCKING (async) calls dispatch to libuv and return immediately.
    // 5. Always prefer async APIs in production. Sync is fine for
    //    startup scripts or CLIs where concurrency is irrelevant.
    // ============================================================
  });
});

// Runs IMMEDIATELY — does NOT wait for the async read.
console.log("  [after]  Interleaved work while file is being read!");
