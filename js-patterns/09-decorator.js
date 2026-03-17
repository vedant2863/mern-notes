/**
 * ============================================================
 *  FILE 9 : The Paan Shop — Decorator Pattern
 *  Topic  : Decorator, Function Decorator
 *  Where you'll see this: Express middleware, React HOCs, logging wrappers
 * ============================================================
 */

// STORY: Paan wala Chhotu layers toppings onto a base paan.
// Each topping adds flavor and cost without altering the original.

console.log("=== FILE 09: The Paan Shop ===\n");

// ────────────────────────────────────
// BLOCK 1 — Object Decorator
// ────────────────────────────────────

// Instead of subclasses for every combo (GulkandCoconutPaan),
// decorators let you compose toppings at runtime.

console.log("--- Block 1: Object Decorator ---");

class Paan {
  constructor(name) { this.name = name; }
  getDescription() { return this.name; }
  getCost() { return 20; }
}

class ToppingDecorator {
  constructor(paan, topping, price) {
    this._paan = paan;
    this._topping = topping;
    this._price = price;
  }

  getDescription() {
    return this._paan.getDescription() + " + " + this._topping;
  }

  getCost() {
    return this._paan.getCost() + this._price;
  }
}

let paan = new Paan("Meetha Paan");
paan = new ToppingDecorator(paan, "Gulkand", 15);
paan = new ToppingDecorator(paan, "Coconut", 10);
paan = new ToppingDecorator(paan, "Silver Vark", 50);
console.log(paan.getDescription() + " — ₹" + paan.getCost());
// Meetha Paan + Gulkand + Coconut + Silver Vark — ₹95

let saadaPaan = new ToppingDecorator(new Paan("Saada Paan"), "Coconut", 10);
console.log(saadaPaan.getDescription() + " — ₹" + saadaPaan.getCost());

// ────────────────────────────────────
// BLOCK 2 — Function Decorators
// ────────────────────────────────────

console.log("\n--- Block 2: Function Decorators ---");

function preparePaan(type, quantity) {
  return "Prepared " + quantity + " " + type + " paan";
}

// Adds logging without modifying the original function
function withLogging(fn, label) {
  return function () {
    const args = Array.from(arguments);
    console.log("[LOG] " + label + " called with: " + args.join(", "));
    const result = fn(...args);
    console.log("[LOG] " + label + " returned: " + result);
    return result;
  };
}

const loggedPrepare = withLogging(preparePaan, "preparePaan");
loggedPrepare("meetha", 60);

// Validation decorator — separates validation from business logic
function withValidation(fn, validator, errorMsg) {
  return function () {
    const args = Array.from(arguments);
    if (!validator(...args)) {
      throw new Error(errorMsg);
    }
    return fn(...args);
  };
}

function setPrice(item, price) {
  return item + " priced at ₹" + price;
}

function isPriceValid(item, price) {
  return typeof price === "number" && price > 0;
}

const safeSetPrice = withValidation(setPrice, isPriceValid, "Price must be a positive number");

console.log(safeSetPrice("Banarasi Paan", 120));
try {
  safeSetPrice("Banarasi Paan", -5);
} catch (e) {
  console.log("Validation caught:", e.message);
}

// ────────────────────────────────────
// BLOCK 3 — Stacking Decorators
// ────────────────────────────────────

console.log("\n--- Block 3: Stacking Decorators ---");

function calculatePrice(base, quantity) {
  return base * quantity;
}

function withDiscount(fn) {
  return function () {
    const args = Array.from(arguments);
    const price = fn(...args);
    const discounted = price * 0.9;
    console.log("  [Discount] " + price + " -> " + discounted);
    return discounted;
  };
}

function withGST(fn) {
  return function () {
    const args = Array.from(arguments);
    const price = fn(...args);
    const withTax = price * 1.18;
    console.log("  [GST 18%] " + price + " -> " + withTax);
    return withTax;
  };
}

// Stack them: discount first, then GST
const discountedPrice = withDiscount(calculatePrice);
const finalPrice = withGST(discountedPrice);
console.log("Final:", finalPrice(100, 3));

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Decorator adds behavior without modifying the original.
// 2. Object decorators wrap and delegate — composable alternative to subclassing.
// 3. Function decorators add logging, validation, caching around any function.
// 4. Stacking order matters: innermost runs first, outermost last.

console.log("\n=== Chhotu wraps the last paan. Shop closed for the night. ===");
