/**
 * ============================================================
 * FILE 41: WeakRef & FinalizationRegistry
 * ============================================================
 * Weak references, deref(), cleanup callbacks, and the
 * nuances of non-deterministic garbage collection.
 *
 * STORY — Munna's Jugaad Lending Library (Daryaganj, Delhi)
 * Books on the cart disappear when no one needs them --
 * picked up by the raddiwala (GC). Munna uses WeakRef to
 * track who borrowed what and FinalizationRegistry as his
 * auto-updating notebook.
 * ============================================================
 */


// ============================================================
// SECTION 1 — WeakRef: CREATING WEAK REFERENCES
// ============================================================
// A WeakRef does NOT prevent garbage collection. If no other
// references exist, GC can reclaim the object.

let lentBook = { title: "Godan by Premchand", pages: 312 };
const bookRef = new WeakRef(lentBook);

console.log("WeakRef created for:", bookRef.deref()?.title);

// WeakRef only accepts objects, not primitives.


// ============================================================
// SECTION 2 — .deref(): ACCESSING THE TARGET
// ============================================================
// Returns the object or undefined if GC has collected it.

function checkBook(ref, label) {
  const book = ref.deref();
  console.log(book
    ? `[${label}] On cart: "${book.title}"`
    : `[${label}] Picked up by raddiwala.`);
}

checkBook(bookRef, "Check 1"); // still alive
lentBook = null;               // now eligible for GC
checkBook(bookRef, "Check 2"); // may still show (GC is non-deterministic)


// ============================================================
// SECTION 3 — FinalizationRegistry: CLEANUP CALLBACKS
// ============================================================
// Fires a callback AFTER a registered object is GC'd.

const notebook = new FinalizationRegistry((heldValue) => {
  console.log(`[Notebook] Book gone: "${heldValue}"`);
});

let rareBook = { title: "Chandrakanta", edition: "1st" };
const token = {};
notebook.register(rareBook, "Chandrakanta", token);

// Unregister if cleanup is no longer needed
notebook.unregister(token);

// Re-register and drop strong reference
notebook.register(rareBook, "Chandrakanta");
rareBook = null;
// Callback fires "eventually" -- not immediately, not predictably.


// ============================================================
// SECTION 4 — PRACTICAL: WeakRef CACHE
// ============================================================
// GC reclaims entries under memory pressure; cache stays
// available when memory is plentiful.

class LendingCache {
  constructor() {
    this.cache = new Map();
    this.registry = new FinalizationRegistry((key) => {
      const ref = this.cache.get(key);
      if (ref && ref.deref() === undefined) {
        this.cache.delete(key);
        console.log(`[Cache] Evicted: "${key}"`);
      }
    });
  }

  set(key, value) {
    this.cache.set(key, new WeakRef(value));
    this.registry.register(value, key);
  }

  get(key) {
    const ref = this.cache.get(key);
    if (!ref) return undefined;
    const val = ref.deref();
    if (!val) { this.cache.delete(key); return undefined; }
    return val;
  }

  get size() { return this.cache.size; }
}

const cache = new LendingCache();
let bookA = { title: "Panchatantra" };
let bookB = { title: "Meghadootam" };

cache.set("fables", bookA);
cache.set("poetry", bookB);
console.log("Cache size:", cache.size);
console.log("Retrieved:", cache.get("fables")?.title);

bookA = null;
bookB = null;
// Entries remain until GC runs.


// ============================================================
// SECTION 5 — CAVEATS: NON-DETERMINISTIC GC
// ============================================================

console.log("\n--- Critical Caveats ---");
console.log("1. GC timing is unpredictable.");
console.log("2. Never rely on finalization for essential cleanup.");
console.log("3. Use deref() result immediately -- don't cache it.");
console.log("4. GC behavior varies across engines.");
console.log("5. Correct code must not depend on finalization running.");


// ============================================================
// SECTION 6 — WeakRef vs WeakMap/WeakSet
// ============================================================

const table = `
  Feature          | WeakMap/WeakSet | WeakRef          | FinalizationRegistry
  -----------------+-----------------+------------------+---------------------
  Holds reference  | Keys (weak)     | Single object    | Registered objects
  Access pattern   | .get(key)       | .deref()         | Callback on GC
  Primary use      | Metadata        | Caches/tracking  | Cleanup side effects
`;
console.log(table);


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. new WeakRef(obj) holds a reference without preventing GC.
//    .deref() returns the object or undefined.
// 2. FinalizationRegistry runs a callback on GC. Use for
//    non-essential cleanup only.
// 3. GC is non-deterministic -- never depend on it for
//    critical resource management.
// 4. WeakRef caches let the GC manage memory pressure.
// 5. WeakRef !== WeakMap. WeakRef holds one object. WeakMap
//    weakly holds keys for metadata association.
// ============================================================
