/**
 * ============================================================
 * FILE 40: Tagged Templates & Miscellaneous Operators
 * ============================================================
 * Tagged template literals, comma operator, void, labels,
 * eval(), with statement, and globalThis.
 *
 * STORY — The Ayurveda Vaidya's Prescription Pad
 * Vaidya Sharma knows both modern (tagged templates,
 * globalThis) and ancient (eval, with) formulations.
 * He prescribes only the safe ones.
 * ============================================================
 */


// ============================================================
// SECTION 1 — TAGGED TEMPLATE LITERALS
// ============================================================
// Tag functions receive (strings[], ...values) separately.
// Powers lit-html, styled-components, GraphQL tags.

function prescriptionFormat(strings, ...values) {
  let result = "";
  strings.forEach((str, i) => {
    result += str + (i < values.length ? values[i].toUpperCase() : "");
  });
  return result;
}

console.log(prescriptionFormat`Prescribing ${"Ashwagandha"} for ${"the patient"}!`);
// Prescribing ASHWAGANDHA for THE PATIENT!

// --- HTML Sanitizer ---
function sanitize(strings, ...values) {
  const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  let result = "";
  strings.forEach((str, i) => {
    result += str + (i < values.length ? esc(values[i]) : "");
  });
  return result;
}

const userInput = '<script>alert("xss")</script>';
console.log(sanitize`<p>Note: ${userInput}</p>`);

// --- SQL-like Tagged Template ---
function sql(strings, ...values) {
  let query = "";
  const params = [];
  strings.forEach((str, i) => {
    query += str;
    if (i < values.length) { params.push(values[i]); query += `$${params.length}`; }
  });
  return { query: query.trim(), params };
}

console.log(sql`SELECT * FROM rx WHERE category = ${"Rasayana"} AND potency >= ${5}`);

// --- strings.raw ---
function showRaw(strings) {
  console.log("Cooked:", strings[0]);
  console.log("Raw:   ", strings.raw[0]);
}
showRaw`Path:\n"twice daily"`;
console.log(String.raw`Dosage: 2g\ntwice daily`);


// ============================================================
// SECTION 2 — THE COMMA OPERATOR
// ============================================================
// Evaluates all operands left-to-right, returns the last.

const result = (1 + 1, 2 + 2, 3 + 3);
console.log("Comma operator:", result); // 6

// Practical: multiple updates in a for-loop header
const herbs = ["ashwagandha", "brahmi", "tulsi"];
for (let i = 0, j = herbs.length - 1; i < j; i++, j--) {
  console.log(`Mixing ${herbs[i]} with ${herbs[j]}`);
}


// ============================================================
// SECTION 3 — THE void OPERATOR
// ============================================================
// Evaluates expression and returns undefined.

console.log(void 0);                        // undefined
const quiet = () => void console.log("written silently");
console.log("Return:", quiet());             // undefined


// ============================================================
// SECTION 4 — LABELS WITH LOOPS
// ============================================================
// Labels let break/continue target outer loops.

const grid = [
  ["ashwagandha", "shatavari", "guduchi"],
  ["brahmi", "turmeric", "neem"],
  ["tulsi", "amla", "triphala"],
];

let found = null;
outerSearch: for (let r = 0; r < grid.length; r++) {
  for (let c = 0; c < grid[r].length; c++) {
    if (grid[r][c] === "turmeric") { found = { r, c }; break outerSearch; }
  }
}
console.log("Found at:", found);


// ============================================================
// SECTION 5 — eval() (AND WHY TO AVOID IT)
// ============================================================
// Compiles and runs a string as JS. Dangerous, slow, leaks scope.

console.log("eval('2+2'):", eval("2 + 2"));

// Dangers: security holes, prevents optimizations, scope leakage.
// Alternatives: JSON.parse(), new Function(), tagged templates.
const saferFn = new Function("a", "b", "return a + b;");
console.log("new Function:", saferFn(10, 20));


// ============================================================
// SECTION 6 — THE with STATEMENT (BANNED IN STRICT MODE)
// ============================================================
// Extends scope chain but creates ambiguity. Use destructuring.

const pad = { title: "Vaidya's Prescriptions", pages: 342 };
const { title, pages } = pad;
console.log(title, pages);
console.log("'with' is forbidden. Use destructuring instead.");


// ============================================================
// SECTION 7 — globalThis
// ============================================================
// Universal cross-platform global: browser, Node, Deno, workers.

console.log("globalThis available:", typeof globalThis !== "undefined");
console.log("setTimeout available:", typeof globalThis.setTimeout === "function");
console.log("DOM available:", typeof globalThis.document !== "undefined");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Tagged templates receive (strings[], ...values). Use for
//    sanitizers, query builders, i18n, and DSLs.
// 2. HTML sanitizer: escape only dynamic values, trust static parts.
// 3. SQL tag: collect user values as params, never concatenate.
// 4. Comma operator: evaluates all, returns last.
// 5. void: always returns undefined.
// 6. Labels: break/continue can target outer loops.
// 7. eval() is dangerous. Use JSON.parse or new Function.
// 8. `with` is banned in strict mode. Use destructuring.
// 9. globalThis is the universal global object.
// ============================================================
