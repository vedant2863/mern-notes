/**
 * ============================================================
 *  FILE 37 : Mixin, Trait & Symbol-based Protocol
 *  WHERE YOU SEE THIS: React higher-order components, Vue mixins,
 *    Symbol.iterator in for...of loops, lodash merge patterns
 * ============================================================
 */

// STORY: Vaidya Sharma the Ayurveda practitioner combines herbal essences
// into medicines, and stamps them with hidden marks (Symbols) that only
// the vaidya can read.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Mixins
// ────────────────────────────────────────────────────────────
// Inject shared behavior into classes without deep inheritance.

console.log("=== Mixins ===");

var VataEssence = {
  balanceVata: function() { return this.name + " calms vata dosha"; }
};

var PittaEssence = {
  coolPitta: function() { return this.name + " soothes pitta dosha"; }
};

class Medicine {
  constructor(name) { this.name = name; }
}

// Copy methods from mixins onto the prototype
Object.assign(Medicine.prototype, VataEssence, PittaEssence);

var ashwagandha = new Medicine("Ashwagandha Churna");
console.log(ashwagandha.balanceVata());
console.log(ashwagandha.coolPitta());

// Class mixin factory — wraps a base class with extra behavior
function addKaphaBalancing(Base) {
  return class extends Base {
    reduceKapha() { return this.name + " reduces kapha"; }
  };
}

function addRejuvenation(Base) {
  return class extends Base {
    rejuvenate() { return this.name + " promotes rejuvenation"; }
  };
}

// Compose by chaining — each wraps the previous
class BrahmiMedicine extends addRejuvenation(addKaphaBalancing(Medicine)) {}

var brahmi = new BrahmiMedicine("Brahmi Rasayana");
console.log(brahmi.reduceKapha());
console.log(brahmi.rejuvenate());

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Trait Pattern
// ────────────────────────────────────────────────────────────
// Traits declare what they REQUIRE from the host.
// If requirements are missing, it fails early.

console.log("\n=== Traits ===");

function createTrait(name, requires, methods) {
  return { name: name, requires: requires, methods: methods };
}

function applyTraits(target, traits) {
  var errors = [];
  var usedNames = {};

  for (var t = 0; t < traits.length; t++) {
    var trait = traits[t];

    // Check requirements
    for (var r = 0; r < trait.requires.length; r++) {
      var req = trait.requires[r];
      if (typeof target[req] !== "function") {
        errors.push(trait.name + " requires method: " + req);
      }
    }

    // Check conflicts
    var keys = Object.keys(trait.methods);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (usedNames[key]) {
        errors.push("Conflict: " + key + " from both " + usedNames[key] + " and " + trait.name);
      }
      usedNames[key] = trait.name;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors };
  }

  // Apply all methods
  for (var t2 = 0; t2 < traits.length; t2++) {
    var methods = traits[t2].methods;
    var methodKeys = Object.keys(methods);
    for (var m = 0; m < methodKeys.length; m++) {
      target[methodKeys[m]] = methods[methodKeys[m]];
    }
  }

  return { ok: true, errors: [] };
}

var Diagnosable = createTrait("Diagnosable", ["getName"], {
  diagnose: function() { return this.getName() + " is being diagnosed"; }
});

var Prescribable = createTrait("Prescribable", ["getName"], {
  prescribe: function() { return this.getName() + " prescription ready"; }
});

var patient = {
  _name: "Amla Compound",
  getName: function() { return this._name; }
};

var result1 = applyTraits(patient, [Diagnosable, Prescribable]);
console.log("Traits applied:", result1.ok);
console.log(patient.diagnose());

// Fails — target missing getName
var rawHerb = { label: "Neem Leaf" };
var result2 = applyTraits(rawHerb, [Diagnosable]);
console.log("Missing requirement:", result2.errors[0]);

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Symbol-based Protocols
// ────────────────────────────────────────────────────────────
// Symbols are unique keys. JS uses them for iteration and coercion.

console.log("\n=== Symbols ===");

// Make an object iterable with Symbol.iterator
class HerbPouch {
  constructor() {
    this.herbs = ["Ashwagandha", "Tulsi", "Brahmi"];
  }

  [Symbol.iterator]() {
    var index = 0;
    var herbs = this.herbs;
    return {
      next: function() {
        if (index < herbs.length) {
          return { value: herbs[index++], done: false };
        }
        return { done: true };
      }
    };
  }
}

console.log("Herbs:", [...new HerbPouch()].join(", "));

// Symbol as a hidden property key
var BATCH = Symbol("batchNumber");

class StampedMedicine {
  constructor(name, batch) {
    this.name = name;
    this[BATCH] = batch;
  }

  revealMark() {
    return this.name + " batch: " + this[BATCH];
  }
}

var med = new StampedMedicine("Chyawanprash", "AYU-2024-0731");
console.log(med.revealMark());
// Object.keys only sees string keys — symbol is hidden
console.log("Visible keys:", Object.keys(med).join(", "));

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Mixins compose shared behavior — avoid deep inheritance chains.
// 2. Class mixin factories preserve super and instanceof.
// 3. Traits declare requirements and detect conflicts early.
// 4. Symbol.iterator makes objects work in for...of and spread.
// 5. Symbol keys are hidden from Object.keys — like secret stamps.
