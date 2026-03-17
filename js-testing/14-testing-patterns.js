// ============================================================
// FILE 14: TESTING PATTERNS
// Topic: Proven patterns that make tests readable and maintainable
// WHY: As your app grows, ad-hoc testing becomes unmaintainable.
//   These battle-tested patterns keep your suite organized — the
//   difference between 50 tests that help and 500 that slow you down.
// ============================================================

// ============================================================
// STORY — Amazon India's Checkout
// 2000+ tests covering guest vs logged-in, COD vs prepaid, single
// vs multi-seller. With factories, parameterized tests, and state
// machine testing, a new engineer understands any test in 2 minutes.
// ============================================================

// ============================================================
// BLOCK 1 — Pattern 1: Test Data Factories
// SECTION: One function creates valid data, tests override what matters
// ============================================================

function createUser(overrides = {}) {
  return {
    id: overrides.id || Math.floor(Math.random() * 10000),
    name: overrides.name || 'Test User',
    email: overrides.email || `test_${Date.now()}@example.com`,
    city: overrides.city || 'Bengaluru',
    isPrime: overrides.isPrime !== undefined ? overrides.isPrime : false,
    verified: overrides.verified !== undefined ? overrides.verified : true,
    ...overrides,
  };
}

function createProduct(overrides = {}) {
  return {
    id: overrides.id || Math.floor(Math.random() * 10000),
    name: overrides.name || 'Test Product',
    price: overrides.price || 999,
    category: overrides.category || 'Electronics',
    inStock: overrides.inStock !== undefined ? overrides.inStock : true,
    gstRate: overrides.gstRate || 18,
    ...overrides,
  };
}

function createOrder(overrides = {}) {
  const items = overrides.items || [createProduct()];
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  return {
    id: overrides.id || 'ORD_' + Date.now(),
    userId: overrides.userId || 'user_1',
    items,
    subtotal,
    discount: overrides.discount || 0,
    total: subtotal - (overrides.discount || 0),
    paymentMethod: overrides.paymentMethod || 'UPI',
    status: overrides.status || 'pending',
    ...overrides,
  };
}

console.log("--- Pattern 1: Test Data Factories ---");
const primeUser = createUser({ isPrime: true });
console.log("Prime user:", primeUser.name, "isPrime:", primeUser.isPrime);

const multiOrder = createOrder({
  items: [createProduct({ name: 'Phone', price: 15000 }), createProduct({ name: 'Cover', price: 500 })],
  paymentMethod: 'COD',
});
console.log("Order:", multiOrder.items.length, "items, total:", multiOrder.total, multiOrder.paymentMethod);

// Without factory: 200 tests create the same 15-field object.
// With factory: update ONE function when a field is added. Zero tests break.


// ============================================================
// BLOCK 2 — Pattern 2: Parameterized Tests
// SECTION: Same test, many data sets
// ============================================================

function calculateDeliveryCharge(weight, distance, isPrime, isFragile) {
  if (isPrime) return 0;
  let charge = weight <= 0.5 ? 40 : weight <= 2 ? 70 : weight <= 5 ? 120 : 200;
  if (distance > 500) charge += 50;
  if (distance > 1000) charge += 50;
  if (isFragile) charge += 30;
  return charge;
}

// In Jest/Vitest:
// test.each([
//   [0.3, 100, false, false, 40],
//   [0.3, 100, true,  false, 0],
//   [0.3, 800, false, true,  120],
// ])('delivery(%f kg, %f km, prime=%s) = Rs %i',
//   (w, d, p, f, expected) => expect(calculateDeliveryCharge(w,d,p,f)).toBe(expected)
// );

console.log("\n--- Pattern 2: Parameterized Tests ---");
const cases = [
  { w: 0.3,  d: 100,  p: false, f: false, exp: 40,  desc: "Light, short" },
  { w: 4.0,  d: 100,  p: false, f: false, exp: 120, desc: "Heavy" },
  { w: 0.3,  d: 800,  p: false, f: false, exp: 90,  desc: "Light + far" },
  { w: 0.3,  d: 100,  p: true,  f: false, exp: 0,   desc: "Prime = free" },
  { w: 0.3,  d: 100,  p: false, f: true,  exp: 70,  desc: "Light + fragile" },
];
cases.forEach(tc => {
  const actual = calculateDeliveryCharge(tc.w, tc.d, tc.p, tc.f);
  console.log(`  ${actual === tc.exp ? 'PASS' : 'FAIL'}: ${tc.desc} => Rs ${actual}`);
});


// ============================================================
// BLOCK 3 — Pattern 3: Error Boundaries
// SECTION: Test that errors are caught, not leaked
// ============================================================

class OrderProcessor {
  processOrder(order) {
    if (!order) throw new Error('Order is required');
    if (!order.items || order.items.length === 0) throw new Error('Order must have items');
    if (order.total > 500000) throw new Error('Order exceeds Rs 5,00,000 limit');
    return { success: true, orderId: 'ORD_' + Date.now() };
  }

  safeProcess(order) {
    try {
      return this.processOrder(order);
    } catch (error) {
      const messages = {
        'Order is required': 'Something went wrong. Please try again.',
        'Order must have items': 'Your cart is empty.',
        'Order exceeds Rs 5,00,000 limit': 'Please split into multiple orders.',
      };
      return { success: false, userMessage: messages[error.message] || 'Unexpected error.' };
    }
  }
}

const proc = new OrderProcessor();
console.log("\n--- Pattern 3: Error Boundaries ---");
console.log("Null order:", proc.safeProcess(null));
console.log("Empty cart:", proc.safeProcess({ items: [], total: 0 }));
console.log("Over limit:", proc.safeProcess(createOrder({ items: [createProduct({ price: 600000 })] })));


// ============================================================
// BLOCK 4 — Pattern 4: Contract Testing
// SECTION: Verify API SHAPE and TYPES, not exact values
// ============================================================

// Backend changed { price: 999 } to { price: "999" } — frontend broke.
// Contract tests catch type changes.

// test('product API matches contract', async () => {
//   const response = await request(app).get('/api/products/1');
//   expect(response.body).toMatchObject({
//     id: expect.any(Number),
//     name: expect.any(String),
//     price: expect.any(Number),        // Would catch string conversion!
//     inStock: expect.any(Boolean),
//   });
// });

function validateContract(response) {
  const errors = [];
  if (typeof response.id !== 'number') errors.push('id must be number');
  if (typeof response.name !== 'string') errors.push('name must be string');
  if (typeof response.price !== 'number') errors.push('price must be number');
  if (typeof response.inStock !== 'boolean') errors.push('inStock must be boolean');
  return { valid: errors.length === 0, errors };
}

console.log("\n--- Pattern 4: Contract Testing ---");
console.log("Valid:", validateContract({ id: 42, name: 'Phone', price: 999, inStock: true }));
console.log("Broken:", validateContract({ id: 42, name: 'Phone', price: "999", inStock: true }));


// ============================================================
// BLOCK 5 — Pattern 5: State Machine Testing
// SECTION: Test all valid AND invalid transitions
// ============================================================

// A bug once let "delivered" go back to "pending" — customer
// got the order AND a full refund.

class OrderStateMachine {
  constructor() {
    this.transitions = {
      'pending':          ['confirmed', 'cancelled'],
      'confirmed':        ['shipped', 'cancelled'],
      'shipped':          ['out_for_delivery', 'returned'],
      'out_for_delivery': ['delivered', 'returned'],
      'delivered':        ['return_requested'],
      'return_requested': ['returned', 'return_rejected'],
      'returned':         [],
      'cancelled':        [],
    };
  }

  canTransition(from, to) {
    return (this.transitions[from] || []).includes(to);
  }

  transition(order, newStatus) {
    if (!this.canTransition(order.status, newStatus)) {
      return { success: false, error: `Cannot go from "${order.status}" to "${newStatus}"` };
    }
    return { success: true, from: order.status, to: newStatus };
  }
}

const sm = new OrderStateMachine();
console.log("\n--- Pattern 5: State Machine Tests ---");
console.log("Valid:");
[['pending','confirmed'],['confirmed','shipped'],['shipped','out_for_delivery'],['out_for_delivery','delivered']]
  .forEach(([f,t]) => console.log(`  ${f} -> ${t}: ${sm.canTransition(f,t) ? 'PASS' : 'FAIL'}`));

console.log("Invalid (all should be rejected):");
[['delivered','pending'],['cancelled','confirmed'],['pending','delivered']]
  .forEach(([f,t]) => console.log(`  ${f} -> ${t}: ${!sm.canTransition(f,t) ? 'PASS' : 'FAIL'}`));


// ============================================================
// BLOCK 6 — Anti-Patterns
// SECTION: What NOT to do
// ============================================================

console.log("\n--- Anti-Patterns ---");
console.log("1. TESTING IMPLEMENTATION: expect(order._internalCache).toBe(3)");
console.log("   FIX: expect(order.getTotal()).toBe(3000)");
console.log("2. SHARED MUTABLE STATE: let counter = 0; (between tests)");
console.log("   FIX: beforeEach(() => { counter = 0; })");
console.log("3. TIMING DEPS: await sleep(2000)");
console.log("   FIX: await waitFor(() => expect(result).toBeDefined())");
console.log("4. OVER-MOCKING: Mock DB + service + validator = testing mocks!");
console.log("   FIX: Mock only external deps");
console.log("5. BAD NAMES: test('test calculateTotal')");
console.log("   FIX: test('should apply 10% discount for orders above Rs 5000')");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Factories: createUser(), createProduct() with defaults.
//    Override only what matters. Tests become self-documenting.
// 2. Parameterized: test.each runs same test with different data.
//    Adding a case = adding one row.
// 3. Error Boundaries: Test errors are caught and shown as
//    friendly messages. Never leak stack traces.
// 4. Contract Testing: Verify API SHAPE and TYPES, not exact values.
// 5. State Machine: Test all valid AND invalid transitions.
// 6. Anti-patterns: testing internals, shared state, timing deps,
//    over-mocking, bad test names.
// ============================================================
