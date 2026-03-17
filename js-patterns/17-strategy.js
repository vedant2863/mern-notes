/**
 * ============================================================
 *  FILE 17 : The Strategy Pattern
 *  Topic   : Strategy, Policy
 *  Impact  : Array.sort() comparators, Express middleware,
 *            payment gateways, form validation rules
 * ============================================================
 */

// STORY: Auto driver Raju navigates Bangalore traffic daily.
// Depending on conditions — rain, peak hour, metro construction —
// he swaps his navigation strategy for an optimal ride.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Classic Strategy (interchangeable sorting)
// ────────────────────────────────────────────────────────────

console.log("=== BLOCK 1: Classic Strategy — Sorting ===");

function byDistance(a, b) {
  return a.distance - b.distance;
}

function byTraffic(a, b) {
  return a.traffic - b.traffic;
}

class BangaloreNavigator {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  planRoute(waypoints) {
    let sorted = waypoints.slice();
    sorted.sort(this.strategy);
    let names = [];
    for (let i = 0; i < sorted.length; i++) {
      names.push(sorted[i].name);
    }
    return names;
  }
}

let waypoints = [
  { name: "Silk Board Junction", distance: 12, traffic: 9 },
  { name: "Indiranagar", distance: 4, traffic: 3 },
  { name: "Koramangala", distance: 7, traffic: 6 },
  { name: "Whitefield", distance: 20, traffic: 8 },
];

let raju = new BangaloreNavigator(byDistance);
console.log("By distance: " + raju.planRoute(waypoints).join(" -> "));

raju.setStrategy(byTraffic);
console.log("By traffic: " + raju.planRoute(waypoints).join(" -> "));

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Functions as Strategies (fare calculation)
// ────────────────────────────────────────────────────────────

console.log("\n=== BLOCK 2: Fare Strategies ===");

function autoFare(price) {
  return { total: price, label: "Auto fare (standard)" };
}

function metroFare(price) {
  return { total: price + 30, label: "Metro + auto last mile (+Rs.30)" };
}

function bikeFare(price) {
  if (price >= 200) {
    return { total: price * 0.8, label: "Bike (20% off)" };
  }
  return { total: price, label: "Bike (standard)" };
}

let strategies = {
  auto: autoFare,
  metro: metroFare,
  bike: bikeFare,
};

function calcFare(price, mode) {
  let strategy = strategies[mode];
  if (!strategy) {
    return { total: price, label: "Unknown" };
  }
  return strategy(price);
}

let r1 = calcFare(120, "auto");
console.log("  " + r1.label + ": Rs." + r1.total);

let r2 = calcFare(250, "bike");
console.log("  " + r2.label + ": Rs." + r2.total);

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Stateful Strategy (classes with internal state)
// ────────────────────────────────────────────────────────────

// Use classes when strategies need internal state (e.g., UPI ID)
console.log("\n=== BLOCK 3: Stateful Strategy (classes) ===");

class UPIStrategy {
  constructor(upiId) {
    this.upiId = upiId;
  }
  pay(amount) {
    return "Paid Rs." + amount + " via UPI (" + this.upiId + ")";
  }
}

class CardStrategy {
  constructor(cardNumber) {
    this.last4 = cardNumber.slice(-4);
  }
  pay(amount) {
    return "Paid Rs." + amount + " with card ending " + this.last4;
  }
}

class AutoFareCheckout {
  constructor(strategy) {
    this.strategy = strategy;
  }
  setPaymentMethod(strategy) {
    this.strategy = strategy;
  }
  processPayment(amount) {
    return this.strategy.pay(amount);
  }
}

let checkout = new AutoFareCheckout(new UPIStrategy("raju@okaxis"));
console.log(checkout.processPayment(150));

checkout.setPaymentMethod(new CardStrategy("4111222233334444"));
console.log(checkout.processPayment(500));

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Strategy swaps algorithms at runtime — no if/else chains needed.
// 2. In JS, strategies can be plain functions — no class boilerplate.
// 3. Use classes when strategies need internal state (UPI ID, card number).
// 4. Follows Open/Closed Principle — add new strategies without changing existing code.
