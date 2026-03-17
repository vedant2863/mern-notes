// ============================================================
// FILE 09: SNAPSHOT TESTING
// Topic: Capturing output and comparing against stored snapshots
// WHY: Snapshots detect unexpected changes in rendered HTML,
//   API responses, or config objects — a safety net that says
//   "this changed — was it intentional?"
// ============================================================

// ============================================================
// STORY — CRED Rewards Page
// After a routine refactor, a developer changed reward tier
// labels from "Gold" to "gold" (lowercase). No unit test caught
// it. A snapshot test would have flagged the change instantly.
// ============================================================

// ============================================================
// BLOCK 1 — Basic Snapshot Testing
// SECTION: How snapshots work
// ============================================================

// First run: capture output, save to .snap file
// Next runs: compare current output to stored snapshot
// If different: test FAILS, shows exact diff

function generateOrderConfirmation(order) {
  const subtotal = order.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  return {
    orderId: order.id,
    customerName: order.customer.name,
    items: order.items.map((item) => ({
      name: item.name, quantity: item.quantity, price: item.price,
      total: item.quantity * item.price,
    })),
    subtotal,
    gst: Math.round(subtotal * 0.18),
    grandTotal: Math.round(subtotal * 1.18),
    rewardPoints: Math.floor(subtotal / 100),
    tier: determineTier(subtotal),
    message: `Thank you, ${order.customer.name}! Your order #${order.id} has been confirmed.`,
  };
}

function determineTier(amount) {
  if (amount >= 50000) return "Platinum";
  if (amount >= 20000) return "Gold";
  if (amount >= 5000) return "Silver";
  return "Bronze";
}

// test('order confirmation matches snapshot', () => {
//   const order = {
//     id: 'CRED-2024-001',
//     customer: { name: 'Rahul Sharma' },
//     items: [
//       { name: 'Premium Credit Card Holder', quantity: 1, price: 2999 },
//       { name: 'CRED Travel Kit', quantity: 2, price: 1499 },
//     ],
//   };
//   expect(generateOrderConfirmation(order)).toMatchSnapshot();
//   // First run: creates __snapshots__/09-snapshot-testing.test.js.snap
//   // Next runs: compares current value to stored snapshot
// });

console.log("--- Basic Snapshot ---");
console.log("expect(value).toMatchSnapshot()");
console.log("Stored in __snapshots__/ directory. Commit to version control.");
console.log("");

// ============================================================
// BLOCK 2 — Inline Snapshots
// SECTION: Snapshots stored in the test file itself
// ============================================================

// Great for small values — visible during code review without
// opening a separate .snap file.

// test('tier determination', () => {
//   expect(determineTier(60000)).toMatchInlineSnapshot(`"Platinum"`);
//   expect(determineTier(25000)).toMatchInlineSnapshot(`"Gold"`);
//   expect(determineTier(8000)).toMatchInlineSnapshot(`"Silver"`);
//   expect(determineTier(1000)).toMatchInlineSnapshot(`"Bronze"`);
// });

// On FIRST run, vitest auto-fills the inline snapshot:
// Before: expect(determineTier(60000)).toMatchInlineSnapshot();
// After:  expect(determineTier(60000)).toMatchInlineSnapshot(`"Platinum"`);

console.log("--- Inline Snapshots ---");
console.log("toMatchInlineSnapshot() — stored in the test file itself.");
console.log("Auto-filled on first run. Great for small values.");
console.log("");

// ============================================================
// BLOCK 3 — HTML Template Snapshots
// SECTION: Capturing entire rendered structures
// ============================================================

function renderConfirmationEmail(order) {
  const c = generateOrderConfirmation(order);
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    .header { background: #1a1a2e; color: #e0e0e0; padding: 20px; text-align: center; }
    .tier-badge { padding: 4px 12px; border-radius: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Order Confirmed!</h1>
    <p>${c.message}</p>
    <span class="tier-badge tier-${c.tier}">${c.tier} Member</span>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>
      ${c.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>Rs. ${i.price}</td><td>Rs. ${i.total}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3">Subtotal</td><td>Rs. ${c.subtotal}</td></tr>
      <tr><td colspan="3">GST (18%)</td><td>Rs. ${c.gst}</td></tr>
      <tr class="total-row"><td colspan="3">Grand Total</td><td>Rs. ${c.grandTotal}</td></tr>
    </tfoot>
  </table>
  <p>You earned <strong>${c.rewardPoints} CRED coins</strong>!</p>
</body>
</html>`.trim();
}

// test('email HTML matches snapshot', () => {
//   const order = {
//     id: 'CRED-2024-042', customer: { name: 'Ananya Iyer' },
//     items: [{ name: 'Wireless Earbuds', quantity: 1, price: 4999 }],
//   };
//   expect(renderConfirmationEmail(order)).toMatchSnapshot();
// });

console.log("--- HTML Snapshots ---");
console.log("Snapshot entire HTML templates. Catches structural changes.");
console.log("");

// ============================================================
// BLOCK 4 — Updating Snapshots
// SECTION: When a snapshot fails, what do you do?
// ============================================================

// Two choices when a snapshot fails:
// 1. The change is a BUG -> fix your code
// 2. The change is INTENTIONAL -> update the snapshot

// npx vitest -u   |   npx jest -u
// In watch mode: press 'u' to update interactively
// ALWAYS review the diff BEFORE updating.

console.log("--- Updating Snapshots ---");
console.log("npx vitest -u  |  npx jest -u");
console.log("ALWAYS review diff before updating. Blind updates = useless tests.");
console.log("");

// ============================================================
// BLOCK 5 — Property Matchers (Dynamic Values)
// SECTION: Handling timestamps, random IDs, UUIDs
// ============================================================

// Timestamps and random IDs break plain snapshots.
// Property matchers replace dynamic values with type checks.

function createOrder(items, customer) {
  return {
    orderId: "CRED-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    createdAt: new Date(),
    customer,
    items,
    status: "confirmed",
    totalAmount: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  };
}

// test('order with dynamic values', () => {
//   const order = createOrder(
//     [{ name: 'Earbuds', quantity: 1, price: 4999 }],
//     { name: 'Vikram' }
//   );
//   expect(order).toMatchSnapshot({
//     orderId: expect.any(String),
//     createdAt: expect.any(Date),
//   });
// });

console.log("--- Property Matchers ---");
console.log("toMatchSnapshot({ id: expect.any(String), date: expect.any(Date) })");
console.log("");

// ============================================================
// BLOCK 6 — What to Snapshot (and What NOT to)
// SECTION: Choosing good snapshot candidates
// ============================================================

// GOOD: Rendered HTML/JSX, API response shapes, config objects, error messages
// BAD:  Large objects (100+ lines), frequently changing data, CSS classes, random values

console.log("--- What to Snapshot ---");
console.log("GOOD: HTML output, API shapes, config, error messages.");
console.log("BAD:  Large objects, changing data, CSS classes, random values.");
console.log("Rule: If you'd blindly update it, don't snapshot it.");
console.log("");

// ============================================================
// BLOCK 7 — Best Practices
// SECTION: Making snapshots useful, not noisy
// ============================================================

// 1. Keep snapshots SMALL and FOCUSED
//    BAD:  expect(renderEntirePage()).toMatchSnapshot();
//    GOOD: expect(renderRewardCard(reward)).toMatchSnapshot();
// 2. Name snapshots: expect(badge).toMatchSnapshot('gold tier badge');
// 3. Review .snap changes in PRs like code changes
// 4. Inline for values under ~5 lines, file for larger ones
// 5. Combine snapshots with targeted assertions:
//    expect(confirmation.grandTotal).toBe(7076);    // Critical logic
//    expect(confirmation).toMatchSnapshot();         // Structure safety net

console.log("--- Best Practices ---");
console.log("1. Small & focused — snapshot sections, not pages");
console.log("2. Name snapshots: toMatchSnapshot('descriptive name')");
console.log("3. Review .snap changes in PRs like code changes");
console.log("4. Combine with targeted assertions for critical logic");
console.log("");

// ============================================================
// BLOCK 8 — Complete Example
// SECTION: Combining all snapshot techniques
// ============================================================

function formatCurrency(amount) {
  return "Rs. " + amount.toLocaleString("en-IN");
}

function renderRewardSummary(order) {
  const c = generateOrderConfirmation(order);
  return `<div class="reward-summary">
  <div class="tier-badge ${c.tier.toLowerCase()}">${c.tier} Member</div>
  <p>You earned <strong>${c.rewardPoints}</strong> CRED coins</p>
</div>`;
}

// describe('Order Snapshots', () => {
//   const order = {
//     id: 'CRED-2024-001', customer: { name: 'Rahul Sharma' },
//     items: [
//       { name: 'Card Holder', quantity: 1, price: 2999 },
//       { name: 'Travel Kit', quantity: 2, price: 1499 },
//     ],
//   };
//
//   test('confirmation object', () => {
//     const c = generateOrderConfirmation(order);
//     expect(c.grandTotal).toBe(7076);           // Targeted assertion
//     expect(c).toMatchSnapshot('silver order');  // Structure snapshot
//   });
//
//   test('tier determination (inline)', () => {
//     expect(determineTier(100)).toMatchInlineSnapshot(`"Bronze"`);
//     expect(determineTier(50000)).toMatchInlineSnapshot(`"Platinum"`);
//   });
//
//   test('dynamic order with property matchers', () => {
//     const o = createOrder([{ name: 'Earbuds', quantity: 1, price: 4999 }], { name: 'Priya' });
//     expect(o).toMatchSnapshot({ orderId: expect.any(String), createdAt: expect.any(Date) });
//   });
//
//   test('reward summary HTML', () => {
//     expect(renderRewardSummary(order)).toMatchSnapshot('reward summary');
//   });
// });

console.log("--- Complete Snapshot Suite ---");
console.log("Object + HTML + inline + property matchers combined.");
console.log("");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Snapshot testing captures output and compares on subsequent runs.
//    Any difference fails the test and shows the exact diff.
// 2. toMatchSnapshot() -> .snap file. toMatchInlineSnapshot() -> inline.
//    Use inline for small values (< 5 lines).
// 3. Update with -u. ALWAYS review diff before updating.
// 4. Property matchers for dynamic values:
//    toMatchSnapshot({ id: expect.any(String), date: expect.any(Date) })
// 5. Keep snapshots small, focused, and named descriptively.
// 6. Combine snapshots with targeted assertions for critical logic.
// 7. Commit .snap files. Review changes in PRs like code changes.
// ============================================================

console.log("=== File 09 Complete: Snapshot Testing ===");
