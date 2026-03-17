/**
 * ============================================================
 *  FILE 24: The `new` Keyword and Constructor Functions
 * ============================================================
 *  Topic: How JavaScript creates objects using constructors
 *         and the `new` operator.
 * ============================================================
 *
 *  STORY: Imagine a Tata Motors Factory. The constructor is
 *  the assembly blueprint. Every time you press the `new`
 *  button, the factory stamps out a new car with its own
 *  chassis number, but all cars share the same workshop
 *  tools (prototype methods).
 * ============================================================
 */

// ============================================================
//  BLOCK 1 — Constructor Functions and `new`
// ============================================================

// Constructors are regular functions invoked with `new`.
// PascalCase signals "call me with new!"

function TataCar(chassisNumber, modelName) {
  this.chassisNumber = chassisNumber;
  this.modelName = modelName;
  this.fuelLevel = 100;
}

// Shared methods live on the prototype, NOT on each instance.
TataCar.prototype.status = function () {
  return `Tata ${this.modelName} #${this.chassisNumber} | Fuel: ${this.fuelLevel}%`;
};

TataCar.prototype.drive = function (hours) {
  this.fuelLevel = Math.max(0, this.fuelLevel - hours * 10);
  return `Driven ${hours}h. Fuel now ${this.fuelLevel}%`;
};

console.log("--- The Tata Motors Factory ---");
const car1 = new TataCar("MH-101", "Nexon");
const car2 = new TataCar("DL-202", "Harrier");

console.log(car1.status());
console.log(car2.drive(3));
console.log(car1.drive === car2.drive); // true — shared

// ----- What `new` does — 4 steps -----
// 1. Creates a brand-new empty object: {}
// 2. Links its [[Prototype]] to TataCar.prototype
// 3. Calls TataCar() with `this` bound to the new object
// 4. Returns the object automatically (if no explicit return)

// Manual simulation:
console.log("\n--- Manual simulation of `new` ---");
const manualCar = Object.create(TataCar.prototype);
TataCar.call(manualCar, "GJ-303", "Tiago");
console.log(manualCar.status());


// ============================================================
//  BLOCK 2 — Gotchas and Alternatives
// ============================================================

// --- new.target guard ---
console.log("\n--- new.target guard ---");

function SafeCar(id, model) {
  if (!new.target) {
    console.log("Warning: called without `new`. Auto-correcting...");
    return new SafeCar(id, model);
  }
  this.id = id;
  this.model = model;
}

const oops = SafeCar("RJ-404", "Punch"); // no `new`!
console.log(oops.id, oops.model);

// --- instanceof ---
console.log("\n--- instanceof ---");
console.log(car1 instanceof TataCar);  // true
console.log(oops instanceof SafeCar);  // true

// --- Factory function alternative ---
console.log("\n--- Factory function ---");

function createAutoRickshaw(id, route) {
  return {
    id,
    route,
    run() { return `Auto ${this.id} on ${this.route} route`; },
  };
}

const auto1 = createAutoRickshaw("UP-1", "Lucknow-Kanpur");
console.log(auto1.run());

// SECTION — Comparison table
//  Feature             | Constructor + new     | Factory function
//  --------------------|-----------------------|------------------
//  Invocation          | new TataCar()         | createAutoRickshaw()
//  Prototype methods   | shared (memory-lean)  | per-instance
//  instanceof works?   | yes                   | no
//  Forgetting `new`    | bugs!                 | no issue


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. Constructors are regular functions called with `new`.
//    Name them PascalCase by convention.
// 2. `new` does 4 things: create obj, link prototype,
//    bind this, return the object.
// 3. Forgetting `new` causes global pollution or TypeError.
//    Use new.target to guard against it.
// 4. Factory functions are simpler — no `new`, no `this`,
//    but methods aren't shared via prototype.
// 5. ES6 classes are syntactic sugar over this mechanism.
// ============================================================
