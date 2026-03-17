// ============================================================
// FILE 18: PERFORMANCE PROFILING AND OPTIMIZATION
// Topic: Measuring, profiling, and optimizing JavaScript in V8
// WHY: Profiling identified 3 functions consuming 80% of CPU in
// Hotstar's IPL stream. Optimizing those 3 (not 200) cut latency
// by 60%. The lesson: measure first, optimize second, measure again.
// ============================================================

// ============================================================
// SECTION 1 — Rule #1: Measure, Don't Guess
// Story: During the 2024 IPL final, a JSON serialization function
// called 50K times/sec was the bottleneck. Developer intuition
// is wrong ~80% of the time.
// ============================================================

console.log("=".repeat(60));
console.log("RULE #1: MEASURE, DON'T GUESS");
console.log("=".repeat(60));
console.log("1. Measure BEFORE optimizing");
console.log("2. Optimize the bottleneck (80/20 rule)");
console.log("3. Measure AFTER to verify");

// ============================================================
// SECTION 2 — High-Resolution Timing
// Story: performance.now() gives microsecond precision and is
// monotonic. Date.now() only gives milliseconds and can jump.
// ============================================================

const { performance, PerformanceObserver } = require("perf_hooks");

const perfStart = performance.now();
let sum = 0;
for (let i = 0; i < 100000; i++) sum += i;
console.log("\nperformance.now():", (performance.now() - perfStart).toFixed(4), "ms (sub-ms precision)");

// ============================================================
// SECTION 3 — console.time() for Quick Benchmarks
// Story: Zero setup, zero dependencies — the fastest way to
// measure a section of code.
// ============================================================

console.time("Array creation");
const bigArray = new Array(1000000).fill(0).map((_, i) => i);
console.timeEnd("Array creation");

console.time("Sort"); bigArray.sort((a, b) => a - b); console.timeEnd("Sort");
console.time("Search"); bigArray.indexOf(500000); console.timeEnd("Search");

// ============================================================
// SECTION 4 — Performance Marks and Measures
// Story: Named timestamps that appear in Chrome DevTools and
// can be collected by analytics.
// ============================================================

performance.mark("start");
const videoData = new Array(100000).fill("frame-data");
performance.mark("middle");
videoData.forEach(() => {});
performance.mark("end");

performance.measure("Total", "start", "end");
performance.measure("Processing", "middle", "end");
performance.getEntriesByType("measure").forEach(m =>
    console.log(`  ${m.name}: ${m.duration.toFixed(4)} ms`));
performance.clearMarks(); performance.clearMeasures();

// ============================================================
// SECTION 5 — Node.js Profiling: --prof and Flame Charts
// Story: node --prof reveals hot functions. Chrome DevTools
// flame charts show where time is spent visually.
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("PROFILING TOOLS");
console.log("=".repeat(60));

console.log(`
  $ node --prof script.js              # Generate V8 log
  $ node --prof-process isolate-*.log  # Human-readable output
  $ node --inspect script.js           # Chrome DevTools flame chart

  Flame chart: width = duration (wider = slower)
               depth = call stack (taller = deeper nesting)
  Look for: wide bars, tall stacks, repeated patterns
`);

// ============================================================
// SECTION 6 — Process Metrics: Memory and CPU
// Story: Hotstar's auto-scaler monitors these metrics to decide
// when to spin up new instances.
// ============================================================

const mem = process.memoryUsage();
console.log("Memory:");
console.log(`  rss:      ${(mem.rss / 1024 / 1024).toFixed(2)} MB (total process)`);
console.log(`  heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB (V8 heap in use)`);

const cpuBefore = process.cpuUsage();
let cpuResult = 0;
for (let i = 0; i < 5000000; i++) cpuResult += Math.sin(i) * Math.cos(i);
const cpuDelta = process.cpuUsage(cpuBefore);
console.log(`  CPU user: ${(cpuDelta.user / 1000).toFixed(2)} ms`);

// ============================================================
// SECTION 7 — Benchmarking Best Practices
// Story: A flawed benchmark concluded "for is 10x faster than
// forEach." In production: negligible difference.
// ============================================================

// WHY: Without warmup, you measure the interpreter. V8 also
// eliminates dead code and optimizes monomorphic call sites.

function benchWithWarmup(fn, label, iters = 10000) {
    for (let i = 0; i < 1000; i++) fn();  // JIT warmup
    const start = performance.now();
    for (let i = 0; i < iters; i++) fn();
    console.log(`  ${label}: ${(performance.now() - start).toFixed(2)} ms`);
}

console.log("\nBenchmarks (with warmup):");
benchWithWarmup(() => { const a = new Array(100); for (let i = 0; i < 100; i++) a[i] = i * 2; return a; }, "for loop");
benchWithWarmup(() => Array.from({ length: 100 }, (_, i) => i * 2), "Array.from");

// ============================================================
// SECTION 8 — Memory Leak Detection
// Story: Hotstar's proxy grew from 200MB to 2GB in 24 hours.
// Heap snapshots found an unbounded cache.
// ============================================================

class LeakyCache {
    constructor() { this.cache = {}; }
    set(k, v) { this.cache[k] = v; }  // Never evicts!
}

class BoundedCache {
    constructor(max = 1000) { this.max = max; this.cache = new Map(); }
    set(k, v) {
        if (this.cache.has(k)) this.cache.delete(k);
        else if (this.cache.size >= this.max) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(k, v);
    }
}

const leaky = new LeakyCache(), bounded = new BoundedCache(5);
for (let i = 0; i < 10; i++) { leaky.set(`k${i}`, i); bounded.set(`k${i}`, i); }
console.log("\nLeaky cache:", Object.keys(leaky.cache).length);  // 10 (growing forever)
console.log("Bounded cache:", bounded.cache.size);  // 5 (capped)

console.log("Finding leaks: snapshot A → run suspect code → snapshot B → compare");

// ============================================================
// SECTION 9 — Full Optimization Workflow
// Story: Hotstar's chat consumed 40% CPU. Profiler found regex
// compiled on every message. Cached it → CPU dropped to 5%.
// ============================================================

// SLOW: regex compiled every iteration + string concat in loop
function processChat_SLOW(messages) {
    const results = [];
    for (const msg of messages) {
        const urlRegex = new RegExp("https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+[\\w\\-.,@?^=%&:/~+#]*", "gi");
        let processed = "";
        for (const w of msg.split(" ")) processed = processed + w.toLowerCase() + " ";
        results.push({ text: processed.trim(), urls: msg.match(urlRegex) || [] });
    }
    return results;
}

// FAST: cached regex + array join
const URL_REGEX = /https?:\/\/[\w\-]+(\.[\w\-]+)+[\w\-.,@?^=%&:/~+#]*/gi;
function processChat_FAST(messages) {
    const results = [];
    for (const msg of messages) {
        URL_REGEX.lastIndex = 0;
        results.push({
            text: msg.split(" ").map(w => w.toLowerCase()).join(" "),
            urls: msg.match(URL_REGEX) || []
        });
    }
    return results;
}

const testMsgs = Array.from({ length: 10000 }, (_, i) =>
    `Check https://hotstar.com/live for IPL ${i}`);

console.time("SLOW"); processChat_SLOW(testMsgs); console.timeEnd("SLOW");
console.time("FAST"); processChat_FAST(testMsgs); console.timeEnd("FAST");

// ============================================================
// SECTION 10 — Optimization Checklist
// ============================================================

console.log(`
  HIGH IMPACT:
  - Avoid object creation in hot loops
  - Cache regex compilations
  - Promise.all() for independent async ops
  - Pre-allocate arrays when size is known

  MEDIUM IMPACT:
  - Consistent argument types (avoid polymorphism)
  - TypedArrays for numeric data
  - WeakMap/WeakRef for caches

  MEASUREMENT:
  - node --prof for CPU profiling
  - Heap snapshots for memory leaks
  - performance.mark/measure for custom metrics
  - Warmup + multiple iterations for benchmarks
`);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. ALWAYS measure before optimizing. Developer intuition
//    about bottlenecks is wrong ~80% of the time.
//
// 2. performance.now() for precision. console.time() for quick
//    benchmarks. performance.mark/measure for DevTools.
//
// 3. node --prof for CPU profiles. --inspect for flame charts
//    and heap snapshots.
//
// 4. Memory leaks: compare heap snapshots to find growing objects.
//    Common: unbounded caches, event listeners, closure captures.
//
// 5. Benchmarking pitfalls: JIT warmup, dead code elimination,
//    monomorphic optimization.
//
// 6. process.memoryUsage() and process.cpuUsage() for production.
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("FILE 18 COMPLETE — Performance Profiling");
console.log("=".repeat(60));
