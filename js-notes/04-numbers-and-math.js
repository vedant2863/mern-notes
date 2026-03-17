/**
 * ============================================================
 *  FILE 4 : Numbers & Math
 * ============================================================
 *  Topic  : int, float, Infinity, NaN. Number methods. parseInt,
 *           parseFloat, toFixed, toString(radix). Math object.
 *           Floating-point gotcha. BigInt basics.
 *
 *  WHY: JS has a single Number type (64-bit float), so decimal
 *  precision traps lurk everywhere. Know your tools.
 * ============================================================
 */

// STORY: ISRO Mission Control is prepping Chandrayaan. Every
// calculation depends on JavaScript numbers.

// ────────────────────────────────────────────────────────────
// SECTION 1 — Number Basics: int, float, Infinity, NaN
// ────────────────────────────────────────────────────────────

const scientists = 6;
const fuelTons = 142.75;
const escapeVelocity = 11_186;    // underscores for readability

console.log(1 / 0);              // Infinity
console.log("rocket" * 2);       // NaN
console.log(NaN === NaN);        // false — NaN is never equal to itself

// ────────────────────────────────────────────────────────────
// SECTION 2 — Number Static Properties & Methods
// ────────────────────────────────────────────────────────────

console.log("MAX_SAFE_INTEGER:", Number.MAX_SAFE_INTEGER); // 9007199254740991

console.log(Number.isInteger(6));      // true
console.log(Number.isFinite(Infinity)); // false

// Number.isNaN vs global isNaN
console.log(Number.isNaN(NaN));        // true
console.log(Number.isNaN("hello"));    // false (no coercion)
console.log(isNaN("hello"));           // true  (coercion trap!)
// ALWAYS prefer Number.isNaN()

// ────────────────────────────────────────────────────────────
// SECTION 3 — Parsing & Conversion
// ────────────────────────────────────────────────────────────

console.log(parseInt("142.75 tons"));   // 142
console.log(parseInt("0xA3"));          // 163 (hex auto-detected)
console.log(parseInt("111", 2));        // 7   (binary to decimal)
console.log(parseFloat("142.75 tons")); // 142.75

const pi = 3.141592653589793;
console.log(pi.toFixed(2));             // "3.14" (returns a string!)

const missionId = 255;
console.log(missionId.toString(2));     // "11111111" (binary)
console.log(missionId.toString(16));    // "ff" (hex)

// ────────────────────────────────────────────────────────────
// SECTION 4 — The Math Object
// ────────────────────────────────────────────────────────────

// Rounding
console.log(Math.round(4.567)); // 5
console.log(Math.floor(4.567)); // 4
console.log(Math.ceil(4.567));  // 5
console.log(Math.trunc(4.567)); // 4

// floor vs trunc on negatives
console.log(Math.floor(-4.3));  // -5 (toward -Infinity)
console.log(Math.trunc(-4.3));  // -4 (toward zero)

console.log(Math.abs(-12.8));   // 12.8

const sensorReadings = [-120, 45, 300, 0, -50];
console.log(Math.max(...sensorReadings)); // 300
console.log(Math.min(...sensorReadings)); // -120

console.log(Math.pow(9.8, 2));  // 96.04
console.log(Math.sqrt(96.04));  // ~9.8

// Random integer between min and max (inclusive)
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
console.log("Random 1-100:", randomBetween(1, 100));

// ────────────────────────────────────────────────────────────
// SECTION 5 — Floating Point Precision Gotcha
// ────────────────────────────────────────────────────────────

console.log(0.1 + 0.2);             // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);     // false

function almostEqual(a, b) {
  return Math.abs(a - b) < Number.EPSILON;
}
console.log(almostEqual(0.1 + 0.2, 0.3)); // true

// ────────────────────────────────────────────────────────────
// SECTION 6 — BigInt Basics
// ────────────────────────────────────────────────────────────

const maxSafe = Number.MAX_SAFE_INTEGER;
console.log(maxSafe + 1); // 9007199254740992
console.log(maxSafe + 2); // 9007199254740992 — WRONG! Same as +1

const bigDistance = 9007199254740991n;
console.log(bigDistance + 2n); // 9007199254740993n — correct!

// Cannot mix BigInt and Number: bigDistance + 1 throws TypeError

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. JS has ONE number type: 64-bit IEEE 754 double.
// 2. Special values: Infinity, -Infinity, NaN.
// 3. Use Number.isNaN() — not global isNaN().
// 4. parseInt/parseFloat parse strings; .toFixed() returns a string.
// 5. Math covers rounding, abs, min/max, pow, sqrt, random.
// 6. 0.1 + 0.2 !== 0.3 — use Number.EPSILON for comparisons.
// 7. BigInt (suffix n) handles integers beyond MAX_SAFE_INTEGER.
// ============================================================
