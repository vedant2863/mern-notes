/**
 * ============================================================
 *  FILE 25: Prototypes and the Prototype Chain
 * ============================================================
 *  Topic: How JavaScript objects delegate property lookups
 *         through the prototype chain.
 * ============================================================
 *
 *  STORY: The Kapoor Khandaan. Grandfather Prithviraj knows
 *  ancient recipes. Father Raj adds business skills. Son Ranbir
 *  adds filmmaking. When Ranbir is asked to cook, he walks up
 *  the family tree until Prithviraj handles it.
 * ============================================================
 */

// ============================================================
//  BLOCK 1 — The Kapoor Khandaan (Prototype Chain)
// ============================================================

// Property lookup works by delegation — if an object doesn't
// have a property, the engine walks up the chain to null.

const prithviraj = {
  name: "Prithviraj",
  cookTraditionalDish() {
    return `${this.name} cooks an ancient family recipe!`;
  },
};

const raj = Object.create(prithviraj);
raj.name = "Raj";
raj.runBusiness = function () {
  return `${this.name} runs the family business!`;
};

const ranbir = Object.create(raj);
ranbir.name = "Ranbir";
ranbir.makeFilm = function () {
  return `${this.name} directs a blockbuster!`;
};

console.log("--- The Kapoor Khandaan ---");
console.log(ranbir.makeFilm());           // own
console.log(ranbir.runBusiness());         // from raj
console.log(ranbir.cookTraditionalDish()); // from prithviraj

// Chain: ranbir -> raj -> prithviraj -> Object.prototype -> null
console.log(Object.getPrototypeOf(ranbir) === raj);              // true
console.log(Object.getPrototypeOf(prithviraj) === Object.prototype); // true
console.log(Object.getPrototypeOf(Object.prototype));            // null


// ============================================================
//  BLOCK 2 — __proto__ vs .prototype, Own vs Inherited
// ============================================================

// __proto__  : on every object, points to its prototype
// .prototype : on functions only, becomes __proto__ of
//              instances made with `new`

console.log("\n--- __proto__ vs .prototype ---");

function Pahalwan(name) {
  this.name = name;
}
Pahalwan.prototype.warCry = function () {
  return `${this.name}: "Jai Bajrang Bali!"`;
};

const bheem = new Pahalwan("Bheem");
console.log(Object.getPrototypeOf(bheem) === Pahalwan.prototype); // true
console.log(bheem.warCry());

// --- hasOwnProperty vs `in` ---
console.log("\n--- hasOwnProperty vs in ---");
console.log(bheem.hasOwnProperty("name"));    // true  (own)
console.log(bheem.hasOwnProperty("warCry"));   // false (inherited)
console.log("warCry" in bheem);                // true  (found up chain)

console.log("Object.keys(bheem):", Object.keys(bheem)); // ['name']


// ============================================================
//  SECTION — Property Shadowing & Built-in Prototypes
// ============================================================

console.log("\n--- Property shadowing ---");
const ancestor = Object.create(prithviraj);
ancestor.name = "Kapoor Ancestor";

const descendant = Object.create(ancestor);
descendant.name = "Kapoor Descendant";

console.log(descendant.name);  // "Kapoor Descendant" (own)
delete descendant.name;
console.log(descendant.name);  // "Kapoor Ancestor" (inherited)
descendant.name = "Kapoor Descendant"; // restore

// Never modify built-in prototypes (Array.prototype, etc.)
// in production — causes collisions and subtle bugs.

// Object.setPrototypeOf() works but is SLOW.
// Prefer Object.create() when possible.


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. Every object has a [[Prototype]] link. Lookups walk this
//    chain until found or null is reached.
// 2. __proto__ is the link on an instance. .prototype is on
//    functions — becomes __proto__ of `new`-created objects.
// 3. hasOwnProperty() checks only the object. `in` checks
//    the entire prototype chain.
// 4. Object.create(proto) — cleanest way to set up inheritance.
// 5. Property shadowing: setting on child hides the inherited
//    one without modifying the parent.
// 6. Never modify built-in prototypes in production.
// ============================================================
