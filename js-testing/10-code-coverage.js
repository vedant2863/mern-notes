// ============================================================
// FILE 10: CODE COVERAGE
// Topic: Measuring test coverage — metrics, reports, thresholds
// WHY: Code coverage tells you WHICH lines your tests execute,
//   not WHETHER those lines are correct. Understanding this
//   difference is key to using coverage as a tool, not a religion.
// ============================================================

// ============================================================
// STORY — Zerodha's Trading Bug
// A margin calculation function had 100% line coverage — every
// line was executed. But the test only checked valid inputs. No
// test for negative quantity or zero price. The bug went to
// production. Coverage measures EXECUTION, not CORRECTNESS.
// ============================================================

// ============================================================
// BLOCK 1 — The Four Coverage Metrics
// SECTION: What coverage actually measures
// ============================================================

function calculateMargin(stockPrice, quantity, marginPercent, orderType) {
  if (stockPrice <= 0) {
    throw new Error("Stock price must be positive");
  }
  if (quantity <= 0) {
    throw new Error("Quantity must be positive");
  }
  if (marginPercent < 0 || marginPercent > 100) {
    throw new Error("Margin must be between 0 and 100");
  }

  const totalValue = stockPrice * quantity;

  let marginRequired;
  if (orderType === "intraday") {
    marginRequired = totalValue * (marginPercent / 100) * 0.5;
  } else if (orderType === "delivery") {
    marginRequired = totalValue * (marginPercent / 100);
  } else {
    throw new Error(`Unknown order type: ${orderType}`);
  }

  const minimumMargin = 500;
  if (marginRequired < minimumMargin) {
    marginRequired = minimumMargin;
  }

  return {
    totalValue,
    marginRequired: Math.round(marginRequired * 100) / 100,
    orderType,
    leveraged: orderType === "intraday",
  };
}

console.log("--- The Four Coverage Metrics ---");
console.log("1. STATEMENT: % of individual statements executed");
console.log("2. BRANCH:    % of decision paths taken (MOST IMPORTANT)");
console.log("3. FUNCTION:  % of functions called at least once");
console.log("4. LINE:      % of executable lines executed");
console.log("");

// ============================================================
// BLOCK 2 — Running Coverage Reports
// SECTION: Tools and configuration
// ============================================================

// Vitest:  npx vitest --coverage
// Jest:    npx jest --coverage

// vitest.config.js:
// export default {
//   test: {
//     coverage: {
//       provider: 'v8',
//       include: ['src/**/*.{js,ts}'],
//       exclude: ['src/**/*.test.*', 'src/mocks/**'],
//       reporter: ['text', 'html', 'lcov'],
//     },
//   },
// };

console.log("--- Running Coverage ---");
console.log("npx vitest --coverage  |  npx jest --coverage");
console.log("Providers: V8 (fast, native) or Istanbul (compatible)");
console.log("Reports: text (terminal), html (visual), lcov (CI tools)");
console.log("");

// ============================================================
// BLOCK 3 — Reading Coverage Reports
// SECTION: Understanding the output
// ============================================================

// Terminal output:
// File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered
// ------------------|---------|----------|---------|---------|----------
// marginCalc.js     |   95.0  |   60.0   |  100.0  |   95.0  | 28-30, 42

// HTML report colors:
// GREEN:  Line fully covered (all branches taken)
// RED:    Line NEVER executed
// YELLOW: Line executed but NOT ALL BRANCHES taken (most dangerous!)

console.log("--- Reading Reports ---");
console.log("Focus on % Branch and Uncovered Lines.");
console.log("HTML: GREEN=covered, RED=uncovered, YELLOW=partial (dangerous)");
console.log("");

// ============================================================
// BLOCK 4 — The 100% Coverage Myth
// SECTION: Why 100% coverage does not mean bug-free
// ============================================================

function divide(a, b) {
  return a / b;   // 100% line coverage with just divide(10, 2)
}

// test('divides two numbers', () => {
//   expect(divide(10, 2)).toBe(5);    // 100% coverage!
// });
// BUT: divide(10, 0) -> Infinity     (NOT TESTED!)
//      divide(0, 0)  -> NaN          (NOT TESTED!)

console.log("--- The 100% Coverage Myth ---");
console.log("divide(10, 2) = 100% coverage. But divide(10, 0) = Infinity!");
console.log("Coverage measures EXECUTION, not CORRECTNESS.");
console.log("");

// ============================================================
// BLOCK 5 — Fixing the Coverage Gap
// SECTION: Tests targeting each branch
// ============================================================

// describe('calculateMargin', () => {
//   test('throws for zero stock price', () => {
//     expect(() => calculateMargin(0, 10, 20, 'delivery')).toThrow('Stock price must be positive');
//   });
//   test('throws for zero quantity', () => {
//     expect(() => calculateMargin(100, 0, 20, 'delivery')).toThrow('Quantity must be positive');
//   });
//   test('throws for margin out of range', () => {
//     expect(() => calculateMargin(100, 10, -5, 'delivery')).toThrow('Margin must be between 0 and 100');
//   });
//   test('applies 50% discount for intraday', () => {
//     const result = calculateMargin(1000, 10, 20, 'intraday');
//     expect(result.marginRequired).toBe(1000);
//     expect(result.leveraged).toBe(true);
//   });
//   test('applies full margin for delivery', () => {
//     expect(calculateMargin(1000, 10, 20, 'delivery').marginRequired).toBe(2000);
//   });
//   test('throws for unknown order type', () => {
//     expect(() => calculateMargin(100, 10, 20, 'futures')).toThrow('Unknown order type: futures');
//   });
//   test('enforces minimum margin of 500', () => {
//     expect(calculateMargin(100, 1, 10, 'delivery').marginRequired).toBe(500);
//   });
// });

console.log("--- Complete Branch Coverage ---");
console.log("Each test targets a specific branch.");
console.log("Result: 100% statement, 100% branch, 100% function, 100% line.");
console.log("");

// ============================================================
// BLOCK 6 — Coverage Thresholds
// SECTION: Enforcing minimums in CI
// ============================================================

// vitest.config.js:
// coverage: {
//   thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
// }

// jest.config.js:
// coverageThreshold: {
//   global: { branches: 80, functions: 80, lines: 80, statements: 80 },
//   './src/trading/': { branches: 95 },   // Higher for critical modules
// }

console.log("--- Coverage Thresholds ---");
console.log("Set in config. CI fails if coverage drops below.");
console.log("Recommended: 80% overall, 90%+ for critical paths.");
console.log("");

// ============================================================
// BLOCK 7 — Ignoring Code and CI Integration
// SECTION: Excluding non-production code
// ============================================================

// Config exclusion:
// exclude: ['src/**/*.test.*', 'src/mocks/**', 'src/__generated__/**']

// Inline ignore comments:
/* istanbul ignore next */
function debugLog(message) {
  if (process.env.DEBUG) { console.log(`[DEBUG] ${message}`); }
}

// /* c8 ignore next */ — V8/c8 ignore
// Use sparingly! Overuse defeats the purpose.

// CI integration (GitHub Actions):
// - run: npx vitest --coverage
// - uses: codecov/codecov-action@v4
//   with: { token: ${{ secrets.CODECOV_TOKEN }}, files: ./coverage/lcov.info }

console.log("--- Ignoring Code & CI ---");
console.log("Config: exclude files/directories.");
console.log("Inline: /* istanbul ignore next */ or /* c8 ignore next */");
console.log("CI: upload lcov.info to Codecov/Coveralls for PR diffs.");
console.log("");

// ============================================================
// BLOCK 8 — Coverage Gap Analysis
// SECTION: Finding what 100% line coverage misses
// ============================================================

function calculatePortfolioValue(holdings) {
  if (!holdings || holdings.length === 0) {
    return { totalValue: 0, totalGain: 0, gainPercent: 0 };
  }
  let totalInvested = 0, totalCurrent = 0;
  for (const h of holdings) {
    totalInvested += h.buyPrice * h.quantity;
    totalCurrent += h.currentPrice * h.quantity;
  }
  const totalGain = totalCurrent - totalInvested;
  const gainPercent = totalInvested > 0 ? Math.round((totalGain / totalInvested) * 10000) / 100 : 0;
  return {
    totalValue: Math.round(totalCurrent * 100) / 100,
    totalGain: Math.round(totalGain * 100) / 100,
    gainPercent,
  };
}

// 2 tests give 100% line coverage but miss: null input, delisted stock, all-loss
// test('null input', () => {
//   expect(calculatePortfolioValue(null)).toEqual({ totalValue: 0, totalGain: 0, gainPercent: 0 });
// });
// test('delisted stock (price=0)', () => {
//   const result = calculatePortfolioValue([{ stock: 'DEWAN', buyPrice: 100, currentPrice: 0, quantity: 100 }]);
//   expect(result.totalGain).toBe(-10000);
//   expect(result.gainPercent).toBe(-100);
// });

console.log("--- Coverage Gap Analysis ---");
console.log("100% line coverage with 2 tests. Looks great!");
console.log("Missing: null, delisted stock, all-loss portfolio.");
console.log("THESE edge cases are where production bugs live.");
console.log("");

// ============================================================
// BLOCK 9 — Coverage Anti-Patterns
// SECTION: Common ways to game coverage numbers
// ============================================================

// 1. Tests without assertions — execution without verification
//    test('calc', () => { calculateMargin(100, 10, 20, 'delivery'); });
// 2. Snapshot padding — inflates coverage without logic testing
// 3. Dead code coverage — delete unused code, don't test it

console.log("--- Anti-Patterns ---");
console.log("1. Tests without assertions — execution without verification");
console.log("2. Snapshot padding — inflates coverage without logic testing");
console.log("3. Dead code coverage — delete unused code, don't test it");
console.log("");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Coverage measures EXECUTION, not CORRECTNESS.
//    100% coverage does not mean bug-free.
// 2. Four metrics: Statement, Branch, Function, Line.
//    BRANCH is most important — it tracks decision paths.
// 3. HTML reports: GREEN=covered, RED=uncovered, YELLOW=partial.
// 4. Set thresholds (80% recommended). CI fails if not met.
// 5. Tiered targets: 95% for critical paths, 80% business logic,
//    70% utilities. Focus where bugs cause most damage.
// 6. Anti-patterns: tests without assertions, snapshot padding,
//    dead code coverage. Goal is CONFIDENCE, not a number.
// ============================================================

console.log("=== File 10 Complete: Code Coverage ===");
