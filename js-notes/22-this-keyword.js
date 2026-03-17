/**
 * ============================================================
 *  FILE 22: The `this` Keyword
 *  Topic: How JavaScript determines `this` in different contexts
 *  Why: `this` is one of the most misunderstood parts of JS.
 *       Mastering it prevents bugs where methods lose context.
 * ============================================================
 *
 *  STORY: Ranveer the Bollywood actor takes on a different
 *  persona depending on which stage he performs on.
 * ============================================================
 */

// ============================================================
//  EXAMPLE 1 — Ranveer on Different Stages
// ============================================================

// `this` is decided when a function is CALLED, not when written.

// --- Global context ---
// Node module scope: this === {} (module.exports)
// Browser: this === window
console.log(this);

// --- Regular function: sloppy vs strict ---
function sloppyFn() { return typeof this; }    // "object" (global)
function strictFn() { "use strict"; return this; } // undefined

console.log(sloppyFn()); // object
console.log(strictFn()); // undefined

// --- Method call: this = owning object ---
const film = {
  name: "Bajirao Mastani",
  lead: "Ranveer",
  introduce() {
    return `${this.lead} performs in ${this.name}`;
  },
};
console.log(film.introduce()); // Ranveer performs in Bajirao Mastani

// --- Arrow function: inherits this from enclosing scope ---
const director = {
  name: "Sanjay Leela Bhansali",
  cast: ["Ranveer", "Deepika", "Priyanka"],
  announceCast() {
    this.cast.forEach((actor) => {
      console.log(`${this.name} introduces ${actor}`);
    });
  },
};
director.announceCast();


// ============================================================
//  EXAMPLE 2 — Classic Gotchas
// ============================================================

// --- Nested function loses this ---
const filmSet = {
  crew: "Spot Boys",
  prepareProps() {
    // Regular nested function: this is global/undefined
    function arrangeChairs() {
      console.log(`Inner this.crew: ${this?.crew}`); // undefined
    }
    arrangeChairs();

    // Fix: arrow function inherits this
    const arrangeLights = () => {
      console.log(`Arrow this.crew: ${this.crew}`); // Spot Boys
    };
    arrangeLights();
  },
};
filmSet.prepareProps();

// --- Detached method ---
const actor = {
  name: "Ranveer",
  bow() { return `${this.name} takes a bow`; },
};
const detachedBow = actor.bow;
// this is now global/undefined — context lost!
try {
  console.log(detachedBow());
} catch (e) {
  console.log("TypeError — lost context");
}


// ============================================================
//  EXAMPLE 3 — setTimeout and Event Handlers
// ============================================================

const ad = {
  name: "Rohit",
  cueWithDelay() {
    // Regular fn in setTimeout: this = global
    setTimeout(function () {
      console.log(`Regular fn: ${this?.name || "LOST CONTEXT"}`);
    }, 100);

    // Arrow fn preserves this
    setTimeout(() => {
      console.log(`Arrow fn: ${this.name}`); // Rohit
    }, 200);
  },
};
ad.cueWithDelay();

// DOM event handlers (conceptual):
// Regular fn: this = the element that received the event.
// Arrow fn: this = the enclosing lexical scope.


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. `this` is determined by HOW a function is called,
//    not where it is written (except arrow functions).
// 2. Method call (obj.fn()) => this is obj.
// 3. Plain call (fn()) => this is global (sloppy) or
//    undefined (strict).
// 4. Arrow functions capture `this` from enclosing scope.
// 5. setTimeout, detached methods, and nested functions
//    are the classic traps — fix with arrow or bind().
// 6. DOM events: this = element (regular fn) or
//    surrounding scope (arrow fn).
// ============================================================
