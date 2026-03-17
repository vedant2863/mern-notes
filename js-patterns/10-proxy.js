/**
 * ============================================================
 *  FILE 10 : The SBI Bank Guard — Proxy Pattern
 *  Topic  : Proxy, ES6 Proxy, Reactive Data
 *  Where you'll see this: Vue.js reactivity, access control, lazy loading
 * ============================================================
 */

// STORY: Security guard Raju stands in front of the SBI locker room.
// Every request goes through Raju — he checks, logs, and sometimes blocks.

console.log("=== FILE 10: The SBI Bank Guard ===\n");

// ────────────────────────────────────
// BLOCK 1 — Classic Proxy (Virtual + Protection)
// ────────────────────────────────────

console.log("--- Block 1: Classic Proxy ---");

class LockerRoom {
  constructor() {
    this._contents = { gold: 5000, documents: 120, jewelry: 45 };
    console.log("  [LockerRoom] Heavy door opened (expensive operation)");
  }

  getContents() {
    return Object.assign({}, this._contents);
  }

  withdraw(item, amount) {
    const available = this._contents[item] || 0;
    if (available < amount) {
      throw new Error("Insufficient " + item);
    }
    this._contents[item] -= amount;
    return "Withdrew " + amount + " " + item;
  }
}

// Virtual proxy — delays creation until first use
class LockerRoomProxy {
  constructor() {
    this._lockerRoom = null;
  }

  _ensure() {
    if (!this._lockerRoom) {
      this._lockerRoom = new LockerRoom();
    }
    return this._lockerRoom;
  }

  getContents() { return this._ensure().getContents(); }
  withdraw(item, amount) { return this._ensure().withdraw(item, amount); }
}

const lazyLocker = new LockerRoomProxy();
console.log("LockerRoom created?", lazyLocker._lockerRoom !== null); // false

console.log("First access triggers creation:");
console.log("Gold:", lazyLocker.getContents().gold);

// ────────────────────────────────────
// BLOCK 2 — ES6 Proxy with Traps
// ────────────────────────────────────

console.log("\n--- Block 2: ES6 Proxy ---");

const lockerData = { gold: 5000, documents: 120, _aadhaarPin: "9876-5432-1098" };

const secureLocker = new Proxy(lockerData, {

  get(target, prop) {
    // Block access to private properties (start with underscore)
    if (typeof prop === "string" && prop.startsWith("_")) {
      console.log("  [Raju] BLOCKED read of private: " + prop);
      return undefined;
    }
    const value = target[prop];
    console.log("  [Raju] READ locker." + String(prop) + " -> " + value);
    return value;
  },

  set(target, prop, value) {
    if (typeof prop === "string" && prop.startsWith("_")) {
      console.log("  [Raju] BLOCKED write to private: " + prop);
      return true;
    }
    if (typeof value === "number" && value < 0) {
      console.log("  [Raju] REJECTED negative value for " + prop + ": " + value);
      return true;
    }
    console.log("  [Raju] WRITE locker." + String(prop) + " = " + value);
    target[prop] = value;
    return true;
  },

  has(target, prop) {
    if (typeof prop === "string" && prop.startsWith("_")) return false;
    return prop in target;
  },
});

console.log("Gold:", secureLocker.gold);
console.log("Aadhaar:", secureLocker._aadhaarPin); // undefined
secureLocker.documents = -50; // rejected
console.log("'_aadhaarPin' in locker:", "_aadhaarPin" in secureLocker); // false

// ────────────────────────────────────
// BLOCK 3 — Reactive Data Binding (Vue.js style)
// ────────────────────────────────────

console.log("\n--- Block 3: Reactive Data Binding ---");

function reactive(target, onChange) {
  return new Proxy(target, {

    get(obj, prop) {
      const value = obj[prop];
      // Wrap nested objects so they are also reactive
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return reactive(value, onChange);
      }
      return value;
    },

    set(obj, prop, value) {
      const oldValue = obj[prop];
      obj[prop] = value;
      if (oldValue !== value) {
        onChange(prop, oldValue, value);
      }
      return true;
    },
  });
}

const state = reactive(
  { count: 0, user: { name: "Raju", role: "guard" } },
  function (prop, oldVal, newVal) {
    console.log("[Reactive] " + prop + ": " + JSON.stringify(oldVal) + " -> " + JSON.stringify(newVal));
  }
);

state.count = 1;            // fires
state.user.name = "Raju S"; // fires (nested)
state.count = 1;            // same value — no reaction

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Proxy stands between client and object, intercepting operations.
// 2. Virtual Proxy delays expensive creation until first use.
// 3. ES6 Proxy traps: get, set, has, deleteProperty, and more.
// 4. Reactive data binding (Vue.js) uses Proxy to detect changes.

console.log("\n=== Raju's shift ends. The locker room is secure. ===");
