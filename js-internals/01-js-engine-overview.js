// ============================================================
// FILE 01: JAVASCRIPT ENGINE OVERVIEW
// Topic: What a JS engine is and how it transforms your code into execution
// WHY: Every line of JavaScript goes through a complex pipeline before
//   it runs. Understanding this pipeline lets you write optimizable code
//   and debug mysterious performance issues.
// ============================================================

// ============================================================
// SECTION 1 — What is a JS Engine?
// STORY: A JS engine is SOFTWARE (usually C++) that reads your JavaScript
//   text and executes it. It is not hardware. Think of it like a translator
//   who reads JS and speaks "machine language."
// ============================================================

// A JavaScript engine:
// 1. Takes source code (text) as input
// 2. Parses it into a data structure (AST)
// 3. Compiles/interprets it
// 4. Executes it and produces results

console.log("=== SECTION 1: JS Engine Basics ===");
console.log("This console.log was processed by a JS engine (V8 in Node.js).");
console.log("");

// ============================================================
// SECTION 2 — Major Engines & The Pipeline
// STORY: Different browsers ship different engines. Chrome uses V8,
//   Firefox uses SpiderMonkey, Safari uses JavaScriptCore. All implement
//   the same ECMAScript spec but have different performance characteristics.
// ============================================================

console.log("=== SECTION 2: Major JS Engines ===");
const engines = [
    { name: "V8",              usedIn: "Chrome, Node.js, Deno, Edge", by: "Google" },
    { name: "SpiderMonkey",    usedIn: "Firefox",                     by: "Mozilla" },
    { name: "JavaScriptCore",  usedIn: "Safari, all iOS browsers",    by: "Apple" },
    { name: "Hermes",          usedIn: "React Native",                by: "Meta" },
];
engines.forEach(e => console.log(`  ${e.name} -> ${e.usedIn} (by ${e.by})`));
console.log("");

// --- The JS Engine Pipeline (V8) ---
//
//  Source Code -> Parser -> AST -> Ignition (interpreter) -> Bytecode
//                                       |
//                                  (hot code detected)
//                                       |
//                                  TurboFan (JIT) -> Machine Code

console.log("  Pipeline: Source -> Parser -> AST -> Ignition -> Bytecode");
console.log("            Hot code -> TurboFan -> Machine Code");
console.log("");

// ============================================================
// SECTION 3 — Interpreter vs Compiler vs JIT
// STORY: JS uses a HYBRID approach. It interprets immediately (fast startup)
//   then compiles hot code paths for speed. This is JIT compilation.
// ============================================================

// WHY: JavaScript is dynamically typed. The engine discovers types at
// RUNTIME, not compile time. This is why JIT exists -- you compile
// based on what you OBSERVE, not what is declared.

console.log("=== SECTION 3: JIT Compilation in Action ===");

// Interpreter:  line by line, fast startup, slower execution
// AOT Compiler: all code upfront, slow startup, fast execution
// JIT:          interpret first, compile hot paths on the fly (best of both)

function addNumbers(a, b) {
    return a + b;
}

const startJIT = Date.now();
let jitResult = 0;
for (let i = 0; i < 1_000_000; i++) {
    jitResult = addNumbers(i, i + 1);  // Hot path -> gets JIT compiled
}
const endJIT = Date.now();
console.log(`  1,000,000 calls to addNumbers: ${endJIT - startJIT}ms`);
console.log("  V8 likely JIT-compiled addNumbers after ~1000 calls.");
console.log("");

// ============================================================
// SECTION 4 — V8's Two-Tier Architecture: Ignition + TurboFan
// STORY: Ignition (interpreter) generates bytecode and collects type
//   feedback. TurboFan (optimizing compiler) uses that feedback to
//   generate optimized machine code. If assumptions fail, it deoptimizes.
// ============================================================

console.log("=== SECTION 4: V8 Ignition + TurboFan ===");
console.log("  Ignition: generates bytecode, collects type feedback");
console.log("  TurboFan: compiles hot bytecode into optimized machine code");
console.log("  Deopt:    if type assumptions break, falls back to Ignition");
console.log("");

// Dynamic types are WHY JS needs JIT (not AOT like C++):
function calculate(a, b) {
    return a + b;
}

console.log("  calculate(5, 3) =", calculate(5, 3));         // 8
console.log("  calculate('5', '3') =", calculate('5', '3')); // "53" (string concat!)
console.log("  Same function, different behavior based on runtime types.");
console.log("");

// ============================================================
// SECTION 5 — Single-Threaded + Host Environments
// STORY: JS is single-threaded: one call stack, one thing at a time.
//   The engine only knows ECMAScript. APIs like console.log, setTimeout,
//   and fetch come from the HOST ENVIRONMENT (browser or Node.js).
// ============================================================

console.log("=== SECTION 5: Single Thread & Host APIs ===");

function heavyComputation() {
    const start = Date.now();
    let count = 0;
    while (Date.now() - start < 50) { count++; }
    return count;
}

const iterations = heavyComputation();
console.log(`  Blocked for ~50ms: ${iterations.toLocaleString()} iterations`);
console.log("  Nothing else could run. In a browser, the UI freezes.");
console.log("");

// Engine (ECMAScript) vs Host (Browser/Node):
//   Engine:  let/const, functions, Promise, Map/Set, Proxy
//   Browser: DOM, fetch, setTimeout, localStorage
//   Node.js: fs, http, process, Buffer

console.log("  Engine:  variables, functions, Promise, Map/Set");
console.log("  Browser: DOM, fetch, setTimeout, localStorage");
console.log("  Node.js: fs, http, process, Buffer + libuv");
console.log("");

// ============================================================
// SECTION 6 — V8 Optimization Demo
// STORY: Type-stable functions get JIT-compiled and run faster.
//   Mixed types cause deoptimization -- measurably slower.
// ============================================================

console.log("=== SECTION 6: Type Stability Benchmark ===");

function multiply(a, b) { return a * b; }

function benchmark(fn, iterations, label) {
    for (let i = 0; i < 1000; i++) fn(i, i + 1); // warm up
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) fn(i, i + 1);
    const end = process.hrtime.bigint();
    console.log(`  ${label}: ${(Number(end - start) / 1_000_000).toFixed(2)}ms`);
}

benchmark(multiply, 10_000_000, "Type-stable multiply (always numbers)");

// Type-unstable version
function unstableMultiply(a, b) { return a * b; }
for (let i = 0; i < 5000; i++) unstableMultiply(i, i + 1);
unstableMultiply("hello", 5); // pollute type feedback

const start2 = process.hrtime.bigint();
for (let i = 0; i < 10_000_000; i++) unstableMultiply(i, i + 1);
const end2 = process.hrtime.bigint();
console.log(`  Type-unstable (mixed types): ${(Number(end2 - start2) / 1_000_000).toFixed(2)}ms`);
console.log("");

// Useful V8 flags:
console.log("  V8 debugging flags:");
console.log("  node --trace-opt script.js        # see optimized functions");
console.log("  node --trace-deopt script.js      # see deoptimized functions");
console.log("  node --print-bytecode script.js   # see generated bytecode");
if (typeof process !== 'undefined' && process.versions) {
    console.log(`  V8: ${process.versions.v8}, Node: ${process.version}`);
}
console.log("");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. A JS engine is SOFTWARE (C++) that executes JS. Main engines:
//    V8 (Chrome/Node), SpiderMonkey (Firefox), JSC (Safari).
//
// 2. Pipeline: Source -> Parser -> AST -> Ignition (bytecode)
//    -> (hot code) -> TurboFan -> Machine Code.
//
// 3. JIT = interpret first (fast startup) + compile hot code (fast exec).
//    Exists because JS is dynamically typed -- can't AOT compile.
//
// 4. V8 = Ignition (interpreter + type feedback) + TurboFan (optimizer).
//
// 5. JS is SINGLE-THREADED: one call stack, one thing at a time.
//
// 6. The engine only knows ECMAScript. console.log, setTimeout, fetch
//    are HOST ENVIRONMENT APIs.
//
// 7. Write type-stable code so V8 can optimize. Mixed types = deopt.
// ============================================================

console.log("=== KEY TAKEAWAYS ===");
console.log("1. JS engine = software (V8, SpiderMonkey, JSC)");
console.log("2. Pipeline: Source -> AST -> Bytecode -> (hot) -> Machine Code");
console.log("3. JIT: interpret first, compile hot code");
console.log("4. V8 = Ignition (interpreter) + TurboFan (optimizer)");
console.log("5. Single-threaded: one call stack, one thing at a time");
console.log("6. console.log is a host API, not part of the engine");
console.log("7. Type stability helps V8 optimize your functions");
