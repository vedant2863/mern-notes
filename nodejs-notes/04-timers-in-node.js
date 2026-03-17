/**
 * ============================================================
 *  FILE 4: Timers in Node.js
 * ============================================================
 *  Topic  : setTimeout, setImmediate, setInterval,
 *           process.nextTick, event loop phases,
 *           timer.ref(), timer.unref(), clear* functions.
 * ============================================================
 */

// ============================================================
// STORY: Railway control at NDLS manages three train types:
// RAJDHANI (nextTick) = highest priority, SHATABDI (setImmediate)
// = check phase after I/O, LOCAL (setTimeout) = timers phase.
// ============================================================

// ============================================================
// EXAMPLE BLOCK 1 — Execution Order & Event Loop Phases
// ============================================================

console.log("=== BLOCK 1: Execution Order & Event Loop Phases ===\n");

// ──────────────────────────────────────────────────────────
// SECTION 1 — The Six Phases of the Node.js Event Loop
// ──────────────────────────────────────────────────────────
// Phase 1: TIMERS      — setTimeout, setInterval callbacks
// Phase 2: PENDING     — deferred I/O callbacks (TCP errors)
// Phase 3: IDLE        — internal libuv housekeeping
// Phase 4: POLL        — retrieve new I/O events, run I/O callbacks
// Phase 5: CHECK       — setImmediate callbacks
// Phase 6: CLOSE       — close event callbacks (socket.on('close'))
//
// BETWEEN EVERY PHASE: Node drains nextTick, then Promise queue.

// ──────────────────────────────────────────────────────────
// SECTION 2 — The Classic Ordering Test
// ──────────────────────────────────────────────────────────

console.log("--- Ordering Demo ---");
console.log("  1. Synchronous — always first");

setTimeout(() => {
  console.log("  5. setTimeout(fn, 0) — timers phase");
}, 0);

setImmediate(() => {
  console.log("  6. setImmediate(fn) — check phase");
});

process.nextTick(() => {
  console.log("  2. process.nextTick — before all microtasks");
});

Promise.resolve().then(() => {
  console.log("  3. Promise.then — after nextTick, before timers");
});

queueMicrotask(() => {
  console.log("  4. queueMicrotask — same queue as Promise.then");
});

console.log("  1b. Synchronous — still first (call stack)");

// NOTE: Outside I/O, setTimeout vs setImmediate order is non-deterministic.
// Inside an I/O callback, setImmediate ALWAYS fires first.

// ──────────────────────────────────────────────────────────
// SECTION 3 — Inside I/O: Deterministic Order
// ──────────────────────────────────────────────────────────

const fs = require("fs");

fs.readFile(__filename, () => {
  console.log("\n--- Inside I/O callback (deterministic) ---");

  setTimeout(() => {
    console.log("  B. setTimeout — timers phase (next iteration)");
  }, 0);

  setImmediate(() => {
    console.log("  A. setImmediate — check phase (ALWAYS first here)");
  });

  process.nextTick(() => {
    console.log("  0. nextTick — before both (between phases)");
  });
  // Guaranteed: 0 -> A -> B
});

// ──────────────────────────────────────────────────────────
// SECTION 4 — Nested nextTick Starvation
// ──────────────────────────────────────────────────────────
// nextTick drains completely (including nested ticks) before
// Promises get a turn — can starve other queues.

setTimeout(() => {
  console.log("\n--- nextTick vs Promise interleaving ---");
  process.nextTick(() => {
    console.log("  tick 1");
    process.nextTick(() => {
      console.log("  tick 2 (nested — still before Promise)");
    });
  });
  Promise.resolve().then(() => {
    console.log("  promise 1 (after ALL nextTicks drain)");
  });
}, 50);

// ──────────────────────────────────────────────────────────
// SECTION 5 — Queue Priority Reference
// ──────────────────────────────────────────────────────────
// #0 Call Stack (sync) > #1 nextTick > #2 Promise/microtask
// > #3 Timer > #4 I/O Callback > #5 I/O Poll
// > #6 Check (setImmediate) > #7 Close
//
// Memory aid: "N P T I C C" — nextTick, Promise, Timer,
// I/O, Check, Close

// ============================================================
// EXAMPLE BLOCK 2 — Timer Control: ref, unref & Cleanup
// ============================================================

setTimeout(() => {
  console.log("\n=== BLOCK 2: Timer Control — ref, unref & Cleanup ===\n");

  // ──────────────────────────────────────────────────────
  // SECTION 6 — timer.unref() and timer.ref()
  // ──────────────────────────────────────────────────────
  // unref(): don't keep process alive just for this timer.
  // ref(): reverse unref — process waits for the timer.

  console.log("--- timer.unref() / ref() ---");
  const heartbeat = setInterval(() => {}, 30);
  heartbeat.unref();
  console.log("  Interval unref'd — process won't hang for it.");

  const bgTimer = setTimeout(() => {
    console.log("  bgTimer fired (was ref'd again).");
  }, 20);
  bgTimer.unref();
  bgTimer.ref();
  console.log("  bgTimer unref'd then ref'd — process WILL wait.");

  // ──────────────────────────────────────────────────────
  // SECTION 7 — Clearing Timers
  // ──────────────────────────────────────────────────────

  console.log("\n--- Clearing Timers ---");
  const myImmediate = setImmediate(() => {});
  clearImmediate(myImmediate);
  console.log("  setImmediate cleared.");

  const myTimeout = setTimeout(() => {}, 100);
  clearTimeout(myTimeout);
  console.log("  setTimeout cleared.");

  clearInterval(heartbeat);
  console.log("  Heartbeat interval cleared.");

  // ──────────────────────────────────────────────────────
  // SECTION 8 — Self-Cancelling Interval
  // ──────────────────────────────────────────────────────

  console.log("\n--- Self-Cancelling Interval ---");
  let tickCount = 0;
  const maxTicks = 3;

  const selfCancelling = setInterval(() => {
    tickCount++;
    console.log("  Tick #" + tickCount + " of " + maxTicks);
    if (tickCount >= maxTicks) {
      clearInterval(selfCancelling);
      console.log("  Interval self-cancelled.");

      // ============================================================
      // KEY TAKEAWAYS
      // ============================================================
      // 1. Event loop phases: Timers > Pending > Poll > Check > Close.
      //    Microtasks (nextTick, Promise) drain between every phase.
      // 2. nextTick drains before Promises (starvation risk with nesting).
      // 3. Inside I/O: setImmediate ALWAYS before setTimeout(fn, 0).
      // 4. timer.unref() lets process exit; timer.ref() reverses it.
      // 5. Always clear timers you no longer need to prevent leaks.
      // ============================================================
    }
  }, 25);
}, 200);
