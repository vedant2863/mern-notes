// ============================================================
// FILE 02: TEST ANATOMY
// Topic: The structure, lifecycle, and naming of well-written tests
// ============================================================

// ============================================================
// STORY: Every new restaurant on Zomato goes through a structured
//   checklist before going live. Tests follow the exact same
//   step-by-step verification approach: Arrange, Act, Assert.
// ============================================================

// BLOCK 1 — The Module Under Test

class ShoppingCart {
  constructor() {
    this.items = [];
    this.couponApplied = null;
  }

  addItem(name, price, quantity = 1) {
    if (price < 0) throw new Error("Price cannot be negative");
    if (quantity < 1) throw new Error("Quantity must be at least 1");
    const existing = this.items.find((item) => item.name === name);
    if (existing) { existing.quantity += quantity; }
    else { this.items.push({ name, price, quantity }); }
    return this;
  }

  removeItem(name) {
    const index = this.items.findIndex((item) => item.name === name);
    if (index === -1) throw new Error(`Item "${name}" not found in cart`);
    this.items.splice(index, 1);
    return this;
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  applyCoupon(code, discountPercent) {
    if (this.couponApplied) throw new Error("Only one coupon allowed");
    if (discountPercent <= 0 || discountPercent > 50) {
      throw new Error("Discount must be between 1% and 50%");
    }
    this.couponApplied = { code, discountPercent };
    return this;
  }

  getTotal() {
    const subtotal = this.getSubtotal();
    if (this.couponApplied) {
      const discount = (subtotal * this.couponApplied.discountPercent) / 100;
      return Math.round((subtotal - discount) * 100) / 100;
    }
    return subtotal;
  }

  clear() {
    this.items = [];
    this.couponApplied = null;
    return this;
  }
}

// --- Mini test framework (reused from File 01, with hooks) ---
const results = { passed: 0, failed: 0, skipped: 0, errors: [] };
const hooks = { beforeEachFns: [], afterEachFns: [] };

function describe(name, fn) {
  console.log(`\n${name}`);
  const saved = [...hooks.beforeEachFns];
  const savedA = [...hooks.afterEachFns];
  fn();
  hooks.beforeEachFns = saved;
  hooks.afterEachFns = savedA;
}

function test(name, fn) {
  try {
    hooks.beforeEachFns.forEach((h) => h());
    fn();
    results.passed++;
    console.log(`  PASS: ${name}`);
  } catch (error) {
    results.failed++;
    results.errors.push({ name, error: error.message });
    console.log(`  FAIL: ${name} -> ${error.message}`);
  } finally {
    hooks.afterEachFns.forEach((h) => h());
  }
}

test.skip = function (name) { results.skipped++; console.log(`  SKIP: ${name}`); };
test.todo = function (name) { console.log(`  TODO: ${name}`); };
function beforeEach(fn) { hooks.beforeEachFns.push(fn); }
function afterEach(fn) { hooks.afterEachFns.push(fn); }

function expect(received) {
  return {
    toBe(expected) { if (received !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(received)}`); },
    toEqual(expected) { if (JSON.stringify(received) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(received)}`); },
    toThrow(msg) {
      let threw = false, errMsg = "";
      try { received(); } catch (e) { threw = true; errMsg = e.message; }
      if (!threw) throw new Error("Expected to throw");
      if (msg && !errMsg.includes(msg)) throw new Error(`Expected "${msg}" but got "${errMsg}"`);
    },
    toBeGreaterThan(n) { if (!(received > n)) throw new Error(`Expected ${received} > ${n}`); },
    not: { toBe(expected) { if (received === expected) throw new Error(`Expected NOT ${JSON.stringify(expected)}`); } },
  };
}


// ============================================================
// SECTION 1 — The AAA Pattern (Arrange -> Act -> Assert)
// ============================================================

describe("ShoppingCart -- AAA Pattern", () => {
  test("should add an item and calculate subtotal", () => {
    // ARRANGE
    const cart = new ShoppingCart();

    // ACT
    cart.addItem("Paneer Tikka", 299);

    // ASSERT
    expect(cart.getItemCount()).toBe(1);
    expect(cart.getSubtotal()).toBe(299);
  });

  test("should apply coupon and reduce total", () => {
    // ARRANGE
    const cart = new ShoppingCart();
    cart.addItem("Biryani", 350);
    cart.addItem("Naan", 50, 2);

    // ACT
    cart.applyCoupon("ZOMATO20", 20);

    // ASSERT
    expect(cart.getSubtotal()).toBe(450);
    expect(cart.getTotal()).toBe(360);
  });
});


// ============================================================
// SECTION 2 — describe() and test() Grouping
// ============================================================

describe("ShoppingCart", () => {
  describe("addItem()", () => {
    test("should add a new item to empty cart", () => {
      const cart = new ShoppingCart();
      cart.addItem("Masala Dosa", 120);
      expect(cart.getItemCount()).toBe(1);
    });

    test("should increase quantity for duplicate item", () => {
      const cart = new ShoppingCart();
      cart.addItem("Masala Dosa", 120);
      cart.addItem("Masala Dosa", 120, 2);
      expect(cart.getItemCount()).toBe(3);
    });

    test("should throw for negative price", () => {
      const cart = new ShoppingCart();
      expect(() => cart.addItem("Free Item", -10)).toThrow("negative");
    });
  });

  describe("removeItem()", () => {
    test("should remove an existing item", () => {
      const cart = new ShoppingCart();
      cart.addItem("Idli", 60);
      cart.addItem("Vada", 40);
      cart.removeItem("Idli");
      expect(cart.getItemCount()).toBe(1);
    });

    test("should throw when removing non-existent item", () => {
      const cart = new ShoppingCart();
      expect(() => cart.removeItem("Ghost Item")).toThrow("not found");
    });
  });
});


// ============================================================
// SECTION 3 — beforeEach / afterEach (Setup & Teardown)
// ============================================================

// Lifecycle order in Vitest/Jest:
//   beforeAll -> beforeEach -> test() -> afterEach -> afterAll

let sharedCart;

describe("ShoppingCart with beforeEach", () => {
  beforeEach(() => {
    sharedCart = new ShoppingCart();
    sharedCart.addItem("Dal Makhani", 320);
    sharedCart.addItem("Roti", 30, 4);
  });
  afterEach(() => { sharedCart = null; });

  test("should start with pre-loaded items", () => {
    expect(sharedCart.getItemCount()).toBe(5);
    expect(sharedCart.getSubtotal()).toBe(440);
  });

  test("should not see items from previous test (isolation proof)", () => {
    sharedCart.addItem("Raita", 60);
    expect(sharedCart.getItemCount()).toBe(6);
  });
});


// ============================================================
// SECTION 4 — test.skip, test.only, test.todo
// ============================================================

describe("Test Modifiers", () => {
  test.skip("should handle international shipping (API not ready)");
  test("regular test runs normally", () => { expect(1 + 1).toBe(2); });
  test.todo("should apply loyalty points discount");
  // test.only('debug this one test') -- NEVER commit test.only!
});


// ============================================================
// SECTION 5 — Test Naming & Isolation
// ============================================================

describe("Test Naming Best Practices", () => {
  // Pattern: "should [expected behavior] when [condition]"
  test("should return 0 when cart is empty", () => {
    expect(new ShoppingCart().getTotal()).toBe(0);
  });

  test("should apply 20% discount when SAVE20 coupon is used", () => {
    const cart = new ShoppingCart();
    cart.addItem("Shirt", 1000);
    cart.applyCoupon("SAVE20", 20);
    expect(cart.getTotal()).toBe(800);
  });

  // BAD names: "test cart", "it works", "test 1"
});

// --- Test Isolation: no shared mutable state ---
describe("Test Isolation", () => {
  test("each test creates its own data", () => {
    const items = [1, 2, 3];
    items.push(4);
    expect(items.length).toBe(4);
  });

  test("not affected by previous test", () => {
    const items = [1, 2, 3];
    expect(items.length).toBe(3);
  });
});

// Flaky test causes: TIME (use fake timers), NETWORK (mock APIs),
// ORDER (no shared state), RANDOMNESS (test patterns not exact values)


// ============================================================
// SECTION 6 — Practical: Complete ShoppingCart Suite
// ============================================================

describe("ShoppingCart -- Complete Suite", () => {
  let cart;
  beforeEach(() => { cart = new ShoppingCart(); });
  afterEach(() => { cart = null; });

  describe("adding items", () => {
    test("should add single item", () => {
      cart.addItem("Samosa", 20);
      expect(cart.getItemCount()).toBe(1);
      expect(cart.getSubtotal()).toBe(20);
    });

    test("should merge duplicates", () => {
      cart.addItem("Chai", 15);
      cart.addItem("Chai", 15, 2);
      expect(cart.getItemCount()).toBe(3);
    });
  });

  describe("coupons", () => {
    test("should apply valid coupon", () => {
      cart.addItem("Laptop Bag", 2000);
      cart.applyCoupon("FLAT10", 10);
      expect(cart.getTotal()).toBe(1800);
    });

    test("should reject second coupon", () => {
      cart.addItem("Item", 100);
      cart.applyCoupon("FIRST", 10);
      expect(() => cart.applyCoupon("SECOND", 20)).toThrow("Only one coupon");
    });
  });

  describe("clear", () => {
    test("should reset to empty state", () => {
      cart.addItem("A", 100).addItem("B", 200);
      cart.applyCoupon("CODE", 10);
      cart.clear();
      expect(cart.getItemCount()).toBe(0);
      expect(cart.getTotal()).toBe(0);
    });
  });
});

// --- Print summary ---
console.log(`\n=== RESULTS: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped ===`);
if (results.errors.length > 0) {
  console.log("Failures:");
  results.errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
}


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. AAA Pattern (Arrange -> Act -> Assert) in every test.
//
// 2. describe() groups tests; test()/it() defines cases.
//    Nest describes: Module -> Method -> Scenario.
//
// 3. beforeEach/afterEach for per-test setup/teardown.
//    beforeAll/afterAll for expensive one-time setup.
//
// 4. test.skip for temp exclusion, test.only for debugging
//    (NEVER commit!), test.todo for planning.
//
// 5. Name tests: "should [behavior] when [condition]".
//
// 6. Test isolation is non-negotiable. No shared mutable state.
//    Flaky tests destroy trust -- fix immediately or delete.
// ============================================================
