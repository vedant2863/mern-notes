// ============================================================
// FILE 04: EXECUTION CONTEXT
// Topic: The environment where JavaScript code evaluates and executes
// WHY: Every line of JS runs inside an "execution context" that manages
//   variables, scope chains, and `this`. Understanding execution contexts
//   demystifies hoisting, closures, scope, and the Temporal Dead Zone.
// ============================================================

// ============================================================
// SECTION 1 — What is an Execution Context?
// STORY: Each function call creates an isolated environment holding its
//   variables, its scope chain, and its `this` binding. Without these,
//   variables from one function would collide with another's.
// ============================================================

console.log("=== SECTION 1: Execution Context Structure ===");

// +------------------------------------------+
// |  Execution Context                       |
// |  1. Variable Environment (var, functions) |
// |  2. Lexical Environment (let, const)      |
// |  3. This Binding (determined by call-site)|
// +------------------------------------------+

// Three types:
// - Global EC: created when script loads (one per program)
// - Function EC: created on every function CALL (not definition)
// - Eval EC: created by eval() (avoid eval)

var globalVar = "I'm in Global EC";

function outerFunction() {
    var outerVar = "I'm in outerFunction's EC";
    function innerFunction() {
        var innerVar = "I'm in innerFunction's EC";
        console.log("  " + innerVar);
        console.log("  " + outerVar);   // via scope chain
        console.log("  " + globalVar);  // via scope chain
    }
    innerFunction();
}

outerFunction();
console.log("");

// ============================================================
// SECTION 2 — Creation Phase vs Execution Phase
// STORY: Each EC goes through two phases. The creation phase explains
//   hoisting: var -> undefined, function declarations -> fully hoisted,
//   let/const -> TDZ (Temporal Dead Zone).
// ============================================================

console.log("=== SECTION 2: Creation Phase vs Execution Phase ===");

// CREATION PHASE (before any code runs):
//   var userName     -> allocated, set to undefined
//   function greet() -> allocated, FULLY HOISTED
//   let userCity     -> allocated, placed in TDZ

// EXECUTION PHASE (code runs line by line):
//   var gets assigned, let/const exit TDZ at declaration line

console.log("  greet() before definition:", greet2("Priya")); // Works! (fully hoisted)
console.log("  userName before assignment:", userName2);        // undefined (hoisted, not assigned)
// console.log(userCity2);  // ReferenceError: TDZ!

var userName2 = "Rajesh";
let userCity2 = "Bengaluru";
function greet2(name) { return `Hello, ${name}!`; }

console.log("  userName after assignment:", userName2);
console.log("  userCity after assignment:", userCity2);
console.log("");

// ============================================================
// SECTION 3 — Variable Environment vs Lexical Environment
// STORY: Variable Environment holds var (function-scoped). Lexical
//   Environment holds let/const (block-scoped). Each block {} with
//   let/const creates a new Lexical Environment.
// ============================================================

console.log("=== SECTION 3: VE vs LE (var vs let/const) ===");

function scopeDemo() {
    var funcScoped = "Variable Environment";
    let blockScoped = "Lexical Environment";

    if (true) {
        var alsoFuncScoped = "I leak out of blocks!";   // -> VE (function-scoped)
        let staysInBlock = "I stay in this block";       // -> block's LE
        console.log("  Inside block: staysInBlock =", staysInBlock);
    }

    console.log("  Outside block: alsoFuncScoped =", alsoFuncScoped);  // Works! var leaks
    // console.log(staysInBlock);  // ReferenceError! let doesn't leak
    console.log("  Outside block: staysInBlock = <not accessible>");
}

scopeDemo();
console.log("");

// ============================================================
// SECTION 4 — Scope Chain
// STORY: Each EC references its outer Lexical Environment, forming a
//   chain. Variable lookup walks inner -> outer -> ... -> global.
//   Not found anywhere? ReferenceError.
// ============================================================

console.log("=== SECTION 4: Scope Chain ===");

//  innerFn LE -> outerFn LE -> Global LE -> null (ReferenceError)

const restaurantCity = "Mumbai";

function processOrder(orderId) {
    const orderType = "delivery";
    function calculateFee(distance) {
        const baseFee = 30;
        console.log(`  Order #${orderId}, ${orderType}, ${restaurantCity}`);
        console.log(`  Distance: ${distance} km, Fee: Rs ${baseFee + distance * 5}`);
    }
    calculateFee(3);
}

processOrder(1001);
console.log("");

// ============================================================
// SECTION 5 — The `this` Binding
// STORY: `this` is set during EC creation based on HOW the function
//   is called, not where it's defined.
// ============================================================

console.log("=== SECTION 5: this Binding ===");

// Priority order:
// 1. new keyword        -> this = new empty object
// 2. call/apply/bind    -> this = explicit object
// 3. Method call (obj.) -> this = object before dot
// 4. Regular function   -> this = undefined (strict) or global (sloppy)
// 5. Arrow function     -> this = inherited from enclosing scope

const ride = {
    id: "RIDE-5001",
    driver: "Amit",
    getInfo: function() { return `${this.driver} is driving ${this.id}`; },
    getInfoArrow: () => { return `Arrow: this is NOT ride object`; },
};

console.log("  Method call:", ride.getInfo());
console.log("  Arrow in obj:", ride.getInfoArrow());
const bound = ride.getInfo.bind(ride);
console.log("  Bound method:", bound());
console.log("");

// ============================================================
// SECTION 6 — Block Scoping (var vs let in loops)
// STORY: var in a loop shares ONE variable across all iterations.
//   let creates a NEW Lexical Environment per iteration -- this
//   fixes the classic closure-in-loop bug.
// ============================================================

console.log("=== SECTION 6: Block Scoping in Loops ===");

// Classic bug with var:
var varFunctions = [];
for (var i = 0; i < 3; i++) {
    varFunctions.push(function() { return i; });
}
console.log("  var loop:", varFunctions.map(f => f()));  // [3, 3, 3]

// Fixed with let:
let letFunctions = [];
for (let j = 0; j < 3; j++) {
    letFunctions.push(function() { return j; });
}
console.log("  let loop:", letFunctions.map(f => f()));  // [0, 1, 2]
console.log("");

// ============================================================
// SECTION 7 — TDZ + Closures
// STORY: let/const ARE hoisted but live in the TDZ until their
//   declaration line. Closures work because the inner function's EC
//   retains a reference to the outer function's Lexical Environment.
// ============================================================

console.log("=== SECTION 7: TDZ & Closures ===");

// TDZ: let/const hoisted but not accessible until declaration
console.log("  var before decl:", typeof varTDZ); // "undefined"
var varTDZ = "hello";
// let in TDZ would throw: console.log(letTDZ); // ReferenceError!
let letTDZ = "world";
console.log("  let after decl:", letTDZ);
console.log("");

// Closures: inner function keeps outer LE alive
function createCounter(initialValue) {
    let count = initialValue;
    return {
        increment: () => ++count,
        decrement: () => --count,
        getCount: () => count,
    };
}

const counter = createCounter(0);
console.log("  Counter:", counter.increment(), counter.increment(), counter.increment());
console.log("  Current:", counter.getCount());   // 3
console.log("  Decrement:", counter.decrement()); // 2
console.log("");

// The returned methods hold a reference to createCounter's LE
// which contains `count`. Even after createCounter returns,
// that LE survives because the closures reference it.

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. EC = Variable Environment + Lexical Environment + this binding.
//
// 2. Three types: Global (one per program), Function (one per call), Eval.
//
// 3. Two phases: Creation (scan declarations, set up memory)
//    -> Execution (run code, assign values).
//
// 4. Hoisting: var=undefined, function=fully hoisted, let/const=TDZ.
//
// 5. VE = function-scoped (var). LE = block-scoped (let/const).
//
// 6. Scope chain: inner -> outer -> ... -> global. Not found = ReferenceError.
//
// 7. `this` determined by call-site, not definition.
//    Priority: new > call/bind > method > regular > arrow.
//
// 8. Closures: inner function keeps outer LE alive in memory.
// ============================================================

console.log("=== KEY TAKEAWAYS ===");
console.log("1. EC = Variable Environment + Lexical Environment + this binding");
console.log("2. Three types: Global, Function, Eval");
console.log("3. Two phases: Creation (set up memory) -> Execution (run code)");
console.log("4. Hoisting: var=undefined, function=hoisted, let/const=TDZ");
console.log("5. VE=function-scoped (var), LE=block-scoped (let/const)");
console.log("6. Scope chain: inner -> outer -> ... -> global");
console.log("7. this: determined by call-site, not definition");
console.log("8. Closures: inner function keeps outer LE alive");
