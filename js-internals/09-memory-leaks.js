// ============================================================
// FILE 09: MEMORY LEAKS
// Topic: How memory leaks happen, how to detect them, how to fix them
// WHY: A memory leak is memory that SHOULD be freed but ISN'T.
//   In long-running apps, even tiny leaks compound over hours,
//   causing slowdowns, OOM crashes, and forced restarts.
// ============================================================

// ============================================================
// SECTION 1 — What is a Memory Leak?
// Story: Memory usage climbs steadily. GC works harder and harder.
//   Eventually there's no memory left.
// ============================================================

//  HEALTHY: memory rises and falls (GC collects garbage)
//  LEAKING: memory only rises (nothing ever freed)

function memUsedMB() {
    return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
}

console.log("A memory leak = memory STILL REFERENCED, preventing GC\n");


// ============================================================
// LEAK 1 — Accidental Globals
// Story: Forgot `let`/`const` — variable becomes global, lives forever.
// ============================================================

function processStudentData() {
    // BAD: leakedData = "x".repeat(1000);  // becomes global!
    // FIX:
    "use strict";
    const localData = "x".repeat(1000);  // scoped, GC'd when function returns
    return localData.length;
}
processStudentData();
console.log("LEAK 1: Missing let/const → global → never freed");
console.log("FIX: Always use let/const + 'use strict'\n");


// ============================================================
// LEAK 2 — Forgotten Timers
// Story: setInterval runs forever after component is destroyed.
//   The closure and its data grow without bound.
// ============================================================

// BAD: interval never cleared
function startTrackingBad() {
    const data = { history: [] };
    const id = setInterval(() => {
        data.history.push({ lat: 12.97, time: Date.now() });
        // history grows FOREVER
    }, 5000);
    return id;
}

// GOOD: return cleanup function, cap array growth
function startTrackingGood() {
    const data = { history: [] };
    const id = setInterval(() => {
        data.history.push({ lat: 12.97, time: Date.now() });
        if (data.history.length > 100) data.history = data.history.slice(-50);
    }, 5000);
    return function stop() {
        clearInterval(id);
        data.history = [];
    };
}

const badId = startTrackingBad();
clearInterval(badId);
const stop = startTrackingGood();
stop();
console.log("LEAK 2: setInterval without clearInterval");
console.log("FIX: Return cleanup function, cap array growth\n");


// ============================================================
// LEAK 3 — Closures Holding Large Scope
// Story: Returned function only needs userId, but the closure
//   captures the entire scope including a 100MB config object.
// ============================================================

// BAD: closure captures entire scope
function createLoggerBad() {
    const hugeConfig = { rules: new Array(10000).fill("data") };
    const userId = "U001";
    return function log(msg) { console.log(`  [${userId}] ${msg}`); };
    // hugeConfig stays alive if shared scope references it
}

// GOOD: extract what you need
function createLoggerGood() {
    let hugeConfig = { rules: new Array(10000).fill("data") };
    const userId = hugeConfig.rules.length > 0 ? "U001" : "unknown";
    hugeConfig = null;  // explicitly release
    return function log(msg) { console.log(`  [${userId}] ${msg}`); };
}

createLoggerGood()("lean logger works");
console.log("LEAK 3: Closure captures large objects in scope");
console.log("FIX: Extract needed values, null out large objects\n");


// ============================================================
// LEAK 4 — Event Listeners Not Removed
// Story: SPA adds new listener on every page visit without
//   removing the old one. 20 visits = 20 duplicate handlers.
// ============================================================

const EventEmitter = require("events");
const paymentBus = new EventEmitter();

function setupListenerBad(sessionId) {
    paymentBus.on("payment", (data) => {
        console.log(`  [${sessionId}] Payment:`, data.amount);
    });
}

setupListenerBad("S001");
setupListenerBad("S002");
setupListenerBad("S003");
console.log(`Listeners (BAD): ${paymentBus.listenerCount("payment")}`); // 3!

paymentBus.removeAllListeners("payment");
paymentBus.on("payment", (data) => console.log("  [latest] Payment:", data.amount));
console.log(`Listeners (GOOD): ${paymentBus.listenerCount("payment")}`); // 1

paymentBus.removeAllListeners("payment");
console.log("LEAK 4: Listeners accumulate without removal");
console.log("FIX: removeAllListeners / AbortController\n");


// ============================================================
// LEAK 5 — Unbounded Caches
// Story: A Map cache grows forever — entries added but never
//   evicted. After a week, 12GB of RAM consumed.
// ============================================================

// BAD: cache grows forever
const badCache = new Map();
for (let i = 0; i < 10000; i++) {
    badCache.set(`user_${i}`, { products: Array(100).fill("product") });
}
console.log(`BAD cache: ${badCache.size} entries (grows forever!)`);

// GOOD: LRU cache with max size
class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }
    get(key) {
        if (!this.cache.has(key)) return undefined;
        const val = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, val);  // move to end (most recent)
        return val;
    }
    set(key, value) {
        if (this.cache.has(key)) this.cache.delete(key);
        else if (this.cache.size >= this.maxSize) {
            this.cache.delete(this.cache.keys().next().value);  // evict oldest
        }
        this.cache.set(key, value);
    }
    get size() { return this.cache.size; }
}

const goodCache = new LRUCache(1000);
for (let i = 0; i < 10000; i++) goodCache.set(`user_${i}`, { products: ["p1"] });
console.log(`GOOD cache: ${goodCache.size} entries (capped at 1000)`);
console.log("FIX: LRU cache, TTL expiration, or WeakMap\n");


// ============================================================
// SECTION 6 — WeakRef, WeakMap, FinalizationRegistry
// Story: Weak references don't prevent GC. Perfect for caches
//   that should auto-clean when objects are no longer needed.
// ============================================================

// WeakMap: keys are weakly held — auto-removed when key is GC'd
const metadataCache = new WeakMap();
let merchant = { id: "M001", revenue: 5000000 };
metadataCache.set(merchant, { tier: "enterprise", processedAt: Date.now() });
console.log("WeakMap metadata:", metadataCache.get(merchant));
merchant = null;  // WeakMap entry auto-removed by GC

// WeakRef: weak reference to a single object
let bigObj = { id: "BIG", data: "x".repeat(10000) };
const weakRef = new WeakRef(bigObj);
console.log("WeakRef deref:", weakRef.deref()?.id);  // "BIG"
bigObj = null;  // After GC, weakRef.deref() returns undefined

// FinalizationRegistry: callback when object is GC'd
const registry = new FinalizationRegistry((label) => {
    console.log(`  [FinalizationRegistry] '${label}' was collected`);
});
let temp = { name: "Temporary" };
registry.register(temp, "temp-label");
temp = null;
console.log("FinalizationRegistry: non-deterministic — don't rely on for cleanup\n");


// ============================================================
// SECTION 7 — Detecting Memory Leaks
// ============================================================

const leakyStore = [];
const snapshots = [];

function snap(label) {
    const mem = process.memoryUsage();
    snapshots.push({ label, mb: (mem.heapUsed / 1024 / 1024).toFixed(2) });
}

snap("Start");
for (let cycle = 1; cycle <= 3; cycle++) {
    for (let i = 0; i < 10000; i++) {
        leakyStore.push({ id: `${cycle}_${i}`, data: "x".repeat(20) });
    }
    snap(`Cycle ${cycle}`);
}

console.log("Memory Trend:");
for (const s of snapshots) console.log(`  ${s.label.padEnd(12)} │ ${s.mb} MB`);
console.log("  Heap keeps growing = LEAK!\n");
leakyStore.length = 0;

console.log("Detection methods:");
console.log("  1. process.memoryUsage() trending over time");
console.log("  2. Chrome DevTools: node --inspect → Memory tab → heap snapshots");
console.log("  3. Alert if heapUsed grows >10% over 10 minutes\n");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. A leak is memory still referenced — GC can't help if reachable.
//
// 2. Top sources: accidental globals, forgotten timers, closures
//    capturing large scopes, unremoved listeners, unbounded caches.
//
// 3. Circular references are NOT leaks in modern engines (V8 uses
//    Mark-and-Sweep, not reference counting).
//
// 4. WeakMap/WeakRef hold weak references that don't prevent GC.
//
// 5. Detect leaks by watching heapUsed trend upward. Use Chrome
//    DevTools heap snapshots to find what's growing.
//
// 6. Prevention: clear timers, remove listeners, bound caches,
//    use strict mode, review closure captures in code review.
// ============================================================

console.log("=== FILE 09 COMPLETE ===\n");
