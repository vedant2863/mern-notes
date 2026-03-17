// ============================================================
// FILE 13: STRING INTERNALS IN V8
// Topic: How V8 stores, optimizes, and manipulates strings internally
// WHY: Strings are the most common data type in web apps. V8 uses
// 5+ internal representations to avoid copying. Some ops are O(1),
// others silently trigger expensive O(n) flattening.
// ============================================================

// ============================================================
// SECTION 1 — Strings Are UTF-16 Code Units, Not Characters
// Story: Zomato manages 500K+ restaurant listings. Every name,
// review, and search query is a string processed by V8.
// ============================================================

const restaurantName = "Zomato";
console.log("Length (code units):", restaurantName.length);  // 6

// Immutability: every "modification" creates a new string
let greeting = "Hello";
greeting[0] = "J";  // Silently fails
console.log("After mutation attempt:", greeting);  // Still "Hello"

// ============================================================
// SECTION 2 — Surrogate Pairs: Why emoji.length === 2
// Story: Reviewers use emoji ratings. UTF-16 uses 2 code units
// (4 bytes) for emoji, breaking .length expectations.
// ============================================================

const emoji = "😀";
console.log("emoji.length:", emoji.length);  // 2 (NOT 1!)

//   U+1F600 → High surrogate 0xD83D + Low surrogate 0xDE00
//   In memory: [ 0xD83D ][ 0xDE00 ] → .length sees 2 code units

console.log("codePointAt(0):", emoji.codePointAt(0).toString(16));  // 1f600

// for...of iterates code POINTS correctly
const review = "Great 👨‍🍳🔥";
console.log(".length:", review.length, "spread count:", [...review].length);

// ============================================================
// SECTION 3 — V8 Internal String Types
// Story: When Zomato builds a restaurant page, V8 uses 5+
// internal string types to defer expensive byte copying.
// ============================================================

// WHY: This is the core insight — different representations
// explain why some patterns are fast and others hit cliffs.

//   String (abstract)
//   ├── SeqString       → flat chars in memory (OneByte or TwoByte)
//   ├── ConsString      → tree node: left + right pointers
//   ├── SlicedString    → parent + offset + length
//   ├── ThinString      → redirect after flattening
//   └── ExternalString  → data outside V8 heap

// 1. SeqString: flat array
const seq = "Biryani Paradise";  // SeqOneByteString (ASCII, 1 byte/char)
console.log("ASCII → SeqOneByteString (saves 50% vs TwoByte)");

// 2. ConsString: O(1) concat via tree node — NO bytes copied
const concatenated = "Zomato - " + "Order Food Online";  // ConsString
console.log("Concat → ConsString tree node, O(1)");

// 3. SlicedString: O(1) substring, shares parent memory
const fullAddress = "123 MG Road, Bengaluru, Karnataka 560001";
const city = fullAddress.substring(14, 23);  // { parent, offset:14, length:9 }
console.log("substring →", city, "(CAVEAT: keeps entire parent alive!)");

// ============================================================
// SECTION 4 — String Interning
// Story: Common words like "biryani" appear thousands of times
// in Zomato's search index. V8 stores them just ONCE.
// ============================================================

// WHY: Interning makes === comparison O(1) — just compare
// memory pointers instead of every character.

const tag1 = "biryani";
const tag2 = "biryani";  // Same pointer as tag1
console.log("tag1 === tag2:", tag1 === tag2);  // true (pointer comparison)

// ============================================================
// SECTION 5 — ConsString Flattening Cost
// Story: Building a review by concat creates a ConsString tree.
// First character access forces O(n) flattening — the hidden cost.
// ============================================================

let reviewText = "";
for (const s of ["Amazing! ", "Generous. ", "On-time. ", "Five stars! "]) {
    reviewText += s;  // ConsString tree, no bytes copied
}
const firstChar = reviewText[0];  // Forces O(n) flattening!
console.log("reviewText[0]:", firstChar, "→ FLATTENED entire tree");

// ============================================================
// SECTION 6 — Unicode Normalization
// Story: "cafe" with combining accent vs precomposed character
// look identical but aren't equal without normalization.
// ============================================================

const precomposed = "\u00E9";   // e (precomposed, length 1)
const decomposed = "e\u0301";  // e + combining accent (length 2)
console.log("Strict equal:", precomposed === decomposed);  // false!
console.log("NFC equal:", precomposed.normalize("NFC") === decomposed.normalize("NFC"));  // true

// ============================================================
// SECTION 7 — Performance: Join vs Concat
// Story: The right string-building strategy matters at scale.
// ============================================================

const iterations = 10000;
function concatMethod() { let r = ""; for (let i = 0; i < iterations; i++) r += "item-" + i + ", "; return r; }
function joinMethod() { const p = []; for (let i = 0; i < iterations; i++) p.push("item-" + i); return p.join(", "); }

console.time("Concat (+=)"); concatMethod(); console.timeEnd("Concat (+=)");
console.time("Array.join()"); joinMethod(); console.timeEnd("Array.join()");

// ============================================================
// SECTION 8 — Safe Surrogate Handling
// Story: Truncating strings with emoji must not split surrogate
// pairs, or you get broken characters.
// ============================================================

function safeTruncate(str, max) {
    const pts = [...str];
    return pts.length <= max ? str : pts.slice(0, max).join("") + "...";
}
console.log(safeTruncate("Love this place! 🍕🔥 Best pizza!", 20));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. JS strings are immutable UTF-16 code units, NOT characters.
//    Emoji use 2 code units (surrogate pairs).
//
// 2. V8 has 5+ string types: SeqString (flat), ConsString (tree
//    for O(1) concat), SlicedString (O(1) substring).
//
// 3. ConsString concat is O(1), but first char access forces
//    O(n) flattening. SlicedString keeps parent alive.
//
// 4. String interning: identical short strings share memory,
//    making === comparison O(1).
//
// 5. Use for...of or spread for correct Unicode iteration.
//    Use .normalize("NFC") before comparing accented strings.
//
// 6. Array.join() often wins for building from many pieces.
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("FILE 13 COMPLETE — String Internals");
console.log("=".repeat(60));
