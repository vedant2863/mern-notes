/**
 * ============================================================
 *  FILE 2: Node.js Global Objects
 * ============================================================
 *  Topic  : global, globalThis, __dirname, __filename,
 *           Buffer, URL, TextEncoder/TextDecoder,
 *           structuredClone, queueMicrotask, performance.
 * ============================================================
 */

// ============================================================
// STORY: Like ISRO mission control's always-visible instrument
// panels, Node.js globals are available in every module without
// require(). Know the dashboard before reaching for imports.
// ============================================================

// ============================================================
// EXAMPLE BLOCK 1 — The Built-In Instrument Panels
// ============================================================

console.log("=== BLOCK 1: Built-In Globals ===\n");

// ──────────────────────────────────────────────────────────
// SECTION 1 — global and globalThis
// ──────────────────────────────────────────────────────────
// In browsers it's `window`, in Node it's `global`.
// `globalThis` is the universal standard (ES2020+).

console.log("--- global vs globalThis ---");
console.log("  globalThis === global :", globalThis === global); // true

// ──────────────────────────────────────────────────────────
// SECTION 2 — __dirname and __filename
// ──────────────────────────────────────────────────────────
// Available in CommonJS. In ESM, use import.meta.dirname (Node 21.2+).

console.log("\n--- __dirname and __filename ---");
console.log("  __dirname  :", __dirname);
console.log("  __filename :", __filename);

// ──────────────────────────────────────────────────────────
// SECTION 3 — Buffer (Binary Data)
// ──────────────────────────────────────────────────────────
// JS strings are UTF-16. Buffer gives byte-level control
// for files, network packets, and crypto.

console.log("\n--- Buffer ---");
const buf = Buffer.from("hello");
console.log("  Buffer.from('hello') :", buf);
// Output: <Buffer 68 65 6c 6c 6f>
console.log("  buf.toString()       :", buf.toString());
console.log("  buf.length           :", buf.length);

// ──────────────────────────────────────────────────────────
// SECTION 4 — URL (Navigation Panel)
// ──────────────────────────────────────────────────────────
// WHATWG URL API — globally available, safer than string splitting.

console.log("\n--- URL ---");
const myUrl = new URL("https://isro.gov.in:8080/api/satellites?active=true&mission=chandrayaan#section1");
console.log("  protocol :", myUrl.protocol);
console.log("  hostname :", myUrl.hostname);
console.log("  pathname :", myUrl.pathname);
console.log("  search   :", myUrl.search);
console.log("  searchParams.get('mission') :", myUrl.searchParams.get("mission"));

// ──────────────────────────────────────────────────────────
// SECTION 5 — TextEncoder and TextDecoder
// ──────────────────────────────────────────────────────────
// Convert between strings and Uint8Array (byte arrays).

console.log("\n--- TextEncoder / TextDecoder ---");
const encoder = new TextEncoder();
const encoded = encoder.encode("ISRO Chandrayaan");
console.log("  Encoded byte length :", encoded.byteLength); // 16

const decoder = new TextDecoder();
console.log("  Decoded string      :", decoder.decode(encoded));

// ============================================================
// EXAMPLE BLOCK 2 — Advanced Global Utilities
// ============================================================

console.log("\n=== BLOCK 2: Advanced Global Utilities ===\n");

// ──────────────────────────────────────────────────────────
// SECTION 6 — structuredClone (Deep Copy)
// ──────────────────────────────────────────────────────────
// Unlike JSON.parse(JSON.stringify()), structuredClone handles
// Dates, Maps, Sets, RegExps, and circular references.

console.log("--- structuredClone ---");
const original = {
  name: "Chandrayaan-3",
  readings: [98.2, 97.8],
  lastChecked: new Date("2025-06-15T10:30:00Z"),
  metadata: { nested: { deep: true } },
};

const clone = structuredClone(original);
clone.name = "Aditya-L1";
clone.readings.push(100.0);
clone.metadata.nested.deep = false;

console.log("  original.name   :", original.name);   // Chandrayaan-3
console.log("  clone.name      :", clone.name);       // Aditya-L1
console.log("  original.nested :", original.metadata.nested); // { deep: true }
console.log("  Date preserved  :", clone.lastChecked instanceof Date); // true

// ──────────────────────────────────────────────────────────
// SECTION 7 — Module Scope vs Global
// ──────────────────────────────────────────────────────────
// Node wraps each CJS module in a function scope, so `var`
// does NOT attach to `global` (unlike browsers with `window`).

console.log("\n--- Module Scope vs Global ---");
var satelliteName = "Chandrayaan";
console.log("  global.satelliteName :", global.satelliteName); // undefined

// ──────────────────────────────────────────────────────────
// SECTION 8 — queueMicrotask
// ──────────────────────────────────────────────────────────
// Runs after current call stack, BEFORE I/O or timer callbacks.

console.log("\n--- queueMicrotask ---");
console.log("  1. Sync — before queueMicrotask");
queueMicrotask(() => {
  console.log("  3. Microtask — runs after sync, before timers");
});
console.log("  2. Sync — after queueMicrotask");

// ──────────────────────────────────────────────────────────
// SECTION 9 — performance.now()
// ──────────────────────────────────────────────────────────
// Sub-millisecond precision for benchmarking (vs Date.now() ms).

setTimeout(() => {
  console.log("\n--- performance.now() ---");
  const perfStart = performance.now();
  let sum = 0;
  for (let i = 0; i < 1_000_000; i++) sum += i;
  const elapsed = (performance.now() - perfStart).toFixed(4);
  console.log("  Sum of 0..999999 :", sum, "| Time:", elapsed, "ms");

  // ============================================================
  // KEY TAKEAWAYS
  // ============================================================
  // 1. globalThis === global in Node; use globalThis for cross-env code.
  // 2. __dirname/__filename are CJS globals; ESM uses import.meta.
  // 3. Buffer handles raw binary — no require() needed.
  // 4. URL/URLSearchParams parse URLs safely.
  // 5. structuredClone does true deep copies preserving Dates/Maps/Sets.
  // 6. `var` at module top does NOT attach to global (CJS wraps in function).
  // 7. queueMicrotask: after sync, before I/O and timers.
  // 8. performance.now(): sub-millisecond precision.
  // ============================================================
}, 0);
