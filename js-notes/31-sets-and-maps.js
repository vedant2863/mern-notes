/**
 * ========================================================
 *  FILE 31: SETS AND MAPS
 * ========================================================
 *  Topic: Set, Map, WeakSet, WeakMap — creation, methods,
 *         iteration, set operations, and practical patterns.
 * ========================================================
 *
 *  STORY — The Sahitya Akademi Library
 *  Pushpa ji manages: unique ISBNs (Set), book-to-author
 *  mappings keyed by objects (Map), and checkout slips that
 *  vanish when a reader leaves (Weak*).
 * ========================================================
 */

// ========================================================
//  BLOCK 1 — Set (Unique Collection)
// ========================================================

// Set stores unique values. Duplicates silently ignored.

const isbns = new Set();
isbns.add("978-81-260-1234");
isbns.add("978-81-260-5678");
isbns.add("978-81-260-1234"); // duplicate — ignored

console.log(isbns.size);                        // 2
console.log(isbns.has("978-81-260-5678"));       // true

isbns.delete("978-81-260-5678");
console.log(isbns.size);                         // 1

// Init from array (auto-dedup)
const unique = new Set(["a", "b", "a", "c"]);
console.log([...unique]); // ['a', 'b', 'c']

// --- Set operations ---
const setA = new Set(["Godaan", "Gitanjali", "Malgudi Days"]);
const setB = new Set(["Malgudi Days", "The Guide", "Kanthapura"]);

const union        = new Set([...setA, ...setB]);
const intersection = new Set([...setA].filter(x => setB.has(x)));
const difference   = new Set([...setA].filter(x => !setB.has(x)));

console.log("\nUnion:", [...union]);
console.log("Intersection:", [...intersection]);
console.log("Difference:", [...difference]);


// ========================================================
//  BLOCK 2 — Map (Any-Key Dictionary)
// ========================================================

// Map allows ANY value as key, preserves insertion order.

console.log("\n--- Book Catalogue (Map) ---");
const catalogue = new Map();
catalogue.set("godaan",    { title: "Godaan",    price: 250 });
catalogue.set("the-guide", { title: "The Guide", price: 350 });

console.log(catalogue.get("the-guide"));
console.log(catalogue.size); // 2

// Objects as keys
const bookA = { id: 1, title: "Meghdootam" };
const authorMap = new Map();
authorMap.set(bookA, "Kalidasa");
console.log(authorMap.get(bookA)); // "Kalidasa"

// Iterating
const shelves = new Map([
  ["shelf-A", ["Godaan", "Gitanjali"]],
  ["shelf-B", ["The Guide", "Kanthapura"]],
]);

for (const [shelf, books] of shelves) {
  console.log(`${shelf}: ${books.join(", ")}`);
}

// Map <-> Object conversion
const obj = Object.fromEntries(shelves);
const backToMap = new Map(Object.entries(obj));


// ========================================================
//  SECTION — WeakSet & WeakMap
// ========================================================

// WeakSet: object-only, GC-friendly, no iteration/size.
console.log("\n--- WeakSet ---");
const passes = new WeakSet();
let reader = { name: "Anand" };
passes.add(reader);
console.log(passes.has(reader)); // true
reader = null; // entry becomes GC-eligible

// WeakMap: object keys, GC-friendly. Ideal for private data.
console.log("\n--- WeakMap (private data) ---");
const _energy = new WeakMap();

class Librarian {
  constructor(name, energy) {
    this.name = name;
    _energy.set(this, energy);
  }

  shelveBooks(hours) {
    const remaining = Math.max(0, _energy.get(this) - hours * 10);
    _energy.set(this, remaining);
    console.log(`${this.name} energy: ${remaining}`);
  }
}

const pushpa = new Librarian("Pushpa ji", 100);
pushpa.shelveBooks(3);  // 70
pushpa.shelveBooks(8);  // 0
console.log(Object.keys(pushpa)); // ['name'] — energy hidden


/**
 * ========================================================
 *  KEY TAKEAWAYS
 * ========================================================
 *  1. SET: unique values, O(1) has/add/delete, insertion order.
 *  2. Set ops (union, intersection, difference) via spread+filter.
 *  3. MAP: any key type, preserves order, has .size.
 *  4. Prefer Map over Object for non-string keys or frequent
 *     add/delete operations.
 *  5. WEAKSET: objects only, no iteration, GC-friendly.
 *  6. WEAKMAP: object keys, GC-friendly — ideal for private
 *     data and caches.
 * ========================================================
 */
