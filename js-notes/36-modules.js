/**
 * ============================================================
 *  FILE 36: JAVASCRIPT MODULES
 * ============================================================
 *  CommonJS (require/module.exports), ES Modules
 *  (import/export), dynamic imports, module scope,
 *  and circular dependencies.
 *
 *  STORY — The Mantralaya File System
 *  Each DEPARTMENT (module) keeps its own files. A
 *  REQUESTING OFFICER (importer) requisitions specific
 *  files (named exports) or the department head's order
 *  (default export). The FILE REGISTRY (module resolver)
 *  prevents duplicates and handles circular refs.
 *
 *  NOTE: Sections marked [ILLUSTRATIVE] show what separate
 *  files would look like. [RUNNABLE] sections execute with
 *  `node 36-modules.js`.
 * ============================================================
 */

console.log("=== FILE 36: JavaScript Modules ===\n");

// ============================================================
//  SECTION 1 — COMMONJS [ILLUSTRATIVE + RUNNABLE]
// ============================================================
// require() is synchronous and loads at runtime.
// module.exports is the actual returned object.

console.log("--- SECTION 1: CommonJS (require / module.exports) ---\n");

/*
 * -- revenueDesk.js --
 *   const departmentName = "Revenue Department, Mantralaya";
 *   function issueCircular(subject, officer) {
 *     return `${officer} issued circular: "${subject}"`;
 *   }
 *   module.exports = { departmentName, issueCircular };
 *
 * -- requestingOfficer.js --
 *   const { departmentName, issueCircular } = require("./revenueDesk");
 */

// [RUNNABLE] IIFE simulates a CommonJS module scope
const revenueDesk = (() => {
  const departmentName = "Revenue Department, Mantralaya";
  function issueCircular(subject, officer) {
    return `${officer} issued circular: "${subject}"`;
  }
  return { departmentName, issueCircular };
})();

const { departmentName, issueCircular } = revenueDesk;
console.log(departmentName);
console.log(issueCircular("Land Survey Update", "Shri Kulkarni"));

// ============================================================
//  SECTION 2 — ES MODULES (ESM) [ILLUSTRATIVE + RUNNABLE]
// ============================================================
// Statically analyzable, supports tree-shaking and top-level await.

console.log("\n--- SECTION 2: ES Modules (import / export) ---\n");

/*
 * -- fileRegistry.mjs --
 *   export const totalFiles = 42_000;
 *   export function searchRegistry(query) { ... }
 *   export default { name: "Mantralaya e-Filing v3", version: "3.2.1" };
 *
 * -- officer.mjs --
 *   import registrySystem from "./fileRegistry.mjs";          // default
 *   import { searchRegistry } from "./fileRegistry.mjs";      // named
 *   import * as Registry from "./fileRegistry.mjs";           // namespace
 *   import { searchRegistry as search } from "./fileRegistry.mjs"; // rename
 */

const fileRegistryModule = (() => {
  const totalFiles = 42_000;
  function searchRegistry(query) {
    return `Searching for "${query}" in ${totalFiles} files...`;
  }
  const defaultExport = { name: "Mantralaya e-Filing v3", version: "3.2.1" };
  return { totalFiles, searchRegistry, default: defaultExport };
})();

const registrySystem = fileRegistryModule.default;
console.log(`Registry: ${registrySystem.name} (v${registrySystem.version})`);

const { searchRegistry } = fileRegistryModule;
console.log(searchRegistry("land acquisition"));

// ============================================================
//  SECTION 3 — NAMED vs DEFAULT EXPORTS
// ============================================================
// Named: many per module, exact name, better tree-shaking.
// Default: one per module, importer picks any name.

console.log("\n--- SECTION 3: Named vs Default Exports ---\n");
console.log("Named  -> import { foo } from ... (exact name required)");
console.log("Default -> import Anything from ... (name is free)");

// ============================================================
//  SECTION 4 — DYNAMIC import() [RUNNABLE]
// ============================================================
// Returns a Promise. Use for lazy/conditional loading.

console.log("\n--- SECTION 4: Dynamic import() ---\n");

async function dynamicDepartmentLoad() {
  const os = await import("node:os");
  console.log(`Server: ${os.hostname()}, Platform: ${os.platform()}`);

  const path = await import("node:path");
  console.log(`Registry path: ${path.join("/mantralaya", "registry", "index.json")}`);
}

dynamicDepartmentLoad();

// ============================================================
//  SECTION 5 — MODULE SCOPE [RUNNABLE]
// ============================================================
// Each module has its own scope -- no global pollution.

console.log("\n--- SECTION 5: Module Scope ---\n");

const deptA = (() => {
  const confidential = "Home classified briefing";
  return { shared: "Home Department public notice" };
})();

const deptB = (() => {
  const confidential = "Finance classified briefing"; // no collision
  return { shared: "Finance Department public notice" };
})();

console.log(deptA.shared);
console.log(deptB.shared);
console.log("Neither department leaks its 'confidential' variable.");

// ============================================================
//  SECTION 6 — CIRCULAR DEPENDENCIES [RUNNABLE]
// ============================================================
// When A imports B and B imports A, partially loaded modules
// can yield undefined values during load.

console.log("\n--- SECTION 6: Circular Dependencies ---\n");

function simulateCircularDeps() {
  const departments = {};

  function loadHomeDept() {
    if (!departments.financeDept) loadFinanceDept();
    departments.homeDept = { name: "Home Department" };
    console.log(`  Home sees Finance: ${departments.financeDept?.name ?? "undefined"}`);
  }

  function loadFinanceDept() {
    departments.financeDept = { name: "Finance Department" };
    console.log(`  Finance sees Home: ${departments.homeDept?.name ?? "undefined (circular!)"}`);
  }

  loadHomeDept();
}

simulateCircularDeps();
console.log("  Fix: extract shared code into a third module.");

// ============================================================
//  SECTION 7 — CommonJS vs ESM QUICK REFERENCE
// ============================================================

console.log("\n--- SECTION 7: CommonJS vs ESM ---\n");

const comparison = [
  ["Feature",         "CommonJS",                "ESM"],
  ["Syntax",          "require / module.exports", "import / export"],
  ["Loading",         "Synchronous",             "Asynchronous"],
  ["Top-level await", "No",                      "Yes"],
  ["Tree-shaking",    "Difficult",               "Built-in"],
  ["Browser support", "Needs bundler",           "Native"],
];

comparison.forEach(([f, c, e]) => {
  console.log(`  ${f.padEnd(18)} | ${c.padEnd(28)} | ${e}`);
});

/**
 * ============================================================
 *  KEY TAKEAWAYS
 * ============================================================
 *  1. CommonJS: require() is synchronous, module.exports is
 *     the real export. Modules are cached.
 *  2. ESM: import/export is the standard. Statically
 *     analyzable, supports tree-shaking, works in browsers.
 *  3. Named exports use curly braces; preferred for most cases.
 *  4. Default export: one per module, no braces on import.
 *  5. Dynamic import() returns a Promise -- lazy/conditional.
 *  6. Module scope: top-level vars stay private unless exported.
 *  7. Circular deps may yield undefined during load.
 *     Fix by restructuring or using a third shared module.
 * ============================================================
 */
