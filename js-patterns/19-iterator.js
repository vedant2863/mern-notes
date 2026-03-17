/**
 * ============================================================
 *  FILE 19 : The Iterator Pattern
 *  Topic   : Iterator, ES6 Iterables, Generators
 *  Impact  : for...of loops, spread operator, Array.from(),
 *            Node.js streams, database cursors
 * ============================================================
 */

// STORY: Dabbawala Ganesh walks his delivery route one tiffin
// at a time through the train compartment. He does not care if
// tiffins are in crates or racks — the iterator handles traversal.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Custom Iterator (Symbol.iterator)
// ────────────────────────────────────────────────────────────

console.log("=== BLOCK 1: Custom Iterator ===");

class TiffinRoute {
  constructor(name) {
    this.name = name;
    this.tiffins = [];
  }

  add(label) {
    this.tiffins.push(label);
    return this;
  }

  [Symbol.iterator]() {
    let index = 0;
    let tiffins = this.tiffins;
    return {
      next: function () {
        if (index < tiffins.length) {
          let value = tiffins[index];
          index = index + 1;
          return { value: value, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
}

let route = new TiffinRoute("Churchgate Line");
route.add("Tiffin-Sharma");
route.add("Tiffin-Gupta");
route.add("Tiffin-Patel");

// Works with for...of
for (let tiffin of route) {
  console.log("  Delivered: " + tiffin);
}

// Works with spread
let allTiffins = [...route];
console.log("Spread: " + allTiffins.join(", "));

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Generator Functions as Iterators
// ────────────────────────────────────────────────────────────

console.log("\n=== BLOCK 2: Generators ===");

// Generators enable lazy evaluation — infinite sequences are safe
function* fibonacci() {
  let a = 0;
  let b = 1;
  while (true) {
    yield a;
    let temp = a;
    a = b;
    b = temp + b;
  }
}

function* take(count, iterator) {
  let taken = 0;
  for (let item of iterator) {
    if (taken >= count) return;
    yield item;
    taken = taken + 1;
  }
}

let first8 = [...take(8, fibonacci())];
console.log("First 8 Fibonacci: " + first8.join(", "));

// Composing generators — filter then transform
function* filterItems(items, test) {
  for (let item of items) {
    if (test(item)) {
      yield item;
    }
  }
}

function* mapItems(items, transform) {
  for (let item of items) {
    yield transform(item);
  }
}

let tiffins = ["Tiffin-Churchgate", "Tiffin-Marine-Lines", "Tiffin-Churchgate-Express"];

let churchgateOnly = filterItems(tiffins, function (t) {
  return t.indexOf("Churchgate") !== -1;
});
let uppercased = mapItems(churchgateOnly, function (t) {
  return t.toUpperCase();
});

console.log("Composed (filter+map): " + [...uppercased].join(", "));

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Async Iterators (for await...of)
// ────────────────────────────────────────────────────────────

console.log("\n=== BLOCK 3: Async Iterators ===");

async function* stationStream(stations, ms) {
  for (let i = 0; i < stations.length; i++) {
    await new Promise(function (resolve) { setTimeout(resolve, ms); });
    yield stations[i];
  }
}

async function main() {
  console.log("Ganesh delivers across stations:");
  let stations = stationStream(["Churchgate", "Marine Lines", "Charni Road"], 15);
  for await (let station of stations) {
    console.log("  Delivered at: " + station);
  }
}

main();

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Symbol.iterator lets any collection work with for...of and spread.
// 2. Generators (function*) simplify iterators — yield replaces manual next().
// 3. Lazy evaluation means infinite sequences are safe — compute on demand.
// 4. Compose generators (map, filter, take) to build data pipelines.
// 5. Async generators + for await...of handle data that arrives over time.
