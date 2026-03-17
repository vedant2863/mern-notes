// ============================================================
// FILE 12: Objects — The Basics
// Topic: Creating, accessing, modifying, and iterating objects
// Why: Objects are THE fundamental building block in JavaScript.
// ============================================================

// =============================================
// STORY: The Cricket Player Profile Card
// You're building a player card for the IPL
// auction — every cricketer is an object,
// every stat is a property.
// =============================================


// =============================================
// SECTION 1: Object Literals & Computed Property Names
// =============================================

const player = {
  name: "Virat Kohli",
  role: "Batsman",
  matches: 237,
  runs: 12000,
  average: 53.5,
  isActive: true,
};

console.log(player);

// Computed property names — use [] for dynamic keys
const statName = "centuries";
const dynamicStats = {
  [statName]: 43,
  [`${statName}InTests`]: Math.floor(43 / 2),
};
console.log(dynamicStats); // { centuries: 43, centuriesInTests: 21 }


// =============================================
// SECTION 2: Accessing Properties — Dot vs Bracket
// =============================================

// Dot notation — cleaner, for valid identifiers
console.log(player.name);    // Virat Kohli

// Bracket notation — for dynamic keys or special characters
const prop = "runs";
console.log(player[prop]);   // 12000

const specialRecord = { "full name": "MS Dhoni", 7: "jersey number" };
console.log(specialRecord["full name"]); // MS Dhoni
console.log(specialRecord[7]);           // jersey number


// =============================================
// SECTION 3: Adding & Deleting Properties
// =============================================

const allRounder = { name: "Hardik Pandya", role: "All-Rounder" };

allRounder.battingAvg = 29.5;
allRounder["bowlingAvg"] = 33.1;

delete allRounder.bowlingAvg;
console.log(allRounder.bowlingAvg); // undefined


// =============================================
// SECTION 4: Shorthand Properties & Methods
// =============================================

// Shorthand properties — when variable name matches key
const name = "Jasprit Bumrah";
const wickets = 145;
const bowler = { name, wickets };
console.log(bowler); // { name: 'Jasprit Bumrah', wickets: 145 }

// Shorthand methods + getter
const batsman = {
  name: "Virat",
  stamina: 100,

  playShot(shotType) {
    this.stamina -= 10;
    return `${this.name} plays ${shotType}! (Stamina: ${this.stamina})`;
  },

  get form() {
    return this.stamina > 50 ? "In Form" : "Tired";
  },
};

console.log(batsman.playShot("Cover Drive"));
console.log(batsman.form); // In Form


// =============================================
// SECTION 5: Property Existence Checks
// =============================================

const fielder = { name: "Ravindra Jadeja", catches: 85, runOuts: undefined };

// "in" checks own AND inherited properties
console.log("runOuts" in fielder);    // true (exists, even though undefined)
console.log("toString" in fielder);   // true (inherited)

// Object.hasOwn() checks OWN properties only (ES2022)
console.log(Object.hasOwn(fielder, "catches"));   // true
console.log(Object.hasOwn(fielder, "toString"));   // false

// Don't compare to undefined — fails when value IS undefined
console.log(fielder.runOuts !== undefined); // false <-- WRONG, property exists


// =============================================
// SECTION 6: for...in Loop
// =============================================

const captain = { name: "Rohit Sharma", role: "Opener", matches: 264 };

for (const key in captain) {
  if (Object.hasOwn(captain, key)) {
    console.log(`${key}: ${captain[key]}`);
  }
}
// NOTE: for...in does NOT guarantee order for numeric keys.
// For arrays, use for...of or forEach.


// =============================================
// SECTION 7: Nested Objects
// =============================================

const playerCard = {
  name: "Virat Kohli",
  career: {
    ODI: { matches: 275, runs: 13848, average: 57.32 },
    Test: { matches: 113, runs: 8848, average: 48.03 },
  },
  iplTeam: {
    name: "Royal Challengers Bengaluru",
    awards: ["Orange Cap 2016", "MVP 2016"],
  },
};

console.log(playerCard.career.ODI.average);  // 57.32
console.log(playerCard.iplTeam.awards[1]);   // MVP 2016

// Safe access with optional chaining
console.log(playerCard.career.T20I?.average); // undefined (no crash)


// =============================================
// SECTION 8: Object References & Comparison
// =============================================

// Assignment copies the REFERENCE, not the data
const originalPlayer = { name: "Virat", matches: 237 };
const playerAlias = originalPlayer;
playerAlias.matches = 240;
console.log(originalPlayer.matches); // 240 — BOTH changed

// Two identical objects are NOT equal
const playerA = { name: "Virat" };
const playerB = { name: "Virat" };
console.log(playerA === playerB); // false (different references)

// Shallow copy with spread
const playerCopy = { ...originalPlayer };
playerCopy.matches = 300;
console.log(originalPlayer.matches); // 240 — original safe

// CAUTION: spread is shallow — nested objects are still shared
const deepPlayer = { name: "Virat", career: { runs: 13848 } };
const shallowCopy = { ...deepPlayer };
shallowCopy.career.runs = 0;
console.log(deepPlayer.career.runs); // 0 — nested object shared!

// For deep copies, use structuredClone()
const deepCopy = structuredClone(deepPlayer);
deepCopy.career.runs = 99999;
console.log(deepPlayer.career.runs); // 0 — original preserved


// ============================================================
// KEY TAKEAWAYS
// ------------------------------------------------------------
// 1. Object literals {} create objects. Computed keys [expr]
//    allow dynamic property names.
// 2. Dot notation for simple keys; bracket notation for
//    dynamic/special keys.
// 3. Objects are dynamic — add with assignment, remove with delete.
// 4. ES6 shorthands: { name } and method() {} reduce boilerplate.
// 5. Use "in" or Object.hasOwn() for existence checks —
//    don't compare to undefined.
// 6. Objects are stored BY REFERENCE — assignment copies the
//    reference, not the data. Spread is shallow only.
// ============================================================
