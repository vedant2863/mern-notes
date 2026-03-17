/**
 * ============================================================
 *  FILE 6 : The Jaipur Block Printer — Prototype Pattern
 *  Topic  : Prototype, Cloning, Deep vs Shallow Copy
 *  Where you'll see this: Object.create, spread operator, structuredClone
 * ============================================================
 */

// STORY: Artisan Meena carves master wooden blocks in Jaipur, then
// clones them to produce variations — faster than carving from scratch.

console.log("=== FILE 06: The Jaipur Block Printer ===\n");

// ────────────────────────────────────
// BLOCK 1 — Prototype via Object.create
// ────────────────────────────────────

const masterBlock = {
  material: "teak wood",
  ink: "none",

  describe() {
    const name = this.name || "Unnamed";
    return name + " — material: " + this.material + ", ink: " + this.ink;
  },

  clone() {
    const copy = Object.create(Object.getPrototypeOf(this));
    const keys = Object.getOwnPropertyNames(this);
    for (let i = 0; i < keys.length; i++) {
      copy[keys[i]] = this[keys[i]];
    }
    return copy;
  },
};

const originalBlock = Object.create(masterBlock);
originalBlock.name = "Meena's Paisley";
originalBlock.motifSize = 30;

console.log("--- Block 1: Prototype via Object.create ---");
console.log(originalBlock.describe());

const clonedBlock = originalBlock.clone();
clonedBlock.name = "Cloned Paisley";
clonedBlock.ink = "indigo";

console.log(clonedBlock.describe());
console.log("Original unchanged:", originalBlock.ink); // none

// ────────────────────────────────────
// BLOCK 2 — Deep Clone vs Shallow Clone
// ────────────────────────────────────

console.log("\n--- Block 2: Deep Clone vs Shallow Clone ---");

const blockDesign = {
  name: "Lotus Motif",
  dimensions: { width: 40, height: 60 },
  inkPalette: ["indigo", "turmeric yellow"],
};

// Shallow clone — nested objects are SHARED
const shallowCopy = Object.assign({}, blockDesign);
shallowCopy.dimensions.height = 100;
console.log("Original height after shallow mutation:", blockDesign.dimensions.height); // 100 — oops!

// Deep clone — nested objects are independent
blockDesign.dimensions.height = 60; // reset
const deepCopy = structuredClone(blockDesign);
deepCopy.dimensions.height = 300;
deepCopy.inkPalette.push("pomegranate red");

console.log("Original height after deep mutation:", blockDesign.dimensions.height); // 60 — safe!
console.log("Original palette:", blockDesign.inkPalette.join(", "));
console.log("Deep copy palette:", deepCopy.inkPalette.join(", "));

// ────────────────────────────────────
// BLOCK 3 — Prototype Chain with Classes
// ────────────────────────────────────

// ES6 classes are syntactic sugar over prototypes.

console.log("\n--- Block 3: Prototype Chain ---");

class FabricArt {
  constructor(title) { this.title = title; }
  getTitle() { return "Art: " + this.title; }
}

class BlockPrint extends FabricArt {
  constructor(title, material) {
    super(title);
    this.material = material;
  }
  getMaterial() { return "Material: " + this.material; }
}

const meenaPrint = new BlockPrint("Meena's Paisley", "teak wood");
console.log(meenaPrint.getTitle());
console.log(meenaPrint.getMaterial());

// Walk the prototype chain
let proto = Object.getPrototypeOf(meenaPrint);
const chain = [];
while (proto !== null) {
  chain.push(proto.constructor.name);
  proto = Object.getPrototypeOf(proto);
}
console.log("Prototype chain:", chain.join(" -> "));

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Prototype pattern clones existing objects instead of building from scratch.
// 2. Shallow clones share nested references — use structuredClone for safety.
// 3. ES6 classes are sugar over JavaScript's prototype-based inheritance.
// 4. Every prototype chain ends at Object.prototype -> null.
