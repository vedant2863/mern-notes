// ============================================================
// FILE 15: CI/CD AND TESTING BEST PRACTICES
// Topic: Automating tests in CI pipelines and building a testing culture
// WHY: Tests are only valuable if they run automatically. A test
//   suite on a developer's machine that never runs in CI is like
//   a fire alarm with no batteries.
// ============================================================

// ============================================================
// STORY — Flipkart: 15,000 Tests in 4 Minutes
// No PR merges if any test fails. Coverage reports post as PR
// comments. During Big Billion Days, this pipeline prevented
// 12 critical bugs from reaching 100M+ users.
// ============================================================

// ============================================================
// BLOCK 1 — GitHub Actions Workflow
// SECTION: The most popular CI for JS projects
// ============================================================

const workflow = `
# .github/workflows/tests.yml
name: Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'             # Cache node_modules for speed
      - run: npm ci                # Clean install (not npm install)
      - run: npm run lint
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          token: \${{ secrets.CODECOV_TOKEN }}
`;
console.log("--- GitHub Actions Workflow ---");
console.log(workflow);

// npm ci vs npm install:
// npm ci: exact versions from package-lock.json, deterministic. Use in CI.
// npm install: can update lock file. Fine for local dev only.


// ============================================================
// BLOCK 2 — Matrix Testing & Caching
// SECTION: Multiple versions in parallel
// ============================================================

console.log("--- Matrix Testing ---");
console.log(`
strategy:
  matrix:
    node-version: [18, 20, 22]   # 3 parallel jobs!
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: \${{ matrix.node-version }}
  - run: npm ci && npm test
`);
console.log("Also works with OS: [ubuntu-latest, macos-latest, windows-latest]");
console.log("Cache: 'npm' in setup-node caches node_modules automatically.\n");


// ============================================================
// BLOCK 3 — Coverage Thresholds
// SECTION: Enforcing minimums in CI
// ============================================================

const jestCoverage = {
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
    './src/payments/': { branches: 95, functions: 95, lines: 95 },
  }
};

console.log("--- Coverage Thresholds ---");
console.log("Jest config:", JSON.stringify(jestCoverage, null, 2));
console.log("General: 80-90%. Critical paths (payments, auth): 95%+.");
console.log("Do NOT mandate 100% — leads to testing trivial code.\n");


// ============================================================
// BLOCK 4 — Pre-Commit Hooks
// SECTION: Catch bugs before they enter git history
// ============================================================

// Setup: npm install --save-dev husky lint-staged && npx husky init

const lintStagedConfig = {
  "lint-staged": {
    "*.{js,ts}": ["eslint --fix", "jest --bail --findRelatedTests"]
  }
};

console.log("--- Pre-Commit Hooks ---");
console.log("Config:", JSON.stringify(lintStagedConfig, null, 2));
console.log("Flow: git commit -> husky -> lint-staged -> eslint + tests -> commit or block\n");


// ============================================================
// BLOCK 5 — Test Organization & Naming
// SECTION: Where to put tests and what to call them
// ============================================================

console.log("--- Test Organization ---");
console.log(`
HYBRID APPROACH (recommended):
  src/
    services/
      UserService.js
      UserService.test.js          # Unit: co-located
  tests/
    integration/                   # Integration: separate
      booking-flow.test.js
    e2e/                           # E2E: separate
      booking-journey.spec.js
`);

console.log("--- Test Naming ---");
console.log("BAD:  test('test validatePassword')");
console.log("GOOD: test('should reject password shorter than 8 characters')");
console.log("Pattern: 'should [behavior] when [condition]'\n");


// ============================================================
// BLOCK 6 — What NOT to Test
// SECTION: Avoid testing framework internals and trivial code
// ============================================================

console.log("--- What NOT to Test ---");
console.log("  Framework code: Express routes correctly? Trust Express.");
console.log("  Third-party libs: lodash.get() works? lodash tests that.");
console.log("  Trivial code: Getters that just return a property.");
console.log("\nWhat TO test:");
console.log("  YOUR business logic, API endpoints, state machines");
console.log("  YOUR integrations with external services");
console.log("  Bug regression: write a test for every bug you fix\n");


// ============================================================
// BLOCK 7 — PR Checklist & Parallel Execution
// SECTION: Quality gates and speed
// ============================================================

console.log("--- PR Testing Checklist ---");
["Happy path tested", "Error/edge cases tested", "No flaky tests (no sleep)",
 "Test names describe behavior", "No test.only() or test.skip() committed",
 "Coverage maintained or improved", "Tests are independent (no shared state)"]
  .forEach(item => console.log(`  [ ] ${item}`));

console.log("\n--- Parallel Execution ---");
console.log("Jest:    jest --maxWorkers=4");
console.log("Vitest:  vitest --pool=threads");
console.log(`
Sharding across CI machines:
  strategy:
    matrix:
      shard: [1, 2, 3]
  steps:
    - run: npx jest --shard=\${{ matrix.shard }}/3
`);
console.log("Impact: 45 min (serial) -> 4 min (sharded)\n");


// ============================================================
// BLOCK 8 — Complete CI Setup
// SECTION: Production-ready, copy-paste
// ============================================================

const scripts = {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:unit": "jest --testPathPattern=src/",
  "test:integration": "jest --testPathPattern=tests/integration/",
  "test:e2e": "npx playwright test",
  "test:ci": "jest --ci --coverage --maxWorkers=4",
  "lint": "eslint src/ tests/",
  "prepare": "husky"
};
console.log("--- package.json scripts ---");
console.log(JSON.stringify({ scripts }, null, 2));

const completeCI = `
# .github/workflows/ci.yml
name: CI Pipeline
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run test:unit -- --ci --coverage
      - uses: codecov/codecov-action@v4

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
`;
console.log("\n--- Complete CI Workflow ---");
console.log(completeCI);


// ============================================================
// BLOCK 9 — The Testing Philosophy
// SECTION: Confidence over coverage
// ============================================================

console.log("--- The Testing Philosophy ---\n");
const philosophy = [
  ["Test for confidence, not coverage numbers",
   "95% coverage means nothing if the 5% untested is payment processing."],
  ["Test behavior, not implementation",
   "Tests should survive a refactor."],
  ["The best test catches a real bug",
   "Write regression tests for every bug fix."],
  ["Fast tests get run. Slow tests get skipped.",
   "If your suite takes 30 min, devs stop running it locally."],
];
philosophy.forEach(([principle, explanation], i) => {
  console.log(`  ${i + 1}. ${principle}`);
  console.log(`     ${explanation}\n`);
});


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. CI runs tests automatically on every push/PR. Use GitHub
//    Actions — free, fast, built into GitHub.
// 2. npm ci (not npm install) in CI: clean, reproducible, fast.
// 3. Matrix testing: multiple Node versions in parallel.
// 4. Coverage thresholds: fail CI if coverage drops below 80-85%.
// 5. Pre-commit hooks (Husky + lint-staged): catch bugs before commit.
// 6. Organization: co-located unit tests, separate integration/E2E.
// 7. Test naming: "should [behavior] when [condition]".
// 8. Do NOT test: framework internals, third-party libs, trivial code.
// 9. Parallel + sharding for speed at scale.
// 10. Philosophy: confidence over coverage, behavior over implementation.
// ============================================================
