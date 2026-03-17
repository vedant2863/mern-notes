// ============================================================
// FILE 13: Object Methods — The Curator's Toolkit
// Topic: Built-in Object static methods for inspection,
//        transformation, protection, and cloning
// Why: These methods turn raw objects into controlled, inspectable,
//      immutable data — essential for state management and APIs.
// ============================================================

// =============================================
// STORY: The National Museum of Delhi
// Curator Mehra ji catalogs artifacts, locks
// display cases, and creates perfect replicas.
// Each Object method is a tool in his toolkit.
// =============================================


// =======================================================
// EXAMPLE BLOCK 1: Inspecting, Transforming & Protecting
// =======================================================

const artifact = {
  name: "Kohinoor Replica",
  era: "Mughal",
  value: 500000,
  material: "carved ivory",
};

// --- Object.keys / values / entries ---
console.log(Object.keys(artifact));    // [ 'name', 'era', 'value', 'material' ]
console.log(Object.values(artifact));  // [ 'Kohinoor Replica', 'Mughal', 500000, 'carved ivory' ]

// entries() pairs well with for...of destructuring
for (const [key, val] of Object.entries(artifact)) {
  console.log(`${key}: ${val}`);
}

// --- Object.fromEntries() — reverse of entries() ---
// Transform: double the artifact value
const inflated = Object.fromEntries(
  Object.entries(artifact).map(([key, val]) =>
    key === "value" ? [key, val * 2] : [key, val]
  )
);
console.log(inflated.value); // 1000000

// Filter: keep only string-valued properties
const stringOnly = Object.fromEntries(
  Object.entries(artifact).filter(([, val]) => typeof val === "string")
);
console.log(stringOnly); // { name, era, material }

// --- Object.assign() — merge objects (shallow) ---
const merged = Object.assign({}, artifact, { rarity: "common" });
console.log(merged);
// Later sources override earlier ones
console.log(Object.assign({}, { a: 1 }, { a: 2 })); // { a: 2 }

// --- Object.freeze() — fully immutable (shallow) ---
const displayCase = { artifact: "Kohinoor Replica", location: "Gallery A" };
Object.freeze(displayCase);
displayCase.location = "Gallery B"; // silently fails
console.log(displayCase.location);  // Gallery A
console.log(Object.isFrozen(displayCase)); // true

// --- Object.seal() — can modify existing, no add/delete ---
const catalogEntry = { id: "ART-001", verified: false };
Object.seal(catalogEntry);
catalogEntry.verified = true;       // OK
catalogEntry.notes = "test";        // silently fails
console.log(catalogEntry.verified); // true
console.log(catalogEntry.notes);    // undefined

// --- Object.is() — stricter equality ---
// Fixes two edge cases where === lies
console.log(NaN === NaN);            // false
console.log(Object.is(NaN, NaN));    // true
console.log(+0 === -0);              // true
console.log(Object.is(+0, -0));      // false


// =======================================================
// EXAMPLE BLOCK 2: Advanced — create, defineProperty,
//                  descriptors, structuredClone
// =======================================================

// --- Object.create(proto) ---
const artifactProto = {
  describe() {
    return `${this.name} from the ${this.era} era (worth ${this.value})`;
  },
};

const dancingGirl = Object.create(artifactProto);
dancingGirl.name = "Dancing Girl of Mohenjo-daro";
dancingGirl.era = "Indus Valley";
dancingGirl.value = 750000;
console.log(dancingGirl.describe());
console.log(dancingGirl.hasOwnProperty("describe")); // false (on prototype)

// --- Object.defineProperty() — fine-grained control ---
const secureArtifact = { name: "Chola Bronze Nataraja" };

Object.defineProperty(secureArtifact, "catalogId", {
  value: "SEC-999",
  writable: false,
  enumerable: true,
  configurable: false,
});

secureArtifact.catalogId = "HACKED";
console.log(secureArtifact.catalogId); // SEC-999 (write failed)

// Non-enumerable (hidden) property
Object.defineProperty(secureArtifact, "_notes", {
  value: "Suspected replica",
  enumerable: false,
});
console.log(Object.keys(secureArtifact));              // [ 'name', 'catalogId' ]
console.log(Object.getOwnPropertyNames(secureArtifact)); // includes '_notes'

// --- structuredClone() — deep copy ---
const masterArtifact = {
  name: "Sarnath Buddha",
  properties: { material: "sandstone", weight: 9000 },
  discovery: new Date("1905-01-15"),
};

const replica = structuredClone(masterArtifact);
replica.properties.weight = 1;
console.log(masterArtifact.properties.weight); // 9000 (original preserved)
console.log(replica.discovery instanceof Date); // true (dates cloned properly)
// structuredClone handles dates, maps, sets, circular refs.
// It does NOT handle functions or DOM nodes.


// ============================================================
// KEY TAKEAWAYS
// ------------------------------------------------------------
// 1. keys/values/entries — the standard trio for iterating
//    objects. Returns arrays you can map/filter.
// 2. fromEntries() reverses entries() — essential for
//    object transformation pipelines.
// 3. assign() merges objects (shallow, mutates target).
// 4. freeze() = fully immutable. seal() = can edit, no add/delete.
//    Both are shallow.
// 5. Object.create(proto) sets up manual prototype chains.
// 6. defineProperty() controls writable, enumerable, configurable.
// 7. Object.is() fixes NaN and -0 edge cases vs ===.
// 8. structuredClone() is THE answer for deep copying.
// ============================================================
