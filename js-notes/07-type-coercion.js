/**
 * ============================================================
 *  FILE 7 : Type Coercion
 * ============================================================
 *  Topic  : Implicit vs explicit coercion. == vs ===.
 *           String/Number/Boolean coercion. Edge cases.
 *           Object.is() vs ===.
 *
 *  WHY: JS silently converts types. If you don't know the rules,
 *  you'll face baffling bugs like [] + [] = "".
 * ============================================================
 */

// STORY: Pappu is a jugaadu electrician — he converts anything
// to anything, sometimes on purpose (explicit), sometimes by
// accident (implicit).

// ────────────────────────────────────────────────────────────
// SECTION 1 — Implicit vs Explicit Coercion
// ────────────────────────────────────────────────────────────

const pappuRate = "25";
console.log(pappuRate + 1);          // "251" — string concat!
console.log(pappuRate - 1);          // 24   — forced to number
console.log(Number(pappuRate) + 1);  // 26   — explicit conversion

// ────────────────────────────────────────────────────────────
// SECTION 2 — == (Abstract) vs === (Strict Equality)
// ────────────────────────────────────────────────────────────

console.log(5 == "5");          // true  (coerces)
console.log(5 === "5");         // false (no coercion)
console.log(0 == false);        // true
console.log(0 === false);       // false
console.log(null == undefined); // true  (the one useful == rule)
console.log(null === undefined);// false

// ────────────────────────────────────────────────────────────
// SECTION 3 — String Coercion
// ────────────────────────────────────────────────────────────

console.log("Pappu" + 7);     // "Pappu7"
console.log(1 + "2");          // "12"
console.log(String(42));       // "42"
console.log(String(null));     // "null"
console.log((255).toString(16)); // "ff"

// ────────────────────────────────────────────────────────────
// SECTION 4 — Number Coercion
// ────────────────────────────────────────────────────────────

console.log("6" - 2);      // 4
console.log(+"42");         // 42  (unary + converts to number)
console.log(+true);         // 1
console.log(+null);         // 0
console.log(+undefined);   // NaN
console.log(Number(""));   // 0
console.log(Number(true));  // 1

// ────────────────────────────────────────────────────────────
// SECTION 5 — Boolean Coercion
// ────────────────────────────────────────────────────────────

// The 8 falsy values:
// false, 0, -0, 0n, "", null, undefined, NaN

// Surprising truthy values:
console.log(Boolean("0"));    // true  (non-empty string!)
console.log(Boolean("false"));// true
console.log(Boolean([]));     // true  (empty array!)
console.log(Boolean({}));     // true

console.log(!!"Pappu");       // true  (!! = Boolean shortcut)

// ────────────────────────────────────────────────────────────
// SECTION 6 — Edge Cases
// ────────────────────────────────────────────────────────────

console.log([] + []);         // ""  (both toString -> "")
console.log([] + {});         // "[object Object]"
console.log(true + true);    // 2
console.log("5" + 3);         // "53" (string concat wins)
console.log("5" - 3);         // 2   (- forces number)
console.log(null + 1);        // 1   (null -> 0)
console.log(undefined + 1);  // NaN (undefined -> NaN)

// ────────────────────────────────────────────────────────────
// SECTION 7 — Object.is() vs ===
// ────────────────────────────────────────────────────────────

console.log(NaN === NaN);          // false
console.log(Object.is(NaN, NaN));  // true  (fixes NaN)

console.log(+0 === -0);            // true
console.log(Object.is(+0, -0));    // false (distinguishes them)

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Implicit = JS converts silently. Explicit = you do it
//    with Number(), String(), Boolean(), !!.
// 2. ALWAYS use === unless checking null == undefined.
// 3. + with a string concatenates; other math ops force numbers.
// 4. 8 falsy values: false, 0, -0, 0n, "", null, undefined, NaN.
//    Everything else is truthy — including "0", [], {}.
// 5. Edge cases: [] + [] = "", null + 1 = 1, undefined + 1 = NaN.
// 6. Object.is(NaN, NaN) = true, Object.is(+0, -0) = false.
// ============================================================
