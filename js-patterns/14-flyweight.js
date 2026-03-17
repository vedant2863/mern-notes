/**
 * ============================================================
 *  FILE 14 : The Flyweight Pattern
 *  Topic   : Flyweight, Shared State Optimization
 *  Impact  : Text editors, game engines (shared sprites),
 *            React internals (shared fiber objects)
 * ============================================================
 */

// STORY: Compositor Ravi ji runs the press room at Dainik Jagran.
// Instead of casting a fresh letter block for every character,
// he casts ONE block per letter and reuses it across every page.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Classic Flyweight (shared formatting objects)
// ────────────────────────────────────────────────────────────

class AksharaStyle {
  constructor(typeface, size, color) {
    this.typeface = typeface;
    this.size = size;
    this.color = color;
  }

  apply(char, row, col) {
    return "'" + char + "' at (" + row + "," + col + ") [" +
      this.typeface + " " + this.size + "px " + this.color + "]";
  }
}

// Factory ensures only one instance per unique combo
class StyleFactory {
  constructor() {
    this.cache = new Map();
  }

  getStyle(typeface, size, color) {
    let key = typeface + "-" + size + "-" + color;
    if (!this.cache.has(key)) {
      this.cache.set(key, new AksharaStyle(typeface, size, color));
    }
    return this.cache.get(key);
  }

  getCount() {
    return this.cache.size;
  }
}

console.log("=== BLOCK 1: Classic Flyweight ===");
let factory = new StyleFactory();

let chars = [
  { char: "A", row: 0, col: 0, typeface: "Mangal", size: 12, color: "black" },
  { char: "B", row: 0, col: 1, typeface: "Mangal", size: 12, color: "black" },
  { char: "C", row: 0, col: 2, typeface: "Mangal", size: 12, color: "black" },
  { char: "D", row: 0, col: 3, typeface: "Krutidev", size: 16, color: "red" },
  { char: "E", row: 1, col: 0, typeface: "Mangal", size: 12, color: "black" },
  { char: "F", row: 1, col: 1, typeface: "Krutidev", size: 16, color: "red" },
];

for (let i = 0; i < chars.length; i++) {
  let c = chars[i];
  let style = factory.getStyle(c.typeface, c.size, c.color);
  console.log(style.apply(c.char, c.row, c.col));
}

console.log("Chars rendered: " + chars.length + ", Style objects created: " + factory.getCount());

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Scale Test: 1000 characters, 3 shared blocks
// ────────────────────────────────────────────────────────────

class LetterBlock {
  constructor(letter) {
    this.letter = letter;
    // Simulate heavy shared data
    this.blockData = "BLOCK_" + letter + "_HEAVY_DATA";
  }
}

class BlockFactory {
  constructor() {
    this.blocks = new Map();
  }

  getBlock(letter) {
    if (!this.blocks.has(letter)) {
      this.blocks.set(letter, new LetterBlock(letter));
    }
    return this.blocks.get(letter);
  }

  getCount() {
    return this.blocks.size;
  }
}

console.log("\n=== BLOCK 2: Scale Test ===");
let blockFactory = new BlockFactory();

let letterTypes = ["A", "K", "M"];
for (let i = 0; i < 1000; i++) {
  let index = i % 3;
  blockFactory.getBlock(letterTypes[index]);
}

console.log("Total chars: 1000, Block objects in memory: " + blockFactory.getCount());

let b1 = blockFactory.getBlock("A");
let b2 = blockFactory.getBlock("A");
console.log("Same reference? " + (b1 === b2));

let saved = ((1 - 3 / 1000) * 100).toFixed(1);
console.log("Memory saved: " + saved + "%");

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Flyweight splits state into shared (intrinsic) and unique (extrinsic).
// 2. A factory/pool ensures only one object per unique combination.
// 3. Massive memory savings when thousands of objects share common data.
// 4. Caller passes unique data at call time — the flyweight stays immutable.
