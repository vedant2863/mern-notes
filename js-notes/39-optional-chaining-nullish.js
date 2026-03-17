/**
 * ============================================================
 *  FILE 39: OPTIONAL CHAINING & NULLISH COALESCING
 * ============================================================
 *  ?. (optional chaining), ?? (nullish coalescing),
 *  ??= (logical nullish assignment), and ?? vs ||.
 *
 *  STORY — Sarkari File Tracing with Babu Tripathi
 *  ?. is an RTI query -- trace the file without crashing
 *  into "File Not Found" at any department.
 *  ?? is the fallback stamp -- kicks in ONLY when the
 *  value is truly missing (null/undefined), not when it
 *  says "0 pages attached."
 * ============================================================
 */

console.log("=== FILE 39: Optional Chaining & Nullish Coalescing ===\n");

// ============================================================
//  SECTION 1 — OPTIONAL CHAINING (?.)
// ============================================================

console.log("--- SECTION 1: Optional Chaining (?.) ---\n");

const ministry = {
  reception: {
    name: "Central Filing Section",
    forwarding: {
      name: "Under Secretary Desk",
      forwarding: { name: "Joint Secretary Office" },
    },
  },
};

// Safe property access
console.log("New way:", ministry?.reception?.forwarding?.name);
console.log("Too deep:", ministry?.reception?.forwarding?.forwarding?.forwarding?.name); // undefined

// Safe method call
const babu = {
  desk: {
    stamp: { use() { return "Stamped URGENT!"; } },
    redInk: null,
  },
};
console.log("Stamp:", babu.desk.stamp?.use());
console.log("Red ink:", babu.desk.redInk?.apply()); // undefined, no crash

// Safe bracket access
const depts = { dept1: "Filing Section" };
console.log("Exists:", depts?.["dept1"]);
console.log("Missing:", depts?.["dept99"]);

// With arrays
const floors = [{ offices: [{ name: "Accounts" }] }, null];
console.log("Floor 1:", floors[0]?.offices?.[0]?.name);
console.log("Floor 2:", floors[1]?.offices?.[0]?.name); // undefined

// Short-circuit: everything after ?. is skipped if left is null/undefined
let sideEffectRan = false;
const nothing = null;
nothing?.prop[(() => { sideEffectRan = true; return "key"; })()];
console.log("Side effect ran?", sideEffectRan); // false

// ============================================================
//  SECTION 2 — NULLISH COALESCING (??) AND ??=
// ============================================================

console.log("\n--- SECTION 2: Nullish Coalescing (??) ---\n");

const cfg = {
  maxCopies: 0,
  priority: "",
  requiresStamp: false,
  assignedOfficer: null,
};

// || replaces ALL falsy (0, "", false) -- often wrong
console.log("maxCopies || 4:", cfg.maxCopies || 4);      // 4 (wrong!)
// ?? replaces ONLY null/undefined
console.log("maxCopies ?? 4:", cfg.maxCopies ?? 4);      // 0 (correct)
console.log("priority ?? 'X':", cfg.priority ?? "X");    // "" (correct)
console.log("officer ?? 'N/A':", cfg.assignedOfficer ?? "N/A"); // N/A

// Combining ?. and ??
const profile = { name: "Tripathi", fileStats: { pending: 0 } };
console.log("Pending:", profile?.fileStats?.pending ?? 100);  // 0, not 100
console.log("Peon:", profile?.support?.peon?.name ?? "None"); // "None"

// ??= assigns ONLY if current value is null/undefined
const desk = { stamps: 3, clips: 0, redInk: null };
desk.stamps  ??= 10;   // kept (3)
desk.clips   ??= 100;  // kept (0 is not null/undefined)
desk.redInk  ??= "Camlin Red Ink"; // replaced (was null)
desk.stapler ??= "Kangaro";        // replaced (was undefined)
console.log("Desk:", desk);

// Precedence: cannot mix ?? with || or && without parens
const a = null, b = 0, c = "fallback";
console.log("(a||b) ?? c:", (a || b) ?? c);   // 0
console.log("a ?? (b||c):", a ?? (b || c));   // "fallback"

// Real-world: API response handling
function processAPI(response) {
  return {
    name:   response?.data?.officer?.name ?? "Anonymous",
    items:  response?.data?.items?.length ?? 0,
    status: response?.status ?? 500,
  };
}

console.log("Good:", processAPI({ status: 200, data: { officer: { name: "Tripathi" }, items: [1, 2] } }));
console.log("Null:", processAPI(null));

// Config merging with ??=
function applyDefaults(config) {
  config.host    ??= "localhost";
  config.port    ??= 3000;
  config.debug   ??= false;
  return config;
}
console.log("Config:", applyDefaults({ port: 8080, debug: true }));

/**
 * ============================================================
 *  KEY TAKEAWAYS
 * ============================================================
 *  1. ?. short-circuits to undefined on null/undefined.
 *     Works with .prop, .method(), and [expr].
 *  2. ?? returns right side ONLY for null/undefined.
 *     Unlike ||, it preserves 0, "", and false.
 *  3. ?? vs ||: use ?? when 0, "", or false are valid values.
 *  4. ??= assigns only if current value is null/undefined.
 *  5. Combine ?. and ?? for safe navigation + defaults:
 *     obj?.deep?.path ?? "default"
 *  6. Cannot mix ?? with || or && without explicit parens.
 * ============================================================
 */
