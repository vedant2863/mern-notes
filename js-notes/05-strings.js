/**
 * ============================================================
 *  FILE 5 : Strings
 * ============================================================
 *  Topic  : Creation, immutability, length, charAt, at, case,
 *           searching, slicing, replacing, splitting, trimming,
 *           padding, repeating, regex methods, iteration.
 *
 *  WHY: Text is the most common data format. Mastering string
 *  methods means you can search, transform, and validate with
 *  confidence.
 * ============================================================
 */

// STORY: RAW Agent Vikram decodes intercepted messages using
// JavaScript string operations.

// ────────────────────────────────────────────────────────────
// SECTION 1 — String Creation & Immutability
// ────────────────────────────────────────────────────────────

const codeName = "Baaz";
const templateName = `Agent ${codeName}`;
console.log(templateName); // Agent Baaz

// Strings are IMMUTABLE
let intercepted = "HELLO";
intercepted[0] = "J";       // silently fails
console.log(intercepted);   // HELLO (unchanged)

// ────────────────────────────────────────────────────────────
// SECTION 2 — .length, .charAt(), .at(), Bracket Access
// ────────────────────────────────────────────────────────────

const secretCode = "TRIDENT";
console.log(secretCode.length);     // 7
console.log(secretCode.charAt(0));  // T
console.log(secretCode.at(-1));     // T  (.at() supports negatives!)
console.log(secretCode[3]);         // D

// ────────────────────────────────────────────────────────────
// SECTION 3 — Case Conversion
// ────────────────────────────────────────────────────────────

const raw = "ThE PaKiStAn LiNk Is AcTiVe";
console.log(raw.toUpperCase()); // THE PAKISTAN LINK IS ACTIVE
console.log(raw.toLowerCase()); // the pakistan link is active

// ────────────────────────────────────────────────────────────
// SECTION 4 — Searching Methods
// ────────────────────────────────────────────────────────────

const message = "The drop point is at Gate 7. Repeat: Gate 7.";

console.log(message.indexOf("Gate"));      // 21
console.log(message.lastIndexOf("Gate"));  // 37
console.log(message.indexOf("Pier"));      // -1
console.log(message.includes("drop"));     // true
console.log(message.startsWith("The"));    // true
console.log(message.endsWith("7."));       // true

// ────────────────────────────────────────────────────────────
// SECTION 5 — Extracting Substrings
// ────────────────────────────────────────────────────────────

const intel = "CLASSIFIED: Operation Trishul Dawn";

console.log(intel.slice(0, 10));  // CLASSIFIED
console.log(intel.slice(12));     // Operation Trishul Dawn
console.log(intel.slice(-4));     // Dawn

// ────────────────────────────────────────────────────────────
// SECTION 6 — Replacing Text
// ────────────────────────────────────────────────────────────

const report = "Agent Vikram met Agent Vikram at the safe house.";

console.log(report.replace("Vikram", "Arjun"));
// Agent Arjun met Agent Vikram at the safe house. (first only)

console.log(report.replaceAll("Vikram", "Arjun"));
// Agent Arjun met Agent Arjun at the safe house. (all)

// ────────────────────────────────────────────────────────────
// SECTION 7 — Splitting & Joining
// ────────────────────────────────────────────────────────────

const orders = "move-north|hold-position|extract-asset";
const orderList = orders.split("|");
console.log(orderList);             // [ 'move-north', 'hold-position', 'extract-asset' ]
console.log(orderList.join(" -> ")); // move-north -> hold-position -> extract-asset

// ────────────────────────────────────────────────────────────
// SECTION 8 — Trimming Whitespace
// ────────────────────────────────────────────────────────────

const dirtyInput = "   safehouse location   ";
console.log(dirtyInput.trim());      // 'safehouse location'
console.log(dirtyInput.trimStart()); // 'safehouse location   '
console.log(dirtyInput.trimEnd());   // '   safehouse location'

// ────────────────────────────────────────────────────────────
// SECTION 9 — Repeat, Pad
// ────────────────────────────────────────────────────────────

console.log("-".repeat(30));                       // ------------------------------
console.log("42".padStart(6, "0"));                // 000042
console.log("Agent".padEnd(12, "."));              // Agent.......

// ────────────────────────────────────────────────────────────
// SECTION 10 — Regex Methods: .match(), .search()
// ────────────────────────────────────────────────────────────

const transmission = "Coordinates: 28.6139N, 77.2090E at 0300 hours";
console.log(transmission.search(/\d+\.\d+/));            // 13
console.log(transmission.match(/\d+\.\d+[A-Z]/g));       // [ '28.6139N', '77.2090E' ]

// ────────────────────────────────────────────────────────────
// SECTION 11 — .localeCompare()
// ────────────────────────────────────────────────────────────

const agents = ["dhruv", "arjun", "chandra", "bheem"];
agents.sort((a, b) => a.localeCompare(b));
console.log(agents); // [ 'arjun', 'bheem', 'chandra', 'dhruv' ]

// ────────────────────────────────────────────────────────────
// SECTION 12 — String Iteration with for...of
// ────────────────────────────────────────────────────────────

const cipherText = "XRAY";
let decoded = "";
for (const char of cipherText) {
  decoded += String.fromCharCode(char.charCodeAt(0) + 1);
}
console.log("Shifted +1:", decoded); // YSBZ

// Unicode-safe: for...of counts emoji as 1 character
const flagMessage = "GO\u{1F680}NOW";
console.log(flagMessage.length);              // 7 (misleading — emoji = 2 code units)
console.log([...flagMessage].length);         // 6 (true character count)

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1.  Strings are IMMUTABLE — every method returns a NEW string.
// 2.  .at(-1) is the cleanest way to get the last character.
// 3.  .includes/.startsWith/.endsWith return booleans;
//     .indexOf gives position or -1.
// 4.  .slice() supports negatives — prefer over .substring().
// 5.  .replace() hits first match; .replaceAll() hits all.
// 6.  .split() -> array; .join() -> string.
// 7.  .trim() removes whitespace — essential for user input.
// 8.  .padStart/.padEnd for fixed-width formatting.
// 9.  .match/.search unlock regex-powered extraction.
// 10. for...of is the Unicode-safe way to iterate characters.
// ============================================================
