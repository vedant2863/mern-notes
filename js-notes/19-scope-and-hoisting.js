// ============================================================
// FILE 19: SCOPE & HOISTING
// Topic: Global scope, function scope, block scope, var hoisting,
//        TDZ, function hoisting, scope chain, variable shadowing
// WHY: Scope determines where variables live. Hoisting determines
//      when they become available. Misunderstanding either causes bugs.
// ============================================================

// ============================================================
// EXAMPLE 1 — Rashtrapati Bhavan: Security Zones
// Story: Each zone of the Bhavan has different
// clearance levels — each zone is a scope.
// ============================================================

// --- Global Scope ---

const bhavanName = "Rashtrapati Bhavan";

function enterBhavan() {
  console.log(`Welcome to ${bhavanName}`); // global visible inside functions
}
enterBhavan();

// --- Function Scope ---

function privateQuarters() {
  const code = "STAFF-7";
  var access = "RESTRICTED";
  console.log(code, access);
}
privateQuarters();
// console.log(code); // ReferenceError — not visible outside

// --- Block Scope (let/const vs var) ---

if (true) {
  const presidentialFile = "Nuclear Briefcase"; // block-scoped
  let officer = "ADC Rajesh";                   // block-scoped
  var leakyInfo = "I escape blocks!";           // var ignores block scope
}
// console.log(presidentialFile); // ReferenceError
console.log(leakyInfo);          // "I escape blocks!"

for (let i = 0; i < 3; i++) { /* i stays in block */ }
// console.log(i); // ReferenceError

for (var j = 0; j < 3; j++) { /* j leaks */ }
console.log("Leaked j:", j); // 3

// --- var Hoisting ---
// Declaration hoisted, initialization stays in place.

console.log(vipPass); // undefined (not an error)
var vipPass = "Presidential-Suite";
console.log(vipPass); // Presidential-Suite

// --- let/const Temporal Dead Zone (TDZ) ---
// Exist from block start, but cannot be accessed until declaration line.

// console.log(classified); // ReferenceError
let classified = "EYES ONLY";
console.log(classified); // EYES ONLY

// --- Function Declaration Hoisting ---
// Entire function is hoisted — callable before it appears.

const result = checkClearance("Mehra", 4);
console.log(result);

function checkClearance(name, level) {
  return level >= 3 ? `${name}: GRANTED` : `${name}: DENIED`;
}

// Function expressions follow their variable keyword rules:
// var => hoisted as undefined; const/let => TDZ.


// ============================================================
// EXAMPLE 2 — Scope Chain & Variable Shadowing
// ============================================================

// --- Scope Chain (lexical scoping) ---
// JS resolves variables by walking UP from inner to outer scope.

const mainBuilding = "BHAVAN HQ";

function outerGate() {
  const wing = "North Wing";

  function innerChamber() {
    const room = "Study Room";
    console.log(room);         // found in inner
    console.log(wing);         // found in outer
    console.log(mainBuilding); // found in global
  }
  innerChamber();
}
outerGate();

// --- Variable Shadowing ---
// Inner variable with same name hides the outer one.

const visitor = "Public Visitor";

function staffQuarters() {
  const visitor = "Staff Member";

  function presidentsOffice() {
    const visitor = "Secretary";
    console.log("Office sees:", visitor); // Secretary
  }

  console.log("Staff sees:", visitor); // Staff Member
  presidentsOffice();
}

console.log("Garden sees:", visitor); // Public Visitor
staffQuarters();

// --- Dangerous: no keyword = accidental global mutation ---
var eventStatus = "pending";
function updateEvent() {
  eventStatus = "complete"; // no let/const — modifies global!
}
updateEvent();
console.log(eventStatus); // complete


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. GLOBAL SCOPE: accessible everywhere. Minimize it.
// 2. FUNCTION SCOPE: var, let, const all stay inside functions.
// 3. BLOCK SCOPE: let/const stay in { }. var leaks out.
// 4. var hoists declaration (gives undefined). let/const have
//    a TDZ — accessing before declaration is a ReferenceError.
// 5. Function declarations are fully hoisted. Expressions
//    follow their variable keyword rules.
// 6. SCOPE CHAIN: inner to outer, stops at first match.
// 7. SHADOWING: inner variable hides outer. Use let/const
//    to avoid accidental mutation.
// ============================================================
