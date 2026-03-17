// ============================================================
// FILE 03: THE COMPILATION PIPELINE
// Topic: How V8 transforms parsed code into bytecode and then optimized machine code
// WHY: When your JS runs slowly, the bottleneck is often in how the engine
//   compiles and optimizes your code. Understanding Ignition bytecodes,
//   type feedback, and TurboFan optimizations lets you write code the
//   engine loves to optimize.
// ============================================================

// ============================================================
// SECTION 1 — The V8 Pipeline
// STORY: V8 doesn't just interpret your code. It watches, profiles, and
//   compiles hot paths into optimized machine code. If assumptions break,
//   it deoptimizes back to the interpreter.
// ============================================================

console.log("=== SECTION 1: The V8 Compilation Pipeline ===");

// Source -> Parser -> AST -> Ignition (bytecode + type feedback)
//                                |
//                          (hot code detected)
//                                |
//                           TurboFan -> Optimized Machine Code
//                                |
//                          (assumption violated?)
//                                |
//                           DEOPTIMIZE -> back to Ignition

console.log("  Parser -> AST -> Ignition (bytecode) -> TurboFan (machine code)");
console.log("                                ^                    |");
console.log("                                |--- DEOPTIMIZE <---+");
console.log("");

// ============================================================
// SECTION 2 — Ignition: The Bytecode Interpreter
// STORY: Ignition generates compact bytecodes -- like assembly for a
//   virtual machine. It collects type feedback while running, which
//   TurboFan later uses for optimization.
// ============================================================

console.log("=== SECTION 2: Ignition Bytecodes ===");

function add(a, b) { return a + b; }

// V8's Ignition generates roughly:
//   Ldar a1       ; Load argument 'a' into accumulator
//   Add a2, [0]   ; Add argument 'b', feedback at slot 0
//   Return        ; Return accumulator value

console.log("  Bytecode for add(a, b):");
console.log("    Ldar a1       ; Load 'a' into accumulator");
console.log("    Add a2, [0]   ; Add 'b', collect type feedback");
console.log("    Return        ; Return result");
console.log("");
console.log("  View bytecodes yourself:");
console.log("  node --print-bytecode --print-bytecode-filter=add script.js");
console.log("");

// Common bytecodes: LdaSmi (load small int), Star (store to register),
// Add/Sub/Mul/Div, Jump/JumpIfTrue, CallProperty, Return

// ============================================================
// SECTION 3 — Type Feedback and Profiling
// STORY: Ignition records what types flow through each operation.
//   "This Add always gets numbers" -> MONOMORPHIC (best for optimization).
//   Multiple types -> POLYMORPHIC -> MEGAMORPHIC (V8 gives up specializing).
// ============================================================

console.log("=== SECTION 3: Type Feedback ===");

// Feedback states:
// UNINITIALIZED -> MONOMORPHIC -> POLYMORPHIC -> MEGAMORPHIC
//  (no calls)     (one type,      (2-4 types,    (many types,
//                  best!)          still OK)       slow)

function processValue(x) { return x.toString(); }

// Monomorphic: always same type
const monoStart = process.hrtime.bigint();
for (let i = 0; i < 1_000_000; i++) processValue(42);
const monoEnd = process.hrtime.bigint();

// Megamorphic: many different types
const types = [42, "hello", true, 0, 99, { x: 1 }, [1, 2], 3.14, 77, "world"];
const megaStart = process.hrtime.bigint();
for (let i = 0; i < 1_000_000; i++) processValue(types[i % types.length]);
const megaEnd = process.hrtime.bigint();

console.log(`  Monomorphic (always number): ${Number(monoEnd - monoStart) / 1_000_000}ms`);
console.log(`  Megamorphic (mixed types):   ${Number(megaEnd - megaStart) / 1_000_000}ms`);
console.log("");

// ============================================================
// SECTION 4 — TurboFan: Speculative Optimization
// STORY: TurboFan takes bytecodes + type feedback and generates machine
//   code. It SPECULATES based on observed types: "a is always a number"
//   -> skip type checks, use direct CPU instructions. 10-100x faster.
// ============================================================

console.log("=== SECTION 4: TurboFan Optimizations ===");

// TurboFan optimization phases:
// 1. Build graph (sea-of-nodes IR)
// 2. Inlining (inline small called functions)
// 3. Type specialization (use type feedback to remove checks)
// 4. Constant folding (2+3 -> 5 at compile time)
// 5. Dead code elimination
// 6. Register allocation -> Machine code generation

// Interpreted add(a, b):
//   check typeof a, check typeof b, handle all coercion cases, then add

// TurboFan-optimized add(a, b):
//   guard: are both numbers? if not -> DEOPTIMIZE
//   single CPU add instruction (fast!)

console.log("  Interpreted: type checks + coercion + add (slow)");
console.log("  TurboFan:    type guard + CPU add instruction (fast!)");
console.log("");

// ============================================================
// SECTION 5 — Deoptimization
// STORY: When TurboFan's assumptions are wrong (type changes), it throws
//   away the optimized code, reconstructs interpreter state, and falls
//   back to Ignition. This is expensive -- avoid it in hot paths.
// ============================================================

console.log("=== SECTION 5: Deoptimization ===");

function polymorphicAdd(a, b) { return a + b; }

// Phase 1: Warm up with numbers (TurboFan optimizes for numbers)
for (let i = 0; i < 100000; i++) polymorphicAdd(i, i + 1);
console.log("  Phase 1: 100K calls with numbers (optimized)");

// Phase 2: Call with string -> deoptimization!
const stringResult = polymorphicAdd("Mumbai", " Indians");
console.log(`  Phase 2: Called with strings -> "${stringResult}" (DEOPTIMIZED!)`);

// Phase 3: Re-optimized with broader (less optimal) assumptions
for (let i = 0; i < 100000; i++) polymorphicAdd(i, i + 1);
console.log("  Phase 3: Re-optimized (handles both types = less optimal)");
console.log("");
console.log("  Detect with: node --trace-deopt script.js");
console.log("");

// ============================================================
// SECTION 6 — Type Stability & Inline Caching
// STORY: Type stability is THE #1 V8 performance rule. Functions that
//   always receive the same types get the best optimizations. Inline
//   caching remembers where object properties live in memory -- objects
//   with the same shape share the cache (fast), different shapes don't.
// ============================================================

console.log("=== SECTION 6: Type Stability & Inline Caching ===");

// BAD: type-unstable function
function badProcess(input) {
    if (typeof input === 'number') return input * 2;
    if (typeof input === 'string') return input.toUpperCase();
    if (Array.isArray(input)) return input.length;
    return null;
}

// GOOD: separate type-stable functions
function doubleNumber(n) { return n * 2; }
function uppercaseString(s) { return s.toUpperCase(); }

const stableStart = process.hrtime.bigint();
for (let i = 0; i < 5_000_000; i++) doubleNumber(i);
const stableEnd = process.hrtime.bigint();

const inputs = [42, "hello", [1, 2, 3], 100, "world", [4, 5]];
const unstableStart = process.hrtime.bigint();
for (let i = 0; i < 5_000_000; i++) badProcess(inputs[i % inputs.length]);
const unstableEnd = process.hrtime.bigint();

console.log(`  Type-stable (always number):  ${Number(stableEnd - stableStart) / 1_000_000}ms`);
console.log(`  Type-unstable (mixed types):  ${Number(unstableEnd - unstableStart) / 1_000_000}ms`);
console.log("");

// Inline Caching: same object shape -> monomorphic IC (fastest)
// IC states: UNINITIALIZED -> MONOMORPHIC -> POLYMORPHIC -> MEGAMORPHIC

function getPrice(product) { return product.price; }

// GOOD: same shape -> monomorphic
const products = [];
for (let i = 0; i < 10000; i++) {
    products.push({ name: `Product ${i}`, price: i * 100, brand: "TestBrand" });
}

const icStart = process.hrtime.bigint();
let total = 0;
for (const p of products) total += getPrice(p);
const icEnd = process.hrtime.bigint();
console.log(`  Monomorphic IC (same shape): ${Number(icEnd - icStart) / 1_000_000}ms`);

// BAD: different shapes -> megamorphic
function getPriceBad(product) { return product.price; }
const mixedProducts = [];
for (let i = 0; i < 10000; i++) {
    if (i % 4 === 0) mixedProducts.push({ price: i * 100, name: `A${i}` });
    else if (i % 4 === 1) mixedProducts.push({ name: `B${i}`, price: i * 100, brand: "X" });
    else if (i % 4 === 2) mixedProducts.push({ brand: "Y", price: i * 100 });
    else mixedProducts.push({ rating: 5, brand: "Z", price: i * 100, name: `D${i}` });
}

const icStart2 = process.hrtime.bigint();
let total2 = 0;
for (const p of mixedProducts) total2 += getPriceBad(p);
const icEnd2 = process.hrtime.bigint();
console.log(`  Megamorphic IC (mixed shapes): ${Number(icEnd2 - icStart2) / 1_000_000}ms`);
console.log("");

// ============================================================
// SECTION 7 — On-Stack Replacement (OSR) + V8-Friendly Guidelines
// STORY: OSR optimizes long-running loops mid-execution -- the loop
//   starts interpreted and switches to machine code partway through.
// ============================================================

console.log("=== SECTION 7: OSR & V8-Friendly Code ===");

function sumLoop(n) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += i;
    return sum;
}

const osrStart = process.hrtime.bigint();
sumLoop(10_000_000);  // First: interpreted, then OSR mid-loop
const osrEnd = process.hrtime.bigint();

const osrStart2 = process.hrtime.bigint();
sumLoop(10_000_000);  // Second: already compiled, fast from start
const osrEnd2 = process.hrtime.bigint();

console.log(`  First call  (with OSR): ${Number(osrEnd - osrStart) / 1_000_000}ms`);
console.log(`  Second call (compiled): ${Number(osrEnd2 - osrStart2) / 1_000_000}ms`);
console.log("");

console.log("  V8-Friendly Code Rules:");
console.log("  1. TYPE STABILITY: same types to same functions");
console.log("  2. OBJECT SHAPE: same properties, same order");
console.log("  3. AVOID delete: use obj.prop = undefined instead");
console.log("  4. USE REST PARAMS: ...args instead of arguments object");
console.log("  5. MONOMORPHIC OPS: same operation on same types");
console.log("");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Pipeline: AST -> Ignition (bytecode + type feedback) -> TurboFan (machine code)
//
// 2. Ignition generates bytecodes and collects type feedback at each operation.
//
// 3. Type feedback states: MONOMORPHIC (best) -> POLYMORPHIC -> MEGAMORPHIC (worst).
//
// 4. TurboFan speculatively optimizes based on observed types. If wrong -> DEOPTIMIZE.
//
// 5. Type stability is the #1 V8 performance rule.
//
// 6. Inline caching: same object shape = fast property access.
//
// 7. OSR optimizes loops mid-execution.
//
// 8. Debug with --trace-opt, --trace-deopt, --print-bytecode.
// ============================================================

console.log("=== KEY TAKEAWAYS ===");
console.log("1. Pipeline: AST -> Ignition (bytecode + feedback) -> TurboFan (machine code)");
console.log("2. Ignition generates bytecodes and collects type feedback");
console.log("3. Feedback: MONOMORPHIC (best) -> POLYMORPHIC -> MEGAMORPHIC (worst)");
console.log("4. TurboFan speculates on types; wrong assumptions -> deoptimize");
console.log("5. Type stability is the #1 V8 performance rule");
console.log("6. Inline caching: consistent object shapes = fast property access");
console.log("7. OSR optimizes loops mid-execution");
console.log("8. Use --trace-opt and --trace-deopt to observe V8 decisions");
