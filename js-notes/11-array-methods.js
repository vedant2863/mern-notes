/**
 * ============================================================
 *  FILE 11 : Array Methods — The Full Kitchen
 * ============================================================
 *  Topic  : Iterating, transforming, reducing, sorting, and
 *           chaining array methods.
 *
 *  WHY: These methods replace messy for-loops with declarative,
 *  chainable operations — the backbone of modern JS data processing.
 * ============================================================
 */

// STORY: Amma's Tiffin Service in Chennai. Orders flow in, get
// filtered, transformed, sorted, and packed. Each array method
// is a station in her kitchen.

// ────────────────────────────────────────────────────────────
// SECTION 1 — forEach, map, filter, reduce
// ────────────────────────────────────────────────────────────

const orders = [
  { dish: "Curd Rice",            price: 60,  isVeg: true,  qty: 2 },
  { dish: "Chicken Biryani",      price: 150, isVeg: false, qty: 1 },
  { dish: "Masala Dosa",          price: 80,  isVeg: true,  qty: 3 },
  { dish: "Mutton Curry",         price: 200, isVeg: false, qty: 2 },
  { dish: "Paneer Butter Masala", price: 180, isVeg: true,  qty: 1 },
];

// forEach — side effects (logging). Returns undefined.
orders.forEach((o, i) => console.log(`#${i + 1}: ${o.qty}x ${o.dish}`));

// map — transform into a new array of same length
const receiptLines = orders.map(o => `${o.dish}: \u20B9${o.price * o.qty}`);
console.log(receiptLines);

// filter — keep elements passing a test
const nonVeg = orders.filter(o => !o.isVeg);
console.log(nonVeg.map(o => o.dish)); // [ 'Chicken Biryani', 'Mutton Curry' ]

// reduce — boil down to a single value
const totalBill = orders.reduce((sum, o) => sum + o.price * o.qty, 0);
console.log(`Total: \u20B9${totalBill}`); // 1090

// reduce to build an object
const grouped = orders.reduce((acc, o) => {
  const cat = o.isVeg ? "veg" : "nonVeg";
  acc[cat].push(o.dish);
  return acc;
}, { veg: [], nonVeg: [] });
console.log(grouped);

// ────────────────────────────────────────────────────────────
// SECTION 2 — every() and some()
// ────────────────────────────────────────────────────────────

console.log(orders.every(o => o.isVeg));      // false
console.log(orders.some(o => o.isVeg));       // true
console.log(orders.every(o => o.price < 500)); // true

// ────────────────────────────────────────────────────────────
// SECTION 3 — Sorting & Reversing
// ────────────────────────────────────────────────────────────

// sort() MUTATES and sorts as STRINGS by default — DANGER!
const nums = [100, 25, 3, 42, 8];
console.log([...nums].sort());               // [100, 25, 3, 42, 8] WRONG
console.log([...nums].sort((a, b) => a - b)); // [3, 8, 25, 42, 100] correct

// Sorting objects by price
console.log([...orders].sort((a, b) => a.price - b.price).map(o => o.dish));

// reverse() — also MUTATES
const seq = ["first", "second", "third"];
seq.reverse();
console.log(seq); // [ 'third', 'second', 'first' ]

// toSorted / toReversed — IMMUTABLE variants (ES2023)
const prices = [60, 150, 80, 200, 180];
console.log(prices.toSorted((a, b) => a - b)); // [60, 80, 150, 180, 200]
console.log(prices); // unchanged

// ────────────────────────────────────────────────────────────
// SECTION 4 — fill, copyWithin
// ────────────────────────────────────────────────────────────

console.log(Array(5).fill("Reserved")); // 5x "Reserved"

const slots = ["A", "B", "C", "D", "E"];
slots.fill("SOLD OUT", 2, 4);
console.log(slots); // [ 'A', 'B', 'SOLD OUT', 'SOLD OUT', 'E' ]

// ────────────────────────────────────────────────────────────
// SECTION 5 — keys, values, entries, at, with
// ────────────────────────────────────────────────────────────

const menu = ["Dosa", "Idli", "Upma"];
console.log([...menu.entries()]); // [ [0,'Dosa'], [1,'Idli'], [2,'Upma'] ]

// at() — negative index support
const waitlist = ["Sharma Ji", "Gupta Ji", "Verma Ji"];
console.log(waitlist.at(-1)); // Verma Ji

// with() — immutable replacement (ES2023)
const updated = menu.with(1, "Medu Vada");
console.log(updated);  // [ 'Dosa', 'Medu Vada', 'Upma' ]
console.log(menu);     // unchanged

// ────────────────────────────────────────────────────────────
// SECTION 6 — Method Chaining
// ────────────────────────────────────────────────────────────

// Pipeline: veg orders -> compute totals -> sort descending -> format
const vegReport = orders
  .filter(o => o.isVeg)
  .map(o => ({ dish: o.dish, total: o.price * o.qty }))
  .toSorted((a, b) => b.total - a.total)
  .map(o => `${o.dish}: \u20B9${o.total}`);
console.log(vegReport);
// [ 'Masala Dosa: \u20B9240', 'Paneer Butter Masala: \u20B9180', 'Curd Rice: \u20B9120' ]

// Pipeline: non-veg total revenue
const nonVegRevenue = orders
  .filter(o => !o.isVeg)
  .reduce((sum, o) => sum + o.price * o.qty, 0);
console.log(`Non-veg revenue: \u20B9${nonVegRevenue}`); // 670

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. forEach = side effects. map = transform. filter = select.
//    reduce = accumulate to single value.
// 2. sort() MUTATES and sorts as STRINGS by default.
//    Always pass (a, b) => a - b. Use toSorted() for immutability.
// 3. every() = ALL pass. some() = at least ONE passes.
// 4. at(-1) = last element. with(i, val) = immutable replace.
// 5. Chain methods for clean data pipelines:
//    .filter().map().toSorted().reduce()
// 6. Array.from({ length: n }, mapFn) generates sequences.
// ============================================================
