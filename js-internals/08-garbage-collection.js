// ============================================================
// FILE 08: GARBAGE COLLECTION
// Topic: How V8 automatically reclaims unused memory
// WHY: V8's garbage collector runs constantly behind the scenes.
//   Understanding it helps you write code that cooperates with
//   the GC — avoiding pauses, leaks, and OOM crashes.
// ============================================================

// ============================================================
// SECTION 1 — The Memory Lifecycle
// Story: You create objects, use them, stop referencing them.
//   The GC finds unreachable objects and frees the memory.
// ============================================================

//  1. ALLOCATE → let cart = { items: [] }
//  2. USE      → cart.items.push("ticket")
//  3. RELEASE  → cart = null
//  4. COLLECT  → GC finds it unreachable, frees memory

let cart = { userId: "U001", items: ["IPL Final Ticket"], total: 5000 };
console.log("Allocated:", cart);
cart = null;  // Now eligible for garbage collection
console.log("Released: cart = null → GC will collect it automatically\n");


// ============================================================
// SECTION 2 — Reachability (Not Reference Counting)
// Story: The GC walks all references from "roots." If an object
//   can't be reached from any root, it's garbage.
// ============================================================

// WHY: Reachability-based GC handles circular references correctly,
// unlike reference counting (which old IE used).

//  ROOT OBJECTS (always reachable):
//  ├── Global object (globalThis)
//  ├── Call stack local variables
//  ├── Closure variables
//  └── Active timers, listeners, Promises

let viewer1 = { id: "V001", watching: "IND vs AUS" };
let viewer2 = { id: "V002", watching: "IND vs AUS" };
viewer2 = null;  // {id:'V002'} is now unreachable = garbage
console.log("viewer2 = null → object is unreachable, GC will collect it\n");


// ============================================================
// SECTION 3 — Mark-and-Sweep Algorithm
// Story: Like sending an inspector to tag every box still needed
//   (mark), then sweeping away all untagged boxes (sweep).
// ============================================================

//  Phase 1: MARK — start from roots, mark all reachable objects
//  Phase 2: SWEEP — free all unmarked objects
//  Handles circular references correctly!

let objA = { name: "A" };
let objB = { name: "B" };
objA.ref = objB;  // A → B
objB.ref = objA;  // B → A (circular!)
objA = null;
objB = null;
// Neither reachable from root → both collected correctly
console.log("Circular A↔B: after nulling both, Mark-and-Sweep collects both!\n");


// ============================================================
// SECTION 4 — Generational Garbage Collection
// Story: Most objects die young. V8 divides the heap into Young
//   Generation (fast GC) and Old Generation (less frequent GC).
// ============================================================

// WHY: The "generational hypothesis" — most objects are temporary.
// V8 optimizes for this with separate collection strategies.

//  YOUNG GENERATION (~1-8 MB)     │ OLD GENERATION (~hundreds MB)
//  ┌─────────┬─────────┐          │ Long-lived objects:
//  │From-Space│To-Space │          │ cached data, configs,
//  │(new objs)│(for copy)│         │ objects surviving 2+ scavenges
//  └─────────┴─────────┘          │
//  GC: Scavenger (fast, frequent)  │ GC: Mark-Compact (slower, rare)

console.log("Young Gen: Scavenger — fast semi-space copying (~1ms)");
console.log("Old Gen: Mark-Compact — compacts live objects, no fragmentation\n");


// ============================================================
// SECTION 5 — Scavenger (Young Generation)
// Story: Uses two spaces — copies live objects from one to the
//   other. Dead objects are never copied, they just vanish.
// ============================================================

function simulateSearchResults() {
    const restaurants = Array.from({ length: 1000 }, (_, i) => ({
        id: i, name: `Restaurant ${i}`, rating: Math.random() * 5
    }));
    const filtered = restaurants.filter(r => r.rating > 3.5);
    return filtered.sort((a, b) => a.rating - b.rating).slice(0, 10);
}

const topResults = simulateSearchResults();
console.log(`Top ${topResults.length} results kept. ~990 temp objects → Scavenger GC\n`);


// ============================================================
// SECTION 6 — Incremental and Concurrent Marking
// Story: Full GC on a large heap could take 100ms+. V8 breaks
//   work into small pieces and runs some on background threads.
// ============================================================

//  STOP-THE-WORLD:  JS: ████──STOP──████   GC: ████ (100ms pause!)
//  INCREMENTAL:     JS: ██ ██ ██ ██        GC: █ █ █ (5ms chunks)
//  CONCURRENT:      JS: ████████████       GC: ████ (background thread)

console.log("Incremental: 5ms marking chunks spread across execution");
console.log("Concurrent: marking on background thread — near-zero pauses\n");


// ============================================================
// SECTION 7 — Monitoring Memory
// ============================================================

function printMemory(label) {
    const mem = process.memoryUsage();
    console.log(`[${label}]`);
    console.log(`  heapUsed:  ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
}

printMemory("Baseline");

const bigArray = [];
for (let i = 0; i < 100000; i++) {
    bigArray.push({ id: i, data: "x".repeat(100) });
}
printMemory("After 100K objects");

bigArray.length = 0;
printMemory("After clearing (GC may not have run yet)");
console.log();


// ============================================================
// SECTION 8 — Node.js Memory Configuration
// ============================================================

console.log("=== Node.js Memory Config ===");
console.log("Default max heap: ~1.5 GB (64-bit), ~700 MB (32-bit)");
console.log("Increase: node --max-old-space-size=4096 server.js");
console.log("Flags: --expose-gc, --trace-gc, --max-semi-space-size");
console.log("OOM sequence: aggressive GC → longer pauses → FATAL ERROR\n");


// ============================================================
// SECTION 9 — Minimizing GC Pressure
// ============================================================

// Strategy 1: Object pooling
class DriverMatchPool {
    constructor(size) {
        this.pool = Array.from({ length: size }, () => ({
            driverId: null, distance: 0, eta: 0, score: 0
        }));
        this.index = 0;
    }
    acquire() {
        if (this.index >= this.pool.length) this.index = 0;
        return this.pool[this.index++];
    }
}
console.log("Strategy 1: Object pooling — reuse, don't create");

// Strategy 2: Avoid closures in hot loops
console.log("Strategy 2: for-loop over forEach in hot paths");

// Strategy 3: TypedArrays for numeric data
const distances = new Float64Array(1000);
console.log("Strategy 3: TypedArrays — no boxing, no GC per number");

// Strategy 4: Pre-size arrays
console.log("Strategy 4: new Array(knownSize) — avoid repeated resizing\n");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. V8 uses automatic GC based on REACHABILITY from roots.
//    Unreachable objects are collected. Circular refs handled.
//
// 2. Generational GC: Young Gen (Scavenger, semi-space copy)
//    for short-lived + Old Gen (Mark-Compact) for long-lived.
//
// 3. Incremental + concurrent marking reduces stop-the-world
//    pauses from ~100ms to ~1-5ms.
//
// 4. Monitor with process.memoryUsage(). Configure with
//    --max-old-space-size. Debug with --trace-gc.
//
// 5. Reduce GC pressure: object pooling, TypedArrays,
//    pre-sized arrays, avoid closures in hot loops.
// ============================================================

console.log("=== FILE 08 COMPLETE ===\n");
