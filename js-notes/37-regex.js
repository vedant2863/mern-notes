/**
 * ============================================================
 *  FILE 37: REGULAR EXPRESSIONS (REGEX)
 * ============================================================
 *  Creating patterns, flags, methods, character classes,
 *  quantifiers, groups, lookaheads/lookbehinds, and
 *  practical patterns (email, URL, dates).
 *
 *  STORY — Operator Meena at the Aadhaar Verification Center
 *  Every document (string) is scanned against a pattern
 *  (regex). Meena uses different tools (methods) with
 *  different flags to verify citizen information.
 * ============================================================
 */

console.log("=== FILE 37: Regular Expressions ===\n");

// ============================================================
//  BLOCK 1 — CREATING REGEX & CORE METHODS
// ============================================================

console.log("--- BLOCK 1: Creating Regex & Core Methods ---\n");

// Two ways to create
const aadhaarPattern = /\d{12}/i;                         // literal (fixed)
const dynamicPattern = new RegExp("PAN", "gi");           // constructor (dynamic)

// Flags: g (global), i (case-insensitive), m (multiline),
//        s (dotAll), u (unicode), d (indices)

const citizenDoc = "Aadhaar-PAN-Passport-Aadhaar";

// .test() -- boolean
console.log(/aadhaar/i.test(citizenDoc));        // true

// .exec() -- match details
const execResult = /(\w+)-(\w+)/i.exec(citizenDoc);
console.log("Full:", execResult[0], "| Group 1:", execResult[1]);

// String methods with regex
const log = "Case #42: submitted PAN and aadhaar at the PAN counter.";

console.log(log.match(/pan/gi));                 // ['PAN','PAN']
console.log(log.replace(/pan/gi, "[REDACTED]")); // replaces both
console.log(log.search(/aadhaar/i));             // index
console.log("aadhaar;pan, passport".split(/[;,]\s*/));

// ============================================================
//  BLOCK 2 — CHARACTER CLASSES, QUANTIFIERS, GROUPS
// ============================================================

console.log("\n--- BLOCK 2: Classes, Quantifiers, Groups ---\n");

// Character classes
const record = "Age: 34. Phone: 98765-43210";
console.log("\\d:", record.match(/\d+/g));           // ['34','98765','43210']
console.log("\\b:", "pancard pan".match(/\bpan\b/g));// ['pan']

// Quantifiers: * (0+), + (1+), ? (0-1), {n}, {n,m}
console.log("colou?r:", "color colour".match(/colou?r/g));

// Capturing groups
const filing = "Document filed on 2024-03-15.";
const dateMatch = filing.match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/);
console.log("Named groups:", dateMatch.groups);

// Backreference -- detect repeated words
const typo = "The the operator found found the record.";
console.log(typo.match(/\b(\w+)\s+\1\b/gi));    // ['The the','found found']

// Lookahead & Lookbehind
const ids = "AADHAAR123 AADHAARKUMAR AADHAAR987";
console.log("(?=\\d):", ids.match(/AADHAAR(?=\d)/g));   // followed by digit
console.log("(?!\\d):", ids.match(/AADHAAR(?!\d)\w*/g)); // NOT followed by digit
console.log("(?<=):", ids.match(/(?<=AADHAAR)\d+/g));    // digits after AADHAAR

// ============================================================
//  BLOCK 3 — PRACTICAL PATTERNS
// ============================================================

console.log("\n--- BLOCK 3: Practical Patterns ---\n");

// Email validation
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
["meena@uidai.gov.in", "not-an-email", "valid+tag@example.museum"].forEach(e => {
  console.log(`  ${e.padEnd(35)} ${emailPattern.test(e) ? "VALID" : "INVALID"}`);
});

// URL parsing with named groups
const urlPattern = /^(?<protocol>https?):\/\/(?<host>[^/:]+)(?::(?<port>\d+))?(?<path>\/[^\s?#]*)?/;
const urlMatch = "https://uidai.gov.in:8080/verify".match(urlPattern);
if (urlMatch) {
  const g = urlMatch.groups;
  console.log(`\n  Protocol: ${g.protocol}, Host: ${g.host}, Port: ${g.port ?? "default"}`);
}

// Password strength check
function checkPassword(pw) {
  const checks = {
    "8+ chars":   /.{8,}/.test(pw),
    "Uppercase":  /[A-Z]/.test(pw),
    "Lowercase":  /[a-z]/.test(pw),
    "Digit":      /\d/.test(pw),
    "Special":    /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  console.log(`  "${pw}" -> ${passed <= 2 ? "WEAK" : passed <= 4 ? "MEDIUM" : "STRONG"}`);
}

checkPassword("abc");
checkPassword("Meena@Uidai#007!");

// Replace with callback
const sensitive = "Aadhaar 834291076543 linked to Aadhaar 912345678901.";
console.log(sensitive.replace(/Aadhaar (\d+)/g, (_, digits) => `Aadhaar ${"*".repeat(digits.length)}`));

/**
 * ============================================================
 *  KEY TAKEAWAYS
 * ============================================================
 *  1. Literal /pattern/flags for fixed; new RegExp() for dynamic.
 *  2. Flags: g, i, m, s, u, d.
 *  3. Methods: regex.test(), regex.exec(), str.match(),
 *     str.matchAll(), str.replace(), str.search(), str.split().
 *  4. Classes: \d, \w, \s, \b, ., [abc], [^abc].
 *  5. Quantifiers: *, +, ?, {n}, {n,m}.
 *  6. Groups: () capture, (?<name>) named, \1 backreference,
 *     (?:) non-capturing.
 *  7. Lookaround: (?=), (?!), (?<=), (?<!).
 *  8. Keep regex readable -- use named groups and comments
 *     for anything complex.
 * ============================================================
 */
