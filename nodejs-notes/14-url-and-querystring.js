/** ============================================================
 FILE 14: URL and Query String Parsing
 ============================================================
 Topic: URL class, URLSearchParams, legacy url.parse(),
        querystring module
 WHY: Every web app deals with URLs — parsing routes,
   extracting query params, building API endpoints. The URL
   class is the modern standard.
 ============================================================ */

// ============================================================
// STORY: IRCTC TRAVEL PORTAL
//   Rajesh works at the IRCTC booking portal where every
//   train journey is encoded in a URL. He decodes booking
//   addresses, extracts passenger details, and builds
//   new reservation links.
// ============================================================

const url = require("url");
const querystring = require("querystring");

// ============================================================
// BLOCK 1 — The URL Class & searchParams
// ============================================================

console.log("=== BLOCK 1: The URL Class & searchParams ===\n");

// ── 1a — Constructing and inspecting a URL ──────────────────
// WHY: The URL class (WHATWG standard) matches the browser API,
// so your knowledge transfers directly to frontend code.

const booking = new URL(
  "https://www.irctc.co.in:8443/booking/search?from=NDLS&to=BCT&class=3A&quota=GN&page=2#results"
);

console.log("  Decomposed parts:");
console.log(`    protocol: ${booking.protocol}`);   // https:
console.log(`    hostname: ${booking.hostname}`);    // www.irctc.co.in
console.log(`    port:     ${booking.port}`);        // 8443
console.log(`    pathname: ${booking.pathname}`);    // /booking/search
console.log(`    search:   ${booking.search}`);      // ?from=NDLS&to=BCT&...
console.log(`    hash:     ${booking.hash}`);        // #results

// ── 1b — searchParams methods ───────────────────────────────

console.log("\n  --- searchParams methods ---\n");

const params = booking.searchParams;

console.log(`    get('from'):    ${params.get("from")}`);     // NDLS
console.log(`    has('class'):   ${params.has("class")}`);    // true
console.log(`    get('missing'): ${params.get("missing")}`);  // null

// .set() overwrites, .append() allows duplicates
params.set("page", "3");
params.append("stopover", "JHS");
params.append("stopover", "BPL");
console.log(`    getAll('stopover'): ${JSON.stringify(params.getAll("stopover"))}`);
// Output: ["JHS","BPL"]

// WHY: .get() returns only the first value. Use .getAll()
// when a parameter appears multiple times.

params.delete("class");
console.log(`    toString(): ${params.toString()}`);

// ── 1c — Building URLs programmatically ─────────────────────
// WHY: Avoids manual string concatenation bugs — handles encoding.

console.log("\n  --- Building URLs programmatically ---\n");

const trainBooking = new URL("https://api.irctc.co.in/v2/book");
trainBooking.searchParams.set("train", "12952");
trainBooking.searchParams.set("from", "NDLS");
trainBooking.searchParams.set("to", "MMCT");
trainBooking.searchParams.set("date", "2025-08-15");

console.log(`    Built URL: ${trainBooking.href}`);

// Special characters are encoded automatically
trainBooking.searchParams.set("notes", "window seat & lower berth");
console.log(`    Encoded notes: ${trainBooking.searchParams.toString().split("notes=")[1]}`);

// Relative URL resolution
const base = new URL("https://www.irctc.co.in/api/v1/");
const endpoint = new URL("trains?date=today", base);
console.log(`    Resolved relative: ${endpoint.href}`);

console.log("");

// ============================================================
// BLOCK 2 — URLSearchParams, Legacy APIs & Practical Use
// ============================================================

console.log("=== BLOCK 2: URLSearchParams, Legacy APIs & Practical Use ===\n");

// ── 2a — Standalone URLSearchParams ─────────────────────────
// WHY: Works without a full URL — handy for building query strings.

console.log("  --- Standalone URLSearchParams ---\n");

const fromObject = new URLSearchParams({
  destination: "Varanasi",
  trainNo: "12560",
  class: "SL",
});
console.log(`    From object: ${fromObject.toString()}`);

const fromPairs = new URLSearchParams([
  ["passenger", "Rajesh Kumar"],
  ["passenger", "Sunita Devi"],
]);
console.log(`    getAll('passenger'): ${JSON.stringify(fromPairs.getAll("passenger"))}`);

// ── 2b — Legacy url.parse() (deprecated) ────────────────────
// WHY: Still seen in older codebases. Prefer new URL().

console.log("\n  --- Legacy url.parse() ---\n");

const parsed = url.parse("https://www.irctc.co.in/trains?from=HWH&to=NDLS&class=2A", true);
console.log(`    pathname: ${parsed.pathname}`);
console.log(`    query: ${JSON.stringify(parsed.query)}`);
console.log("    Prefer: new URL(urlString) instead of url.parse()");

// ── 2c — Legacy querystring module ──────────────────────────
// WHY: querystring.parse/stringify are the old way. Prefer URLSearchParams.

console.log("\n  --- Legacy querystring module ---\n");

const qsParsed = querystring.parse("train=12301&from=HWH&to=NDLS");
console.log(`    querystring.parse(): ${JSON.stringify(qsParsed)}`);

const qsString = querystring.stringify({ pnr: "4521678901", status: "confirmed" });
console.log(`    querystring.stringify(): ${qsString}`);

// ── 2d — Encoding edge cases ────────────────────────────────
// WHY: URLSearchParams auto-encodes <, >, &, spaces, Unicode.

console.log("\n  --- Encoding Edge Cases ---\n");

const tricky = new URLSearchParams();
tricky.set("query", "fare < 500 & class >= 2A");
tricky.set("route", "Delhi → Chennai");

console.log("    Encoded:", tricky.toString());
console.log("    Decoded back:");
for (const [key, val] of tricky) {
  console.log(`      ${key} = ${val}`);
}

console.log("");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
console.log("============================================================");
console.log("KEY TAKEAWAYS");
console.log("============================================================");
console.log("1. new URL(string) is the modern WHATWG standard — use it.");
console.log("2. searchParams has get, set, append, delete, has, getAll.");
console.log("3. URLSearchParams works standalone for building query strings.");
console.log("4. url.parse() and querystring are legacy — prefer URL class.");
console.log("5. URLSearchParams auto-encodes special characters safely.");
console.log("6. Use new URL(relative, base) to resolve relative URLs.");
console.log("============================================================\n");
