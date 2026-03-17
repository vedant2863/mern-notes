// ============================================================
// FILE 06: JAVASCRIPT MEMORY MODEL
// Topic: How JavaScript organizes memory with Stack and Heap regions
// WHY: Every variable lives in memory -- either on the Stack (fast, small,
//   automatic) or the Heap (flexible, large, GC'd). Misunderstanding this
//   leads to mutation bugs, unexpected equality failures, and memory leaks.
// ============================================================

// ============================================================
// SECTION 1 — Stack vs Heap
// STORY: Primitives live on the stack (copied by value). Objects live
//   on the heap (accessed by reference). This distinction determines
//   everything about mutation, comparison, and garbage collection.
// ============================================================

console.log("=== SECTION 1: Stack vs Heap ===");

//  STACK (fast, LIFO, auto-cleanup)     HEAP (flexible, GC'd)
//  +----------+----------+              +------------------------+
//  | count    |    42    |              | { name: "Priya" }      |
//  | name     | "Priya"  |              | [95, 87, 92]           |
//  | isActive |   true   |              | function(n) {...}      |
//  | user     |  0xA01 --+----------->  |                        |
//  | scores   |  0xA02 --+----------->  |                        |
//  +----------+----------+              +------------------------+
//
//  Primitives (count, name, isActive) -> directly on stack
//  Objects (user, scores) -> reference on stack, data on heap

console.log("  STACK: primitives + references (fast, auto-cleanup)");
console.log("  HEAP:  objects, arrays, functions (flexible, GC'd)");
console.log("");

// ============================================================
// SECTION 2 — Primitives: Copied by Value
// STORY: When you copy a primitive, you get an independent copy.
//   Changing the copy does not affect the original.
// ============================================================

console.log("=== SECTION 2: Primitives (Copy by Value) ===");

// 7 primitives: number, string, boolean, null, undefined, symbol, bigint

let a = 10;
let b = a;    // b gets a COPY
b = 99;

console.log("  let a = 10; let b = a; b = 99;");
console.log("  a =", a, "(unchanged), b =", b, "(independent copy)");
console.log("  Primitive comparison is by value: 5 === 5 ->", 5 === 5);
console.log("");

// ============================================================
// SECTION 3 — Objects: Accessed by Reference
// STORY: Assigning an object copies the REFERENCE, not the object.
//   Both variables point to the SAME heap object. Mutation through
//   one affects the other.
// ============================================================

console.log("=== SECTION 3: Objects (Reference) ===");

let obj1 = { name: "iPhone 15", price: 79999 };
let obj2 = obj1;  // copies REFERENCE, not object

//  STACK:                    HEAP:
//  obj1 -> 0xABC --------> { name: "iPhone 15", price: 79999 }
//  obj2 -> 0xABC ------/    (SAME object!)

obj2.price = 84999;

console.log("  obj2.price = 84999;");
console.log("  obj1.price =", obj1.price, "(CHANGED via obj2!)");
console.log("  obj1 === obj2:", obj1 === obj2, "(same reference)");
console.log("");

// Two objects with same content are NOT equal:
let objA = { x: 1 };
let objB = { x: 1 };
console.log("  { x: 1 } === { x: 1 }:", objA === objB, "(different references!)");
console.log("");

// Arrays behave the same way:
const list = ["Biryani", "Dosa", "Dhaba"];
const alias = list;
alias.push("Pizza");
console.log("  Original after alias.push:", list); // includes "Pizza"
console.log("  Fix: const copy = [...list] for independent copy");
console.log("");

// ============================================================
// SECTION 4 — Shallow Copy vs Deep Copy
// STORY: Shallow copy (spread, Object.assign) copies top-level only.
//   Nested objects are still shared. Use structuredClone() for deep copy.
// ============================================================

console.log("=== SECTION 4: Shallow vs Deep Copy ===");

const merchant = {
    name: "Chai Point",
    address: { city: "Bengaluru", pin: "560001" },
    plans: ["basic", "premium"],
};

// SHALLOW: nested objects still shared
const shallow = { ...merchant };
shallow.address.city = "Mumbai";
console.log("  Shallow copy: original city =", merchant.address.city); // "Mumbai" (CHANGED!)

// DEEP: fully independent
merchant.address.city = "Bengaluru"; // reset
const deep = structuredClone(merchant);
deep.address.city = "Chennai";
console.log("  Deep copy: original city =", merchant.address.city);    // "Bengaluru" (safe)
console.log("  Deep copy: cloned city =", deep.address.city);          // "Chennai"
console.log("");

// Copy methods:
//   = assignment         -> shares reference
//   { ...spread }        -> shallow (top-level only)
//   Object.assign()      -> shallow (top-level only)
//   JSON parse/stringify  -> deep (no functions/dates)
//   structuredClone()    -> deep (most types, recommended)

// ============================================================
// SECTION 5 — Pass by Value vs Pass by Sharing
// STORY: Primitives pass by value (copy). Objects pass a copy of the
//   reference -- you CAN mutate through it, but reassigning the
//   parameter doesn't affect the original variable.
// ============================================================

console.log("=== SECTION 5: Pass by Value vs Sharing ===");

// Primitives: pass by value
function tryToChange(num) { num = 999; }
let myNum = 42;
tryToChange(myNum);
console.log("  Primitive: myNum =", myNum, "after tryToChange (unchanged)");

// Objects: pass by sharing
function mutateObject(obj) { obj.city = "Delhi"; }
function reassignObject(obj) { obj = { city: "Chennai" }; }

let myObj = { city: "Mumbai" };
mutateObject(myObj);
console.log("  After mutate: myObj.city =", myObj.city);     // "Delhi" (changed!)
reassignObject(myObj);
console.log("  After reassign: myObj.city =", myObj.city);   // "Delhi" (NOT changed)
console.log("  Mutation works through shared ref. Reassignment is local only.");
console.log("");

// ============================================================
// SECTION 6 — V8 Optimizations: SMI & String Interning
// STORY: V8 stores small integers (SMI) directly on the stack without
//   heap allocation -- making integer math fast. It also interns identical
//   strings to share memory.
// ============================================================

console.log("=== SECTION 6: V8 Memory Optimizations ===");

// SMI (Small Integer): tagged pointer on stack, no heap alloc
// Range (64-bit): -2^31 to 2^31-1
// HeapNumber: 64-bit float on heap (for decimals, large ints, NaN)

function sumSMI(n) {
    let total = 0;
    for (let i = 0; i < n; i++) total = (total + i) | 0;
    return total;
}

function sumFloat(n) {
    let total = 0.1;
    for (let i = 0; i < n; i++) total += i + 0.1;
    return total;
}

const smiStart = process.hrtime.bigint();
sumSMI(10_000_000);
const smiEnd = process.hrtime.bigint();

const floatStart = process.hrtime.bigint();
sumFloat(10_000_000);
const floatEnd = process.hrtime.bigint();

console.log(`  SMI sum (integers):   ${Number(smiEnd - smiStart) / 1_000_000}ms`);
console.log(`  Float sum (decimals): ${Number(floatEnd - floatStart) / 1_000_000}ms`);
console.log("  Integer arithmetic is faster (SMI stays on stack).");
console.log("");

// String interning: identical string literals may share memory
const str1 = "North Indian";
const str2 = "North Indian";
console.log("  str1 === str2:", str1 === str2, "(V8 may intern identical strings)");
console.log("  Strings always compared by VALUE regardless of interning.");
console.log("");

// ============================================================
// SECTION 7 — typeof null & Object.freeze()
// STORY: typeof null === 'object' is a 1995 bug (type tags). Always
//   check: val !== null && typeof val === 'object'. Object.freeze()
//   provides shallow immutability.
// ============================================================

console.log("=== SECTION 7: typeof null & Object.freeze() ===");

console.log("  typeof null:", typeof null, "(historical bug -- type tag was 000 = object)");
console.log("  Safe check: val !== null && typeof val === 'object'");
console.log("");

// Object.freeze: SHALLOW -- nested objects still mutable
const frozen = Object.freeze({
    value: 22500,
    metadata: { exchange: "NSE" },
});
frozen.value = 0;  // silently ignored
frozen.metadata.exchange = "BSE";  // WORKS (nested not frozen!)

console.log("  frozen.value:", frozen.value, "(unchanged, frozen)");
console.log("  frozen.metadata.exchange:", frozen.metadata.exchange, "(changed! shallow freeze)");
console.log("");

// Deep freeze utility:
function deepFreeze(obj) {
    Object.freeze(obj);
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Object.isFrozen(obj[key])) {
            deepFreeze(obj[key]);
        }
    });
    return obj;
}

const fullyFrozen = deepFreeze({ index: "Nifty", nested: { top: "Reliance" } });
fullyFrozen.nested.top = "HACKED";
console.log("  Deep frozen nested.top:", fullyFrozen.nested.top, "(safe!)");
console.log("");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Stack = primitives + references (fast, auto-cleanup).
//    Heap = objects, arrays, functions (flexible, GC'd).
//
// 2. Primitives: copied by value. Independent copies.
//
// 3. Objects: reference copied. Both variables share same heap object.
//    Mutation through one affects the other.
//
// 4. === on objects compares references, NOT contents.
//
// 5. Shallow copy (spread) vs Deep copy (structuredClone).
//
// 6. Pass by sharing: can mutate object through ref, but reassignment
//    only changes the local copy of the reference.
//
// 7. V8 optimizations: SMI (small ints on stack), string interning.
//
// 8. typeof null === 'object' is a historical bug. Use null check.
//    Object.freeze() is shallow -- use deepFreeze for nested objects.
// ============================================================

console.log("=== KEY TAKEAWAYS ===");
console.log("1. Stack = primitives + refs. Heap = objects (GC'd).");
console.log("2. Primitives: copied by value, independent copies.");
console.log("3. Objects: reference copied, shared mutation.");
console.log("4. === on objects compares references, NOT contents.");
console.log("5. Shallow copy (spread) vs Deep copy (structuredClone).");
console.log("6. Pass by sharing: mutate yes, reassign no.");
console.log("7. V8: SMI for small ints, string interning.");
console.log("8. typeof null === 'object' -- historical bug. Freeze is shallow.");
