/**
 * FILE 27 : Promise Patterns
 * Topic   : Promise.all, race, allSettled, any, Sequential, Pool
 * Used in : API calls, parallel data fetching, rate-limited uploads
 */

// STORY: Dispatch Manager Arjun coordinates parallel Swiggy deliveries
// across Bangalore, choosing the right strategy for each batch.

function deliver(restaurant, ms, shouldFail) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (shouldFail) {
        reject(new Error("Order from " + restaurant + " failed"));
      } else {
        resolve(restaurant + " delivered");
      }
    }, ms);
  });
}

(async function () {

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Promise.all & Promise.allSettled
// ────────────────────────────────────────────────────────────
console.log("=== BLOCK 1: Promise.all & Promise.allSettled ===");

// Promise.all: runs in parallel, fails fast if ANY reject
try {
  const batch = await Promise.all([
    deliver("Meghana Biryani", 10),
    deliver("MTR Dosa", 20),
    deliver("Onesta Pizza", 15),
  ]);
  console.log("All success:", batch);
} catch (e) {
  console.log("Batch failed:", e.message);
}

// One bad order kills the whole batch
try {
  await Promise.all([
    deliver("Truffles Burger", 30),
    deliver("Empire Kebab", 10, true),
    deliver("Vidyarthi Bhavan", 20),
  ]);
} catch (e) {
  console.log("Fail-fast:", e.message);
}

// allSettled: never rejects, reports every result
const settled = await Promise.allSettled([
  deliver("Fanoos Shawarma", 10),
  deliver("Corner House", 20, true),
  deliver("Brahmin Idli", 15),
]);

const report = [];
for (let i = 0; i < settled.length; i++) {
  if (settled[i].status === "fulfilled") {
    report.push(settled[i].value);
  } else {
    report.push("FAILED: " + settled[i].reason.message);
  }
}
console.log("allSettled:", report);

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Promise.race & Promise.any
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 2: Promise.race & Promise.any ===");

// race: first to settle (resolve OR reject) wins. Great for timeouts.
function withTimeout(promise, ms) {
  const timeout = new Promise(function (resolve, reject) {
    setTimeout(function () {
      reject(new Error("Timeout"));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

try {
  await withTimeout(deliver("Whitefield Thali", 100), 20);
} catch (e) {
  console.log("Slow delivery:", e.message);
}

// any: first to FULFILL wins (ignores rejections)
const winner = await Promise.any([
  deliver("HSR Chai", 50, true),
  deliver("Indiranagar Dosa", 20),
  deliver("Jayanagar Chaat", 30),
]);
console.log("Any winner:", winner);

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Sequential Execution & Concurrency Pool
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 3: Sequential & Pool ===");

// Sequential: one at a time using a simple loop
const areas = ["Koramangala", "Indiranagar", "HSR Layout"];
const sequential = [];
for (let i = 0; i < areas.length; i++) {
  const result = await deliver(areas[i] + " Meal", 10);
  sequential.push(result);
}
console.log("Sequential:", sequential);

// Pool: limit concurrency to N at a time
async function pool(tasks, limit) {
  const results = [];
  const running = new Set();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promise = task().then(function (result) {
      running.delete(promise);
      return result;
    });
    results.push(promise);
    running.add(promise);

    if (running.size >= limit) {
      await Promise.race(running);
    }
  }

  return Promise.all(results);
}

const pooled = await pool([
  function () { return deliver("Meghana Biryani", 30); },
  function () { return deliver("MTR Masala Dosa", 10); },
  function () { return deliver("Vidyarthi Bhavan", 20); },
  function () { return deliver("Empire Fried Rice", 10); },
], 2);
console.log("Pool (limit 2):", pooled);

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Promise.all -- parallel, fail-fast on first rejection.
// 2. Promise.allSettled -- parallel, always returns all results.
// 3. Promise.race -- first to settle wins (timeout pattern).
// 4. Promise.any -- first to fulfill wins (redundancy pattern).
// 5. Sequential via for loop -- strict ordering when needed.
// 6. Pool pattern -- bounded concurrency to avoid overload.

})();
