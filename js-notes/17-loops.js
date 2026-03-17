// ============================================================
// FILE 17: LOOPS
// Topic: Iteration — for, while, do...while, for...in, for...of,
//        break, continue, labeled statements
// WHY: Loops process collections and repeat tasks. Picking the
//      right loop matters for clarity and performance.
// ============================================================

// ============================================================
// EXAMPLE 1 — Dabbawala Delivery Route
// Story: Dabbawala Ganesh delivers tiffins door to door.
// Each loop type is a different way to cover his route.
// ============================================================

// --- for loop — total control with index ---

const deliveryFlats = ["Flat 101", "Flat 202", "Flat 303", "Flat 404"];

for (let i = 0; i < deliveryFlats.length; i++) {
  console.log(`Stop ${i + 1}: ${deliveryFlats[i]}`);
}

// --- while — when iteration count is unknown ---

let tiffinsInBag = 10;
let stops = 0;

while (tiffinsInBag > 3) {
  stops++;
  const consumed = Math.floor(Math.random() * 3) + 1;
  tiffinsInBag -= consumed;
  console.log(`Stop ${stops}: Delivered ${consumed}. Left: ${Math.max(tiffinsInBag, 0)}`);
}

// --- do...while — guarantees at least one execution ---

let ringAttempts = 0;
let doorOpened = false;

do {
  ringAttempts++;
  doorOpened = Math.random() < 0.4;
  console.log(`Ring ${ringAttempts}: ${doorOpened ? "Opened!" : "No answer..."}`);
} while (!doorOpened && ringAttempts < 5);

// --- for...in — iterates object KEYS (strings) ---

const buildingInfo = { name: "Shanti Niwas", floors: 5, watchman: "Ramesh" };

for (const key in buildingInfo) {
  console.log(`${key}: ${buildingInfo[key]}`);
}
// WARNING: for...in on arrays gives string indices, not values. Avoid it.

// --- for...of — iterates iterable VALUES ---

for (const flat of deliveryFlats) {
  console.log(`Delivered to: ${flat}`);
}

// for...of with Map
const flatToCustomer = new Map([
  ["Flat 101", "Sharma ji"],
  ["Flat 202", "Gupta ji"],
]);
for (const [flat, customer] of flatToCustomer) {
  console.log(`${flat} — ${customer}`);
}


// ============================================================
// EXAMPLE 2 — break, continue, Labels
// ============================================================

// --- break ---
const routeStops = ["delivered", "delivered", "heavy rain!", "delivered"];
for (const stop of routeStops) {
  if (stop === "heavy rain!") {
    console.log("HEAVY RAIN! Stopping early.");
    break;
  }
  console.log(`Stop: ${stop}`);
}

// --- continue ---
const customers = [
  { name: "Gupta ji", available: true },
  { name: "Patel bhai", available: false },
  { name: "Iyer aunty", available: true },
];
for (const c of customers) {
  if (!c.available) continue;
  console.log(`Delivering to: ${c.name}`);
}

// --- Labeled break — exit outer loop from inner loop ---
const floors = [
  ["Sharma ji", "empty", "tiffin"],
  ["empty", "wrong address", "empty"],
];

buildingSearch:
for (let floor = 0; floor < floors.length; floor++) {
  for (let flat = 0; flat < floors[floor].length; flat++) {
    if (floors[floor][flat] === "wrong address") {
      console.log(`Wrong address at Floor ${floor + 1}, Flat ${flat + 1}!`);
      break buildingSearch;
    }
  }
}

// --- Performance rule of thumb ---
// for: fastest, most control
// for...of: clean syntax, supports break/continue
// .forEach(): clean, but no break/continue or await
// for...in: objects ONLY (slow on arrays, includes prototype keys)
// while/do...while: when iteration count is unknown

// --- Iterating objects with for...of ---
const stats = { tiffins: 500, km: 45, minutes: 30 };
for (const [key, value] of Object.entries(stats)) {
  console.log(`${key}: ${value}`);
}


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. for — total control with index; fastest for large arrays.
// 2. while — when you don't know iteration count upfront.
// 3. do...while — guarantees at least one iteration.
// 4. for...in — object KEYS only; avoid on arrays.
// 5. for...of — iterable VALUES (arrays, strings, Maps, Sets).
// 6. break exits the loop; continue skips to next iteration.
// 7. Labeled statements let break/continue target an outer loop.
// 8. Use Object.entries/keys/values to iterate plain objects.
// ============================================================
