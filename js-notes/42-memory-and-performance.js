/**
 * ============================================================
 * FILE 42: Memory Management & Performance Patterns
 * ============================================================
 * Garbage collection, memory leaks, benchmarking,
 * memoization, debounce/throttle, object pools,
 * and structuredClone.
 *
 * STORY — The Mumbai BEST Bus
 * Driver Raju manages Bus No. 328. Every wasted byte is
 * leaked fuel; every needless computation burns route time.
 * ============================================================
 */


// ============================================================
// SECTION 1 — GARBAGE COLLECTION (MARK-AND-SWEEP)
// ============================================================
// GC marks all objects reachable from roots (globals, stack,
// closures), then sweeps everything else.

let tank = { level: 100 };
let backup = tank;
tank = null;    // still alive via backup
backup = null;  // now unreachable -> eligible for GC

// Circular refs are handled: mark-and-sweep collects them
// when both objects are unreachable from any root.


// ============================================================
// SECTION 2 — COMMON MEMORY LEAKS
// ============================================================

// Leak 1: Forgotten timers
function leakyTimer() {
  const big = new Array(10000).fill("data");
  const id = setInterval(() => {}, 1000); // closure keeps `big` alive
  clearInterval(id); // FIX
}
leakyTimer();

// Leak 2: Closures capturing unused data
function createProcessorFixed() {
  const log = new Array(50000).fill("entry");
  const size = log.length; // extract only what's needed
  return (item) => `${item.toUpperCase()} (log: ${size})`;
}
console.log("Closure fix:", createProcessorFixed()("fuel-check"));

// Leak 3: Detached DOM nodes (browser)
// After removeChild(), nullify the JS reference.

// Leak 4: Accidental globals
// Always use let/const, enable strict mode, use linters.


// ============================================================
// SECTION 3 — BENCHMARKING WITH performance.now()
// ============================================================

const { performance } = require("perf_hooks");

function benchmark(label, fn, runs = 5) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    fn();
    times.push(performance.now() - s);
  }
  const avg = (times.reduce((a, b) => a + b, 0) / runs).toFixed(3);
  console.log(`[${label}] avg: ${avg}ms (${runs} runs)`);
}

function heavyCalc(n) {
  let r = 0;
  for (let i = 0; i < n; i++) r += Math.sqrt(i) * Math.sin(i);
  return r;
}

benchmark("Heavy (100K)", () => heavyCalc(100_000));


// ============================================================
// SECTION 4 — MEMOIZATION
// ============================================================
// Trade memory for speed by caching results.

function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

function calcFare(route, km) {
  let h = 0;
  for (let i = 0; i < 100000; i++) h += (km * i) % 997;
  return { route, fare: km * 2.5 };
}

const memoFare = memoize(calcFare);
memoFare("Andheri-Dadar", 18); // cold
memoFare("Andheri-Dadar", 18); // cache hit


// ============================================================
// SECTION 5 — DEBOUNCE & THROTTLE
// ============================================================

// Debounce: fires AFTER input stops for `delayMs`
function debounce(fn, delayMs) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delayMs);
  };
}

// Throttle: fires AT MOST once per `intervalMs`
function throttle(fn, intervalMs) {
  let last = 0, timer = null;
  return function (...args) {
    const now = Date.now();
    if (now - last >= intervalMs) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, intervalMs - (now - last));
    }
  };
}

const debouncedRoute = debounce(d => console.log(`Route: ${d}`), 300);
debouncedRoute("Dadar");
debouncedRoute("Parel");
debouncedRoute("Worli"); // only this fires

console.log("Debounce: after silence. Throttle: max once per interval.");


// ============================================================
// SECTION 6 — OBJECT POOLS
// ============================================================
// Recycle objects instead of creating/destroying them.

class ObjectPool {
  constructor(factory, reset, size = 10) {
    this.factory = factory;
    this.reset = reset;
    this.pool = Array.from({ length: size }, factory);
  }
  acquire() { return this.pool.pop() || this.factory(); }
  release(obj) { this.reset(obj); this.pool.push(obj); }
  get available() { return this.pool.length; }
}

const tokens = new ObjectPool(
  () => ({ seat: 0, fare: 0, active: false }),
  t => { t.seat = 0; t.fare = 0; t.active = false; },
  5
);

const t1 = tokens.acquire();
t1.seat = 12; t1.fare = 15; t1.active = true;
console.log("In use:", t1);
tokens.release(t1);
console.log("After release:", t1); // reset to defaults


// ============================================================
// SECTION 7 — structuredClone() vs JSON hack
// ============================================================
// structuredClone preserves Dates, Maps, TypedArrays, and
// handles circular references. JSON does not.

const bus = {
  name: "BEST 328",
  systems: { engine: { fuel: 85.5 } },
  serviceDate: new Date("2024-08-15"),
  coords: new Float64Array([19.076, 72.877]),
};

const jsonClone = JSON.parse(JSON.stringify(bus));
console.log("JSON Date type:", typeof jsonClone.serviceDate); // string (broken)

const proper = structuredClone(bus);
console.log("structuredClone Date:", Object.prototype.toString.call(proper.serviceDate));
proper.systems.engine.fuel = 0;
console.log("Original fuel:", bus.systems.engine.fuel); // 85.5

// Circular reference test
const circular = { name: "Bus" };
circular.self = circular;
const cc = structuredClone(circular);
console.log("Circular works:", cc.self === cc); // true


/**
 * ============================================================
 * KEY TAKEAWAYS
 * ============================================================
 * 1. Mark-and-sweep GC: unreachable objects are freed.
 * 2. Leaks: forgotten timers, large closures, detached DOM,
 *    accidental globals. Fix: clear timers, minimize capture.
 * 3. performance.now() for sub-ms benchmarking.
 * 4. Memoization: cache results of pure functions.
 * 5. Debounce: after silence. Throttle: max once per interval.
 * 6. Object pools: recycle to reduce GC churn.
 * 7. structuredClone() > JSON hack for deep cloning.
 * ============================================================
 */
