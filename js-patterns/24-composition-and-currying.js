/**
 * FILE 24 : Function Composition, Pipe & Currying
 * Topic   : Functional Programming Patterns
 * Used in : Redux middleware, RxJS operators, data pipelines
 */

// STORY: Amma's Masala Dabba -- she chains spice steps (roast, grind,
// temper, mix) like a pipeline. Each function transforms the spice.

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Pipe (left-to-right composition)
// ────────────────────────────────────────────────────────────

function pipe(functions) {
  return function (value) {
    let result = value;
    for (let i = 0; i < functions.length; i++) {
      result = functions[i](result);
    }
    return result;
  };
}

function roast(s) { return "roasted(" + s + ")"; }
function grind(s) { return "ground(" + s + ")"; }
function temper(s) { return "tempered(" + s + ")"; }
function mix(s) { return "mixed(" + s + ")"; }

console.log("=== Amma's Masala Dabba Composition ===");

const makeMasala = pipe([roast, grind, temper, mix]);
console.log("  pipe:", makeMasala("jeera"));
// mixed(tempered(ground(roasted(jeera))))

function trimText(s) { return s.trim(); }
function toLower(s) { return s.toLowerCase(); }
function spaceToDash(s) { return s.split(" ").join("-"); }

const slugify = pipe([trimText, toLower, spaceToDash]);
console.log("  slugify:", slugify("  Masala Dosa  "));
// masala-dosa

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Currying
// ────────────────────────────────────────────────────────────

// Currying turns f(a, b) into f(a)(b) so you can build specialized functions

function curry(fn) {
  return function curried() {
    const args = Array.from(arguments);
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return function () {
      const nextArgs = Array.from(arguments);
      return curried(...args, ...nextArgs);
    };
  };
}

console.log("\n=== Amma's Currying Station ===");

const multiply = curry(function (a, b, c) {
  return a * b * c;
});
console.log("  multiply(2)(3)(4) =", multiply(2)(3)(4));
console.log("  multiply(2, 3, 4) =", multiply(2, 3, 4));

const greaterThan = curry(function (threshold, value) {
  return value > threshold;
});

const prices = [50, 150, 300, 500, 800];
const above200 = prices.filter(greaterThan(200));
console.log("  > 200:", above200);

const makeGravy = curry(function (base, spice, heat) {
  return base + " gravy with " + spice + " on " + heat + " flame";
});
const coconutCurry = makeGravy("coconut")("curry leaves");
console.log("  " + coconutCurry("slow"));

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Partial Application
// ────────────────────────────────────────────────────────────

function partial(fn) {
  const preset = Array.from(arguments).slice(1);
  return function () {
    const later = Array.from(arguments);
    return fn(...preset, ...later);
  };
}

function prepareDish(base, masala, tadka) {
  return base + " with " + masala + " and " + tadka + " tadka";
}

console.log("\n=== Amma's Partial Application ===");

const dalBase = partial(prepareDish, "dal", "haldi-mirch");
console.log("  partial:", dalBase("ghee-jeera"));

// Pipe + currying combined
const multiplyBy = curry(function (factor, value) {
  return factor * value;
});

const processPrice = pipe([
  multiplyBy(1.18),
  function addShipping(n) { return n + 50; },
  String,
]);
console.log("  pipe + curry:", processPrice(100));

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. pipe() runs functions left-to-right. Reads naturally for data pipelines.
// 2. Currying converts f(a, b, c) to f(a)(b)(c) for incremental specialization.
// 3. Partial application fixes some args now, passes the rest later.
// 4. Combine pipe + curry for powerful, readable data transforms.
