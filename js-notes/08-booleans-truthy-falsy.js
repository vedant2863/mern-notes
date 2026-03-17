/**
 * ============================================================
 *  FILE 8 : Booleans, Truthy & Falsy Values
 * ============================================================
 *  Topic  : How JS decides what is "true" and "false".
 *           Logical operators, short-circuit evaluation, !!.
 *
 *  WHY: Every if-statement, loop guard, and ternary relies on
 *  truthiness. Misunderstanding it causes silent bugs.
 * ============================================================
 */

// STORY: TC Pandey patrols the Rajdhani Express. Only 8 things
// get you thrown off (falsy). Everyone else stays on board (truthy).

// ────────────────────────────────────────────────────────────
// SECTION 1 — The 8 Falsy Values
// ────────────────────────────────────────────────────────────

const falsyValues = [false, 0, -0, 0n, "", null, undefined, NaN];
falsyValues.forEach(val => {
  console.log(`Boolean(${String(val).padEnd(10)}) => ${Boolean(val)}`);
});
// All print false

// ────────────────────────────────────────────────────────────
// SECTION 2 — Truthy Surprises
// ────────────────────────────────────────────────────────────

console.log(Boolean("0"));       // true  (non-empty string)
console.log(Boolean("false"));   // true
console.log(Boolean([]));        // true  (empty array!)
console.log(Boolean({}));        // true  (empty object!)
console.log(Boolean(-1));        // true

// ────────────────────────────────────────────────────────────
// SECTION 3 — Logical Operators (&&, ||, !)
// ────────────────────────────────────────────────────────────
// && and || return the ACTUAL VALUE that decided the outcome,
// not necessarily a boolean.

// && returns first falsy value, or last value if all truthy
console.log("RAJDHANI-CONFIRM" && 42);  // 42
console.log("" && 42);                  // ""

// || returns first truthy value, or last value if all falsy
console.log(null || "RAC-17");          // "RAC-17"
console.log(null || 0 || undefined);    // undefined

// ────────────────────────────────────────────────────────────
// SECTION 4 — Short-Circuit Patterns
// ────────────────────────────────────────────────────────────

// Default with ||
const passengerName = "" || "Unknown Yatri";
console.log(passengerName); // "Unknown Yatri"

// Guard with &&
const traveller = { name: "Sharma Ji", tripsThisYear: 5 };
const perk = traveller.tripsThisYear > 3 && "Free chai!";
console.log(perk); // "Free chai!"

// CAUTION: || treats 0 and "" as missing
const berthNumber = 0;
console.log(berthNumber || "No berth");  // "No berth" — BUG!
console.log(berthNumber ?? "No berth");  // 0 — correct! (?? only triggers for null/undefined)

// ────────────────────────────────────────────────────────────
// SECTION 5 — Double Bang (!!)
// ────────────────────────────────────────────────────────────

const passengerList = ["Sharma Ji", "Gupta Ji"];
console.log(!!passengerList.length); // true
console.log(!![].length);           // false

// Equivalent to Boolean()
console.log(Boolean("Rajdhani"));   // true

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. 8 falsy values: false, 0, -0, 0n, "", null, undefined, NaN.
//    Everything else is truthy — including [], {}, "0", "false".
// 2. && returns first falsy; || returns first truthy.
//    They return actual values, not necessarily booleans.
// 3. Short-circuit: JS stops evaluating when outcome is known.
// 4. !! converts any value to its boolean. Same as Boolean().
// 5. Use ?? (nullish coalescing) when 0 or "" are valid values.
// ============================================================
