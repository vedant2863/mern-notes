/** ============================================================
 FILE 21: Util Module — The Jugaad Toolkit
 ============================================================
 Topic: The 'util' module — promisify, inspect, types, etc.
 WHY: promisify bridges callbacks to async/await. inspect
   gives deep visibility into objects. types validates
   reliably. Essential conversion and debugging helpers.
 ============================================================ */

const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// STORY: Jugaad Toolkit
// Raju the engineer has a tool for every situation — converting
// old-style jugaad to modern solutions (promisify), examining
// contraptions (inspect), identifying unknown parts (types),
// and labeling components (format).
// ============================================================

// ============================================================
// BLOCK 1 — promisify, callbackify, format, inspect
// ============================================================

console.log('='.repeat(60));
console.log('  BLOCK 1: promisify, callbackify, format, inspect');
console.log('='.repeat(60));

// ── util.promisify() ────────────────────────────────────────
// WHY: Converts callback APIs to promise-based for async/await.

console.log('\n--- util.promisify() ---');

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const unlinkAsync = util.promisify(fs.unlink);

const tmpFile = path.join(os.tmpdir(), 'raju-' + Date.now() + '.txt');

async function testPromisify() {
  await writeFileAsync(tmpFile, 'Jugaad blueprint: solar cooker from old satellite dish');
  const content = await readFileAsync(tmpFile, 'utf8');
  console.log(`  promisified readFile: "${content}"`);
  await unlinkAsync(tmpFile);
}

// ── util.callbackify() ─────────────────────────────────────
// WHY: Wraps async function to accept a callback. For legacy code.

console.log('\n--- util.callbackify() ---');

const callbackGreet = util.callbackify(async (name) => `Namaste, Engineer ${name}!`);

function testCallbackify() {
  return new Promise((resolve) => {
    callbackGreet('Raju', (err, result) => {
      if (!err) console.log(`  result: "${result}"`);
      resolve();
    });
  });
}

// ── util.format() ───────────────────────────────────────────
// WHY: printf-style formatting. %s=string, %d=number, %j=JSON, %o=object.

function testFormat() {
  console.log('\n--- util.format() ---');
  console.log(`  %s,%d : ${util.format('Engineer %s built %d contraptions', 'Raju', 7)}`);
  console.log(`  %j    : ${util.format('Blueprint: %j', { type: 'cooler', cost: 150 })}`);
  console.log(`  %o    : ${util.format('Parts: %o', { motor: true, fan: 3 })}`);
}

// ── util.inspect() ──────────────────────────────────────────
// WHY: Deep, configurable visualization of any object.

function testInspect() {
  console.log('\n--- util.inspect() ---');

  const contraption = {
    name: 'Solar Water Heater',
    origin: { inventor: 'Raju', location: { state: 'Rajasthan', city: 'Jaipur' } },
    materials: ['copper pipe', 'old mirror'],
    specs: new Map([['certified', true], ['id', 'JGD-0042']]),
  };

  // Default inspect
  console.log(`  Default:\n    ${util.inspect(contraption, { colors: false }).split('\n').join('\n    ')}`);

  // Deep inspect: depth:null = unlimited
  const deep = util.inspect(contraption, { depth: null, colors: false, compact: false });
  console.log(`\n  Deep (depth:null):`);
  deep.split('\n').forEach(l => console.log(`    ${l}`));

  // Custom inspect symbol
  class JugaadProject {
    constructor(name, parts) { this.name = name; this.parts = parts; }
    [util.inspect.custom]() { return `JugaadProject<${this.name}, ${this.parts} parts>`; }
  }
  console.log(`\n  Custom: ${util.inspect(new JugaadProject('Cooler-2024', 8), { colors: false })}`);
}

// ============================================================
// BLOCK 2 — types, deprecate, TextEncoder/Decoder
// ============================================================

async function testBlock2() {
  console.log('\n' + '='.repeat(60));
  console.log('  BLOCK 2: types, deprecate, TextEncoder');
  console.log('='.repeat(60));

  // ── util.types — reliable type checking ───────────────────
  // WHY: Works across realms (unlike instanceof)

  console.log('\n--- util.types ---');
  console.log(`  isDate(new Date())        : ${util.types.isDate(new Date())}`);
  console.log(`  isRegExp(/abc/)           : ${util.types.isRegExp(/abc/)}`);
  console.log(`  isPromise(Promise.resolve()): ${util.types.isPromise(Promise.resolve())}`);
  console.log(`  isAsyncFunction(async()=>{}): ${util.types.isAsyncFunction(async () => {})}`);
  console.log(`  isMap(new Map())          : ${util.types.isMap(new Map())}`);

  // ── util.deprecate() ─────────────────────────────────────
  // WHY: Emits a warning on first call. Phases out old APIs.

  console.log('\n--- util.deprecate() ---');
  const oldMethod = util.deprecate(() => 'Using hand-crank pump', 'Use electricPump() instead.', 'DEP_RAJU_001');
  console.log(`  oldMethod(): "${oldMethod()}"`);
  console.log('  (Deprecation warning emitted to stderr)');

  // ── TextEncoder / TextDecoder ─────────────────────────────
  // WHY: Convert between strings and Uint8Arrays.

  console.log('\n--- TextEncoder / TextDecoder ---');
  const encoder = new util.TextEncoder();
  const decoder = new util.TextDecoder('utf-8');

  const encoded = encoder.encode('Raju builds the contraption');
  console.log(`  Encoded: ${encoded.constructor.name}, ${encoded.length} bytes`);
  console.log(`  Decoded: "${decoder.decode(encoded)}"`);

  // ── util.getSystemErrorName() ─────────────────────────────

  console.log('\n--- util.getSystemErrorName() ---');
  for (const code of [-1, -2, -13]) {
    try { console.log(`  errno ${code} -> ${util.getSystemErrorName(code)}`); }
    catch (e) { console.log(`  errno ${code} -> (unknown)`); }
  }

  console.log('\n' + '='.repeat(60));
}

// ── Run everything ──────────────────────────────────────────

async function main() {
  await testPromisify();
  await testCallbackify();
  testFormat();
  testInspect();
  await testBlock2();
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. util.promisify(fn) — convert callback APIs to promises
// 2. util.callbackify(fn) — convert async to callbacks
// 3. util.format('%s %d %j %o') — printf-style formatting
// 4. util.inspect(obj, opts) — deep object visualization
// 5. inspect options: depth, colors, compact, [inspect.custom]
// 6. util.types.isDate/isPromise/isRegExp — reliable type checks
// 7. util.deprecate(fn, msg) — emit warning on first call
// 8. TextEncoder/TextDecoder — string <-> Uint8Array
// ============================================================
