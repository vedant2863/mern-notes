/**
 * FILE 26 : Monad & Functor Patterns
 * Topic   : Functor, Maybe, Either/Result
 * Used in : Optional chaining (?.) is Maybe, Promise is a monad, error handling
 */

// STORY: Mumbai's Dabbawala packs values in tiffin containers (dabbas).
// Functor = dabba with .map(), Maybe = dabba might be empty,
// Either = delivery succeeded or address was wrong.

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Functor (a container you can .map() over)
// ────────────────────────────────────────────────────────────
console.log("=== BLOCK 1: Functor ===");

// Array is the most common functor: [1,2,3].map(x => x * 2)
// A functor is just anything with a .map() that returns a new container

class Dabba {
  constructor(value) {
    this.value = value;
  }

  map(fn) {
    return new Dabba(fn(this.value));
  }

  inspect() {
    return "Dabba(" + JSON.stringify(this.value) + ")";
  }
}

const result = new Dabba(50)
  .map(function (x) { return x + 10; })
  .map(function (x) { return x * 2; })
  .map(function (x) { return "Rs " + x; });

console.log("Chained maps:", result.inspect());
// Dabba("Rs 120")

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Maybe Monad (null-safe chaining)
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 2: Maybe Monad ===");

// Maybe skips the chain when value is null/undefined (empty dabba = no lunch)
// JavaScript's ?. (optional chaining) does the same thing!

class Maybe {
  constructor(value) {
    this.value = value;
  }

  static of(value) {
    return new Maybe(value);
  }

  get isEmpty() {
    return this.value === null || this.value === undefined;
  }

  map(fn) {
    if (this.isEmpty) return this;
    return Maybe.of(fn(this.value));
  }

  flatMap(fn) {
    if (this.isEmpty) return this;
    return fn(this.value);
  }

  getOrElse(fallback) {
    if (this.isEmpty) return fallback;
    return this.value;
  }
}

const deliveries = {
  ramesh: { address: { area: "Nariman Point" } },
  suresh: { address: null },
  priya: null,
};

function getArea(name) {
  return Maybe.of(deliveries[name])
    .flatMap(function (user) { return Maybe.of(user.address); })
    .map(function (addr) { return addr.area; })
    .getOrElse("Unknown");
}

console.log("Ramesh:", getArea("ramesh")); // Nariman Point
console.log("Suresh:", getArea("suresh")); // Unknown
console.log("Nobody:", getArea("nobody")); // Unknown

// Same thing with optional chaining (built-in Maybe!):
// deliveries["ramesh"]?.address?.area ?? "Unknown"

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Either/Result Monad (success or failure as values)
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 3: Either/Result Monad ===");

// Instead of try/catch, encode success and failure as values
// Success keeps going. Failure short-circuits the chain.

class Failure {
  constructor(error) { this.error = error; }
  map() { return this; }
  flatMap() { return this; }
  fold(onError, onSuccess) { return onError(this.error); }
}

class Success {
  constructor(value) { this.value = value; }
  map(fn) { return new Success(fn(this.value)); }
  flatMap(fn) { return fn(this.value); }
  fold(onError, onSuccess) { return onSuccess(this.value); }
}

function safeParse(input) {
  const n = Number(input);
  if (isNaN(n)) return new Failure("Not a number");
  return new Success(n);
}

function validatePincode(pin) {
  if (pin >= 100000 && pin <= 999999) {
    return new Success(pin);
  }
  return new Failure("Pincode " + pin + " out of range");
}

function deliver(input) {
  return safeParse(input)
    .flatMap(validatePincode)
    .map(function (pin) { return "Deliver to pincode " + pin; })
    .fold(
      function (err) { return "FAILED: " + err; },
      function (val) { return "SUCCESS: " + val; }
    );
}

console.log("Valid:", deliver("400001"));
console.log("Bad input:", deliver("abc"));
console.log("Bad range:", deliver("999"));

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Functor = anything with .map(). Array is the most common one.
// 2. Maybe handles null safely. JS optional chaining (?.) is the same idea.
// 3. Either/Result encodes success/failure as values instead of try/catch.
// 4. Promise is also a monad: .then() is flatMap, it chains and short-circuits on error.
