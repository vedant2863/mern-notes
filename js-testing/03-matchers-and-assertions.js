// ============================================================
// FILE 03: MATCHERS AND ASSERTIONS
// Topic: Every matcher in Vitest/Jest -- how to verify ANY value
// ============================================================

// ============================================================
// STORY: IRCTC processes 20 lakh+ bookings daily. After each booking,
//   the system verifies: status MUST be "Confirmed", fare MUST be
//   exactly Rs.1245, PNR MUST match a 10-digit pattern. Each check
//   maps to a different matcher type.
// ============================================================

// --- Mini test framework with comprehensive matchers ---
const results = { passed: 0, failed: 0, errors: [] };

function describe(name, fn) { console.log(`\n${name}`); fn(); }
function test(name, fn) {
  try { fn(); results.passed++; console.log(`  PASS: ${name}`); }
  catch (e) { results.failed++; results.errors.push({ name, error: e.message }); console.log(`  FAIL: ${name} -> ${e.message}`); }
}

function expect(received) {
  return {
    toBe(expected) { if (received !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(received)}`); },
    toEqual(expected) { if (JSON.stringify(received) !== JSON.stringify(expected)) throw new Error(`Deep equal failed`); },
    toStrictEqual(expected) {
      const r = JSON.stringify(received, (k, v) => v === undefined ? "__undef__" : v);
      const e = JSON.stringify(expected, (k, v) => v === undefined ? "__undef__" : v);
      if (r !== e) throw new Error(`Strict equal failed`);
    },
    toBeTruthy() { if (!received) throw new Error(`Expected truthy, got ${received}`); },
    toBeFalsy() { if (received) throw new Error(`Expected falsy, got ${received}`); },
    toBeNull() { if (received !== null) throw new Error(`Expected null, got ${received}`); },
    toBeUndefined() { if (received !== undefined) throw new Error(`Expected undefined`); },
    toBeDefined() { if (received === undefined) throw new Error(`Expected defined`); },
    toBeGreaterThan(n) { if (!(received > n)) throw new Error(`${received} not > ${n}`); },
    toBeLessThan(n) { if (!(received < n)) throw new Error(`${received} not < ${n}`); },
    toBeLessThanOrEqual(n) { if (!(received <= n)) throw new Error(`${received} not <= ${n}`); },
    toBeCloseTo(expected, precision = 2) {
      if (Math.abs(received - expected) >= Math.pow(10, -precision) / 2)
        throw new Error(`${received} not close to ${expected}`);
    },
    toMatch(pattern) {
      const ok = pattern instanceof RegExp ? pattern.test(received) : received.includes(pattern);
      if (!ok) throw new Error(`"${received}" doesn't match ${pattern}`);
    },
    toContain(item) {
      if (!(Array.isArray(received) ? received.includes(item) : String(received).includes(item)))
        throw new Error(`Doesn't contain ${JSON.stringify(item)}`);
    },
    toContainEqual(item) {
      if (!received.some((el) => JSON.stringify(el) === JSON.stringify(item)))
        throw new Error(`Array doesn't contain equal ${JSON.stringify(item)}`);
    },
    toHaveLength(n) { if (received.length !== n) throw new Error(`Length ${received.length}, expected ${n}`); },
    toHaveProperty(keyPath, val) {
      const keys = keyPath.split("."); let cur = received;
      for (const k of keys) { if (!cur || !(k in cur)) throw new Error(`Missing "${keyPath}"`); cur = cur[k]; }
      if (val !== undefined && cur !== val) throw new Error(`"${keyPath}" is ${cur}, expected ${val}`);
    },
    toMatchObject(subset) {
      for (const k of Object.keys(subset))
        if (JSON.stringify(received[k]) !== JSON.stringify(subset[k])) throw new Error(`Mismatch at "${k}"`);
    },
    toThrow(expected) {
      let threw = false, errMsg = "", errType = null;
      try { received(); } catch (e) { threw = true; errMsg = e.message; errType = e.constructor; }
      if (!threw) throw new Error("Expected to throw");
      if (typeof expected === "string" && !errMsg.includes(expected)) throw new Error(`Error "${errMsg}" missing "${expected}"`);
      if (typeof expected === "function" && errType !== expected) throw new Error(`Wrong error type`);
      if (expected instanceof RegExp && !expected.test(errMsg)) throw new Error(`Error doesn't match regex`);
    },
    not: {
      toBe(e) { if (received === e) throw new Error(`Expected NOT ${JSON.stringify(e)}`); },
      toEqual(e) { if (JSON.stringify(received) === JSON.stringify(e)) throw new Error(`Expected NOT equal`); },
      toContain(i) { if (Array.isArray(received) && received.includes(i)) throw new Error(`Should NOT contain ${i}`); },
      toBeNull() { if (received === null) throw new Error("Expected NOT null"); },
      toThrow() { let t = false; try { received(); } catch { t = true; } if (t) throw new Error("Expected NOT to throw"); },
      toHaveProperty(k) { if (received && k in received) throw new Error(`Should NOT have "${k}"`); },
    },
  };
}


// ============================================================
// SECTION 1 — Equality: toBe vs toEqual vs toStrictEqual
// ============================================================

describe("Equality Matchers", () => {
  test("toBe for primitives (strict ===)", () => {
    expect(42).toBe(42);
    expect("hello").toBe("hello");
    expect(null).toBe(null);
  });

  test("toBe FAILS for objects -- use toEqual instead", () => {
    const obj1 = { name: "Priya" };
    const obj2 = { name: "Priya" };
    expect(obj1).not.toBe(obj2);  // Different references
    expect(obj1).toEqual(obj2);   // Same content
  });

  test("toEqual for nested objects", () => {
    expect({
      order: { items: [{ name: "Paneer", price: 250 }], address: { city: "Bengaluru" } }
    }).toEqual({
      order: { items: [{ name: "Paneer", price: 250 }], address: { city: "Bengaluru" } }
    });
  });

  // toStrictEqual catches undefined properties that toEqual ignores
  // { name: "Priya", age: undefined } vs { name: "Priya" }
});


// ============================================================
// SECTION 2 — Truthiness Matchers
// ============================================================

describe("Truthiness Matchers", () => {
  test("toBeTruthy/toBeFalsy for broad checks", () => {
    expect("Hello").toBeTruthy();
    expect([]).toBeTruthy();     // Empty array IS truthy!
    expect(0).toBeFalsy();
    expect("").toBeFalsy();
    expect(null).toBeFalsy();
  });

  test("specific null/undefined checks", () => {
    expect(null).toBeNull();
    expect({}.missing).toBeUndefined();
    expect({ count: 0 }.count).toBeDefined(); // 0 is defined!
  });
});


// ============================================================
// SECTION 3 — Number Matchers
// ============================================================

describe("Number Matchers", () => {
  test("comparison matchers for ranges", () => {
    const fare = 342;
    expect(fare).toBeGreaterThan(300);
    expect(fare).toBeLessThan(500);
  });

  test("toBeCloseTo for floating-point", () => {
    // expect(0.1 + 0.2).toBe(0.3);     // FAILS! 0.30000000000000004
    expect(0.1 + 0.2).toBeCloseTo(0.3, 5); // PASSES
  });
});


// ============================================================
// SECTION 4 — String Matchers
// ============================================================

describe("String Matchers", () => {
  test("toMatch with regex", () => {
    expect("1234 5678 9012").toMatch(/^\d{4}\s\d{4}\s\d{4}$/);
    expect("priya@infosys.com").toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  test("toContain for substring", () => {
    const error = "Payment failed: Insufficient balance in UPI account";
    expect(error).toContain("Insufficient balance");
  });
});


// ============================================================
// SECTION 5 — Array & Object Matchers
// ============================================================

describe("Array Matchers", () => {
  const seats = ["A1", "A2", "B1", "B3", "C5"];

  test("toContain and toHaveLength", () => {
    expect(seats).toContain("A1");
    expect(seats).not.toContain("A3");
    expect(seats).toHaveLength(5);
  });

  test("toContainEqual for objects in arrays", () => {
    const passengers = [
      { name: "Sharma", seat: "A1" },
      { name: "Patel", seat: "B2" },
    ];
    expect(passengers).toContainEqual({ name: "Patel", seat: "B2" });
  });
});

describe("Object Matchers", () => {
  const payment = {
    id: "pay_ABC123", status: "captured", amount: 124500,
    currency: "INR", method: "upi",
    notes: { booking_id: "BK-001", route: "BLR-MAS" },
  };

  test("toHaveProperty checks existence and value", () => {
    expect(payment).toHaveProperty("status", "captured");
    expect(payment).toHaveProperty("notes.route", "BLR-MAS");
    expect(payment).not.toHaveProperty("refund_id");
  });

  test("toMatchObject for partial matching", () => {
    expect(payment).toMatchObject({
      status: "captured", currency: "INR", method: "upi",
    }); // Ignores the other properties
  });
});


// ============================================================
// SECTION 6 — Exception Matchers
// ============================================================

function validateUPIId(upiId) {
  if (typeof upiId !== "string") throw new TypeError("UPI ID must be a string");
  if (!upiId.includes("@")) throw new Error("UPI ID must contain @");
  if (upiId.length < 5) throw new Error("UPI ID too short");
  const validHandles = ["@okicici", "@okaxis", "@ybl", "@paytm"];
  const handle = "@" + upiId.split("@")[1];
  if (!validHandles.includes(handle)) throw new Error(`Invalid handle: ${handle}`);
  return true;
}

describe("Exception Matchers", () => {
  // CRITICAL: toThrow needs a FUNCTION wrapper
  // WRONG: expect(fn(bad)).toThrow()     <- throws BEFORE expect
  // RIGHT: expect(() => fn(bad)).toThrow() <- expect catches it

  test("toThrow with string checks message", () => {
    expect(() => validateUPIId("bad")).toThrow("must contain @");
    expect(() => validateUPIId("a@b")).toThrow("too short");
  });

  test("toThrow with error class", () => {
    expect(() => validateUPIId(123)).toThrow(TypeError);
  });

  test("not.toThrow for valid inputs", () => {
    expect(() => validateUPIId("priya@okicici")).not.toThrow();
  });
});


// ============================================================
// SECTION 7 — Negation & Custom Matchers
// ============================================================

// .not inverts ANY matcher: not.toBe, not.toEqual, not.toContain, etc.

// Custom matchers in Vitest/Jest:
/*
expect.extend({
  toBeValidMRP(received) {
    const pass = typeof received === 'number' && received > 0 && Number.isInteger(received) && received <= 1000000;
    return { pass, message: () => `${received} is${pass ? ' ' : ' not '}a valid MRP` };
  },
});
// Usage: expect(999).toBeValidMRP();
*/


// ============================================================
// SECTION 8 — Practical: Test an E-Commerce Order
// ============================================================

function createOrder(items, customer, couponCode) {
  if (!items || items.length === 0) throw new Error("Order must have items");
  if (!customer || !customer.name) throw new Error("Customer name required");
  if (!customer.pincode || !/^\d{6}$/.test(customer.pincode)) throw new Error("Valid pincode required");
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const gst = Math.round(subtotal * 0.18 * 100) / 100;
  const deliveryCharge = subtotal >= 499 ? 0 : 40;
  let discount = 0;
  if (couponCode === "FIRST50") discount = Math.min(subtotal * 0.5, 200);
  return {
    orderId: "FK-" + Date.now(), customer: { ...customer },
    items: items.map((i) => ({ ...i })),
    pricing: { subtotal, gst, deliveryCharge, discount, total: subtotal + gst + deliveryCharge - discount },
    status: "placed", createdAt: new Date().toISOString(),
  };
}

describe("E-Commerce Order -- Full Matcher Demo", () => {
  const items = [{ name: "Wireless Mouse", price: 599, qty: 1 }, { name: "USB-C Cable", price: 199, qty: 2 }];
  const customer = { name: "Arjun Mehta", pincode: "560034", phone: "+919876543210" };

  test("correct structure and pricing", () => {
    const order = createOrder(items, customer);
    expect(order).toHaveProperty("status", "placed");
    expect(order).toHaveProperty("customer.name", "Arjun Mehta");
    expect(order.pricing.subtotal).toBe(997);
    expect(order.pricing.deliveryCharge).toBe(0);
    expect(order.pricing.gst).toBeGreaterThan(0);
    expect(order.orderId).toMatch(/^FK-\d+$/);
  });

  test("coupon applied", () => {
    const order = createOrder(items, customer, "FIRST50");
    expect(order.pricing.discount).toBeGreaterThan(0);
    expect(order.pricing.discount).toBeLessThanOrEqual(200);
  });

  test("throws for invalid inputs", () => {
    expect(() => createOrder([], customer)).toThrow("must have items");
    expect(() => createOrder(items, { name: "X", pincode: "12" })).toThrow("pincode");
  });
});

// --- Print summary ---
console.log(`\n=== RESULTS: ${results.passed} passed, ${results.failed} failed ===`);
if (results.errors.length) results.errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. toBe for primitives (===), toEqual for objects (deep),
//    toStrictEqual for strict deep (catches undefined props).
//
// 2. toBeTruthy/toBeFalsy for broad checks. toBeNull/toBeUndefined
//    /toBeDefined for specific falsy values.
//
// 3. toBeGreaterThan/toBeLessThan for ranges.
//    toBeCloseTo for floating-point (the 0.1+0.2 problem).
//
// 4. toMatch(/regex/) for patterns, toContain for substrings/arrays.
//
// 5. toHaveProperty('key', val) for existence, toMatchObject for
//    partial matching.
//
// 6. toThrow: ALWAYS wrap in function. Check message, regex, or class.
//
// 7. .not inverts ANY matcher. Custom matchers via expect.extend.
// ============================================================
