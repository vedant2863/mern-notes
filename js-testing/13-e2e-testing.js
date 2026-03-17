// ============================================================
// FILE 13: END-TO-END (E2E) TESTING
// Topic: Testing the entire application as a real user would
// WHY: Unit tests verify functions, integration tests verify
//   services, but E2E tests verify the COMPLETE user experience
//   — from opening the browser to clicking buttons to seeing
//   results. If E2E tests pass, a real human can use your app.
// ============================================================

// ============================================================
// STORY — IRCTC: 10 Million Daily Users
// Playwright E2E tests caught 40+ regressions before production,
// including a CSS bug that hid "Pay Now" on Safari and a JS
// error that broke captcha on Firefox.
// ============================================================

// ============================================================
// BLOCK 1 — Testing Pyramid & Framework Choice
// SECTION: Where E2E fits and why Playwright
// ============================================================

//         /\          E2E (few, slow, high confidence)
//        /  \
//       /----\        Integration (moderate)
//      /------\
//     /--------\      Unit (many, fast, focused)

console.log("--- Testing Pyramid ---");
console.log("E2E:         5-15 critical journeys, slow, highest confidence");
console.log("Integration: 50-200 service tests, medium speed");
console.log("Unit:        500-5000 function tests, fast, focused\n");

console.log("--- Framework Comparison ---");
console.log("Selenium:   Legacy. Slow, flaky. Use for old projects.");
console.log("Cypress:    Good DX, primarily Chrome. Limited cross-browser.");
console.log("Playwright: Modern standard. Cross-browser, fast, auto-waiting.\n");

// Setup: npm init playwright@latest


// ============================================================
// BLOCK 2 — Basic Test Structure & Locators
// SECTION: Navigate, interact, assert
// ============================================================

// test('user can search for trains', async ({ page }) => {
//   await page.goto('https://irctc.co.in');
//   await page.fill('#from', 'Delhi');
//   await page.fill('#to', 'Mumbai');
//   await page.click('button:has-text("Search")');
//   await expect(page.locator('.results')).toBeVisible();
// });

console.log("--- Locator Priority (best to worst) ---");
const locators = [
  { method: "getByRole('button', { name: 'Search' })", why: "Accessibility-based" },
  { method: "getByTestId('search-btn')",                why: "Dedicated test attribute" },
  { method: "getByText('Book Now')",                    why: "Based on visible text" },
  { method: "getByLabel('From Station')",               why: "Based on form labels" },
  { method: "locator('.btn-primary.mt-3')",             why: "CSS classes change often — AVOID" },
];
locators.forEach((loc, i) => {
  console.log(`  ${i + 1}. ${loc.method} — ${loc.why}`);
});


// ============================================================
// BLOCK 3 — Auto-Waiting
// SECTION: No more sleep()
// ============================================================

// Most E2E flakiness comes from timing. Playwright eliminates it.

console.log("\n--- Auto-Waiting ---");
console.log("BAD (Selenium): await sleep(3000); await page.click('#btn');");
console.log("GOOD (Playwright): await page.click('#btn');  // Waits automatically!");
console.log("\nPlaywright checks before acting:");
console.log("  1. Element exists in DOM");
console.log("  2. Element is visible");
console.log("  3. Element is stable (not animating)");
console.log("  4. Element is enabled\n");

// Custom waits for rare cases:
// await page.waitForSelector('.results');
// await page.waitForURL('**/booking/confirmed');
// await page.waitForResponse('**/api/trains');


// ============================================================
// BLOCK 4 — Network Interception
// SECTION: Mock API responses in the browser
// ============================================================

// test('show trains from mocked API', async ({ page }) => {
//   await page.route('**/api/trains', route => route.fulfill({
//     status: 200,
//     contentType: 'application/json',
//     body: JSON.stringify({ trains: [
//       { name: 'Rajdhani Express', departure: '06:00', price: 2500 }
//     ]})
//   }));
//   await page.goto('/search');
//   await page.click('button:has-text("Search")');
//   await expect(page.getByText('Rajdhani Express')).toBeVisible();
// });

console.log("--- Network Interception ---");
console.log("Mock success: route.fulfill({ status: 200, body: mockData })");
console.log("Mock error:   route.fulfill({ status: 500 })");
console.log("Block:        route.abort()");


// ============================================================
// BLOCK 5 — Config, Debugging & CI
// SECTION: Screenshots, videos, running tests
// ============================================================

// playwright.config.js:
// module.exports = defineConfig({
//   use: {
//     screenshot: 'only-on-failure',
//     video: 'retain-on-failure',
//     trace: 'on-first-retry',
//   },
//   projects: [
//     { name: 'chromium', use: { browserName: 'chromium' } },
//     { name: 'firefox',  use: { browserName: 'firefox' } },
//     { name: 'webkit',   use: { browserName: 'webkit' } },
//   ]
// });

console.log("\n--- Running Playwright ---");
console.log("All tests:     npx playwright test");
console.log("See browser:   npx playwright test --headed");
console.log("Debug mode:    npx playwright test --debug");
console.log("Single file:   npx playwright test login.spec.js");
console.log("Codegen:       npx playwright codegen https://example.com\n");

// GitHub Actions CI:
// - run: npx playwright install --with-deps
// - run: npx playwright test
// - uses: actions/upload-artifact@v4
//   if: always()
//   with: { name: playwright-report, path: playwright-report/ }


// ============================================================
// BLOCK 6 — E2E Best Practices
// SECTION: Keep it small, keep it stable
// ============================================================

console.log("--- E2E Best Practices ---");
console.log("1. Test USER JOURNEYS, not individual pages");
console.log("2. Use data-testid for stable selectors");
console.log("3. Clean up test data (create before, delete after)");
console.log("4. Keep suite SMALL: 5-15 critical paths");
console.log("5. Avoid sleep/hard waits — use Playwright's auto-waiting");
console.log("6. Run in parallel: workers: 4 in config\n");


// ============================================================
// BLOCK 7 — Page Object Model (POM)
// SECTION: Encapsulate selectors for maintainability
// ============================================================

// When UI changes, update ONE class instead of 15 test files.

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.signInButton = page.locator('button[type="submit"]');
  }
  async goto() { await this.page.goto('/login'); }
  async login(user, pass) {
    await this.usernameInput.fill(user);
    await this.passwordInput.fill(pass);
    await this.signInButton.click();
  }
}

class SearchPage {
  constructor(page) {
    this.page = page;
    this.from = page.locator('#from');
    this.to = page.locator('#to');
    this.searchBtn = page.locator('button[name="Search"]');
  }
  async search(from, to) {
    await this.from.fill(from);
    await this.to.fill(to);
    await this.searchBtn.click();
  }
}

// Usage:
// test('book ticket', async ({ page }) => {
//   const login = new LoginPage(page);
//   const search = new SearchPage(page);
//   await login.goto();
//   await login.login('testuser', 'pass');
//   await search.search('Delhi', 'Mumbai');
// });

console.log("--- Page Object Model ---");
console.log("LoginPage: encapsulates login selectors and actions");
console.log("SearchPage: encapsulates search selectors and actions");
console.log("Benefit: UI change = update ONE class, not 15 test files");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. E2E tests verify the complete user experience in a real browser.
// 2. Use Playwright — modern, fast, supports all major browsers.
// 3. Stable locators: getByRole() > getByTestId() > CSS selectors.
// 4. Playwright auto-waits — no sleep() needed.
// 5. Network interception: mock external APIs in E2E tests.
// 6. Screenshots/videos on failure for easy debugging.
// 7. Keep suite small: 5-15 critical user journeys.
// 8. Page Object Model keeps large test suites maintainable.
// ============================================================
