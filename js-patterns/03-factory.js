/**
 * ============================================================
 *  FILE 3 : Ramesh Bhaiya's Chai Tapri — Factory Pattern
 *  Topic  : Simple Factory, Factory with Registration
 *  Where you'll see this: React.createElement, Express route handlers
 * ============================================================
 */

// STORY: Ramesh bhaiya makes different chai at his tapri.
// Customers just say what they want — he handles the rest.

console.log("=== FILE 03: Ramesh Bhaiya's Chai Tapri ===\n");

// ────────────────────────────────────
// BLOCK 1 — Simple Factory Function
// ────────────────────────────────────

function makeChai(type, name) {
  const base = { name: name, madeBy: "Ramesh bhaiya" };

  if (type === "masala") {
    base.type = "masala";
    base.strength = 8;
    base.price = 15;
  } else if (type === "cutting") {
    base.type = "cutting";
    base.strength = 7;
    base.price = 10;
  } else if (type === "kulhad") {
    base.type = "kulhad";
    base.strength = 9;
    base.price = 20;
    base.vessel = "kulhad";
  } else {
    throw new Error("Ramesh bhaiya cannot make unknown chai: " + type);
  }

  return base;
}

const masala = makeChai("masala", "Adrak Special");
const cutting = makeChai("cutting", "Tapri Cutting");

console.log("Masala:", masala.name, "| strength:", masala.strength);
console.log("Cutting:", cutting.name, "| price: ₹" + cutting.price);

try {
  makeChai("bubble", "Mystery");
} catch (err) {
  console.log("Error:", err.message);
}

// ────────────────────────────────────
// BLOCK 2 — Factory with Registration (Dynamic Types)
// ────────────────────────────────────

// New types can be added at runtime without editing the factory.

console.log("\n--- Registered Factory ---");

class ChaiRegistry {
  constructor() {
    this.creators = new Map();
  }

  register(type, creatorFn) {
    this.creators.set(type, creatorFn);
    console.log("Ramesh bhaiya learned to brew: " + type);
  }

  create(type, name) {
    const creator = this.creators.get(type);
    if (!creator) {
      throw new Error("Unknown chai type: " + type);
    }
    return creator(name);
  }

  listTypes() {
    const types = [];
    for (const key of this.creators.keys()) {
      types.push(key);
    }
    return types;
  }
}

const registry = new ChaiRegistry();

registry.register("masala", function (name) {
  return { name: name, type: "masala", strength: 8, price: 15 };
});

registry.register("cutting", function (name) {
  return { name: name, type: "cutting", strength: 7, price: 10 };
});

// A plugin adds a new type at runtime
registry.register("sulaimani", function (name) {
  return { name: name, type: "sulaimani", strength: 6, price: 25 };
});

const myMasala = registry.create("masala", "Kadak Masala");
const mySulaimani = registry.create("sulaimani", "Kerala Sulaimani");

console.log("Created:", myMasala.name, "₹" + myMasala.price);
console.log("Created:", mySulaimani.name, "₹" + mySulaimani.price);
console.log("Available:", registry.listTypes());

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Simple Factory returns different objects based on a parameter.
// 2. Registration-based factories allow runtime extension (Open/Closed Principle).
// 3. Factories centralise creation — no scattered "new" calls everywhere.
// 4. If you write "if type === x, create X" in many places, use a factory.

console.log("\n=== Ramesh bhaiya washes the kettle. Another day of fine chai. ===");
