// ============================================================
// FILE 17: WEBASSEMBLY INTEROP WITH JAVASCRIPT
// Topic: How WebAssembly works alongside JavaScript in V8
// WHY: Wasm runs compiled C/Rust code at near-native speed in the
// same sandbox as JS. Understanding the JS-Wasm boundary reveals
// when and how to use Wasm effectively.
// ============================================================

// ============================================================
// SECTION 1 — What Is WebAssembly?
// Story: Razorpay verifies HMAC-SHA256 signatures on every payment.
// Pure JS crypto is 3-5x slower. Wasm gives near-native speed.
// ============================================================

//   V8 Engine: JS (dynamic, JIT) ↔ interop ↔ Wasm (static, AOT)
//   Same sandbox, same security model. Complement, not replacement.

console.log("=".repeat(60));
console.log("WEBASSEMBLY OVERVIEW");
console.log("=".repeat(60));

console.log("JS strengths: DOM, networking, async I/O, ecosystem");
console.log("Wasm strengths: crypto, compression, image processing, games");
console.log("KEY: Wasm is fast from first call. JS needs JIT warmup.");

// ============================================================
// SECTION 2 — Wasm Module from Raw Bytes
// Story: A minimal Wasm binary to understand the format before
// using real toolchains like Emscripten or wasm-pack.
// ============================================================

// WHY: A Wasm module is bytes — binary encoding of functions,
// types, memory, and exports.

const wasmBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,  // Magic + Version
    0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,  // Type: (i32,i32)->i32
    0x03, 0x02, 0x01, 0x00,  // Function: uses type 0
    0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,  // Export: "add"
    0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b  // Code: local.get 0, local.get 1, i32.add
]);

async function loadWasm() {
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module);
    console.log("add(40, 2) =", instance.exports.add(40, 2));  // 42
}
loadWasm().catch(console.error);

// ============================================================
// SECTION 3 — Loading Pipeline
// Story: bytes → compile → Module → instantiate → Instance.
// ============================================================

//   bytes → compile() → Module → instantiate(module, imports) → Instance
//   Browser shortcut: instantiateStreaming(fetch('file.wasm'))

console.log("\nLoading: compile() + instantiate(), or combined instantiate(bytes)");

// ============================================================
// SECTION 4 — Imports: JS Functions Callable from Wasm
// Story: Wasm can't access the outside world directly. Functions
// must be passed via the imports object.
// ============================================================

const wasmWithImport = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x08, 0x02, 0x60, 0x01, 0x7f, 0x00, 0x60, 0x00, 0x00,
    0x02, 0x0b, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x03, 0x6c, 0x6f, 0x67, 0x00, 0x00,
    0x03, 0x02, 0x01, 0x01,
    0x07, 0x08, 0x01, 0x04, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x01,
    0x0a, 0x08, 0x01, 0x06, 0x00, 0x41, 0x2a, 0x10, 0x00, 0x0b
]);

async function demoImports() {
    const imports = { env: { log: (v) => console.log("  [JS from Wasm] Value:", v) } };
    const { instance } = await WebAssembly.instantiate(wasmWithImport, imports);
    instance.exports.main();  // [JS from Wasm] Value: 42
}
demoImports().catch(console.error);

// ============================================================
// SECTION 5 — WebAssembly.Memory: Linear Memory
// Story: Wasm has NO access to JS objects. Communication happens
// through a flat byte array (linear memory).
// ============================================================

const wasmMemory = new WebAssembly.Memory({ initial: 1, maximum: 10 });
console.log("\nMemory:", wasmMemory.buffer.byteLength, "bytes (1 page = 64KB)");

const memView = new Uint8Array(wasmMemory.buffer);
memView[0] = 72; memView[1] = 101; memView[2] = 108; memView[3] = 108; memView[4] = 111;
console.log("Wrote 'Hello':", String.fromCharCode(...memView.slice(0, 5)));

// Growing memory (IMPORTANT: re-create typed array views after grow!)
wasmMemory.grow(2);
const newView = new Uint8Array(wasmMemory.buffer);
console.log("Data preserved after grow:", String.fromCharCode(...newView.slice(0, 5)));

// ============================================================
// SECTION 6 — Passing Strings Between JS and Wasm
// Story: Wasm only understands numbers. Strings must be
// serialized as bytes in shared memory.
// ============================================================

function writeString(memory, offset, str) {
    const bytes = new TextEncoder().encode(str);
    new Uint8Array(memory.buffer).set(bytes, offset);
    return bytes.length;
}
function readString(memory, offset, length) {
    return new TextDecoder().decode(new Uint8Array(memory.buffer, offset, length));
}

const strMem = new WebAssembly.Memory({ initial: 1 });
const len = writeString(strMem, 0, "Razorpay Payments");
console.log("Round-trip:", readString(strMem, 0, len));

// ============================================================
// SECTION 7 — Performance Characteristics
// Story: Wasm is 2x faster on first call. After JIT warmup,
// gap narrows. JS-Wasm call overhead: ~10-50ns per call.
// ============================================================

function fibJS(n) {
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) { const t = a + b; a = b; b = t; }
    return b;
}
for (let i = 0; i < 10000; i++) fibJS(30);  // JIT warmup
console.time("JS fib x10000"); for (let i = 0; i < 10000; i++) fibJS(40); console.timeEnd("JS fib x10000");
console.log("Wasm: instant speed, no warmup. JS can match AFTER JIT warmup.");

// ============================================================
// SECTION 8 — Compilation Tools and Future
// Story: Choose toolchain by source language. Same .wasm binary
// runs in browser AND Node.js.
// ============================================================

console.log("\nToolchains:");
console.log("  Emscripten: C/C++ → Wasm (most mature, FFmpeg, SQLite)");
console.log("  wasm-pack:  Rust → Wasm (smallest output, best tooling)");
console.log("  TinyGo:     Go → Wasm (subset of Go)");
console.log("  AssemblyScript: TypeScript-like → Wasm");

console.log("\nFuture: WASI (sandboxed OS access for Wasm outside browsers)");
console.log("  Edge computing: Cloudflare Workers, Fastly, Vercel");
console.log("  GC Proposal: Kotlin, Dart, Java → Wasm");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Wasm is a binary format running in the same sandbox as JS.
//    Compiled from C/C++/Rust/Go — complement, not replacement.
//
// 2. Pipeline: bytes → compile() → Module → instantiate() →
//    Instance → instance.exports.fn().
//
// 3. Imports: JS functions passed to Wasm. Exports: Wasm
//    functions called from JS. This is the interop bridge.
//
// 4. WebAssembly.Memory: flat byte array shared by JS and Wasm.
//    Strings must be manually encoded/decoded.
//
// 5. Wasm advantage: predictable perf, no JIT warmup.
//    JS can match Wasm speed after V8 JIT warms up.
//
// 6. Tools: Emscripten, wasm-pack, TinyGo, AssemblyScript.
//    Same binary runs in browser AND Node.js.
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("FILE 17 COMPLETE — WebAssembly Interop");
console.log("=".repeat(60));
