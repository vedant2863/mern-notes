/**
 * ============================================================
 *  FILE 2 : Variables — var, let, const
 * ============================================================
 *  Topic  : var, let, const — scope, hoisting, reassignment.
 *           Naming rules & conventions. const with objects/arrays.
 *
 *  WHY: Choosing the right keyword determines where a variable
 *  lives, whether it can change, and how predictable your code is.
 * ============================================================
 */

// STORY: Dadi's steel almirah is const — she can't swap it for
// a different one — but the valuables inside can change.

// ────────────────────────────────────────────────────────────
// SECTION 1 — Declaring Variables: var, let, const
// ────────────────────────────────────────────────────────────

var familyName = "The Sharma Parivaar";   // old way
let totalValuables = 12;                   // block-scoped, reassignable
const dadiName = "Kamla Devi";             // block-scoped, NOT reassignable

totalValuables = 14; // Reassignment is fine with let
console.log("Family:", familyName, "| Valuables:", totalValuables, "| Dadi:", dadiName);

// dadiName = "Savitri Devi"; // TypeError: Assignment to constant variable.

// ────────────────────────────────────────────────────────────
// SECTION 2 — Scope Differences
// ────────────────────────────────────────────────────────────

// var is function-scoped (leaks out of blocks)
if (true) { var leakyValuable = "Gold coin"; }
console.log("var leaks:", leakyValuable); // Gold coin

// let/const are block-scoped (stay inside the block)
if (true) { let secureValuable = "Gold mangalsutra"; }
// console.log(secureValuable); // ReferenceError

// Loop trap: var leaks, let doesn't
for (var i = 0; i < 3; i++) {}
console.log("var i after loop:", i); // 3

for (let j = 0; j < 3; j++) {}
// console.log(j); // ReferenceError

// ────────────────────────────────────────────────────────────
// SECTION 3 — Hoisting
// ────────────────────────────────────────────────────────────

console.log("Hoisted var:", hoistedItem); // undefined
var hoistedItem = "Property papers";

// console.log(hoistedLet);  // ReferenceError (Temporal Dead Zone)
// let hoistedLet = "Old photographs";

// ────────────────────────────────────────────────────────────
// SECTION 4 — Variable Naming Rules & Conventions
// ────────────────────────────────────────────────────────────

let almiraShelfCount = 22;         // camelCase (recommended)
let _privateLocker = "secret";     // leading underscore
let $dowryValue = 500;             // dollar sign allowed
const GOLD_PRICE_PER_GRAM = 0.15;  // UPPER_SNAKE for true constants

// INVALID: 2ndShelf, my-almirah, class (reserved word)

// ────────────────────────────────────────────────────────────
// SECTION 5 — const with Objects & Arrays (Reference vs Value)
// ────────────────────────────────────────────────────────────

const steelAlmirah = { goldMangalsutra: 1, silverPayal: 5 };

// Mutating contents — ALLOWED
steelAlmirah.goldMangalsutra = 2;
steelAlmirah.fixedDeposits = 3;
console.log("Almirah contents:", steelAlmirah);

// Reassigning the variable — BLOCKED
// steelAlmirah = { goldMangalsutra: 0 }; // TypeError

// Same with arrays
const familyMembers = ["Dadi", "Papa", "Mummy"];
familyMembers.push("Chhotu");
console.log("Family:", familyMembers);
// [ 'Dadi', 'Papa', 'Mummy', 'Chhotu' ]

// ────────────────────────────────────────────────────────────
// SECTION 6 — Practical Guidelines
// ────────────────────────────────────────────────────────────

// 1. Default to `const` — if the binding won't be reassigned.
// 2. Use `let` when you need to reassign (loops, accumulators).
// 3. Avoid `var` — its function-scoping causes subtle bugs.

const MAX_VALUABLES = 9999;
let currentValuables = 0;

for (let festival = 1; festival <= 3; festival++) {
  currentValuables += festival * 100;
}
console.log("Total valuables:", currentValuables); // 600

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. var   — function-scoped, hoisted as undefined. Avoid it.
// 2. let   — block-scoped, Temporal Dead Zone, reassignable.
// 3. const — block-scoped, TDZ, NOT reassignable, but object/
//            array contents can still be mutated.
// 4. Use camelCase for variables, UPPER_SNAKE for constants.
// 5. Start with const; switch to let only when needed.
// 6. const locks the reference, not the contents.
// ============================================================
