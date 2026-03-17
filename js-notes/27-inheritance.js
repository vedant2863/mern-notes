/**
 * ============================================================
 *  FILE 27: Class Inheritance (extends & super)
 * ============================================================
 *  Topic: Building class hierarchies with extends, super,
 *         and composing behavior with mixins.
 * ============================================================
 *
 *  STORY: The Indian Government Service Hierarchy. All officers
 *  share a base (SarkariNaukri). Services branch out: IAS adds
 *  district management, IPS adds law enforcement. Each child
 *  extends its parent, overriding and adding abilities.
 * ============================================================
 */

// ============================================================
//  BLOCK 1 — The Government Service Hierarchy
// ============================================================

class SarkariNaukri {
  constructor(name, service) {
    this.name = name;
    this.service = service;
  }

  describe() {
    return `${this.name} is a ${this.service}`;
  }

  attendTraining(course) {
    return `${this.name} attends ${course}`;
  }
}

class CivilServant extends SarkariNaukri {
  constructor(name, service, cadre) {
    super(name, service); // MUST call before `this`
    this.cadre = cadre;
  }

  administerDistrict() {
    return `${this.name} administers the ${this.cadre} cadre`;
  }

  describe() {
    return `${super.describe()} with ${this.cadre} cadre`;
  }
}

class IAS extends CivilServant {
  constructor(name, cadre, postingState) {
    super(name, "IAS Officer", cadre);
    this.postingState = postingState;
  }

  describe() {
    return `${super.describe()} posted in ${this.postingState}`;
  }
}

console.log("--- Government Service Hierarchy ---");
const collector = new IAS("Sharma Ji", "UP", "Uttar Pradesh");
console.log(collector.describe());
console.log(collector.attendTraining("LBSNAA Foundation Course"));

// instanceof walks the whole chain
console.log(collector instanceof IAS);           // true
console.log(collector instanceof CivilServant);   // true
console.log(collector instanceof SarkariNaukri);  // true


// ============================================================
//  BLOCK 2 — Mixins: Composing Abilities
// ============================================================

// JS supports single inheritance only. Mixins let you
// "mix in" methods from multiple sources.

console.log("\n--- Mixins ---");

const DiplomaticSkill = (Base) =>
  class extends Base {
    negotiate() {
      return `${this.name} negotiates a bilateral treaty`;
    }
  };

const CyberSkill = (Base) =>
  class extends Base {
    traceOnline(target) {
      return `${this.name} traces ${target} digitally`;
    }
  };

class IFS extends CyberSkill(DiplomaticSkill(SarkariNaukri)) {
  constructor(name) {
    super(name, "IFS Officer");
  }
}

const ambassador = new IFS("Mehra Ji");
console.log(ambassador.describe());
console.log(ambassador.negotiate());
console.log(ambassador.traceOnline("a foreign network"));
console.log(ambassador instanceof SarkariNaukri); // true

// SECTION — When NOT to use inheritance
// Use inheritance for "is-a" relationships.
// Prefer composition/mixins for "has-a" or "can-do".
// Deep hierarchies (5+ levels) become brittle.


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. `extends` sets up prototypal inheritance between classes.
// 2. `super()` in the constructor calls the parent — MUST
//    be called before using `this` in a child class.
// 3. `super.method()` calls the parent version of an
//    overridden method.
// 4. `instanceof` walks the whole prototype chain.
// 5. Use mixin pattern (functions returning subclasses) to
//    compose behavior from multiple sources.
// 6. Favor composition over inheritance for "can-do" abilities.
// ============================================================
