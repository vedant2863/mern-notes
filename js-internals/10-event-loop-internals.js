// ============================================================
// FILE 10: EVENT LOOP INTERNALS
// Topic: How JavaScript processes asynchronous code
// WHY: JS is single-threaded, yet handles thousands of concurrent
//   operations. The event loop makes this possible. Misunderstanding
//   it causes race conditions, blocked UIs, and starvation bugs.
// ============================================================

// ============================================================
// SECTION 1 — The Big Picture
// Story: A single thread multiplexes work by processing one task
//   at a time from multiple priority queues.
// ============================================================

//  Call Stack (LIFO)  → where JS code executes
//  Web APIs / libuv   → async ops run on separate threads
//  Callback Queues    → completed async ops wait here
//  Event Loop         → moves callbacks to call stack when empty

console.log("Call Stack executes code. Async results queue up.");
console.log("Event loop moves queued callbacks to stack when it's empty.\n");


// ============================================================
// SECTION 2 — Microtasks vs Macrotasks
// Story: Two queue types with different priorities. This is the
//   single most important thing about the event loop.
// ============================================================

// MICROTASKS (high priority, drain completely between macrotasks):
//   Promise.then/.catch/.finally, queueMicrotask, process.nextTick

// MACROTASKS (normal priority, one per event loop iteration):
//   setTimeout, setInterval, setImmediate, I/O callbacks

// PRIORITY: Sync > process.nextTick > Microtask > Macrotask

console.log("=== QUIZ 1: setTimeout vs Promise ===");
setTimeout(() => console.log("  4. setTimeout callback"), 0);
Promise.resolve().then(() => console.log("  3. Promise.then callback"));
console.log("  1. Synchronous — first");
console.log("  2. Synchronous — second");
// Output: 1, 2, 3, 4


// ============================================================
// SECTION 3 — process.nextTick Priority
// Story: nextTick has HIGHER priority than even Promise microtasks.
// ============================================================

setTimeout(() => {
    console.log("\n--- Inside setTimeout (new macrotask) ---");
    setTimeout(() => console.log("  C. setTimeout (macrotask)"), 0);
    Promise.resolve().then(() => console.log("  B. Promise.then (microtask)"));
    process.nextTick(() => console.log("  A. process.nextTick (highest)"));
    console.log("  0. Synchronous (runs first)");
    // Output: 0, A, B, C
}, 0);


// ============================================================
// SECTION 4 — Node.js Event Loop Phases
// Story: Node.js has 6 phases, not just "macro vs micro."
// ============================================================

//  1. TIMERS      — setTimeout, setInterval
//  2. PENDING     — system callbacks (TCP errors)
//  3. IDLE        — internal use
//  4. POLL        — I/O callbacks (fs, net)
//  5. CHECK       — setImmediate
//  6. CLOSE       — socket.on('close')
//  Between every phase: nextTick queue → microtask queue


// ============================================================
// SECTION 5 — setTimeout(0) vs setImmediate
// ============================================================

// From main module: order is NON-DETERMINISTIC
setTimeout(() => console.log("\n  setTimeout from main"), 0);
setImmediate(() => console.log("  setImmediate from main"));

// Inside I/O callback: setImmediate ALWAYS first
const fs = require("fs");
fs.readFile(__filename, () => {
    setTimeout(() => console.log("  setTimeout from I/O"), 0);
    setImmediate(() => console.log("  setImmediate from I/O (always first!)"));
});


// ============================================================
// SECTION 6 — Microtask Starvation
// Story: Recursive microtasks starve macrotasks. setTimeout,
//   I/O, and rendering never get a chance to run.
// ============================================================

// BAD (don't run — freezes process):
// function infinite() { Promise.resolve().then(infinite); }

// GOOD: yield with setTimeout or setImmediate
function processQueueSafely(items, index) {
    if (index >= items.length) return;
    // ... process items[index] ...
    setImmediate(() => processQueueSafely(items, index + 1));
}
console.log("\nStarvation fix: break work with setImmediate between items");


// ============================================================
// SECTION 7 — Output Order Puzzles
// ============================================================

setTimeout(() => {
    console.log("\n=== OUTPUT ORDER PUZZLES ===\n");

    console.log("PUZZLE 1: A, D, C, B");
    console.log('  log("A"); setTimeout(=>"B",0); Promise.then(=>"C"); log("D");\n');

    console.log("PUZZLE 2: P1, P3, P2");
    console.log("  Two promises queued. P1 runs, queues P2 during execution.");
    console.log("  Queue after P1: [P3, P2]. So P3 before P2.\n");

    console.log("PUZZLE 3: async/await → A, F1, B, F2");
    console.log("  async function: code before await is sync.");
    console.log("  Code after await is a microtask.\n");

    console.log("PUZZLE 4: S, NT, P, T, NT-inner, P-inner");
    console.log("  nextTick > Promise > setTimeout. After T runs,");
    console.log("  NT-inner (nextTick) before P-inner (promise).\n");
}, 200);


// ============================================================
// SECTION 8 — Browser: rAF and rIC
// ============================================================

setTimeout(() => {
    console.log("=== Browser Event Loop ===");
    console.log("1. One macrotask → 2. Drain microtasks →");
    console.log("3. rAF + render (if time) → 4. rIC (if idle)\n");

    console.log("requestAnimationFrame: before repaint, ~60/sec, for animations");
    console.log("requestIdleCallback: during idle, for analytics/lazy-loading\n");
}, 210);


// ============================================================
// SECTION 9 — Best Practices
// ============================================================

setTimeout(() => {
    console.log("=== Event Loop Best Practices ===\n");

    console.log("1. Never block the event loop");
    console.log("   Use async versions (crypto.pbkdf2, not Sync)\n");

    console.log("2. Always handle promise rejections");
    console.log("   .catch() or try/catch with await\n");

    console.log("3. Use async/await consistently");
    console.log("   Don't mix callbacks and promises\n");

    console.log("4. Parallelize independent operations");
    console.log("   Promise.all([getUser(), getOrders()]) — concurrent!\n");
}, 220);


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. JS is single-threaded. The event loop multiplexes tasks from
//    different priority queues on that one thread.
//
// 2. Priority: Sync > nextTick > Microtask (Promise) > Macrotask.
//    ALL microtasks drain before the next macrotask.
//
// 3. Infinite microtasks = starvation. Use setTimeout/setImmediate
//    to yield back to the event loop.
//
// 4. Node.js phases: timers → pending → poll → check → close.
//    nextTick + microtasks drain between each phase.
//
// 5. async/await: code after `await` runs as a microtask.
//    Never block the loop with sync heavy computation.
// ============================================================

console.log("=== FILE 10 COMPLETE ===\n");
