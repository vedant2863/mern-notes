/**
 * ============================================================
 *  FILE 1 : Sharma ji's Kirana Store — Module Pattern
 *  Topic  : Module Pattern, Revealing Module, Namespaces
 *  Where you'll see this: Node.js modules, React component files
 * ============================================================
 */

// STORY: Sharma ji keeps his godown (backroom) private and only
// lets customers interact through the billing counter.

console.log("=== FILE 01: Sharma ji's Kirana Store ===\n");

// ────────────────────────────────────
// BLOCK 1 — Module Pattern with a Simple Object
// ────────────────────────────────────

const KiranaStore = {
  _itemCount: 0,
  _godown: [],

  add(name) {
    this._itemCount++;
    this._godown.push(name);
    return "Sharma ji stocked item: " + name;
  },

  count() {
    return this._itemCount;
  },

  list() {
    return this._godown.slice();
  },
};

console.log(KiranaStore.add("Atta 10kg"));
console.log(KiranaStore.add("Toor Dal 5kg"));
console.log("Count:", KiranaStore.count());

// ────────────────────────────────────
// BLOCK 2 — Revealing Module Pattern
// ────────────────────────────────────

// Define everything as private, then reveal only what customers need.

console.log("\n--- Revealing Module Pattern ---");

function createAccountBook() {
  const records = [];
  const accessLog = [];

  function logAccess(action) {
    const today = new Date().toISOString().slice(0, 10);
    accessLog.push("[" + today + "] " + action);
  }

  function store(doc) {
    logAccess("Stored: " + doc);
    records.push(doc);
  }

  function retrieve(index) {
    logAccess("Retrieved index " + index);
    return records[index] || "Not found";
  }

  function getCount() {
    return records.length;
  }

  function getLog() {
    return accessLog.slice();
  }

  // Only these are public — logAccess stays hidden
  return { store, retrieve, getCount, getLog };
}

const AccountBook = createAccountBook();

AccountBook.store("Sugar 2kg");
AccountBook.store("Basmati Rice 5kg");
console.log("Retrieved:", AccountBook.retrieve(0));
console.log("Record count:", AccountBook.getCount());
console.log("logAccess hidden?", typeof AccountBook.logAccess); // undefined

// ────────────────────────────────────
// BLOCK 3 — Namespace Pattern
// ────────────────────────────────────

console.log("\n--- Namespace Pattern ---");

const SharmaMart = {};

SharmaMart.Inventory = {
  unitPrice(totalPrice, qty) {
    return totalPrice / qty;
  },
  totalWeight(weightPerItem, qty) {
    return weightPerItem * qty;
  },
};

SharmaMart.Billing = {
  gstCalc(price, qty, gstPct) {
    const base = SharmaMart.Inventory.unitPrice(price, 1) * qty;
    const gst = (base * gstPct) / 100;
    return "₹" + gst.toFixed(1) + " GST on ₹" + base.toFixed(1);
  },
  bulkDiscount(pricePerKg, kgs) {
    const total = SharmaMart.Inventory.totalWeight(pricePerKg, kgs);
    const discounted = total * 0.95;
    return "₹" + discounted.toFixed(1) + " after 5% bulk discount";
  },
};

console.log("GST:", SharmaMart.Billing.gstCalc(100, 3, 18));
console.log("Bulk:", SharmaMart.Billing.bulkDiscount(60, 10));

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Module Pattern uses closures to hide private state (the godown).
// 2. Revealing Module makes the public API crystal clear in the return object.
// 3. Namespace objects group related functions to avoid global pollution.
// 4. Modern JS uses import/export, but the concept is identical.

console.log("\n=== Sharma ji pulls down the shutter. Store secured. ===");
