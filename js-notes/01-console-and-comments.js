/**
 * ============================================================
 *  FILE 1 : Console Methods & Comments
 * ============================================================
 *  Topic  : console.log, .warn, .error, .table, .group/.groupEnd,
 *           .time/.timeEnd, .count, .clear, .dir, .assert
 *           Single-line //, multi-line /* */, JSDoc /** */
 *
 *  WHY: The console is your first debugging tool. Comments are
 *  how you leave breadcrumbs for your future self.
 * ============================================================
 */

// STORY: CBI Inspector Sharma is investigating a jewellery heist.
// Every console method is a tool in the inspector's kit.

// ────────────────────────────────────────────────────────────
// SECTION 1 — console.log()  (The inspector's notebook)
// ────────────────────────────────────────────────────────────

const clue1 = "Muddy chappal print near the window";
console.log("Clue found:", clue1);
// Output: Clue found: Muddy chappal print near the window

// Log multiple values at once
const suspectName = "Raju";
const suspectAge = 34;
console.log("Suspect:", suspectName, "| Age:", suspectAge);
// Output: Suspect: Raju | Age: 34

// ────────────────────────────────────────────────────────────
// SECTION 2 — console.warn() & console.error()
// ────────────────────────────────────────────────────────────

console.warn("WARNING: Fingerprint evidence is smudging!");
// (Yellow warning icon in most consoles)

console.error("ERROR: Chain of custody broken for Evidence #7!");
// (Red error icon in most consoles)

// ────────────────────────────────────────────────────────────
// SECTION 3 — console.table()
// ────────────────────────────────────────────────────────────

const evidenceLog = [
  { id: 1, item: "Muddy chappal print",   location: "Window sill" },
  { id: 2, item: "Broken bangles",        location: "Shop floor" },
  { id: 3, item: "Red sindoor smudge",    location: "Door handle" },
];

console.table(evidenceLog);
// Prints a formatted table with columns: id, item, location

// ────────────────────────────────────────────────────────────
// SECTION 4 — console.group() & console.groupEnd()
// ────────────────────────────────────────────────────────────

console.group("Suspect: Raju");
console.log("Motive: Gambling debts");
console.log("Alibi: Claims he was at the chai stall");
console.groupEnd();

// ────────────────────────────────────────────────────────────
// SECTION 5 — console.time() & console.timeEnd()
// ────────────────────────────────────────────────────────────

console.time("evidenceProcessing");
let fingerprintMatches = 0;
for (let i = 0; i < 1_000_000; i++) {
  fingerprintMatches++;
}
console.timeEnd("evidenceProcessing");
// Output: evidenceProcessing: <X>ms

// ────────────────────────────────────────────────────────────
// SECTION 6 — console.count()
// ────────────────────────────────────────────────────────────

console.count("clueDiscovered"); // clueDiscovered: 1
console.count("clueDiscovered"); // clueDiscovered: 2
console.count("deadEnd");        // deadEnd: 1

// ────────────────────────────────────────────────────────────
// SECTION 7 — console.clear()
// ────────────────────────────────────────────────────────────

// console.clear();   // Wipes the console — uncomment to test

// ────────────────────────────────────────────────────────────
// SECTION 8 — console.dir()
// ────────────────────────────────────────────────────────────

const caseFile = {
  caseNumber: 4417,
  inspector: "Sharma",
  status: "Open",
  suspects: ["Raju", "Meena"],
};

console.dir(caseFile, { depth: null });
// Displays the full nested object structure

// ────────────────────────────────────────────────────────────
// SECTION 9 — console.assert()
// ────────────────────────────────────────────────────────────

const evidenceCount = 3;
console.assert(evidenceCount > 0, "We should have at least 1 piece of evidence!");
// (silent — condition is true)

console.assert(evidenceCount > 10, "We need more than 10 pieces!");
// Output: Assertion failed: We need more than 10 pieces!

// ────────────────────────────────────────────────────────────
// SECTION 10 — Comments in JavaScript
// ────────────────────────────────────────────────────────────

// --- 10a: Single-line comments ---
const verdict = "Not guilty"; // inline comment

// --- 10b: Multi-line comments ---
/*
  Multi-line comments are wrapped with slash-star ... star-slash.
  Use them when one line isn't enough.
*/

// --- 10c: JSDoc comments ---
/**
 * Analyses a clue and returns a relevance score.
 * @param {string} clue  - A description of the clue.
 * @param {number} age   - Hours since the clue was found.
 * @returns {number}       Relevance score from 0 to 100.
 */
function analyseClue(clue, age) {
  const freshnessBonus = Math.max(0, 100 - age * 2);
  const lengthScore = Math.min(clue.length, 50);
  return Math.round((freshnessBonus + lengthScore) / 2);
}

console.log("Clue relevance score:", analyseClue("Red sindoor smudge on door handle", 3));
// Output: Clue relevance score: 64

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. console.log()    — Everyday debugging notebook.
// 2. console.warn()   — Yellow flag for non-critical issues.
// 3. console.error()  — Red flag for things that broke.
// 4. console.table()  — Tabular view for arrays/objects.
// 5. console.group()  — Nest related logs; end with groupEnd().
// 6. console.time()   — Start a timer; timeEnd() stops & prints.
// 7. console.count()  — Auto-incrementing label counter.
// 8. console.clear()  — Wipe the console clean.
// 9. console.dir()    — Deep-inspect an object's structure.
// 10. console.assert() — Silent unless the condition is false.
// 11. //               — Single-line comment.
// 12. /* ... */        — Multi-line comment block.
// 13. /** ... */       — JSDoc comment for documenting functions.
// ============================================================
