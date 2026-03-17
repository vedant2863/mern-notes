/**
 * ============================================================
 *  FILE 6 : Template Literals
 * ============================================================
 *  Topic  : Interpolation ${}, multi-line strings, expression
 *           evaluation, nested templates, tagged templates.
 *
 *  WHY: Template literals replace ugly concatenation with clean,
 *  readable, multi-line string composition.
 * ============================================================
 */

// STORY: Pandit ji's wedding card press interpolates names, venues,
// and muhurat times into each card perfectly.

// ────────────────────────────────────────────────────────────
// SECTION 1 — Basic Interpolation with ${}
// ────────────────────────────────────────────────────────────

const groomName = "Rajesh";
const brideName = "Priya";
const venueRent = 25;

// Old way
const oldCard = "Groom " + groomName + " weds " + brideName;

// Template literal
const newCard = `Groom ${groomName} weds ${brideName} for ${venueRent} lakh venue.`;
console.log(newCard);

// ────────────────────────────────────────────────────────────
// SECTION 2 — Multi-line Strings
// ────────────────────────────────────────────────────────────

const weddingCard = `
+============================+
|  Groom  : ${groomName.padEnd(16)}  |
|  Bride  : ${brideName.padEnd(16)}  |
|  Venue  : ${String(venueRent).padEnd(16)}  |
+============================+
`;
console.log(weddingCard);

// ────────────────────────────────────────────────────────────
// SECTION 3 — Expression Evaluation Inside ${}
// ────────────────────────────────────────────────────────────

console.log(`Total catering: ${40 * 1.5} thousand`); // 60 thousand

const isDestinationWedding = true;
console.log(`Type: ${isDestinationWedding ? "DESTINATION" : "Local"}`);

function muhuratLevel(rent) {
  if (rent >= 50) return "Grand";
  if (rent >= 25) return "Standard";
  return "Simple";
}
console.log(`Muhurat: ${muhuratLevel(venueRent)}`); // Standard

// ────────────────────────────────────────────────────────────
// SECTION 4 — Nested Template Literals
// ────────────────────────────────────────────────────────────

const functions = [
  { name: "Haldi",    type: "Ritual",   day: 1 },
  { name: "Sangeet",  type: "Dance",    day: 2 },
  { name: "Pheras",   type: "Wedding",  day: 4 },
];

const schedule = `Schedule:
${functions.map(f => `  - ${f.name} (${f.type}) ${f.day >= 3 ? `[MAIN EVENT]` : `[Day ${f.day}]`}`).join("\n")}`;
console.log(schedule);

// ────────────────────────────────────────────────────────────
// SECTION 5 — Tagged Template Literals (Introduction)
// ────────────────────────────────────────────────────────────
// Tag functions receive (strings[], ...values) and can transform
// the template before it becomes a string. Foundation for
// styled-components, GraphQL gql`...`, SQL builders.

function decorate(strings, ...values) {
  let result = "";
  strings.forEach((str, i) => {
    result += str;
    if (i < values.length) result += `*${values[i]}*`;
  });
  return result;
}

console.log(decorate`Order ${"Marigold"} garlands qty ${9001}`);
// Order *Marigold* garlands qty *9001*

// Practical: HTML escaper
function safeHTML(strings, ...values) {
  const escape = (str) =>
    String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let result = "";
  strings.forEach((str, i) => {
    result += str;
    if (i < values.length) result += escape(values[i]);
  });
  return result;
}

const userInput = '<script>alert("shaadi!")</script>';
console.log(safeHTML`<div>${userInput}</div>`);
// <div>&lt;script&gt;alert(&quot;shaadi!&quot;)&lt;/script&gt;</div>

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Template literals use backticks (`).
// 2. ${expression} embeds variables, math, function calls, ternaries.
// 3. Multi-line strings just work — no \n needed.
// 4. Templates can nest: `...${cond ? `A` : `B`}...`
// 5. Tagged templates let a function process the template.
// 6. Tag receives (strings[], ...values); strings.raw has un-escaped text.
// ============================================================
