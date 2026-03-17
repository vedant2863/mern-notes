// ============================================================
// FILE 05: MOCKING ADVANCED
// Topic: Module mocking, timer mocking, date mocking, and dependency injection
// ============================================================

// ============================================================
// STORY: Swiggy's delivery estimator depends on Google Maps API,
//   Redis cache, and system time. Mocking all three makes tests
//   100% deterministic -- no flakiness from external systems.
// ============================================================

// --- Mini test framework (see File 04 for full build) ---
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
    toBeGreaterThan(n) { if (!(received > n)) throw new Error(`${received} not > ${n}`); },
    toBeTruthy() { if (!received) throw new Error(`Expected truthy`); },
    toBeFalsy() { if (received) throw new Error(`Expected falsy`); },
    toContain(i) { if (!(Array.isArray(received)?received.includes(i):String(received).includes(i))) throw new Error(`Missing ${i}`); },
    toHaveProperty(k, v) { if (!(k in received)) throw new Error(`No "${k}"`); if (v !== undefined && received[k] !== v) throw new Error(`"${k}": ${received[k]} != ${v}`); },
    toThrow(m) { let t=false,msg=""; try{received();}catch(e){t=true;msg=e.message;} if(!t)throw new Error("No throw"); if(m&&!msg.includes(m))throw new Error(`"${m}" not in "${msg}"`); },
    not: { toBe(e) { if(received===e) throw new Error(`Expected NOT ${JSON.stringify(e)}`); } },
  };
}
function fn(impl) {
  function m(...a) {
    m._calls.push(a);
    if (m._returnOnceQ.length) return m._returnOnceQ.shift();
    if (m._impl) return m._impl(...a);
    if (m._retVal !== undefined) return m._retVal;
  }
  m._isMock=true; m._calls=[]; m._retVal=undefined; m._returnOnceQ=[]; m._impl=impl||null;
  m.mockReturnValue=(v)=>{m._retVal=v;return m;};
  m.mockReturnValueOnce=(v)=>{m._returnOnceQ.push(v);return m;};
  m.mockImplementation=(f)=>{m._impl=f;return m;};
  m.mockResolvedValue=(v)=>{m._impl=()=>Promise.resolve(v);return m;};
  m.mockRejectedValue=(v)=>{m._impl=()=>Promise.reject(v);return m;};
  m.mockClear=()=>{m._calls=[];return m;};
  m.mockReset=()=>{m._calls=[];m._retVal=undefined;m._returnOnceQ=[];m._impl=null;return m;};
  return m;
}


// ============================================================
// SECTION 1 — Module Mocking: Replacing Entire Imports
// ============================================================

// Vitest syntax:
// vi.mock('./mapsService.js');      // Auto-mock: all exports become vi.fn()
// import { getDistance } from './mapsService.js';  // Now a mock

// --- Simulating module mocking ---
const mapsModule = { getDistance: null };
const weatherModule = { getWeather: null };

function estimateDeliveryTime(origin, destination) {
  const distance = mapsModule.getDistance(origin, destination);
  const weather = weatherModule.getWeather(destination);
  let baseMinutes = distance * 2;
  if (weather === "rain") baseMinutes *= 1.5;
  if (weather === "storm") baseMinutes *= 2;
  return Math.round(baseMinutes);
}

describe("Module Mocking -- Delivery Estimator", () => {
  mapsModule.getDistance = fn();
  weatherModule.getWeather = fn();

  test("10 min for 5km in clear weather", () => {
    mapsModule.getDistance.mockReturnValue(5);
    weatherModule.getWeather.mockReturnValue("clear");
    expect(estimateDeliveryTime("Koramangala", "Indiranagar")).toBe(10);
  });

  test("15 min for 5km in rain (1.5x)", () => {
    mapsModule.getDistance.mockReturnValue(5);
    weatherModule.getWeather.mockReturnValue("rain");
    expect(estimateDeliveryTime("HSR", "Whitefield")).toBe(15);
  });
});

// Factory mock for precise control:
// vi.mock('./razorpayClient', () => ({
//   createOrder: vi.fn(), capturePayment: vi.fn(), refund: vi.fn(),
// }));

// Partial mock -- mock one function, keep rest real:
// vi.mock('./utils', async () => {
//   const actual = await vi.importActual('./utils');
//   return { ...actual, formatDate: vi.fn().mockReturnValue('26/01/2024') };
// });


// ============================================================
// SECTION 2 — Timer Mocking: setTimeout, Debounce
// ============================================================

// vi.useFakeTimers() / vi.advanceTimersByTime(ms) / vi.useRealTimers()

class FakeTimers {
  constructor() { this.time = 0; this.timers = []; this.nextId = 1; this._origST = null; this._origCI = null; }
  install() {
    this._origST = globalThis.setTimeout; this._origCI = globalThis.clearTimeout;
    const self = this;
    globalThis.setTimeout = (cb, delay) => { const id = self.nextId++; self.timers.push({ id, cb, at: self.time + delay, done: false }); return id; };
    globalThis.clearTimeout = (id) => { const t = self.timers.find((t) => t.id === id); if (t) t.done = true; };
  }
  advanceTimersByTime(ms) {
    const target = this.time + ms;
    while (this.time < target) {
      const next = this.timers.filter((t) => !t.done && t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!next) { this.time = target; break; }
      this.time = next.at; next.done = true; next.cb();
    }
  }
  uninstall() { globalThis.setTimeout = this._origST; globalThis.clearTimeout = this._origCI; this.timers = []; this.time = 0; }
}

function debounce(func, delay) {
  let tid = null;
  return function (...args) {
    if (tid) clearTimeout(tid);
    tid = setTimeout(() => func(...args), delay);
  };
}

describe("Timer Mocking -- Debounce", () => {
  const ft = new FakeTimers();

  test("debounce delays execution until timer fires", () => {
    ft.install();
    const cb = fn();
    const debounced = debounce(cb, 300);

    debounced("a"); debounced("b"); debounced("c");
    expect(cb._calls.length).toBe(0);

    ft.advanceTimersByTime(300);
    expect(cb._calls.length).toBe(1); // Called once with last args
    ft.uninstall();
  });

  test("debounce resets on new call within window", () => {
    ft.install();
    const cb = fn();
    const debounced = debounce(cb, 300);

    debounced("first");
    ft.advanceTimersByTime(200);
    debounced("second"); // Resets timer
    ft.advanceTimersByTime(200);
    expect(cb._calls.length).toBe(0); // Still waiting

    ft.advanceTimersByTime(100);
    expect(cb._calls.length).toBe(1);
    ft.uninstall();
  });
});


// ============================================================
// SECTION 3 — Date Mocking: Freezing Time
// ============================================================

// vi.useFakeTimers(); vi.setSystemTime(new Date('2024-01-26T10:00:00+05:30'));

function isTatkalWindow(date) {
  const h = date.getHours();
  return h >= 10 && h < 12;
}

function getDiscount(date) {
  const h = date.getHours();
  return (h >= 14 && h < 17) ? 20 : 0; // Happy hour 2-5 PM
}

function isCouponExpired(coupon, now) {
  return now > new Date(coupon.expiresAt);
}

describe("Date Mocking -- Time-Dependent Logic", () => {
  test("Tatkal window open at 10 AM, closed at 1 PM", () => {
    expect(isTatkalWindow(new Date("2024-01-26T10:00:00+05:30"))).toBe(true);
    expect(isTatkalWindow(new Date("2024-01-26T13:00:00+05:30"))).toBe(false);
  });

  test("Happy hour discount at 3 PM, none at 6 PM", () => {
    expect(getDiscount(new Date("2024-03-15T15:00:00+05:30"))).toBe(20);
    expect(getDiscount(new Date("2024-03-15T18:00:00+05:30"))).toBe(0);
  });

  test("Coupon expiry check", () => {
    const coupon = { code: "SAVE20", expiresAt: "2024-01-25T23:59:59+05:30" };
    expect(isCouponExpired(coupon, new Date("2024-01-26T10:00:00+05:30"))).toBe(true);
    expect(isCouponExpired(coupon, new Date("2024-01-24T10:00:00+05:30"))).toBe(false);
  });
});


// ============================================================
// SECTION 4 — Environment Variable Mocking
// ============================================================

function createConfig(env) {
  return {
    apiUrl: env.API_URL || "http://localhost:3000",
    apiKey: env.API_KEY || "dev_key",
    env: env.NODE_ENV || "development",
    cache: env.ENABLE_CACHE === "true",
    retries: parseInt(env.MAX_RETRIES || "3", 10),
  };
}

describe("Environment Variable Mocking", () => {
  test("production config", () => {
    const cfg = createConfig({ API_URL: "https://api.razorpay.com", NODE_ENV: "production", ENABLE_CACHE: "true", MAX_RETRIES: "5" });
    expect(cfg.apiUrl).toBe("https://api.razorpay.com");
    expect(cfg.cache).toBe(true);
    expect(cfg.retries).toBe(5);
  });

  test("test config with defaults", () => {
    const cfg = createConfig({ NODE_ENV: "test" });
    expect(cfg.apiUrl).toBe("http://localhost:3000");
    expect(cfg.cache).toBe(false);
  });
});


// ============================================================
// SECTION 5 — Dependency Injection (Best Pattern)
// ============================================================

// BAD: hard-coded imports need vi.mock to test
// GOOD: accept deps as params -- pass mocks directly

function createPaymentService({ chargeCard, sendEmail, log }) {
  return {
    async process(order) {
      if (!order.total || order.total <= 0) throw new Error("Invalid total");
      log("info", `Charging Rs.${order.total}`);
      const charge = await chargeCard(order.total, order.method);
      if (charge.status !== "success") {
        log("error", `Failed: ${charge.error}`);
        return { success: false, error: charge.error };
      }
      await sendEmail(order.email, "Receipt", `Rs.${order.total} charged. Txn: ${charge.txnId}`);
      return { success: true, txnId: charge.txnId };
    },
  };
}

describe("Dependency Injection -- Payment Service", () => {
  const mkDeps = () => ({ chargeCard: fn(), sendEmail: fn(), log: fn() });

  testAsync("successful payment", async () => {
    const d = mkDeps();
    d.chargeCard.mockResolvedValue({ status: "success", txnId: "TXN-001" });
    d.sendEmail.mockResolvedValue(true);
    const r = await createPaymentService(d).process({ total: 4999, method: "upi", email: "c@e.com" });
    expect(r.success).toBe(true);
    expect(d.chargeCard._calls.length).toBe(1);
    expect(d.sendEmail._calls.length).toBe(1);
  });

  testAsync("failed payment skips email", async () => {
    const d = mkDeps();
    d.chargeCard.mockResolvedValue({ status: "failed", error: "Declined" });
    const r = await createPaymentService(d).process({ total: 9999, method: "card", email: "c@e.com" });
    expect(r.success).toBe(false);
    expect(d.sendEmail._calls.length).toBe(0);
  });
});


// ============================================================
// SECTION 6 — Practical: Delivery Time Estimator (Full)
// ============================================================

function createDeliveryEstimator({ mapsApi, cache, getCurrentTime }) {
  return {
    async estimate(restaurantId, address) {
      let prepTime = cache.get(`prep:${restaurantId}`);
      if (prepTime === null || prepTime === undefined) prepTime = 15;
      const location = cache.get(`location:${restaurantId}`);
      const distance = await mapsApi.getDistance(location, address);
      const travelTime = distance * 3;
      const hour = getCurrentTime().getHours();
      const isPeak = (hour >= 12 && hour < 14) || (hour >= 19 && hour < 22);
      const multiplier = isPeak ? 1.4 : 1.0;
      const totalMinutes = Math.round((prepTime + travelTime) * multiplier);
      return { prepTime, travelTime: Math.round(travelTime), isPeak, multiplier, totalMinutes };
    },
  };
}

describe("Delivery Estimator -- Full Mock Integration", () => {
  function mkDeps(hour = 15) {
    return {
      mapsApi: { getDistance: fn().mockResolvedValue(4) },
      cache: {
        get: fn().mockImplementation((key) => {
          if (key.startsWith("prep:")) return 12;
          if (key.startsWith("location:")) return "12.97,77.59";
          return null;
        }),
      },
      getCurrentTime: fn().mockReturnValue(
        new Date(`2024-03-15T${String(hour).padStart(2, "0")}:30:00+05:30`)
      ),
    };
  }

  testAsync("off-peak delivery (3:30 PM)", async () => {
    const r = await createDeliveryEstimator(mkDeps(15)).estimate("rest-001", "Koramangala");
    expect(r.isPeak).toBe(false);
    expect(r.totalMinutes).toBe(24); // (12+12)*1.0
  });

  testAsync("lunch peak (1:30 PM)", async () => {
    const r = await createDeliveryEstimator(mkDeps(13)).estimate("rest-001", "Indiranagar");
    expect(r.isPeak).toBe(true);
    expect(r.totalMinutes).toBe(34); // (12+12)*1.4 = 33.6 -> 34
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
// 1. Module mocking (vi.mock) replaces entire imports. Factory
//    gives precise control. Partial mock keeps some functions real.
//
// 2. Timer mocking (vi.useFakeTimers) controls setTimeout/setInterval.
//    advanceTimersByTime for debounce, throttle, retry tests.
//
// 3. Date mocking (vi.setSystemTime) freezes the clock. Essential
//    for expiry, scheduling, and peak-hour logic.
//
// 4. Environment mocking: save/restore process.env. Test configs
//    without touching real credentials.
//
// 5. DEPENDENCY INJECTION is the #1 pattern for testability.
//    Accept deps as params = no module mocking needed.
//
// 6. The more you mock, the less you test. Mock external boundaries
//    (APIs, DBs). Keep business logic real. Always clean up mocks.
// ============================================================
