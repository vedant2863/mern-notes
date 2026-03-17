// ============================================================
// FILE 11: JIT OPTIMIZATION
// Topic: How V8's Just-In-Time compiler makes JavaScript fast
// WHY: JS starts as text, gets interpreted, then hot functions
//   get compiled to optimized machine code at RUNTIME. This is
//   why JS can approach C++ speeds. Understanding it helps you
//   write code V8 can optimize aggressively.
// ============================================================

// ============================================================
// SECTION 1 — V8 Compilation Pipeline
// Story: Source code → Parser → Ignition (interpreter) →
//   TurboFan (optimizing compiler). If assumptions break,
//   deoptimize back to Ignition.
// ============================================================

//  Source → Parser → AST → Ignition (bytecode + type feedback)
//    ↓ hot function + stable types
//  TurboFan → optimized machine code
//    ↓ assumption violated
//  Deoptimize → back to Ignition

console.log("Pipeline: Source → Ignition (interpret) → TurboFan (compile)");
console.log("If type assumptions break → Deoptimize → back to Ignition\n");


// ============================================================
// SECTION 2 — Function Heat Levels
// Story: Cold functions stay interpreted. Hot functions get
//   compiled to machine code by TurboFan.
// ============================================================

// COLD: called once at startup — not worth compiling
function parseConfig(str) { return JSON.parse(str); }

// HOT: called millions of times — TurboFan optimizes this
function calculateSIPReturns(monthly, rate, months) {
    let total = 0;
    const monthlyRate = rate / 12 / 100;
    for (let i = 0; i < months; i++) {
        total = (total + monthly) * (1 + monthlyRate);
    }
    return total;
}

const sipResult = calculateSIPReturns(10000, 12, 240);
console.log(`SIP: Rs. ${sipResult.toFixed(2)} (10K/mo, 12%, 20yr)`);
console.log("Hot functions get TurboFan-compiled to machine code\n");


// ============================================================
// SECTION 3 — Type Feedback and Speculative Optimization
// Story: Ignition records "add() always gets (int, int)."
//   TurboFan generates specialized integer-add machine code.
// ============================================================

// WHY: Type feedback tells TurboFan what machine instructions to emit.
// Consistent types = specialized fast code. Mixed types = slow generic code.

function add(a, b) { return a + b; }

// Ignition collects: (int32, int32) → int32
for (let i = 0; i < 100; i++) add(i, i + 1);

//  UNOPTIMIZED: load a, check type, load b, check type, add, box result
//  OPTIMIZED:   ADD reg_a, reg_b → one CPU instruction!

// But passing a string triggers DEOPTIMIZATION:
add("hello", " world");
console.log('add("hello"," world") → DEOPT! Optimized code thrown away.');
console.log("Falls back to Ignition, may re-optimize with broader types.\n");


// ============================================================
// SECTION 4 — Deoptimization Triggers
// Story: When V8's assumptions are violated, optimized code is
//   discarded and execution falls back to the interpreter.
// ============================================================

// Trigger 1: Type change
function validateAmount(amount) { return amount > 0 && amount < 1000000; }
for (let i = 0; i < 10000; i++) validateAmount(i);
validateAmount("500");  // DEOPT — string comparison != number comparison
console.log("Trigger 1: Type change (number → string)");

// Trigger 2: Hidden class change
function getPrice(p) { return p.price; }
for (let i = 0; i < 10000; i++) getPrice({ name: "X", price: i });
getPrice({ price: 1000, name: "Y", category: "z" });  // different shape!
console.log("Trigger 2: Hidden class change (different property order)");

// Trigger 3: Out-of-bounds array access
console.log("Trigger 3: arr[arr.length] → undefined → type violation");

// Trigger 4-5: eval, with, leaking arguments
console.log("Trigger 4-5: eval(), with, leaking arguments object\n");


// ============================================================
// SECTION 5 — JIT-Friendly Coding Patterns
// ============================================================

console.log("=== JIT-Friendly Patterns ===\n");

// Rule 1: Monomorphic functions
class RewardInput {
    constructor(value) { this.value = value; this.multiplier = 1; }
}
function processReward(input) { return input.value * 2; }
processReward(new RewardInput(10));  // Always same shape!
console.log("Rule 1: Same shape every call → monomorphic → fast");

// Rule 2: Don't change variable types
console.log("Rule 2: let num = 42; // don't later assign 'hello'");

// Rule 3: Homogeneous arrays
const intArray = [1, 2, 3, 4, 5];  // PACKED_SMI_ELEMENTS — fastest
console.log("Rule 3: [1,2,3] not [1,'two',null] → packed SMI → fast");

// Rule 4: TypedArrays for numeric computation
console.log("Rule 4: Float64Array for heavy math — contiguous, no type checks\n");


// ============================================================
// SECTION 6 — Function Inlining
// Story: TurboFan copies small function bodies directly into
//   the caller, eliminating call overhead entirely.
// ============================================================

function square(x) { return x * x; }

function sumOfSquares(n) {
    let total = 0;
    for (let i = 0; i < n; i++) total += square(i);
    // TurboFan inlines: total += i * i (no function call!)
    return total;
}

console.log(`Sum of squares (0-999): ${sumOfSquares(1000)}`);
console.log("Small hot functions are inlined — zero call overhead\n");


// ============================================================
// SECTION 7 — Escape Analysis
// Story: Objects that never leave a function can be stack-allocated
//   or decomposed into variables — zero GC cost.
// ============================================================

// Object doesn't escape → stack-allocated or scalar-replaced
function calculateDistance(x1, y1, x2, y2) {
    const point = { dx: x2 - x1, dy: y2 - y1 };  // V8 may decompose this
    return Math.sqrt(point.dx * point.dx + point.dy * point.dy);
}

console.log("Distance:", calculateDistance(0, 0, 3, 4));  // 5
console.log("Escape analysis: temp objects → stack, not heap → no GC\n");


// ============================================================
// SECTION 8 — Benchmark: JIT-Friendly vs JIT-Hostile
// ============================================================

function benchFriendly() {
    function addNums(a, b) { return a + b; }
    const start = process.hrtime.bigint();
    let total = 0;
    for (let i = 0; i < 1_000_000; i++) total += addNums(i, i + 1);
    return { total, ms: Number(process.hrtime.bigint() - start) / 1_000_000 };
}

function benchHostile() {
    function addAny(a, b) { return a + b; }
    const start = process.hrtime.bigint();
    let total = 0;
    for (let i = 0; i < 1_000_000; i++) {
        if (i % 3 === 0) total += addAny(i, i + 1);
        else if (i % 3 === 1) addAny("s" + i, "s" + (i + 1));
        else addAny(i, String(i + 1));
    }
    return { total, ms: Number(process.hrtime.bigint() - start) / 1_000_000 };
}

benchFriendly(); benchHostile(); // warm up
const friendly = benchFriendly();
const hostile = benchHostile();
console.log(`JIT-Friendly: ${friendly.ms.toFixed(2)} ms`);
console.log(`JIT-Hostile:  ${hostile.ms.toFixed(2)} ms`);
console.log(`Mixed types ~${(hostile.ms / friendly.ms).toFixed(1)}x slower\n`);


// ============================================================
// SECTION 9 — Array Element Kinds
// Story: V8 tracks array element type. Once an array transitions
//   to a more general kind, it NEVER goes back.
// ============================================================

//  PACKED_SMI → PACKED_DOUBLE → PACKED_ELEMENTS (one-way!)
//  Adding holes (arr[100]=x on small array) → HOLEY_* variants

const smi = [1, 2, 3];           // PACKED_SMI_ELEMENTS (fastest)
const dbl = [1, 2, 3]; dbl.push(3.14);  // PACKED_DOUBLE_ELEMENTS
const gen = [1, 2, 3]; gen.push("six");  // PACKED_ELEMENTS (slowest)
const holey = [1, 2, 3]; holey[100] = 4; // HOLEY_SMI_ELEMENTS

console.log("Array kinds: SMI (fastest) → DOUBLE → ELEMENTS (slowest)");
console.log("Transitions are ONE-WAY. Keep arrays homogeneous and dense.\n");


// ============================================================
// SECTION 10 — V8 Debug Flags
// ============================================================

console.log("=== V8 Debug Flags (not for production) ===");
console.log("  node --allow-natives-syntax  → %OptimizeFunctionOnNextCall(fn)");
console.log("  --trace-opt    → log optimizations");
console.log("  --trace-deopt  → log deoptimizations");
console.log("  --trace-ic     → log inline cache transitions");
console.log("  --prof         → CPU profile (v8.log)\n");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. V8: Ignition (interpreter) for all code, TurboFan (compiler)
//    for hot functions. Type feedback drives specialization.
//
// 2. Deopt triggers: type changes, hidden class changes,
//    out-of-bounds access, eval, with, arguments leaking.
//
// 3. Monomorphic (1 type) = fast. Megamorphic (5+) = slow.
//
// 4. Inlining eliminates call overhead for small hot functions.
//    Escape analysis avoids heap allocation for temp objects.
//
// 5. Array element kinds: SMI → DOUBLE → ELEMENTS (one-way).
//    Keep arrays homogeneous. Write predictable, consistent code.
// ============================================================

console.log("=== FILE 11 COMPLETE ===\n");
