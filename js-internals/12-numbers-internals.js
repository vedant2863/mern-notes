// ============================================================
// FILE 12: NUMBERS INTERNALS
// Topic: How JavaScript stores and processes numbers under the hood
// WHY: JS has ONE number type — IEEE 754 double-precision 64-bit
//   float. This causes 0.1 + 0.2 !== 0.3, limits safe integers
//   to 2^53, and means money calculations can silently lose
//   precision. Understanding this prevents real financial bugs.
// ============================================================

// ============================================================
// SECTION 1 — The Famous 0.1 + 0.2 Problem
// Story: 0.1 + 0.2 !== 0.3 isn't a JS bug — it's a fundamental
//   limit of binary floating-point. 1/10 repeats in binary just
//   like 1/3 repeats in decimal.
// ============================================================

console.log("=== 0.1 + 0.2 Problem ===");
console.log("0.1 + 0.2 =", 0.1 + 0.2);              // 0.30000000000000004
console.log("0.1 + 0.2 === 0.3?", 0.1 + 0.2 === 0.3); // false

// IEEE 754: 64 bits = 1 sign + 11 exponent + 52 mantissa
// 52 bits of mantissa ≈ 15-17 significant decimal digits
console.log("0.1 stored as:", (0.1).toPrecision(20));   // 0.10000000000000000555
console.log("0.2 stored as:", (0.2).toPrecision(20));   // 0.20000000000000001110
console.log("Decimal 0.1 = Binary 0.00011001100110011... (repeating)\n");


// ============================================================
// SECTION 2 — MAX_SAFE_INTEGER
// Story: Beyond 2^53-1, integers lose precision. Two DIFFERENT
//   numbers can compare as equal.
// ============================================================

console.log("=== MAX_SAFE_INTEGER ===");
const big = Number.MAX_SAFE_INTEGER;  // 9007199254740991 (2^53 - 1)
console.log("MAX_SAFE_INTEGER:", big);
console.log("big + 1:", big + 1);  // 9007199254740992
console.log("big + 2:", big + 2);  // 9007199254740992 — SAME as big+1!
console.log("9007199254740992 === 9007199254740993?",
    9007199254740992 === 9007199254740993);  // true — dangerous!
console.log("Number.isSafeInteger(2**53):", Number.isSafeInteger(2**53)); // false
console.log();


// ============================================================
// SECTION 3 — V8 Internals: Smi vs HeapNumber
// Story: V8 stores small integers (Smi) directly in the pointer
//   — no heap allocation. Everything else is a HeapNumber on the
//   heap needing GC. Integer math is significantly faster.
// ============================================================

//  Smi: [-2^30, 2^30-1] stored IN the pointer (tag bit = 0)
//  HeapNumber: 64-bit float boxed on heap (needs GC)

console.log("=== Smi vs HeapNumber ===");
console.log("Smi range:", -(2**30), "to", 2**30 - 1);
console.log("42 → Smi | 3.14 → HeapNumber | NaN → HeapNumber");

function benchSmi() {
    let total = 0;
    const start = process.hrtime.bigint();
    for (let i = 0; i < 1_000_000; i++) total += i;
    return { total, ms: Number(process.hrtime.bigint() - start) / 1_000_000 };
}
function benchFloat() {
    let total = 0.1;
    const start = process.hrtime.bigint();
    for (let i = 0; i < 1_000_000; i++) total += i + 0.1;
    return { total, ms: Number(process.hrtime.bigint() - start) / 1_000_000 };
}
benchSmi(); benchFloat();
const smi = benchSmi();
const heap = benchFloat();
console.log(`Smi arithmetic: ${smi.ms.toFixed(2)} ms`);
console.log(`Float arithmetic: ${heap.ms.toFixed(2)} ms`);
console.log(`Integer math ~${(heap.ms / smi.ms).toFixed(1)}x faster\n`);


// ============================================================
// SECTION 4 — Special Number Values
// Story: NaN, Infinity, and -0 all behave in surprising ways.
// ============================================================

console.log("=== Special Values ===");
console.log("NaN === NaN:", NaN === NaN);             // false!
console.log("Number.isNaN(NaN):", Number.isNaN(NaN)); // true (use this, not isNaN())
console.log("1 / 0:", 1 / 0);                         // Infinity
console.log("-0 === 0:", -0 === 0);                    // true
console.log("Object.is(-0, 0):", Object.is(-0, 0));   // false (correct)
console.log();


// ============================================================
// SECTION 5 — Floating Point Pitfalls and Fixes
// ============================================================

console.log("=== Floating Point Pitfalls ===");
console.log("1.1 + 2.2 =", 1.1 + 2.2);  // 3.3000000000000003

let sum = 0;
for (let i = 0; i < 10; i++) sum += 0.1;
console.log("0.1 * 10 =", sum);  // 0.9999999999999999

// Fix: EPSILON comparison
function nearlyEqual(a, b) { return Math.abs(a - b) < Number.EPSILON; }
console.log("nearlyEqual(0.1+0.2, 0.3):", nearlyEqual(0.1 + 0.2, 0.3));
console.log();


// ============================================================
// SECTION 6 — The "Work in Paise" Pattern
// Story: Every serious payment system (Razorpay, Stripe) stores
//   money as smallest-unit integers. No float errors possible.
// ============================================================

// BAD: floating-point money
console.log("=== Work in Paise ===");
console.log("BAD: 199.99 * 0.18 =", 199.99 * 0.18);  // imprecise

// GOOD: integer arithmetic in paise
const pricePaise = 19999;                          // Rs. 199.99
const taxPaise = Math.round(pricePaise * 18 / 100); // 3600 paise — exact
const totalPaise = pricePaise + taxPaise;

function formatRupees(paise) { return `Rs. ${(paise / 100).toFixed(2)}`; }
console.log(`Price: ${formatRupees(pricePaise)} | Tax: ${formatRupees(taxPaise)} | Total: ${formatRupees(totalPaise)}`);
console.log("All integer arithmetic — precise to the paisa!\n");


// ============================================================
// SECTION 7 — BigInt
// Story: For integers beyond 2^53, BigInt provides arbitrary
//   precision. No MAX_SAFE_INTEGER limit.
// ============================================================

console.log("=== BigInt ===");
const big1 = 9007199254740993n;  // Beyond MAX_SAFE_INTEGER — precise!
console.log("BigInt:", big1);
console.log("big1 + 1n:", big1 + 1n);
console.log("typeof:", typeof big1);  // "bigint"
console.log("42n === 42:", 42n === 42);  // false (different types)
console.log("42n == 42:", 42n == 42);   // true (coercion)
console.log("3n / 2n:", 3n / 2n);       // 1n (truncates, no decimals)
console.log("Limitations: no decimals, no Math.*, no JSON.stringify, slower\n");


// ============================================================
// SECTION 8 — Number Puzzles
// ============================================================

console.log("=== Number Puzzles ===");
console.log("'5' + 3 =", "5" + 3);          // "53" (string concat)
console.log("'5' - 3 =", "5" - 3);          // 2 (numeric)
console.log("parseInt(0.0000005):", parseInt(0.0000005)); // 5 (toString → '5e-7')
console.log("(1.255).toFixed(2):", (1.255).toFixed(2));   // "1.25" not "1.26"!
console.log("0.5 + 0.25 === 0.75:", 0.5 + 0.25 === 0.75); // true (powers of 2 exact)
console.log();


// ============================================================
// SECTION 9 — Number Conversions and Indian Formatting
// ============================================================

console.log("=== Conversions ===");
console.log("Number(''):", Number(""));       // 0 (surprise!)
console.log("Number('42abc'):", Number("42abc")); // NaN
console.log("parseInt('42.9'):", parseInt("42.9")); // 42

console.log("\n=== Indian Formatting ===");
const amount = 12345678.50;
console.log(`${amount} → ${amount.toLocaleString("en-IN")}`);
console.log(new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount));
console.log();


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. All JS numbers are IEEE 754 double (64-bit float).
//    0.1 + 0.2 !== 0.3 because 0.1 repeats in binary.
//
// 2. MAX_SAFE_INTEGER = 2^53-1. Beyond that, integers lose
//    precision. Use BigInt or string IDs for large values.
//
// 3. V8 uses Smi (small int in pointer) vs HeapNumber (boxed).
//    Integer math is significantly faster — no heap allocation.
//
// 4. For money: ALWAYS work in paise/cents as integers.
//    Convert to rupees only for display.
//
// 5. Special values: NaN !== NaN (use Number.isNaN()),
//    -0 === 0 (use Object.is()), Infinity from 1/0.
//
// 6. BigInt (123n) for arbitrary precision. No decimals,
//    can't mix with Number, slower than regular numbers.
// ============================================================

console.log("=== FILE 12 COMPLETE ===\n");
