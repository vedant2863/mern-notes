/**
 * ============================================================
 *  FILE 38: PROXY & REFLECT
 * ============================================================
 *  Intercepting and customizing fundamental object operations
 *  using Proxy traps and the Reflect API.
 *
 *  STORY — The Customs Inspector at Mumbai Port
 *  Inspector Deshmukh (Proxy) stands between importers and
 *  the godown (target object). Every check, store, or remove
 *  action is intercepted. Reflect performs the standard
 *  customs procedure when the inspector allows it.
 * ============================================================
 */

console.log("=== FILE 38: Proxy & Reflect ===\n");

// ============================================================
//  BLOCK 1 — PROXY FUNDAMENTALS & COMMON TRAPS
// ============================================================

console.log("--- BLOCK 1: Proxy Fundamentals ---\n");

const godown = {
  spices: 500,
  textiles: 1200,
  electronics: 50,
  _smuggledGoods: "Hidden contraband",
};

const inspectedGodown = new Proxy(godown, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && prop.startsWith("_")) return undefined;
    return Reflect.get(target, prop, receiver);
  },

  set(target, prop, value, receiver) {
    if (typeof value === "number" && value < 0) return false;
    return Reflect.set(target, prop, value, receiver);
  },

  has(target, prop) {
    if (typeof prop === "string" && prop.startsWith("_")) return false;
    return Reflect.has(target, prop);
  },

  deleteProperty(target, prop) {
    if (prop === "electronics") return false; // duty unpaid
    return Reflect.deleteProperty(target, prop);
  },

  ownKeys(target) {
    return Reflect.ownKeys(target).filter(
      k => typeof k !== "string" || !k.startsWith("_")
    );
  },
});

console.log("Spices:", inspectedGodown.spices);        // 500
console.log("Smuggled:", inspectedGodown._smuggledGoods); // undefined
inspectedGodown.textiles = -100;                       // silently fails
console.log("Textiles:", godown.textiles);             // 1200 (unchanged)
console.log("Keys:", Object.keys(inspectedGodown));    // no _smuggledGoods

// --- Reflect API ---
const office = { name: "Mumbai Port Trust", docks: 4 };
console.log("Reflect.get:", Reflect.get(office, "name"));
Reflect.set(office, "docks", 5);
console.log("Reflect.has:", Reflect.has(office, "name"));
Reflect.deleteProperty(office, "docks");

// --- apply & construct traps ---
function summonLabourer(name) { return `Labourer ${name} called!`; }

const fnProxy = new Proxy(summonLabourer, {
  apply(target, thisArg, args) {
    console.log(`  Intercepted call for: ${args[0]}`);
    return Reflect.apply(target, thisArg, args);
  },
});
console.log(fnProxy("Ramesh Patil"));

// ============================================================
//  BLOCK 2 — PRACTICAL PROXY PATTERNS
// ============================================================

console.log("\n--- BLOCK 2: Practical Patterns ---\n");

// --- Pattern 1: Validation Proxy ---
function createTypedObject(schema) {
  return new Proxy({}, {
    set(target, prop, value) {
      if (prop in schema && typeof value !== schema[prop]) {
        throw new TypeError(`'${prop}' must be ${schema[prop]}, got ${typeof value}`);
      }
      return Reflect.set(target, prop, value);
    },
  });
}

const shipment = createTypedObject({ name: "string", weight: "number" });
shipment.name = "Darjeeling Tea";
shipment.weight = 100;
try { shipment.weight = "heavy"; } catch (e) { console.log("Type error:", e.message); }

// --- Pattern 2: Logging Proxy ---
function withLogging(obj, label) {
  return new Proxy(obj, {
    get(t, p, r) {
      const v = Reflect.get(t, p, r);
      if (typeof v !== "function") console.log(`  [${label}] READ ${String(p)}`);
      return v;
    },
    set(t, p, v, r) {
      console.log(`  [${label}] WRITE ${String(p)} = ${JSON.stringify(v)}`);
      return Reflect.set(t, p, v, r);
    },
  });
}

const cargo = withLogging({ type: "silk", qty: 5 }, "Cargo");
cargo.type;
cargo.qty = 10;

// --- Pattern 3: Negative Array Indexing ---
function negativeArray(arr) {
  return new Proxy(arr, {
    get(target, prop, receiver) {
      const idx = Number(prop);
      if (Number.isInteger(idx) && idx < 0) {
        return Reflect.get(target, String(target.length + idx), receiver);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

const manifest = negativeArray(["Spices", "Tea", "Cashews", "Gems"]);
console.log("Last:", manifest[-1]);    // Gems
console.log("First:", manifest[0]);    // Spices

// --- Pattern 4: Revocable Proxy ---
const restricted = { saffron: "Kashmir Grade-A", cardamom: "Kerala Premium" };
const { proxy: tempAccess, revoke } = Proxy.revocable(restricted, {
  get(t, p) { return Reflect.get(t, p); },
});

console.log("Before revoke:", tempAccess.saffron);
revoke();
try { tempAccess.cardamom; } catch (e) { console.log("After revoke:", e.message); }

// --- Pattern 5: Default Values ---
function withDefaults(obj, defaults) {
  return new Proxy(obj, {
    get(t, p, r) {
      const v = Reflect.get(t, p, r);
      return v === undefined && p in defaults ? defaults[p] : v;
    },
  });
}

const importer = withDefaults({ name: "Rajesh" }, { clearance: "standard" });
console.log("Name:", importer.name);
console.log("Clearance:", importer.clearance);

/**
 * ============================================================
 *  KEY TAKEAWAYS
 * ============================================================
 *  1. Proxy = new Proxy(target, handler) -- intercepts
 *     operations via "traps" in the handler.
 *  2. Common traps: get, set, has, deleteProperty, apply,
 *     construct, ownKeys.
 *  3. Reflect mirrors every trap with clean return values.
 *     Always use Reflect inside traps for correct defaults.
 *  4. Patterns: validation, logging, negative indexing,
 *     revocable access, default values.
 *  5. Performance: proxies add overhead -- avoid on hot paths.
 * ============================================================
 */
