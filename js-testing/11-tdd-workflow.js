// ============================================================
// FILE 11: TEST-DRIVEN DEVELOPMENT (TDD) WORKFLOW
// Topic: Build software by writing tests FIRST, then code to pass them
// WHY: TDD flips the workflow — you define what "working" means
//   upfront. This leads to cleaner APIs, fewer bugs, and code
//   that is testable by design.
// ============================================================

// ============================================================
// STORY — Razorpay's Refund Calculator
// Razorpay processes millions of transactions daily. Their refund
// module was built with TDD — tests FIRST defined every scenario.
// Result: zero production bugs for 18+ months.
// ============================================================

// --- The TDD Cycle ---
// Phase 1: RED    — Write a test that FAILS (code doesn't exist yet)
// Phase 2: GREEN  — Write the MINIMUM code to make the test pass
// Phase 3: REFACTOR — Clean up code while keeping all tests green
// Then repeat for the next requirement.

// ============================================================
// BLOCK 1 — TDD Walkthrough: Full Refund (Cycle 1)
// SECTION: RED -> GREEN -> REFACTOR
// ============================================================

// --- RED: Write a failing test ---
// test('should calculate full refund', () => {
//   const calc = new RefundCalculator();
//   const result = calc.calculateRefund(1000, 'full');
//   expect(result.refundAmount).toBe(1000);
//   expect(result.status).toBe('approved');
// });
// RESULT: RED — RefundCalculator doesn't exist yet!

// --- GREEN: Write minimum code to pass ---
class RefundCalculator_v1 {
  calculateRefund(originalAmount, type) {
    return { refundAmount: originalAmount, status: 'approved' };
  }
}

const calc_v1 = new RefundCalculator_v1();
console.log("--- Cycle 1: Full Refund ---");
console.log("Full refund:", calc_v1.calculateRefund(1000, 'full'));

// --- REFACTOR: Code is simple enough. Move to next requirement. ---


// ============================================================
// BLOCK 2 — Partial Refund (Cycle 2)
// SECTION: Adding percentage-based refunds
// ============================================================

// --- RED: Test partial refund ---
// test('should calculate partial refund', () => {
//   expect(calc.calculateRefund(1000, 'partial', 50).refundAmount).toBe(500);
// });

// --- GREEN: Add percentage logic ---
class RefundCalculator_v2 {
  calculateRefund(originalAmount, type, percentage = 100) {
    let refundAmount = type === 'full'
      ? originalAmount
      : (originalAmount * percentage) / 100;
    return { refundAmount, status: 'approved' };
  }
}

const calc_v2 = new RefundCalculator_v2();
console.log("\n--- Cycle 2: Partial Refund ---");
console.log("Full:", calc_v2.calculateRefund(1000, 'full'));
console.log("50%:", calc_v2.calculateRefund(1000, 'partial', 50));


// ============================================================
// BLOCK 3 — Validation (Cycle 3)
// SECTION: Rejecting over-refunds
// ============================================================

// TDD excels at catching edge cases — "What if percentage is 150%?"
// arises DURING test writing, not after deployment.

// --- RED: Test over-refund rejection ---
// test('should reject refund exceeding original', () => {
//   expect(calc.calculateRefund(1000, 'partial', 150).status).toBe('rejected');
// });

// --- GREEN: Add validation ---
class RefundCalculator_v3 {
  calculateRefund(originalAmount, type, percentage = 100) {
    let refundAmount = type === 'full'
      ? originalAmount
      : (originalAmount * percentage) / 100;

    if (refundAmount > originalAmount) {
      return { refundAmount: 0, status: 'rejected', reason: 'Refund exceeds original' };
    }
    return { refundAmount, status: 'approved' };
  }
}

const calc_v3 = new RefundCalculator_v3();
console.log("\n--- Cycle 3: Validation ---");
console.log("150% refund:", calc_v3.calculateRefund(1000, 'partial', 150));


// ============================================================
// BLOCK 4 — GST Reversal (Cycle 4)
// SECTION: Tax compliance requirement
// ============================================================

// In India, refunds must reverse the GST collected on the transaction.

// --- RED: Test GST reversal ---
// test('should handle GST reversal', () => {
//   const result = calc.calculateRefund(1000, 'full', 100, { includeGST: true, gstRate: 18 });
//   expect(result.gstReversed).toBeCloseTo(152.54);
// });

// --- GREEN: Add GST calculation ---
class RefundCalculator_v4 {
  calculateRefund(originalAmount, type, percentage = 100, options = {}) {
    let refundAmount = type === 'full'
      ? originalAmount
      : (originalAmount * percentage) / 100;

    if (refundAmount > originalAmount) {
      return { refundAmount: 0, status: 'rejected', reason: 'Refund exceeds original' };
    }

    const result = { refundAmount, status: 'approved' };

    if (options.includeGST && options.gstRate) {
      const baseAmount = refundAmount / (1 + options.gstRate / 100);
      result.gstReversed = Math.round(baseAmount * (options.gstRate / 100) * 100) / 100;
    }
    return result;
  }
}

const calc_v4 = new RefundCalculator_v4();
console.log("\n--- Cycle 4: GST Reversal ---");
console.log("Full + GST:", calc_v4.calculateRefund(1000, 'full', 100, { includeGST: true, gstRate: 18 }));


// ============================================================
// BLOCK 5 — Date Validation (Cycle 5, Final)
// SECTION: 30-day refund window
// ============================================================

class RefundCalculator {
  calculateRefund(originalAmount, type, percentage = 100, options = {}) {
    if (options.transactionDate && options.refundDate && options.maxRefundDays) {
      const diffMs = Math.abs(options.refundDate - options.transactionDate);
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > options.maxRefundDays) {
        return { refundAmount: 0, status: 'rejected', reason: 'Refund window expired', daysSinceTransaction: diffDays };
      }
    }

    let refundAmount = type === 'full' ? originalAmount : (originalAmount * percentage) / 100;

    if (refundAmount > originalAmount) {
      return { refundAmount: 0, status: 'rejected', reason: 'Refund exceeds original' };
    }

    const result = { refundAmount, status: 'approved' };

    if (options.includeGST && options.gstRate) {
      const baseAmount = refundAmount / (1 + options.gstRate / 100);
      result.gstReversed = Math.round(baseAmount * (options.gstRate / 100) * 100) / 100;
    }
    return result;
  }
}

const calculator = new RefundCalculator();
console.log("\n--- Cycle 5: Date Validation ---");
console.log("Within window:", calculator.calculateRefund(1000, 'full', 100, {
  transactionDate: new Date('2024-01-01'), refundDate: new Date('2024-01-15'), maxRefundDays: 30
}));
console.log("Expired:", calculator.calculateRefund(1000, 'full', 100, {
  transactionDate: new Date('2024-01-01'), refundDate: new Date('2024-02-15'), maxRefundDays: 30
}));


// ============================================================
// BLOCK 6 — The Complete Test Suite as Documentation
// SECTION: Reading the suite tells you what the module does
// ============================================================

// describe('RefundCalculator', () => {
//   test('should calculate full refund');                    // Cycle 1
//   test('should calculate partial refund (percentage)');    // Cycle 2
//   test('should reject refund exceeding original');         // Cycle 3
//   test('should handle refund with GST reversal');          // Cycle 4
//   test('should reject refund after 30-day window');        // Cycle 5
// });

console.log("\n--- All 5 Cycles Verified ---");
const scenarios = [
  { desc: "Full refund",        args: [1000, 'full'] },
  { desc: "Partial 50%",        args: [1000, 'partial', 50] },
  { desc: "Over-refund (150%)", args: [1000, 'partial', 150] },
  { desc: "Full + GST 18%",     args: [1000, 'full', 100, { includeGST: true, gstRate: 18 }] },
  { desc: "Expired (45 days)",  args: [1000, 'full', 100, {
    transactionDate: new Date('2024-01-01'), refundDate: new Date('2024-02-15'), maxRefundDays: 30
  }]},
];
scenarios.forEach(s => {
  console.log(`  ${s.desc}:`, JSON.stringify(calculator.calculateRefund(...s.args)));
});


// ============================================================
// BLOCK 7 — When to Use TDD & Common Mistakes
// SECTION: Practical guidance
// ============================================================

console.log("\n--- When to Use TDD ---");
console.log("TDD excels for: business logic, algorithms, validators, API contracts");
console.log("TDD is hard for: UI components, prototypes, third-party integrations");

console.log("\n--- Common TDD Mistakes ---");
console.log("  1. Writing too many tests at once — stick to ONE at a time");
console.log("  2. Testing implementation details instead of behavior");
console.log("  3. Making too big a step — write MINIMUM code to pass");
console.log("  4. Skipping refactor step — leads to messy code");


// ============================================================
// BLOCK 8 — Practical: TDD a CouponValidator
// SECTION: 5 Red-Green-Refactor cycles
// ============================================================

// Cycle 1: isValidFormat  |  Cycle 2: isExpired  |  Cycle 3: hasRemainingUses
// Cycle 4: calculateDiscount  |  Cycle 5: maxDiscount cap

class CouponValidator {
  isValidFormat(code) {
    return /^[A-Z0-9]{6,12}$/.test(code);
  }

  calculateDiscount(coupon, orderAmount) {
    if (!this.isValidFormat(coupon.code)) {
      return { valid: false, reason: 'Invalid coupon format' };
    }
    if (new Date(coupon.expiryDate) < new Date()) {
      return { valid: false, reason: 'Coupon expired' };
    }
    if (coupon.usedCount >= coupon.maxUses) {
      return { valid: false, reason: 'Usage limit reached' };
    }

    let discount = coupon.type === 'percentage'
      ? (orderAmount * coupon.value) / 100
      : coupon.value;

    if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
    if (discount > orderAmount) discount = orderAmount;

    return {
      valid: true,
      discount: Math.round(discount * 100) / 100,
      finalAmount: Math.round((orderAmount - discount) * 100) / 100
    };
  }
}

const cv = new CouponValidator();
console.log("\n--- CouponValidator TDD Results ---");
console.log("Format 'SAVE20':", cv.isValidFormat('SAVE20'));
console.log("Format 'hi':", cv.isValidFormat('hi'));

const validCoupon = {
  code: 'DIWALI50', type: 'percentage', value: 50,
  maxDiscount: 500, expiryDate: '2026-12-31', usedCount: 3, maxUses: 100
};
console.log("50% off Rs 2000:", cv.calculateDiscount(validCoupon, 2000));

const expired = {
  code: 'OLD2023', type: 'flat', value: 100,
  expiryDate: '2023-01-01', usedCount: 0, maxUses: 10
};
console.log("Expired coupon:", cv.calculateDiscount(expired, 1000));

// Each cycle: 2-10 minutes. If longer, your step is too big.

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. TDD = Red (failing test) -> Green (minimum code) -> Refactor.
//    Never have more than one failing test at a time.
// 2. TDD is about DESIGN, not testing. Writing tests first forces
//    you to design the API from the caller's perspective.
// 3. Each cycle should take 2-10 minutes. If longer, break it down.
// 4. TDD excels for business logic, algorithms, validators.
//    It is harder for UI, prototypes, and third-party integrations.
// 5. Common mistakes: too many tests at once, testing implementation
//    details, skipping refactor, making GREEN steps too large.
// 6. Tests written through TDD serve as living documentation.
// ============================================================
