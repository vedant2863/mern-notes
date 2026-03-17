// ============================================================
// FILE 04: MOCKING BASICS
// Topic: Test doubles -- spies, stubs, and mocks for isolating code
// ============================================================

// ============================================================
// STORY: Razorpay processes Rs.6+ lakh crore annually. Running
//   real payments in tests would charge real cards and send real SMS.
//   Instead, they mock every external dependency -- the test says
//   "pretend the bank returned success" and code runs as if it did.
// ============================================================

// BLOCK 1 — Why Mock?
// ISOLATION (test YOUR code, not the gateway),
// SPEED (instant vs 200ms+ network), CONTROL (simulate any scenario).

// --- Three Types of Test Doubles ---
// | Type  | Real Runs? | Records? | Controls Return? |
// |-------|-----------|----------|-----------------|
// | Spy   | YES       | YES      | Optional        |
// | Stub  | NO        | YES      | YES             |
// | Mock  | NO        | YES      | YES (+ verifies)|

// --- Mini test framework ---
const results = { passed: 0, failed: 0, errors: [] };
function describe(name, fn) { console.log(`\n${name}`); fn(); }
function test(name, fn) {
  try { fn(); results.passed++; console.log(`  PASS: ${name}`); }
  catch (e) { results.failed++; results.errors.push({ name, error: e.message }); console.log(`  FAIL: ${name} -> ${e.message}`); }
}
async function testAsync(name, fn) {
  try { await fn(); results.passed++; console.log(`  PASS: ${name}`); }
  catch (e) { results.failed++; results.errors.push({ name, error: e.message }); console.log(`  FAIL: ${name} -> ${e.message}`); }
}
function expect(received) {
  return {
    toBe(e) { if (received !== e) throw new Error(`Expected ${JSON.stringify(e)} got ${JSON.stringify(received)}`); },
    toEqual(e) { if (JSON.stringify(received) !== JSON.stringify(e)) throw new Error(`Deep equal failed`); },
    toThrow(m) { let t=false,msg=""; try{received();}catch(e){t=true;msg=e.message;} if(!t)throw new Error("Expected throw"); if(m&&!msg.includes(m))throw new Error(`"${m}" not in "${msg}"`); },
    toHaveBeenCalled() { if(!received._isMock)throw new Error("Not mock"); if(!received._calls.length)throw new Error("Not called"); },
    toHaveBeenCalledTimes(n) { if(received._calls.length!==n) throw new Error(`Expected ${n} calls, got ${received._calls.length}`); },
    toHaveBeenCalledWith(...a) { if(!received._calls.some(c=>JSON.stringify(c)===JSON.stringify(a))) throw new Error(`No call with ${JSON.stringify(a)}`); },
    toHaveBeenLastCalledWith(...a) { const l=received._calls[received._calls.length-1]; if(JSON.stringify(l)!==JSON.stringify(a)) throw new Error(`Last call mismatch`); },
    toBeTruthy() { if (!received) throw new Error(`Expected truthy`); },
    toBeGreaterThan(n) { if(!(received>n)) throw new Error(`${received} not > ${n}`); },
    not: {
      toBe(e) { if(received===e) throw new Error(`Expected NOT ${JSON.stringify(e)}`); },
      toHaveBeenCalled() { if(received._isMock&&received._calls.length) throw new Error("Expected NOT called"); },
    },
  };
}


// ============================================================
// SECTION 1 — Building a Mock Function (vi.fn / jest.fn)
// ============================================================

function createMockFn(impl) {
  function mockFn(...args) {
    mockFn._calls.push(args);
    if (mockFn._returnOnceQueue.length) return mockFn._returnOnceQueue.shift();
    if (mockFn._implementation) return mockFn._implementation(...args);
    if (mockFn._returnValue !== undefined) return mockFn._returnValue;
    return undefined;
  }
  mockFn._isMock = true;
  mockFn._calls = [];
  mockFn._returnValue = undefined;
  mockFn._returnOnceQueue = [];
  mockFn._implementation = impl || null;

  mockFn.mockReturnValue = (v) => { mockFn._returnValue = v; return mockFn; };
  mockFn.mockReturnValueOnce = (v) => { mockFn._returnOnceQueue.push(v); return mockFn; };
  mockFn.mockResolvedValue = (v) => { mockFn._implementation = () => Promise.resolve(v); return mockFn; };
  mockFn.mockRejectedValue = (v) => { mockFn._implementation = () => Promise.reject(v); return mockFn; };
  mockFn.mockImplementation = (f) => { mockFn._implementation = f; return mockFn; };
  mockFn.mockClear = () => { mockFn._calls = []; return mockFn; };
  mockFn.mockReset = () => { mockFn._calls = []; mockFn._returnValue = undefined; mockFn._returnOnceQueue = []; mockFn._implementation = null; return mockFn; };
  return mockFn;
}
const fn = createMockFn;


// ============================================================
// SECTION 2 — Using Mock Functions
// ============================================================

describe("Mock Functions -- Core Features", () => {
  test("mockReturnValue returns fixed value", () => {
    const getPrice = fn().mockReturnValue(250);
    expect(getPrice()).toBe(250);
    expect(getPrice()).toBe(250);
  });

  test("mockReturnValueOnce for sequential returns", () => {
    const fetchStatus = fn()
      .mockReturnValueOnce("pending")
      .mockReturnValueOnce("processing")
      .mockReturnValueOnce("delivered");
    expect(fetchStatus()).toBe("pending");
    expect(fetchStatus()).toBe("processing");
    expect(fetchStatus()).toBe("delivered");
  });

  test("tracking calls and arguments", () => {
    const logger = fn();
    logger("Order placed", { orderId: "ORD-001" });
    logger("Shipped", { tracking: "TRK-123" });

    expect(logger).toHaveBeenCalled();
    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith("Order placed", { orderId: "ORD-001" });
    expect(logger).toHaveBeenLastCalledWith("Shipped", { tracking: "TRK-123" });
  });
});


// ============================================================
// SECTION 3 — Async Mocks & Spying
// ============================================================

describe("Async Mock Functions", () => {
  testAsync("mockResolvedValue for async success", async () => {
    const fetchRestaurants = fn().mockResolvedValue([
      { name: "Paradise Biryani", rating: 4.5 },
    ]);
    const data = await fetchRestaurants("Koramangala");
    expect(data.length).toBe(1);
    expect(fetchRestaurants).toHaveBeenCalledWith("Koramangala");
  });

  testAsync("mockRejectedValue for async failure", async () => {
    const fetchMenu = fn().mockRejectedValue(new Error("Not found"));
    try {
      await fetchMenu("invalid-id");
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toBe("Not found");
    }
  });
});

// --- Spying on existing methods ---
// vi.spyOn(obj, 'method') wraps the real method, records calls.
// spy.mockRestore() restores the original.

function spyOn(obj, methodName) {
  const original = obj[methodName];
  const spy = fn();
  spy._original = original;
  obj[methodName] = function (...args) {
    spy(...args);
    return original.apply(this, args);
  };
  obj[methodName]._isMock = true;
  obj[methodName]._calls = spy._calls;
  spy.mockRestore = () => { obj[methodName] = original; };
  return spy;
}

const analytics = {
  events: [],
  trackEvent(name, data) { this.events.push({ name, data }); return true; },
};

describe("Spying on Methods", () => {
  test("spy records calls, real method still runs", () => {
    const spy = spyOn(analytics, "trackEvent");
    analytics.trackEvent("page_view", { page: "/home" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(analytics.events.length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});


// ============================================================
// SECTION 4 — Mock as Callback
// ============================================================

function selectSeat(seatId, available, onSuccess, onFailure) {
  if (available.includes(seatId)) onSuccess({ seatId, status: "selected", price: 850 });
  else onFailure(new Error(`Seat ${seatId} not available`));
}

describe("Mock as Callback", () => {
  test("calls onSuccess for available seat", () => {
    const ok = fn(), fail = fn();
    selectSeat("A2", ["A1", "A2", "B1"], ok, fail);
    expect(ok).toHaveBeenCalledWith({ seatId: "A2", status: "selected", price: 850 });
    expect(fail).not.toHaveBeenCalled();
  });

  test("calls onFailure for unavailable seat", () => {
    const ok = fn(), fail = fn();
    selectSeat("C5", ["A1", "A2"], ok, fail);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(ok).not.toHaveBeenCalled();
  });
});


// ============================================================
// SECTION 5 — Clearing & Resetting Mocks
// ============================================================

// .mockClear()   -- Reset calls, KEEP implementation
// .mockReset()   -- Clear + remove implementation
// .mockRestore() -- Restore ORIGINAL (only with spyOn)
// In Vitest/Jest: vi.clearAllMocks(), vi.resetAllMocks()

describe("Mock Cleanup", () => {
  test("mockClear resets calls, keeps implementation", () => {
    const calc = fn().mockReturnValue(42);
    calc("first"); calc("second");
    expect(calc).toHaveBeenCalledTimes(2);
    calc.mockClear();
    expect(calc).toHaveBeenCalledTimes(0);
    expect(calc("third")).toBe(42);  // Implementation kept!
  });

  test("mockReset removes everything", () => {
    const calc = fn().mockReturnValue(42);
    calc("call1");
    calc.mockReset();
    expect(calc("call2")).toBe(undefined);  // Implementation gone!
  });
});


// ============================================================
// SECTION 6 — Practical: Mocking a Payment Gateway
// ============================================================

class OrderService {
  constructor(paymentGateway, notifier) {
    this.paymentGateway = paymentGateway;
    this.notifier = notifier;
    this.orders = [];
  }

  async placeOrder(orderData) {
    if (!orderData.items || !orderData.items.length) throw new Error("Order must have items");
    if (!orderData.customer?.phone) throw new Error("Customer phone required");
    const total = orderData.items.reduce((s, i) => s + i.price * i.qty, 0);
    const payment = await this.paymentGateway.charge(total, orderData.cardToken);
    if (payment.status !== "success") {
      await this.notifier.sendSMS(orderData.customer.phone, `Payment failed: ${payment.error}`);
      return { success: false, error: payment.error };
    }
    const order = { id: "ORD-" + Date.now(), items: orderData.items, total, paymentId: payment.paymentId, status: "confirmed" };
    this.orders.push(order);
    await this.notifier.sendSMS(orderData.customer.phone, `Order ${order.id} confirmed! Rs.${total}`);
    return { success: true, order };
  }
}

describe("OrderService -- Mocked Payment & Notifications", () => {
  const mkGateway = () => ({ charge: fn() });
  const mkNotifier = () => ({ sendSMS: fn(), sendEmail: fn() });
  const sampleOrder = {
    items: [{ name: "Headphones", price: 1999, qty: 1 }, { name: "Case", price: 499, qty: 2 }],
    customer: { phone: "+919876543210" },
    cardToken: "tok_visa",
  };

  testAsync("successful order flow", async () => {
    const gw = mkGateway(), nt = mkNotifier();
    const svc = new OrderService(gw, nt);
    gw.charge.mockResolvedValue({ status: "success", paymentId: "pay_001" });
    nt.sendSMS.mockResolvedValue(true);

    const result = await svc.placeOrder(sampleOrder);

    expect(result.success).toBe(true);
    expect(result.order.total).toBe(2997);
    expect(gw.charge).toHaveBeenCalledWith(2997, "tok_visa");
    expect(nt.sendSMS).toHaveBeenCalledTimes(1);
  });

  testAsync("payment failure sends failure SMS", async () => {
    const gw = mkGateway(), nt = mkNotifier();
    const svc = new OrderService(gw, nt);
    gw.charge.mockResolvedValue({ status: "failed", error: "Insufficient funds" });
    nt.sendSMS.mockResolvedValue(true);

    const result = await svc.placeOrder(sampleOrder);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient funds");
    expect(nt.sendSMS).toHaveBeenCalledTimes(1);
  });

  testAsync("validates before charging", async () => {
    const gw = mkGateway(), nt = mkNotifier();
    const svc = new OrderService(gw, nt);
    try {
      await svc.placeOrder({ items: [], customer: { phone: "123" } });
      expect(true).toBe(false);
    } catch (e) { expect(e.message).toBe("Order must have items"); }
    expect(gw.charge).not.toHaveBeenCalled();
  });
});

// --- Print summary ---
setTimeout(() => {
  console.log(`\n=== RESULTS: ${results.passed} passed, ${results.failed} failed ===`);
  if (results.errors.length) results.errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
}, 100);


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Three test doubles: SPY (records, real runs), STUB (fixed
//    return), MOCK (records + verifies expectations).
//
// 2. vi.fn() / jest.fn() creates a mock. Configure with
//    mockReturnValue, mockImplementation, mockResolvedValue.
//
// 3. Inspect mocks: toHaveBeenCalled, toHaveBeenCalledTimes(n),
//    toHaveBeenCalledWith(args).
//
// 4. vi.spyOn wraps real methods. Always mockRestore() after.
//
// 5. Cleanup: mockClear (reset calls), mockReset (clear + remove
//    impl), mockRestore (restore original).
//
// 6. Design for testability: dependency injection (accept deps as
//    params) eliminates the need for module mocking.
// ============================================================
