/**
 * ============================================================
 *  FILE 10 : Arrays — The Basics
 * ============================================================
 *  Topic  : Creating, reading, modifying, and searching arrays.
 *
 *  WHY: Arrays are the most-used data structure. Almost every
 *  API response and dataset arrives as an array.
 * ============================================================
 */

// STORY: The Mumbai Local Train — compartments are indices,
// passengers are values.

// ────────────────────────────────────────────────────────────
// SECTION 1 — Creating Arrays
// ────────────────────────────────────────────────────────────

const compartment1 = ["Sharma Ji", "Gupta Ji", "Verma Ji"]; // literal (preferred)

// Array(3) creates 3 empty slots, NOT [3] — use Array.of(3) for [3]
console.log(Array(3));          // [ <3 empty items> ]
console.log(Array.of(3));       // [ 3 ]

// Array.from() — converts iterables and array-likes
console.log(Array.from("MUMBAI"));  // [ 'M', 'U', 'M', 'B', 'A', 'I' ]

const seatNumbers = Array.from({ length: 5 }, (_, i) => `Seat-${i + 1}`);
console.log(seatNumbers); // [ 'Seat-1', 'Seat-2', 'Seat-3', 'Seat-4', 'Seat-5' ]

// ────────────────────────────────────────────────────────────
// SECTION 2 — Accessing, Modifying & .length
// ────────────────────────────────────────────────────────────

const train = ["Sharma Ji", "Gupta Ji", "Verma Ji", "Iyer Ji", "Patel Ji"];

console.log(train[0]);                  // Sharma Ji
console.log(train[train.length - 1]);   // Patel Ji
console.log(train[99]);                 // undefined (no error)

train[1] = "Gupta Ji (upgraded)";
console.log(train[1]);

// Setting .length smaller truncates the array
const temp = ["A", "B", "C", "D", "E"];
temp.length = 3;
console.log(temp); // [ 'A', 'B', 'C' ]

// ────────────────────────────────────────────────────────────
// SECTION 3 — Adding & Removing: push, pop, shift, unshift, splice
// ────────────────────────────────────────────────────────────

const coach = ["Sharma Ji", "Gupta Ji", "Verma Ji"];

coach.push("Iyer Ji");         // add to END
console.log(coach);

coach.pop();                   // remove from END
console.log(coach);

coach.unshift("TC Pandey");    // add to BEGINNING
console.log(coach);

coach.shift();                 // remove from BEGINNING
console.log(coach);

// splice(start, deleteCount, ...items) — the Swiss Army knife
const compartmentB = ["Sharma Ji", "Gupta Ji", "Verma Ji", "Iyer Ji"];
compartmentB.splice(2, 1);                   // remove Verma Ji
compartmentB.splice(1, 0, "Khan Sahab");     // insert at index 1
compartmentB.splice(3, 1, "Chaiwala");       // replace Iyer Ji
console.log(compartmentB); // [ 'Sharma Ji', 'Khan Sahab', 'Gupta Ji', 'Chaiwala' ]

// ────────────────────────────────────────────────────────────
// SECTION 4 — Non-Mutating: concat, slice, flat, flatMap
// ────────────────────────────────────────────────────────────

const general = ["Sharma Ji", "Gupta Ji"];
const ladies = ["Verma Ji", "Iyer Ji"];
console.log(general.concat(ladies));  // merged, originals unchanged

const wholeTrain = ["A", "B", "C", "D", "E"];
console.log(wholeTrain.slice(1, 4));  // [ 'B', 'C', 'D' ]
console.log(wholeTrain.slice(-2));    // [ 'D', 'E' ]

const nested = [["A", "B"], ["C", ["D", "E"]]];
console.log(nested.flat(Infinity));   // [ 'A', 'B', 'C', 'D', 'E' ]

const csvRows = ["Sharma,Gupta", "Verma,Iyer"];
console.log(csvRows.flatMap(r => r.split(","))); // [ 'Sharma', 'Gupta', 'Verma', 'Iyer' ]

// ────────────────────────────────────────────────────────────
// SECTION 5 — Searching: indexOf, includes, find, findIndex
// ────────────────────────────────────────────────────────────

const roster = ["Sharma Ji", "Gupta Ji", "Verma Ji", "Gupta Ji"];

console.log(roster.indexOf("Gupta Ji"));    // 1
console.log(roster.includes("Chaiwala"));   // false

const passengers = [
  { name: "Sharma Ji", ticket: "First-Class" },
  { name: "Gupta Ji", ticket: "Second-Class" },
  { name: "Verma Ji", ticket: "First-Class" },
];

console.log(passengers.find(p => p.ticket === "First-Class"));
// { name: 'Sharma Ji', ticket: 'First-Class' }

console.log(passengers.findIndex(p => p.ticket === "First-Class")); // 0
console.log(passengers.findLast(p => p.ticket === "First-Class"));
// { name: 'Verma Ji', ticket: 'First-Class' }

// ────────────────────────────────────────────────────────────
// SECTION 6 — Array.isArray()
// ────────────────────────────────────────────────────────────

console.log(typeof []);           // "object" — useless
console.log(Array.isArray([]));   // true

// ────────────────────────────────────────────────────────────
// SECTION 7 — Multi-Dimensional Arrays
// ────────────────────────────────────────────────────────────

const seating = [
  ["Sharma Ji", "Gupta Ji",  "Verma Ji"],
  ["Patel Ji",  "Khan Sahab", "Reddy Ji"],
];

console.log(seating[1][2]); // Reddy Ji

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Use [] for creation. Array(n) creates empty slots — use
//    Array.of(n) if you want [n].
// 2. Zero-indexed. Out-of-bounds returns undefined (no error).
// 3. Mutating: push/pop (end), shift/unshift (start), splice.
// 4. Non-mutating: concat, slice, flat, flatMap — return NEW arrays.
// 5. Searching: indexOf/includes for values; find/findIndex for
//    objects; findLast/findLastIndex from the end.
// 6. Array.isArray() — the only reliable array check.
// 7. Multi-dimensional: grid[row][col].
// ============================================================
