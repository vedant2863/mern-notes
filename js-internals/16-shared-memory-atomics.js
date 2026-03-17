// ============================================================
// FILE 16: SHARED MEMORY AND ATOMICS
// Topic: SharedArrayBuffer, Atomics, and thread-safe shared memory
// WHY: SharedArrayBuffer lets worker threads share raw memory without
// copying. Atomics provides thread-safe operations to prevent race
// conditions — essential for high-frequency concurrent operations.
// ============================================================

// ============================================================
// SECTION 1 — The Problem: postMessage Copies Data
// Story: PhonePe processes 4B+ UPI transactions/month. Workers
// communicate via structured clone which COPIES data. For
// high-frequency ops, SharedArrayBuffer shares SAME memory.
// ============================================================

//   postMessage: serialize → COPY → deserialize (slow for large data)
//   SharedArrayBuffer: both threads read/write SAME memory (zero copy)

console.log("=".repeat(60));
console.log("SHARED MEMORY BASICS");
console.log("=".repeat(60));

const sharedBuffer = new SharedArrayBuffer(16);
const int32View = new Int32Array(sharedBuffer);  // 4 elements (4 bytes each)
int32View[0] = 100; int32View[1] = 200;
console.log("Values:", Array.from(int32View));

// Different views of the same bytes
const uint8View = new Uint8Array(sharedBuffer);
console.log("Same bytes via Uint8Array:", Array.from(uint8View.slice(0, 4)));

// ============================================================
// SECTION 2 — The Race Condition Problem
// Story: Two workers incrementing a counter without sync.
// Expected: 2000. Actual: sometimes 1800.
// ============================================================

// WHY: Two threads read-modify-write without sync → lost updates.

//   Thread A: READ(100), ADD 1(101), WRITE(101)
//   Thread B: READ(100), ADD 1(101), WRITE(101)
//   Expected: 102. Actual: 101. LOST UPDATE!

const raceView = new Int32Array(new SharedArrayBuffer(4));
raceView[0] = 0;
for (let i = 0; i < 1000; i++) { raceView[0] = raceView[0] + 1; }
console.log("Single-thread (ok here, broken with real threads):", raceView[0]);

// ============================================================
// SECTION 3 — Atomics: Thread-Safe Operations
// Story: Each Atomics operation is INDIVISIBLE — no other thread
// can see a half-completed state.
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("ATOMICS OPERATIONS");
console.log("=".repeat(60));

const atomicView = new Int32Array(new SharedArrayBuffer(32));

Atomics.store(atomicView, 0, 42);
console.log("load:", Atomics.load(atomicView, 0));  // 42

Atomics.store(atomicView, 1, 100);
const old = Atomics.add(atomicView, 1, 5);  // Returns OLD value
console.log("add(100, 5) → old:", old, "new:", Atomics.load(atomicView, 1));  // 100, 105

// ============================================================
// SECTION 4 — Compare-And-Swap (CAS)
// Story: CAS is the building block of ALL lock-free algorithms.
// "Change the value ONLY if it's still what I expect."
// ============================================================

Atomics.store(atomicView, 5, 100);
const actual1 = Atomics.compareExchange(atomicView, 5, 100, 200);  // expect 100, set 200
console.log("CAS(100→200) succeeded:", actual1 === 100, "new:", Atomics.load(atomicView, 5));

const actual2 = Atomics.compareExchange(atomicView, 5, 100, 300);  // expect 100, but it's 200
console.log("CAS(100→300) failed:", actual2 === 100, "still:", Atomics.load(atomicView, 5));

// CAS retry loop — custom atomic multiply
function atomicMultiply(arr, idx, mult) {
    let oldVal;
    do { oldVal = Atomics.load(arr, idx); }
    while (Atomics.compareExchange(arr, idx, oldVal, oldVal * mult) !== oldVal);
    return Atomics.load(arr, idx);
}
Atomics.store(atomicView, 6, 10);
console.log("Atomic multiply(10*5):", atomicMultiply(atomicView, 6, 5));  // 50

// ============================================================
// SECTION 5 — wait/notify: Thread Synchronization
// Story: Workers SLEEP until work arrives, then wake up.
// Like a condition variable in C/C++.
// ============================================================

// WHY: wait/notify enables sync without busy-waiting.
// The thread actually sleeps, freeing CPU.

const waitView = new Int32Array(new SharedArrayBuffer(4));
console.log("wait(timeout=100ms):", Atomics.wait(waitView, 0, 0, 100));  // "timed-out"
waitView[0] = 1;
console.log("wait(value mismatch):", Atomics.wait(waitView, 0, 0, 100));  // "not-equal"

// ============================================================
// SECTION 6 — Building a Mutex with Atomics
// Story: CAS-based mutex ensures only ONE thread enters a
// critical section at a time.
// ============================================================

class AtomicMutex {
    constructor(buf, idx) { this.view = new Int32Array(buf); this.idx = idx; }
    lock() {
        while (Atomics.compareExchange(this.view, this.idx, 0, 1) !== 0) {
            Atomics.wait(this.view, this.idx, 1, 1);
        }
    }
    unlock() {
        Atomics.store(this.view, this.idx, 0);
        Atomics.notify(this.view, this.idx, 1);
    }
}

const mutex = new AtomicMutex(new SharedArrayBuffer(4), 0);
mutex.lock();
console.log("Lock acquired → critical section");
mutex.unlock();
console.log("Lock released");

// ============================================================
// SECTION 7 — worker_threads + SharedArrayBuffer
// Story: Main and worker both atomically increment a shared
// counter. Result: exactly 2000 (no lost updates).
// ============================================================

const { Worker, isMainThread } = require("worker_threads");

if (isMainThread) {
    const counterBuffer = new SharedArrayBuffer(4);
    const counterView = new Int32Array(counterBuffer);

    const workerCode = `
        const { workerData, parentPort } = require("worker_threads");
        const view = new Int32Array(workerData.buf);
        for (let i = 0; i < 1000; i++) Atomics.add(view, 0, 1);
        parentPort.postMessage("done");
    `;
    const worker = new Worker(workerCode, { eval: true, workerData: { buf: counterBuffer } });
    for (let i = 0; i < 1000; i++) Atomics.add(counterView, 0, 1);

    worker.on("message", () => {
        console.log("Counter:", Atomics.load(counterView, 0));  // 2000
    });
    worker.on("error", e => console.log("Worker error:", e.message));
}

// ============================================================
// SECTION 8 — Security: Spectre and Cross-Origin Isolation
// Story: SharedArrayBuffer was disabled in 2018 (Spectre attack),
// re-enabled with isolation headers.
// ============================================================

console.log("\nSpectre mitigation headers (browsers):");
console.log("  Cross-Origin-Embedder-Policy: require-corp");
console.log("  Cross-Origin-Opener-Policy: same-origin");
console.log("Node.js: always available (no browser sandbox)");

// ============================================================
// SECTION 9 — Practical: Shared Ring Buffer
// Story: Workers write log entries, main thread reads.
// Lock-free ring buffer avoids message passing overhead.
// ============================================================

class SharedRingBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new SharedArrayBuffer((2 + capacity) * 4);
        this.view = new Int32Array(this.buffer);
    }
    write(value) {
        const wp = Atomics.load(this.view, 0), rp = Atomics.load(this.view, 1);
        if (wp - rp >= this.capacity) return false;
        Atomics.store(this.view, 2 + (wp % this.capacity), value);
        Atomics.add(this.view, 0, 1);
        return true;
    }
    read() {
        const wp = Atomics.load(this.view, 0), rp = Atomics.load(this.view, 1);
        if (rp >= wp) return null;
        const val = Atomics.load(this.view, 2 + (rp % this.capacity));
        Atomics.add(this.view, 1, 1);
        return val;
    }
}

const ring = new SharedRingBuffer(4);
for (let i = 1; i <= 5; i++) console.log(`  Write ${i * 100}: ${ring.write(i * 100) ? "OK" : "FULL"}`);
let v; while ((v = ring.read()) !== null) console.log(`  Read: ${v}`);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. SharedArrayBuffer: raw shared memory across threads — no
//    copying, no serialization.
//
// 2. Without Atomics, shared access causes race conditions.
//    Atomics.add/sub/compareExchange are indivisible.
//
// 3. CAS (compareExchange) is the foundation of lock-free code.
//
// 4. Atomics.wait() blocks until notified — efficient sync
//    without busy-waiting.
//
// 5. Browsers require Cross-Origin Isolation headers (Spectre).
//
// 6. Use for heavy computation / high-frequency counters.
//    Use postMessage for everything else.
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("FILE 16 COMPLETE — Shared Memory and Atomics");
console.log("=".repeat(60));
