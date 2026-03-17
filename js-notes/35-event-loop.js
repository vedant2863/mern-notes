/**
 * ============================================================
 *  FILE 35: THE EVENT LOOP
 * ============================================================
 *  Call stack, microtasks, macrotasks, and the event loop
 *  cycle that orchestrates all async JavaScript execution.
 *
 *  STORY — The Railway Station Enquiry Counter
 *  One busy enquiry counter at an Indian railway station:
 *    - CLERK (call stack) -- handles one query at a time
 *    - VIP TOKENS (microtasks) -- always served first
 *    - GENERAL TOKENS (macrotasks) -- served only after
 *      all VIP tokens are done
 *  Cycle: finish current -> ALL VIP tokens -> ONE general
 *  token -> ALL VIP tokens -> ONE general token -> ...
 * ============================================================
 */


// ============================================================
//  SECTION 1: THE THREE QUEUES
// ============================================================
// 1. Call stack    -- sync code, runs immediately
// 2. Microtask     -- Promise .then/.catch, queueMicrotask
// 3. Macrotask     -- setTimeout, setInterval, I/O
//
// Order: stack empties -> drain ALL microtasks -> ONE macrotask -> repeat

console.log("1. Clerk opens the window");           // sync

setTimeout(() => {
  console.log("5. General Token (setTimeout)");      // macrotask
}, 0);

Promise.resolve().then(() => {
  console.log("3. VIP Token (Promise.then)");        // microtask
});

queueMicrotask(() => {
  console.log("4. VIP Token (queueMicrotask)");      // microtask
});

console.log("2. Clerk finishes current passenger");  // sync

// Output: 1, 2, 3, 4, 5


// ============================================================
//  SECTION 2: MICROTASKS SPAWNING MICROTASKS
// ============================================================
// New microtasks drain BEFORE any macrotask. They are FIFO.

setTimeout(() => {
  console.log("D. General Token: finally served!");
}, 0);

Promise.resolve().then(() => {
  console.log("A. VIP #1: train arrival query");
  Promise.resolve().then(() => {
    console.log("B. VIP #1: follow-up about platform");
  });
});

queueMicrotask(() => {
  console.log("C. VIP #2: ticket refund enquiry");
});

// Output: A, C, B, D
// B was spawned by A, but C was already queued, so C runs first.


// ============================================================
//  SECTION 3: THE CLASSIC INTERVIEW QUIZ
// ============================================================

console.log("1");                                         // sync

setTimeout(() => console.log("2"), 10);                   // macrotask (10ms)
setTimeout(() => console.log("3"), 0);                    // macrotask (0ms)

new Promise((resolve) => {
  console.log("4");  // executor is SYNCHRONOUS
  resolve();
})
  .then(() => console.log("5"))                           // microtask
  .then(() => console.log("6"));                          // microtask (chained)

queueMicrotask(() => console.log("7"));                   // microtask

console.log("8");                                         // sync

// Output: 1, 4, 8, 5, 7, 6, 3, 2
// Trap: "4" prints during sync phase -- the executor runs immediately.


// ============================================================
//  SECTION 4: MICROTASK STARVATION
// ============================================================
// Infinite microtask loops starve macrotasks (and page rendering).

let floodCount = 0;

function floodMicrotasks() {
  if (floodCount < 5) {
    floodCount++;
    console.log(`  Microtask flood #${floodCount}`);
    queueMicrotask(floodMicrotasks);
  }
}

setTimeout(() => {
  console.log("  General Token FINALLY gets a turn");
}, 0);

queueMicrotask(floodMicrotasks);
// All 5 microtasks run before the setTimeout callback.


// ============================================================
//  SECTION 5: return Promise.resolve() NUANCE
// ============================================================
// Returning a thenable from .then() adds an extra microtask tick.

Promise.resolve()
  .then(() => {
    console.log("  A");
    return Promise.resolve();  // extra tick!
  })
  .then(() => console.log("  C"));

queueMicrotask(() => console.log("  B"));

// Output: A, B, C  (not A, C, B)
// Plain return value would give A, C, B -- no extra tick.


// ============================================================
//  SECTION 6: MACROTASK + MICROTASK INTERLEAVING
// ============================================================
// One macrotask -> drain microtasks -> next macrotask.

setTimeout(() => {
  setTimeout(() => {
    console.log("  1. First macrotask");
    Promise.resolve().then(() => {
      console.log("  2. Microtask inside first macrotask");
    });
  }, 0);

  setTimeout(() => {
    console.log("  3. Second macrotask");
  }, 0);
  // Output: 1, 2, 3 (NOT 1, 3, 2)
}, 500);


// ============================================================
//  SECTION 7: BROWSER — requestAnimationFrame
// ============================================================
// rAF runs AFTER microtasks, BEFORE next macrotask's paint.
// Browser loop: stack -> microtasks -> rAF -> paint -> macrotask
//
// Example (browser-only):
//   setTimeout(() => console.log("macrotask"), 0);
//   requestAnimationFrame(() => console.log("rAF"));
//   Promise.resolve().then(() => console.log("microtask"));
//   // Output: microtask -> rAF -> macrotask


/**
 * ============================================================
 *  KEY TAKEAWAYS
 * ============================================================
 *  1. One call stack. Sync code always runs to completion.
 *  2. Microtasks (Promise .then, queueMicrotask) drain
 *     entirely before any macrotask gets a turn.
 *  3. Only ONE macrotask per loop iteration.
 *  4. Cycle: stack empties -> ALL microtasks -> ONE macrotask.
 *  5. Promise executor is synchronous; only .then/.catch
 *     handlers are microtasks.
 *  6. Microtasks spawning microtasks drain before macrotasks.
 *     Infinite loops = starvation.
 *  7. return Promise.resolve() inside .then() adds an extra
 *     microtask tick.
 * ============================================================
 */
