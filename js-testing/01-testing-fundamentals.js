// ============================================================
// FILE 01: TESTING FUNDAMENTALS
// Topic: Why testing matters and building your first tests from scratch
// ============================================================

// ============================================================
// STORY: During Flipkart's Big Billion Days sale, a price calculation
//   bug set a laptop to Rs.1 instead of Rs.10,000. One unit test
//   would have caught it in 2 seconds during CI.
// ============================================================

// BLOCK 1 — What Testing IS
// Testing = running code with known inputs and verifying outputs
// match expectations. Everything else is tooling around this idea.

function applyDiscount(price, discountPercent) {
  if (price < 0 || discountPercent < 0 || discountPercent > 100) {
    throw new Error("Invalid price or discount");
  }
  const discountAmount = (price * discountPercent) / 100;
  return price - discountAmount;
}

console.log("applyDiscount(10000, 10):", applyDiscount(10000, 10));
// Output: 9000


// ============================================================
// SECTION 1 — The Testing Pyramid & Trophy
// ============================================================

// --- The Testing Pyramid ---
//
//          /  E2E  \           <- Few (slow, expensive, brittle)
//         /----------\
//        / Integration \       <- Some (moderate speed/cost)
//       /----------------\
//      /   Unit  Tests    \    <- Many (fast, cheap, focused)
//     /____________________\
//
// Rule of thumb: 70% unit, 20% integration, 10% E2E

// UNIT TEST — tests ONE function in isolation, no network/DB.
function calculateFare(distanceKm, ratePerKm, surgeFactor = 1) {
  const baseFare = 50;
  const fare = baseFare + distanceKm * ratePerKm * surgeFactor;
  return Math.round(fare * 100) / 100;
}

console.log("Fare (5km, Rs.12/km):", calculateFare(5, 12));       // 110
console.log("Fare (5km, 1.5x surge):", calculateFare(5, 12, 1.5)); // 140

// INTEGRATION TEST — tests multiple units working together.
function calculateGST(amount, gstRate) {
  if (typeof amount !== "number" || typeof gstRate !== "number") {
    throw new TypeError("Amount and GST rate must be numbers");
  }
  if (amount < 0) throw new RangeError("Amount cannot be negative");
  return Math.round(amount * gstRate) / 100;
}

function processRide(distanceKm, ratePerKm, paymentMethod) {
  const fare = calculateFare(distanceKm, ratePerKm);
  const gst = calculateGST(fare, 5);
  const total = fare + gst;
  return { fare, gst, total, paymentMethod, status: "completed" };
}

console.log("Ride receipt:", processRide(10, 15, "UPI"));

// --- The Testing Trophy (modern alternative) ---
// Static Analysis > Unit > >> Integration << > E2E
// Integration tests give the most confidence per test dollar.

// DO TEST: business logic, edge cases, error paths, integrations
// DO NOT TEST: framework internals, simple getters, third-party libs, constants


// ============================================================
// SECTION 2 — Testing Frameworks
// ============================================================

// | Framework | Speed   | ESM     | Config  |
// |-----------|---------|---------|---------|
// | Vitest    | Fastest | Native  | Minimal |
// | Jest      | Fast    | Config  | Medium  |
// | node:test | Fast    | Native  | Zero    |
//
// New projects: Vitest. Existing Jest: stay. Simple scripts: node:test.


// ============================================================
// SECTION 3 — Building a Mini Test Framework from Scratch
// ============================================================

// --- assert: the atom of testing ---
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// --- test(): wraps each test in try/catch ---
const testResults = { passed: 0, failed: 0, errors: [] };

function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    console.log(`  PASS: ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ name, error: error.message });
    console.log(`  FAIL: ${name}`);
    console.log(`    -> ${error.message}`);
  }
}

// --- describe(): groups related tests ---
function describe(suiteName, fn) {
  console.log(`\n${suiteName}`);
  fn();
}

// --- expect(): matcher object ---
function expect(received) {
  return {
    toBe(expected) {
      assert(received === expected, `Expected ${expected} but received ${received}`);
    },
    toEqual(expected) {
      assert(
        JSON.stringify(received) === JSON.stringify(expected),
        `Expected ${JSON.stringify(expected)} but received ${JSON.stringify(received)}`
      );
    },
    toThrow() {
      let threw = false;
      try { received(); } catch (e) { threw = true; }
      assert(threw, "Expected function to throw but it did not");
    },
    not: {
      toBe(expected) {
        assert(received !== expected, `Expected ${received} to NOT be ${expected}`);
      },
    },
  };
}


// ============================================================
// SECTION 4 — Using Our Mini Framework
// ============================================================

describe("applyDiscount", () => {
  test("should apply 10% discount correctly", () => {
    expect(applyDiscount(10000, 10)).toBe(9000);
  });

  test("should return full price for 0% discount", () => {
    expect(applyDiscount(1000, 0)).toBe(1000);
  });

  test("should throw for invalid inputs", () => {
    expect(() => applyDiscount(-100, 10)).toThrow();
    expect(() => applyDiscount(1000, 150)).toThrow();
  });
});

describe("calculateFare", () => {
  test("should calculate base fare + distance", () => {
    expect(calculateFare(5, 12)).toBe(110);
  });

  test("should apply surge pricing", () => {
    expect(calculateFare(5, 12, 1.5)).toBe(140);
  });
});

console.log(`\n--- Results: ${testResults.passed} passed, ${testResults.failed} failed ---`);


// ============================================================
// SECTION 5 — Real Test File Structure (Vitest/Jest)
// ============================================================

// File: src/utils/pricing.test.js
/*
import { describe, test, expect } from 'vitest';
import { applyDiscount, calculateGST } from './pricing.js';

describe('Pricing Module', () => {
  test('should apply percentage discount correctly', () => {
    expect(applyDiscount(10000, 10)).toBe(9000);
  });

  test('should throw for invalid inputs', () => {
    expect(() => applyDiscount(-100, 10)).toThrow();
  });
});
*/

// --- Naming Conventions ---
// *.test.js (most common), *.spec.js (Angular), __tests__/ (Jest default)
// Recommendation: *.test.js next to source file.

// --- Running Tests ---
// Vitest:   npx vitest          (watch) / npx vitest run (CI)
// Jest:     npx jest            / npx jest --coverage
// Node:     node --test         / node --test --watch


// ============================================================
// SECTION 6 — Practical: PAN Card Validator
// ============================================================

function validatePAN(pan) {
  if (typeof pan !== "string") return { valid: false, error: "PAN must be a string" };
  const panUpper = pan.toUpperCase().trim();
  if (panUpper.length !== 10) return { valid: false, error: "PAN must be 10 characters" };
  const panRegex = /^[A-Z]{3}[CPHFATBLJ][A-Z]\d{4}[A-Z]$/;
  if (!panRegex.test(panUpper)) return { valid: false, error: "Invalid PAN format" };
  const typeMap = {
    C: "Company", P: "Person", H: "HUF", F: "Firm",
    A: "AOP", T: "Trust", B: "BOI", L: "Local Authority", J: "AJP",
  };
  return { valid: true, pan: panUpper, holderType: typeMap[panUpper[3]] };
}

describe("PAN Card Validator", () => {
  test("should validate correct individual PAN", () => {
    const result = validatePAN("ABCPD1234E");
    expect(result.valid).toBe(true);
    expect(result.holderType).toBe("Person");
  });

  test("should reject invalid PAN", () => {
    expect(validatePAN("ABC123").valid).toBe(false);
    expect(validatePAN("ABCXD1234E").valid).toBe(false);
  });

  test("should handle non-string and whitespace input", () => {
    expect(validatePAN(12345).valid).toBe(false);
    expect(validatePAN("  ABCPD1234E  ").valid).toBe(true);
  });
});

console.log(`\n=== FINAL RESULTS: ${testResults.passed} passed, ${testResults.failed} failed ===`);
if (testResults.errors.length > 0) {
  console.log("Failures:");
  testResults.errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
}


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Testing is: run code -> check output -> report pass/fail.
//
// 2. Testing Pyramid: 70% unit (fast), 20% integration, 10% E2E.
//    Testing Trophy (modern): invest most in integration tests.
//
// 3. Test business logic, edge cases, error paths.
//    Don't test framework internals or trivial getters.
//
// 4. Vitest for new projects, Jest for existing, node:test for scripts.
//
// 5. A test framework is just assert() + test() + describe() + expect().
//
// 6. Naming: *.test.js next to source. Wrong name = CI never runs them.
//
// 7. Start with ONE test. One test is infinitely better than zero.
// ============================================================
