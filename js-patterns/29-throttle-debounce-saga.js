/**
 * FILE 29 : Throttle, Debounce & Saga Patterns
 * Topic   : Rate Limiting & Multi-Step Transactions
 * Used in : Search inputs, scroll handlers (debounce/throttle), payment flows (saga)
 */

// STORY: Guard Ravi manages crowd flow on the Mumbai local train platform.
// No whistle blows too fast, no journey continues if a leg fails.

(async function () {

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Debounce
// ────────────────────────────────────────────────────────────
console.log("=== BLOCK 1: Debounce ===");

// Debounce: wait until events stop, then fire once
function debounce(fn, delay) {
  let timer = null;
  return function () {
    const args = Array.from(arguments);
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn(...args);
    }, delay);
  };
}

const whistleResults = await new Promise(function (resolve) {
  const results = [];
  const blowWhistle = debounce(function (passenger) {
    results.push(passenger);
  }, 30);

  // Ravi sees passengers rushing in, only blows after the last one
  blowWhistle("Amit");
  blowWhistle("Priya");
  blowWhistle("Rahul");
  blowWhistle("Sneha");

  setTimeout(function () { resolve(results); }, 60);
});
console.log("Debounced whistle:", whistleResults);
// Only [ 'Sneha' ] -- the last one

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Throttle
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 2: Throttle ===");

// Throttle: fire at most once per interval
function throttle(fn, interval) {
  let lastRun = 0;
  let timer = null;

  return function () {
    const args = Array.from(arguments);
    const now = Date.now();

    if (now - lastRun >= interval) {
      lastRun = now;
      fn(...args);
    } else {
      // Trailing call so the last event is not lost
      clearTimeout(timer);
      const remaining = interval - (now - lastRun);
      timer = setTimeout(function () {
        lastRun = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

const announcements = [];
const announce = throttle(function (station) {
  announcements.push(station);
}, 50);

announce("Churchgate");
announce("Marine Lines");
announce("Charni Road");
announce("Grant Road");

console.log("Immediate:", announcements.slice());
// [ 'Churchgate' ] -- only first fires immediately

await new Promise(function (r) { setTimeout(r, 70); });
console.log("After wait:", announcements);
// [ 'Churchgate', 'Grant Road' ] -- trailing edge got the last one

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Saga Pattern
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 3: Saga Pattern ===");

// Saga: run steps in order. If one fails, refund completed steps in reverse.

const sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

class Saga {
  constructor(name) {
    this.name = name;
    this.steps = [];
  }

  addStep(name, execute, compensate) {
    this.steps.push({ name: name, execute: execute, compensate: compensate });
    return this;
  }

  async run() {
    const completed = [];
    const log = [];

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      try {
        const result = await step.execute();
        log.push("[OK] " + step.name + ": " + result);
        completed.push(step);
      } catch (err) {
        log.push("[FAIL] " + step.name + ": " + err.message);
        // Refund in reverse order
        for (let j = completed.length - 1; j >= 0; j--) {
          try {
            const refund = await completed[j].compensate();
            log.push("[REFUND] " + completed[j].name + ": " + refund);
          } catch (undoErr) {
            log.push("[REFUND-FAIL] " + completed[j].name + ": " + undoErr.message);
          }
        }
        return { success: false, log: log };
      }
    }
    return { success: true, log: log };
  }
}

// Successful journey
const ok = await new Saga("Churchgate-Virar Express")
  .addStep("Churchgate-Dadar",
    async function () { await sleep(5); return "Rs 20 booked"; },
    async function () { return "Rs 20 refunded"; })
  .addStep("Dadar-Borivali",
    async function () { await sleep(5); return "Rs 15 booked"; },
    async function () { return "Rs 15 refunded"; })
  .addStep("Borivali-Virar",
    async function () { await sleep(5); return "Rs 10 booked"; },
    async function () { return "Rs 10 refunded"; })
  .run();
console.log("Success:", ok.success);
console.log(ok.log);

// Failed journey: second leg fails, first leg gets refunded
const fail = await new Saga("Churchgate-Virar Express")
  .addStep("Churchgate-Dadar",
    async function () { await sleep(5); return "Rs 20 booked"; },
    async function () { return "Rs 20 refunded"; })
  .addStep("Dadar-Borivali",
    async function () { throw new Error("Waterlogging!"); },
    async function () { return "Fare reversed"; })
  .addStep("Borivali-Virar",
    async function () { await sleep(5); return "Rs 10 booked"; },
    async function () { return "Rs 10 refunded"; })
  .run();
console.log("Failed:", fail.success);
console.log(fail.log);

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Debounce: wait for the last event. Ideal for search input, resize.
// 2. Throttle: max once per interval. Ideal for scroll, API rate limiting.
// 3. Saga: multi-step transactions with automatic rollback on failure.
// 4. Compensation runs in reverse order of completed steps.

})();
