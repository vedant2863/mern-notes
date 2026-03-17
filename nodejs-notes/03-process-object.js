/**
 * ============================================================
 *  FILE 3: The process Object
 * ============================================================
 *  Topic  : process.argv, process.env, process.cwd(), pid,
 *           memoryUsage, hrtime, stdout.write, nextTick,
 *           signals, exit event.
 * ============================================================
 */

// ============================================================
// STORY: Flight Director Meena at ISRO Sriharikota monitors
// telemetry panels: argv (launch commands), env (parameters),
// memory gauges, comms console, and lifecycle hooks.
// ============================================================

// ============================================================
// EXAMPLE BLOCK 1 — Identity & Environment
// ============================================================

console.log("=== BLOCK 1: Identity & Environment ===\n");

// ──────────────────────────────────────────────────────────
// SECTION 1 — process.argv (Launch Commands)
// ──────────────────────────────────────────────────────────
// argv[0] = node binary, argv[1] = script, argv[2+] = user args.

console.log("--- process.argv ---");
console.log("  argv[0] (node)   :", process.argv[0]);
console.log("  argv[1] (script) :", process.argv[1]);

// ──────────────────────────────────────────────────────────
// SECTION 2 — process.env (Environment Variables)
// ──────────────────────────────────────────────────────────
// Never log full env in production — it may contain secrets.

console.log("\n--- process.env (selected) ---");
console.log("  NODE_ENV :", process.env.NODE_ENV || "(not set)");
console.log("  SHELL    :", process.env.SHELL || "(not set)");
console.log("  HOME     :", process.env.HOME || process.env.USERPROFILE || "(not set)");

// ──────────────────────────────────────────────────────────
// SECTION 3 — Process Identity
// ──────────────────────────────────────────────────────────

console.log("\n--- Process Identity ---");
console.log("  process.pid      :", process.pid);
console.log("  process.ppid     :", process.ppid);
console.log("  process.cwd()    :", process.cwd());
console.log("  process.uptime() :", process.uptime().toFixed(4), "seconds");

// ============================================================
// EXAMPLE BLOCK 2 — Memory & Precision Timing
// ============================================================

console.log("\n=== BLOCK 2: Memory & Precision Timing ===\n");

// ──────────────────────────────────────────────────────────
// SECTION 4 — process.memoryUsage()
// ──────────────────────────────────────────────────────────
// Monitor heapUsed for leak detection. rss = total OS memory.

console.log("--- process.memoryUsage() ---");
const mem = process.memoryUsage();
const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";
console.log("  rss      :", toMB(mem.rss));
console.log("  heapUsed :", toMB(mem.heapUsed));
console.log("  external :", toMB(mem.external));

// ──────────────────────────────────────────────────────────
// SECTION 5 — process.hrtime.bigint() (Nanosecond Timer)
// ──────────────────────────────────────────────────────────

console.log("\n--- process.hrtime.bigint() Benchmark ---");
const hrStart = process.hrtime.bigint();
let benchSum = 0;
for (let i = 0; i < 1_000_000; i++) benchSum += i;
const hrElapsedNs = process.hrtime.bigint() - hrStart;

console.log("  Elapsed (ms)     :", (Number(hrElapsedNs) / 1_000_000).toFixed(4));
console.log("  Ns per iteration :", (Number(hrElapsedNs) / 1_000_000).toFixed(2));

// ============================================================
// EXAMPLE BLOCK 3 — Streams, Lifecycle & Signals
// ============================================================

console.log("\n=== BLOCK 3: Streams, Lifecycle & Signals ===\n");

// ──────────────────────────────────────────────────────────
// SECTION 6 — process.stdout.write() vs console.log()
// ──────────────────────────────────────────────────────────
// stdout.write gives raw control — no auto newline.

console.log("--- stdout.write vs console.log ---");
process.stdout.write("  stdout.write: no newline");
process.stdout.write(" — continues on same line\n");

// ──────────────────────────────────────────────────────────
// SECTION 7 — process.nextTick() Ordering
// ──────────────────────────────────────────────────────────
// Priority: sync > nextTick > Promise.then > setTimeout

console.log("\n--- process.nextTick() Ordering Demo ---");
console.log("  1. Synchronous");

setTimeout(() => {
  console.log("  4. setTimeout (macrotask)");
  printSignalDemo();
}, 0);

Promise.resolve().then(() => {
  console.log("  3. Promise.then (microtask)");
});

process.nextTick(() => {
  console.log("  2. process.nextTick (before Promise)");
});

// ──────────────────────────────────────────────────────────
// SECTION 8 — Signal Handling & Exit Hook
// ──────────────────────────────────────────────────────────

function printSignalDemo() {
  console.log("\n--- Signal Handling ---");
  const sigintHandler = () => {
    console.log("  Caught SIGINT! Initiating abort sequence...");
  };
  process.on("SIGINT", sigintHandler);
  console.log("  SIGINT handler registered.");
  process.removeListener("SIGINT", sigintHandler);
  console.log("  SIGINT handler removed (process won't hang).");
  // WHY: Leaving a SIGINT handler registered prevents Ctrl+C from exiting.

  // ──────────────────────────────────────────────────────
  // SECTION 9 — process.on('exit')
  // ──────────────────────────────────────────────────────
  // Only SYNCHRONOUS code runs here — no async operations.

  console.log("\n--- process.on('exit') ---");
  process.on("exit", (code) => {
    console.log("  [exit hook] Code:", code, "| Uptime:", process.uptime().toFixed(4), "s");

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    // 1. process.argv — CLI input; argv[2+] for user args.
    // 2. process.env — config without hardcoding; never log secrets.
    // 3. process.memoryUsage() — monitor heapUsed for leak detection.
    // 4. process.hrtime.bigint() — nanosecond-precision benchmarks.
    // 5. process.stdout.write() — raw output without trailing newline.
    // 6. Priority: sync > nextTick > Promise > setTimeout.
    // 7. process.on('SIGINT') — graceful shutdown; must call exit() or remove handler.
    // 8. process.on('exit') — synchronous-only last-chance cleanup.
    // ============================================================
  });

  console.log("  Exit hook registered.\n");
}
