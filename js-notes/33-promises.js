/**
 * ============================================================
 *  FILE 33: Promises in JavaScript
 * ============================================================
 *  Topic: Promise constructor, .then/.catch/.finally,
 *         chaining, error propagation, and combinators.
 * ============================================================
 *
 *  STORY — Zomato Food Delivery
 *  Every order is a Promise. You place it (pending), the
 *  restaurant prepares it (fulfilled) or cancels (rejected).
 *  Kitchen -> rider -> doorstep is a .then() chain. Multiple
 *  restaurants at once? That's Promise.all().
 * ============================================================
 */


// ============================================================
//  SECTION 1: The Problem — Callback Hell
// ============================================================

// Nested callbacks = "pyramid of doom". Promises flatten this.
function prepareOrderCB(dish, cb) {
  setTimeout(() => cb(null, { dish, status: "prepared" }), 100);
}

console.log("--- Callback Hell ---");
prepareOrderCB("Biryani", (err, order) => {
  if (err) return console.log(err);
  console.log(`  [Callback] ${order.dish} → ${order.status}`);
});


// ============================================================
//  SECTION 2: Creating a Promise
// ============================================================

// Three states: pending -> fulfilled (resolve) or rejected (reject).
// Once settled, it NEVER changes.

function prepareOrder(dish) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!dish) return reject(new Error("No dish specified!"));
      resolve({ dish, status: "prepared" });
    }, 100);
  });
}

function pickUpOrder(order) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ...order, status: "picked-up" }), 100);
  });
}

function deliverOrder(order) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ...order, status: "delivered" }), 100);
  });
}


// ============================================================
//  SECTION 3: .then() / .catch() / .finally()
// ============================================================

// .then() = success, .catch() = failure, .finally() = cleanup.
// Each returns a NEW Promise, enabling chaining.

setTimeout(() => {
  console.log("\n--- .then / .catch / .finally ---");

  prepareOrder("Butter Chicken")
    .then(order => console.log(`  ${order.dish} is ${order.status}`))
    .catch(err => console.log(`  Error: ${err.message}`))
    .finally(() => console.log("  cleanup done"));
}, 300);


// ============================================================
//  SECTION 4: Chaining — The Real Power
// ============================================================

// Return a value or Promise from .then() to build flat pipelines.

setTimeout(() => {
  console.log("\n--- Chaining ---");

  prepareOrder("Paneer Tikka")
    .then(order => pickUpOrder(order))
    .then(order => deliverOrder(order))
    .then(order => console.log(`  ${order.dish} → ${order.status}!`))
    .catch(err => console.log(`  Error: ${err.message}`));
}, 800);


// ============================================================
//  SECTION 5: Error Propagation
// ============================================================

// A rejection anywhere skips to the nearest .catch().

setTimeout(() => {
  console.log("\n--- Error Propagation ---");

  prepareOrder(null) // rejects here
    .then(order => pickUpOrder(order))   // skipped
    .then(order => deliverOrder(order))  // skipped
    .catch(err => console.log(`  Caught: ${err.message}`));
}, 1300);


// ============================================================
//  SECTION 6: Promise.resolve() & Promise.reject()
// ============================================================

setTimeout(() => {
  console.log("\n--- resolve/reject shortcuts ---");
  Promise.resolve({ dish: "Dal Makhani" })
    .then(o => console.log(`  Cached: ${o.dish}`));

  Promise.reject(new Error("Restaurant closed"))
    .catch(err => console.log(`  Instant fail: ${err.message}`));
}, 1700);


// ============================================================
//  SECTION 7: Combinators (Parallel Promises)
// ============================================================

function restaurant(name, dish, ms, fail = false) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      fail ? reject(new Error(`${name} cancelled ${dish}`))
           : resolve({ restaurant: name, dish });
    }, ms);
  });
}

// --- Promise.all(): ALL must succeed ---
setTimeout(() => {
  console.log("\n--- Promise.all() ---");
  Promise.all([
    restaurant("Haldiram's", "Chole Bhature", 200),
    restaurant("Sagar Ratna", "Dosa", 100),
  ]).then(results => results.forEach(r =>
    console.log(`  ${r.restaurant}: ${r.dish}`)
  )).catch(err => console.log(`  Failed: ${err.message}`));
}, 2100);

// --- Promise.allSettled(): wait for ALL, report each ---
setTimeout(() => {
  console.log("\n--- Promise.allSettled() ---");
  Promise.allSettled([
    restaurant("Punjab Grill", "Lassi", 100),
    restaurant("Cafe Delhi", "Samosa", 200, true),
  ]).then(results => results.forEach(r =>
    console.log(`  ${r.status === "fulfilled" ? r.value.dish : r.reason.message}`)
  ));
}, 2600);

// --- Promise.race(): first to SETTLE wins ---
setTimeout(() => {
  console.log("\n--- Promise.race() ---");
  Promise.race([
    restaurant("Slow", "Thali", 500),
    restaurant("Fast", "Maggi", 50),
  ]).then(w => console.log(`  Winner: ${w.restaurant}`));
}, 3100);

// --- Promise.any(): first to FULFILL wins ---
setTimeout(() => {
  console.log("\n--- Promise.any() ---");
  Promise.any([
    restaurant("A", "Chai", 300, true),
    restaurant("B", "Chai", 400),
  ]).then(w => console.log(`  First success: ${w.restaurant}`));
}, 3600);


// ============================================================
//  SECTION 8: Timeout Pattern
// ============================================================

function withTimeout(promise, ms) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timer]);
}

setTimeout(() => {
  console.log("\n--- Timeout Pattern ---");
  withTimeout(restaurant("Slow Dhaba", "Thali", 5000), 300)
    .catch(err => console.log(`  ${err.message}`));
}, 4100);


/**
 * ============================================================
 *  KEY TAKEAWAYS
 * ============================================================
 *  1. A Promise = a future value. States: pending -> fulfilled
 *     or rejected. Once settled, never changes.
 *  2. .then() = success, .catch() = failure, .finally() = cleanup.
 *     Each returns a NEW Promise.
 *  3. Chaining flattens callbacks into readable pipelines.
 *  4. Rejection skips to the nearest .catch() — one covers all.
 *  5. Four combinators:
 *       all()        — all must succeed (fail-fast)
 *       allSettled() — wait for all, report each
 *       race()       — first to settle wins
 *       any()        — first to fulfill wins
 *  6. Promise.resolve/reject create pre-settled Promises.
 *  7. Timeout pattern: race([operation, timer]).
 * ============================================================
 */
