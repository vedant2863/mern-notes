/**
 * ============================================================
 *  FILE 9 : null, undefined & NaN
 * ============================================================
 *  Topic  : JavaScript's three "nothing" values.
 *
 *  WHY: Confusing these three causes the majority of runtime
 *  errors. Understanding them is survival.
 * ============================================================
 */

// STORY: The Abandoned Haveli — some rooms were never furnished
// (undefined), some intentionally emptied (null), and some have
// broken locks with no number (NaN).

// ────────────────────────────────────────────────────────────
// SECTION 1 — undefined ("Never Furnished")
// ────────────────────────────────────────────────────────────

// JS assigns undefined when a value was expected but never provided.

let emptyRoom;                          // declared, no value
console.log(emptyRoom);                 // undefined

function inspectRoom(roomName, inspector) {
  console.log(`Room: ${roomName}, Inspector: ${inspector}`);
}
inspectRoom("Sheesh Mahal");            // Inspector: undefined

const mainHall = { name: "Diwan-e-Khas" };
console.log(mainHall.caretaker);        // undefined (missing property)

function walkThrough() {}
console.log(walkThrough());            // undefined (no return)

console.log(typeof undefined);          // "undefined"

// ────────────────────────────────────────────────────────────
// SECTION 2 — null ("Intentionally Emptied")
// ────────────────────────────────────────────────────────────

let treasureRoom = { name: "Khazana Room", items: 42 };
treasureRoom = null; // intentionally cleared
console.log(treasureRoom);              // null

console.log(typeof null);               // "object" — 30-year-old bug!
console.log(treasureRoom === null);      // true (safe check)

// null vs undefined
console.log(null == undefined);          // true  (loose)
console.log(null === undefined);         // false (strict)

// Arithmetic
console.log(null + 5);                   // 5   (null -> 0)
console.log(undefined + 5);             // NaN (undefined -> NaN)

// ────────────────────────────────────────────────────────────
// SECTION 3 — NaN ("Broken Lock")
// ────────────────────────────────────────────────────────────

console.log(Number("Baithak"));          // NaN
console.log(typeof NaN);                 // "number" — yes, really.
console.log(NaN === NaN);               // false — not equal to itself!

// How to check
console.log(Number.isNaN(NaN));          // true  (correct)
console.log(isNaN("hello"));            // true  (coercion trap — avoid)
console.log(Number.isNaN("hello"));      // false (no coercion — correct)

// Common sources of NaN
console.log(0 / 0);                     // NaN
console.log(Math.sqrt(-1));             // NaN
console.log(parseInt("haveli"));        // NaN
console.log("paan" * 3);               // NaN

// NaN is contagious — any math with NaN produces NaN
console.log(NaN + 100);                 // NaN

// ────────────────────────────────────────────────────────────
// SECTION 4 — Nullish Coalescing (??)
// ────────────────────────────────────────────────────────────
// ?? only treats null and undefined as "missing". Deep dive in File 39.

const visitors = 0;
console.log(visitors || "No data");      // "No data" — BUG! 0 is valid
console.log(visitors ?? "No data");      // 0 — correct!
console.log(null ?? "No data");          // "No data"
console.log(undefined ?? "No data");     // "No data"

// ────────────────────────────────────────────────────────────
// SECTION 5 — Optional Chaining (?.)
// ────────────────────────────────────────────────────────────
// ?. returns undefined instead of crashing on null/undefined. Deep dive in File 39.

const registry = {
  baithak: { owner: { name: "Nawab Sahab" }, floors: 2 },
  khazana: null,
};

console.log(registry.khazana?.owner?.name);   // undefined (no crash)
console.log(registry.baithak?.owner?.name);   // "Nawab Sahab"

// Combine ?. with ??
const owner = registry.khazana?.owner?.name ?? "No owner on record";
console.log(owner); // "No owner on record"

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. undefined = "never assigned" — JS sets this automatically.
// 2. null = "intentionally empty" — you set it. typeof null
//    === "object" is a historic bug.
// 3. NaN = "failed math" — type "number", NOT equal to itself.
//    Use Number.isNaN() to detect.
// 4. null == undefined is true; null === undefined is false.
// 5. Use ?? instead of || when 0/""/false are valid values.
// 6. Use ?. to safely access nested props without crashing.
// 7. Combine them: obj?.nested?.value ?? "fallback"
// ============================================================
