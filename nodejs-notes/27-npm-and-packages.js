/** ============================================================
    FILE 27: npm and Packages
    ============================================================
    Topic: package.json anatomy, semver, node_modules, npx
    WHY THIS MATTERS:
    npm is the world's largest software registry. Understanding
    package.json, semver, and module resolution is essential for
    every Node.js developer.
    ============================================================ */

// ============================================================
// STORY: Kirana Store Wholesale Market
// Seth Govind ji orders supplies from the wholesale market
// (npm). package.json is the order list. node_modules is the
// godown (warehouse). npm install is bulk purchasing.
// ============================================================

// ============================================================
// EXAMPLE BLOCK 1 — package.json Anatomy
// ============================================================

console.log('=== Seth Govind ji opens the wholesale order ledger ===\n');

const samplePackageJson = {
  name: "@govindji/kirana-app",       // Scoped, lowercase, max 214 chars
  version: "2.1.0",                   // MAJOR.MINOR.PATCH (semver)
  description: "Kirana store inventory app",
  main: "./dist/index.js",            // CJS entry point
  exports: {                          // Modern replacement for "main"
    ".": { import: "./dist/index.mjs", require: "./dist/index.cjs" },
    "./utils": "./dist/utils.js"
  },
  type: "commonjs",                   // "module" for ESM
  scripts: {
    start: "node dist/index.js",      // npm start (no "run" needed)
    dev: "node --watch src/index.js",  // npm run dev
    test: "jest --coverage",           // npm test (no "run" needed)
    build: "tsc",
    prepublishOnly: "npm run build && npm test", // auto before publish
  },
  dependencies: { express: "^4.18.2", lodash: "~4.17.21" },
  devDependencies: { jest: "^29.7.0", typescript: "^5.2.0" },
  peerDependencies: { react: ">=17.0.0" },
  engines: { node: ">=18.0.0" },
  files: ["dist/", "LICENSE", "README.md"],
};

console.log('package.json fields:');
Object.keys(samplePackageJson).forEach((field, i) => {
  const val = samplePackageJson[field];
  const type = Array.isArray(val) ? 'array' : typeof val;
  console.log(`  ${(i + 1).toString().padStart(2)}. ${field} (${type})`);
});

// ============================================================
// SECTION 2 — Semver, Resolution, npx, ESM
// ============================================================

console.log('\n--- Semver Ranges ---\n');

const semverExamples = [
  ['^1.2.3', '>=1.2.3 <2.0.0',  'Minor + patch (most common)'],
  ['~1.2.3', '>=1.2.3 <1.3.0',  'Patch only (conservative)'],
  ['1.2.3',  'exactly 1.2.3',   'Exact version (strictest)'],
  ['^0.2.3', '>=0.2.3 <0.3.0',  'MAJOR=0: ^ acts like ~'],
];

semverExamples.forEach(([range, expands, note]) => {
  console.log(`  ${range.padEnd(10)} -> ${expands.padEnd(22)} // ${note}`);
});

console.log('\n  GOTCHA: ^0.x treats minor as breaking, ^0.0.x allows only that patch.\n');

// ──────────────────────────────────────────────────────────
// node_modules resolution algorithm
// ──────────────────────────────────────────────────────────
console.log('Module resolution order:');
console.log('  1. Core modules (fs, path, http)');
console.log('  2. ./node_modules/<pkg> -> ../node_modules/<pkg> -> ... up to root');
console.log('  3. Global folders (NODE_PATH, ~/.node_modules)\n');

console.log('module.paths for this file:');
module.paths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

console.log(`\nrequire.resolve('fs'): ${require.resolve('fs')}`);

// ──────────────────────────────────────────────────────────
// package-lock.json
// ──────────────────────────────────────────────────────────
console.log('\npackage-lock.json:');
console.log('  Locks exact versions for reproducibility. Always commit it.');
console.log('  `npm ci` = strict install from lock (for CI/CD).');

// ──────────────────────────────────────────────────────────
// npx — run without global install
// ──────────────────────────────────────────────────────────
console.log('\nnpx: checks local .bin, then downloads temporarily.');
console.log('  npx create-react-app app  — scaffold without global install');

// ──────────────────────────────────────────────────────────
// ESM vs CJS
// ──────────────────────────────────────────────────────────
console.log('\n"type": "module" (ESM) vs "commonjs" (CJS):');
console.log('  CJS: require(), module.exports, __dirname');
console.log('  ESM: import/export, import.meta.url, top-level await');
console.log('  CJS can require ESM? NO. ESM can import CJS? YES.');

// ──────────────────────────────────────────────────────────
// Essential npm commands
// ──────────────────────────────────────────────────────────
console.log('\nEssential npm commands:');
const commands = [
  ['npm init -y',          'Create package.json with defaults'],
  ['npm install <pkg>',    'Add to dependencies'],
  ['npm install -D <pkg>', 'Add to devDependencies'],
  ['npm ci',               'Clean install from lock (CI/CD)'],
  ['npm outdated',         'Show newer versions available'],
  ['npm audit',            'Check security vulnerabilities'],
  ['npm ls',               'Show dependency tree'],
  ['npm publish',          'Publish to npm registry'],
];

commands.forEach(([cmd, desc]) => {
  console.log(`  ${cmd.padEnd(25)} — ${desc}`);
});

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. package.json: name, version, deps, scripts, entry points.
// 2. dependencies = runtime; devDependencies = build/test;
//    peerDependencies = "you install this."
// 3. Semver: ^ = minor+patch, ~ = patch only. Watch ^0.x.
// 4. node_modules resolution walks up the directory tree.
// 5. package-lock.json locks versions. Always commit it.
//    Use `npm ci` in CI/CD.
// 6. npx runs packages without global install.
// 7. "type": "module" switches .js to ESM. Default is CJS.
// 8. "exports" replaces "main" — conditional exports + subpaths.
// ============================================================

console.log('\nSeth Govind ji closes the ledger. Godown fully stocked.');
