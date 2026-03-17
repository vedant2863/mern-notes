// ============================================================
// FILE 15: ASYNC INTERNALS IN V8
// Topic: Promises, async/await, and generators — V8's async state machines
// WHY: V8 transforms async/await into state machines with implicit
// promises, microtask queues, and suspended contexts. Understanding
// this reveals the true cost of async and how to predict execution order.
// ============================================================

// ============================================================
// SECTION 1 — Promise States and V8 Internals
// Story: A Swiggy order flows through validate, pay, notify, deliver.
// Each step is async with microtask checkpoints.
// ============================================================

//   PENDING → FULFILLED or REJECTED (immutable once settled)

const orderPromise = new Promise((resolve) => {
    console.log("1. Order placed (PENDING)");
    setTimeout(() => resolve({ orderId: "SWG-12345", total: 450 }), 100);
});
orderPromise
    .then(order => { console.log("3. Validated:", order.orderId); return order; })
    .then(order => { console.log("4. Payment processed for Rs." + order.total); });
console.log("2. Runs BEFORE .then() — synchronous code first");

// ============================================================
// SECTION 2 — Microtask vs Macrotask Queue
// Story: .then() callbacks are microtasks — executed BEFORE the
// next macrotask (setTimeout). This ordering is guaranteed.
// ============================================================

// WHY: Microtasks drain COMPLETELY before the next macrotask.
// Microtasks can enqueue more microtasks — all run first.

//   1. Execute sync code → 2. Drain ALL microtasks →
//   3. ONE macrotask → 4. Drain ALL microtasks → repeat

console.log("A: Synchronous start");
setTimeout(() => console.log("F: setTimeout (macrotask)"), 0);
Promise.resolve()
    .then(() => {
        console.log("C: First microtask");
        Promise.resolve().then(() => console.log("D: Nested microtask"));
    })
    .then(() => console.log("E: Chained microtask"));
console.log("B: Synchronous end");
// Order: A, B, C, D, E, F

// ============================================================
// SECTION 3 — async/await State Machine
// Story: V8 transforms async/await into a state machine. Each
// await suspends the function and creates a microtask checkpoint.
// ============================================================

// WHY: async/await is syntactic sugar over promises + generators.
// Each await is a state transition: context saved to heap.

async function processOrder(orderId) {
    console.log("  Step 1: Validating", orderId);
    const v = await validateOrder(orderId);     // State 0 → 1
    console.log("  Step 2: Payment");
    const p = await processPayment(v);          // State 1 → 2
    console.log("  Step 3: Notify restaurant");
    return await notifyRestaurant(p);           // State 2 → 3
}

function validateOrder(id) { return new Promise(r => setTimeout(() => r({ id, valid: true }), 50)); }
function processPayment(o) { return new Promise(r => setTimeout(() => r({ ...o, paid: true }), 50)); }
function notifyRestaurant(o) { return new Promise(r => setTimeout(() => r({ ...o, notified: true }), 50)); }

//   State 0 ──await──► State 1 ──await──► State 2 ──await──► State 3
//   validate   suspend  payment   suspend  notify    suspend  return

processOrder("SWG-99999").then(r => console.log("  Complete:", JSON.stringify(r)));

// ============================================================
// SECTION 4 — Await Microtask Overhead
// Story: Even awaiting an already-resolved value suspends the
// function. V8 wraps it in Promise.resolve() and schedules resume.
// ============================================================

async function unnecessaryAwaits() {
    const a = await 1;  // Suspends! Even though 1 is not a promise
    const b = await 2;  // Suspends again!
    return a + b;
}
async function optimized() { return 1 + 2; }  // One promise, no suspensions

console.log("Unnecessary awaits = extra microtask turns for sync values");

// ============================================================
// SECTION 5 — Generator Internals
// Story: Generators suspend/resume execution contexts — the same
// mechanism V8 uses for async/await internally.
// ============================================================

// WHY: yield saves full context (locals, IP) to heap.
// .next() restores it to the stack.

function* orderProcessor(orders) {
    for (const order of orders) {
        const result = yield { ...order, status: "processing" };
        console.log(`  Order ${order.id}: ${result}`);
    }
    return "complete";
}

const gen = orderProcessor([{ id: "ORD-1" }, { id: "ORD-2" }]);
console.log(gen.next());           // { value: {id:"ORD-1", status:"processing"}, done: false }
console.log(gen.next("approved")); // Order ORD-1: approved
console.log(gen.next("approved")); // { value: "complete", done: true }

// ============================================================
// SECTION 6 — Async Generators
// Story: Swiggy's live order tracking streams status updates
// using async generators — lazy + non-blocking.
// ============================================================

async function* orderStatusStream(orderId) {
    for (const status of ["Placed", "Preparing", "Out for Delivery", "Delivered"]) {
        await new Promise(r => setTimeout(r, 30));
        yield { orderId, status };
    }
}

async function trackOrder() {
    for await (const update of orderStatusStream("SWG-77777")) {
        console.log(`  [${update.status}]`);
    }
}
trackOrder();

// ============================================================
// SECTION 7 — Error Propagation
// Story: Rejected promises propagate until caught. In async
// functions, try/catch works naturally.
// ============================================================

async function processPaymentWithErrors(orderId) {
    try {
        await new Promise((_, rej) => setTimeout(() => rej(new Error("Insufficient balance")), 50));
    } catch (error) {
        console.log(`  Payment failed: ${error.message}`);
        return { status: "refunded", orderId };
    }
}
processPaymentWithErrors("SWG-FAIL").then(r => console.log("  Result:", r));

process.on("unhandledRejection", (reason) => {
    console.log("  CAUGHT unhandled rejection:", reason.message || reason);
});

// ============================================================
// SECTION 8 — Promise Concurrency Patterns
// Story: Swiggy's homepage loads from 5 microservices. The right
// concurrency pattern determines 200ms vs 1000ms.
// ============================================================

function fetchSvc(name, delay, fail = false) {
    return new Promise((res, rej) => setTimeout(() =>
        fail ? rej(new Error(`${name} failed`)) : res({ service: name }), delay));
}

setTimeout(async () => {
    // Promise.all — ALL must succeed
    const all = await Promise.all([fetchSvc("restaurants", 50), fetchSvc("reviews", 80)]);
    console.log("  all:", all.map(r => r.service).join(", "));

    // Promise.allSettled — waits for ALL, never rejects
    const settled = await Promise.allSettled([fetchSvc("a", 30), fetchSvc("b", 50, true)]);
    settled.forEach(r => console.log(`  settled: ${r.status}`, r.value?.service || r.reason?.message));

    // Promise.race — first to settle wins
    const race = await Promise.race([fetchSvc("slow", 100), fetchSvc("fast", 30)]);
    console.log("  race winner:", race.service);

    // Promise.any — first to FULFILL wins
    const any = await Promise.any([fetchSvc("x", 80, true), fetchSvc("y", 50)]);
    console.log("  any winner:", any.service);
}, 500);

// ============================================================
// SECTION 9 — Sequential vs Parallel Performance
// Story: Swiggy optimized order processing from 3s to 800ms by
// parallelizing independent async ops with Promise.all().
// ============================================================

async function fetchData(id) {
    return new Promise(r => setTimeout(() => r({ id }), 100));
}

setTimeout(async () => {
    const s1 = Date.now();
    await fetchData(1); await fetchData(2); await fetchData(3);
    console.log(`  Sequential: ${Date.now() - s1}ms`);

    const s2 = Date.now();
    await Promise.all([fetchData(1), fetchData(2), fetchData(3)]);
    console.log(`  Parallel: ${Date.now() - s2}ms`);
}, 2000);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Promises: pending → fulfilled/rejected (immutable once settled).
//    .then() registers reactions → become microtasks on settle.
//
// 2. Microtasks drain COMPLETELY before the next macrotask.
//
// 3. async/await compiles to a state machine. Each await suspends
//    (context → heap) and creates a microtask checkpoint.
//
// 4. Generators use the same suspend/resume mechanism as async.
//    yield: stack → heap. .next(): heap → stack.
//
// 5. Use Promise.all() for independent operations. Sequential
//    awaits for independent tasks is the #1 async perf mistake.
//
// 6. Always handle rejections: try/catch or .catch().
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("FILE 15 COMPLETE — Async Internals");
console.log("=".repeat(60));
