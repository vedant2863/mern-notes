/**
 * ========================================================
 *  FILE 29: SYMBOLS
 * ========================================================
 *  Topic: Unique primitives, hidden property keys,
 *         well-known symbols, and the global registry.
 * ========================================================
 *
 *  STORY — Aadhaar's Hidden Biometric Keys
 *  Every citizen has visible properties, but authorized
 *  officers with the right Symbol key can read hidden
 *  data etched onto the same record.
 * ========================================================
 */

// ========================================================
//  BLOCK 1 — Creating Symbols & Uniqueness
// ========================================================

// Symbols are always unique — same description, different value.
const id1 = Symbol("aadhaar");
const id2 = Symbol("aadhaar");
console.log(id1 === id2);           // false
console.log(id1.description);       // "aadhaar"


// ========================================================
//  BLOCK 2 — Symbols as Hidden Property Keys
// ========================================================

// Symbol-keyed properties are invisible to for...in,
// Object.keys(), and JSON.stringify().

const biometricHash = Symbol("biometricHash");

const citizen = {
  name: "Rajesh Kumar",
  age: 35,
  [biometricHash]: "a7f3c9e2d1",
};

console.log(Object.keys(citizen));          // ['name', 'age']
console.log(JSON.stringify(citizen));        // no biometricHash
console.log(citizen[biometricHash]);         // "a7f3c9e2d1"
console.log(Object.getOwnPropertySymbols(citizen)); // [Symbol(biometricHash)]


// ========================================================
//  BLOCK 3 — Well-Known Symbols
// ========================================================

// --- Symbol.iterator: make objects work with for...of ---
const rtiBook = {
  queries: ["Budget", "Ration Status", "Land Records"],
  [Symbol.iterator]() {
    let i = 0;
    const q = this.queries;
    return {
      next() {
        return i < q.length
          ? { value: q[i++], done: false }
          : { value: undefined, done: true };
      }
    };
  }
};

for (const query of rtiBook) console.log(`RTI: ${query}`);

// --- Symbol.toPrimitive: control type conversion ---
const scheme = {
  name: "PM Kisan Yojana",
  beneficiaries: 42,
  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.beneficiaries;
    return this.name;
  }
};

console.log(+scheme);        // 42
console.log(`${scheme}`);    // "PM Kisan Yojana"

// --- Symbol.hasInstance: customize instanceof ---
class UIDAIRegistry {
  static [Symbol.hasInstance](obj) {
    return obj.hasAadhaar === true;
  }
}
console.log({ hasAadhaar: true } instanceof UIDAIRegistry); // true


// ========================================================
//  SECTION — Global Symbol Registry
// ========================================================

// Symbol.for(key) returns a shared symbol across modules.
const panDelhi  = Symbol.for("pan-number");
const panMumbai = Symbol.for("pan-number");
console.log(panDelhi === panMumbai);       // true
console.log(Symbol.keyFor(panDelhi));      // "pan-number"

// Local symbols have no registry key
const local = Symbol("pan-number");
console.log(local === panDelhi);           // false


// ========================================================
//  SECTION — Enum-Like Constants with Symbols
// ========================================================

const Season = Object.freeze({
  SUMMER:  Symbol("summer"),
  MONSOON: Symbol("monsoon"),
  WINTER:  Symbol("winter"),
});

function describeSeason(s) {
  if (s === Season.SUMMER)  return "Loo winds!";
  if (s === Season.MONSOON) return "Rains drench the fields!";
  if (s === Season.WINTER)  return "Fog blankets the plains!";
  return "Unknown season.";
}

console.log(describeSeason(Season.SUMMER));
console.log(describeSeason("summer")); // "Unknown season."


/**
 * ========================================================
 *  KEY TAKEAWAYS
 * ========================================================
 *  1. Symbol() always creates a UNIQUE primitive.
 *  2. Symbol-keyed properties are hidden from for...in,
 *     Object.keys(), and JSON.stringify().
 *  3. Well-known symbols (iterator, toPrimitive, hasInstance)
 *     hook into core language protocols.
 *  4. Symbol.for(key) shares symbols across modules/realms.
 *  5. Symbols make excellent enum-like constants — no
 *     collision with strings or other symbols.
 * ========================================================
 */
