/** ============================================================
 *  FILE 29: DESIGN A PAYMENT SYSTEM
 *  ============================================================
 *  Topic: Payment lifecycle, idempotency keys, double-entry ledger,
 *         reconciliation, refunds, state machines, retry logic
 *
 *  WHY THIS MATTERS:
 *  Payment systems handle real money — bugs mean financial loss.
 *  India's UPI processes 10B+ transactions monthly. Every payment
 *  must be exactly-once, auditable, and reconcilable.
 *  ============================================================ */

// STORY: UPI / RazorPay
// When a customer pays Rs 500 for a Swiggy order, the system creates
// exactly two ledger entries: debit customer, credit Swiggy. If the
// network drops, the idempotency key ensures no double charge. At
// end of day, reconciliation checks every entry against bank statements.

console.log("=".repeat(70));
console.log("  FILE 29: DESIGN A PAYMENT SYSTEM");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Payment Lifecycle
// ════════════════════════════════════════════════════════════════

console.log("SECTION 1 — Payment Lifecycle");
console.log("-".repeat(50));

console.log("  Customer -> Merchant -> Payment Gateway -> Bank\n");
[{ stage: "INITIATE", desc: "Customer clicks Pay Now" },
 { stage: "AUTHORIZE", desc: "Bank verifies funds, places hold" },
 { stage: "CAPTURE", desc: "Merchant confirms, bank moves money" },
 { stage: "SETTLE", desc: "Money transferred to merchant's bank" },
 { stage: "COMPLETE", desc: "Fully settled, receipt generated" },
].forEach(s => console.log(`  ${s.stage.padEnd(12)} -> ${s.desc}`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Idempotency Keys
// ════════════════════════════════════════════════════════════════

// WHY: Network retries MUST NOT charge a customer twice.

console.log("SECTION 2 — Idempotency Keys");
console.log("-".repeat(50));

class IdempotencyStore {
  constructor() { this.keys = new Map(); this.ttl = 86400000; }
  check(key) {
    const entry = this.keys.get(key);
    if (!entry) return { exists: false };
    if (Date.now() - entry.timestamp > this.ttl) { this.keys.delete(key); return { exists: false }; }
    return { exists: true, result: entry.result };
  }
  store(key, result) { this.keys.set(key, { result, timestamp: Date.now() }); }
}

const idempotencyStore = new IdempotencyStore();

function processPayment(idempotencyKey, details) {
  const existing = idempotencyStore.check(idempotencyKey);
  if (existing.exists) return { ...existing.result, note: "IDEMPOTENT — cached result, no duplicate charge" };
  const result = { paymentId: `pay_${Date.now()}`, amount: details.amount, status: "success" };
  idempotencyStore.store(idempotencyKey, result);
  return result;
}

console.log("First attempt:");
const first = processPayment("order_123_payment", { amount: 500, currency: "INR" });
console.log(`  Payment ID: ${first.paymentId}, Status: ${first.status}`);

console.log("\nRetry (same key):");
const retry = processPayment("order_123_payment", { amount: 500, currency: "INR" });
console.log(`  Payment ID: ${retry.paymentId}, Note: ${retry.note}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Double-Entry Ledger
// ════════════════════════════════════════════════════════════════

// WHY: Every rupee debited must be credited somewhere.

console.log("SECTION 3 — Double-Entry Ledger");
console.log("-".repeat(50));

class Ledger {
  constructor() { this.entries = []; this.balances = new Map(); this.entryCounter = 0; }
  _ensureAccount(id, balance = 0) { if (!this.balances.has(id)) this.balances.set(id, balance); }
  createTransaction(description, debitAccount, creditAccount, amount) {
    if (amount <= 0) return { success: false, error: "Amount must be positive" };
    this._ensureAccount(debitAccount); this._ensureAccount(creditAccount);
    if (this.balances.get(debitAccount) < amount) return { success: false, error: `Insufficient balance in ${debitAccount}` };
    const txnId = `txn_${++this.entryCounter}`;
    this.balances.set(debitAccount, this.balances.get(debitAccount) - amount);
    this.balances.set(creditAccount, this.balances.get(creditAccount) + amount);
    this.entries.push({ txnId, account: debitAccount, type: "DEBIT", amount: -amount });
    this.entries.push({ txnId, account: creditAccount, type: "CREDIT", amount: +amount });
    return { success: true, txnId };
  }
  getBalance(id) { return this.balances.get(id) || 0; }
  verifyBalance() {
    let debits = 0, credits = 0;
    this.entries.forEach(e => { if (e.type === "DEBIT") debits += Math.abs(e.amount); else credits += e.amount; });
    return { totalDebits: debits, totalCredits: credits, balanced: Math.abs(debits - credits) < 0.01 };
  }
}

const ledger = new Ledger();
ledger._ensureAccount("rahul_wallet", 10000);
ledger._ensureAccount("swiggy_account", 0);
ledger._ensureAccount("razorpay_fees", 0);

console.log("Transaction 1: Rahul pays Rs 450 for Swiggy");
ledger.createTransaction("Swiggy Order", "rahul_wallet", "swiggy_account", 450);
console.log(`  Rahul: Rs ${ledger.getBalance("rahul_wallet")}, Swiggy: Rs ${ledger.getBalance("swiggy_account")}`);

console.log("\nTransaction 2: RazorPay 2% fee from Swiggy");
ledger.createTransaction("Processing fee", "swiggy_account", "razorpay_fees", 9);
console.log(`  Swiggy: Rs ${ledger.getBalance("swiggy_account")}, RazorPay: Rs ${ledger.getBalance("razorpay_fees")}`);

const v = ledger.verifyBalance();
console.log(`\n  Double-Entry Check: Debits=Rs ${v.totalDebits}, Credits=Rs ${v.totalCredits}, Balanced=${v.balanced}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Payment State Machine
// ════════════════════════════════════════════════════════════════

// WHY: Payments have strict state transitions — invalid transitions cause money errors.

console.log("SECTION 4 — Payment State Machine");
console.log("-".repeat(50));

class PaymentStateMachine {
  constructor() {
    this.transitions = {
      "CREATED": ["PROCESSING", "CANCELLED"], "PROCESSING": ["AUTHORIZED", "FAILED", "TIMEOUT"],
      "AUTHORIZED": ["CAPTURED", "VOIDED"], "CAPTURED": ["SETTLED", "REFUND_INITIATED"],
      "SETTLED": ["REFUND_INITIATED", "COMPLETED"], "COMPLETED": ["REFUND_INITIATED"],
      "REFUND_INITIATED": ["REFUNDED", "REFUND_FAILED"], "FAILED": ["CREATED"], "TIMEOUT": ["CREATED"],
      "REFUNDED": [], "CANCELLED": [], "VOIDED": [], "REFUND_FAILED": ["REFUND_INITIATED"]
    };
  }
  transition(payment, newState, reason = "") {
    const allowed = this.transitions[payment.state] || [];
    if (!allowed.includes(newState)) return { success: false, error: `Invalid: ${payment.state} -> ${newState}`, allowed };
    const prev = payment.state; payment.state = newState;
    payment.stateHistory.push({ from: prev, to: newState, reason });
    return { success: true, from: prev, to: newState };
  }
}

const sm = new PaymentStateMachine();
console.log("  State Diagram:");
console.log("  CREATED -> PROCESSING -> AUTHORIZED -> CAPTURED -> SETTLED -> COMPLETED");
console.log("     |           |             |                          |");
console.log("  CANCELLED   FAILED        VOIDED               REFUND_INITIATED\n");

const payment = { id: "pay_001", state: "CREATED", stateHistory: [] };
[["PROCESSING", "UPI request sent"], ["AUTHORIZED", "Bank approved"], ["CAPTURED", "Funds captured"],
 ["SETTLED", "Money transferred"], ["COMPLETED", "Done"]
].forEach(([s, r]) => {
  const res = sm.transition(payment, s, r);
  if (res.success) console.log(`  ${res.from.padEnd(14)} -> ${res.to.padEnd(14)} (${r})`);
});

const invalid = sm.transition(payment, "CREATED", "Reset");
console.log(`\n  Invalid: COMPLETED -> CREATED: ${invalid.error}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Reconciliation
// ════════════════════════════════════════════════════════════════

// WHY: Catches discrepancies between internal ledger and bank statements.

console.log("SECTION 5 — Reconciliation");
console.log("-".repeat(50));

class ReconciliationEngine {
  reconcile(internalLedger, bankStatement) {
    const bankMap = new Map(bankStatement.map(e => [e.txnRef, e]));
    const ledgerMap = new Map(internalLedger.map(e => [e.txnRef, e]));
    const matched = [], missingInBank = [], missingInLedger = [], mismatch = [];
    internalLedger.forEach(e => {
      const b = bankMap.get(e.txnRef);
      if (!b) missingInBank.push(e);
      else if (Math.abs(e.amount - b.amount) > 0.01) mismatch.push({ txnRef: e.txnRef, ledger: e.amount, bank: b.amount });
      else matched.push(e.txnRef);
    });
    bankStatement.forEach(e => { if (!ledgerMap.has(e.txnRef)) missingInLedger.push(e); });
    return { matched: matched.length, missingInBank: missingInBank.length, missingInLedger: missingInLedger.length, mismatches: mismatch.length, reconciled: missingInBank.length === 0 && missingInLedger.length === 0 && mismatch.length === 0 };
  }
}

const recon = new ReconciliationEngine();
const result = recon.reconcile(
  [{ txnRef: "UPI/001", amount: 450 }, { txnRef: "UPI/002", amount: 680 }, { txnRef: "UPI/003", amount: 200 }, { txnRef: "UPI/004", amount: 1500 }],
  [{ txnRef: "UPI/001", amount: 450 }, { txnRef: "UPI/002", amount: 680 }, { txnRef: "UPI/003", amount: 199 }, { txnRef: "UPI/005", amount: 350 }]
);
console.log(`  Matched: ${result.matched}, Missing in bank: ${result.missingInBank}, Missing in ledger: ${result.missingInLedger}, Mismatches: ${result.mismatches}`);
console.log(`  Status: ${result.reconciled ? "RECONCILED" : "DISCREPANCIES FOUND"}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Refund Handling
// ════════════════════════════════════════════════════════════════

// WHY: Refunds are reverse transactions following double-entry rules.

console.log("SECTION 6 — Refund Handling");
console.log("-".repeat(50));

console.log("Refund: Rahul's Swiggy biryani was cold (full refund Rs 450)\n");
console.log(`  Rahul before: Rs ${ledger.getBalance("rahul_wallet")}, Swiggy before: Rs ${ledger.getBalance("swiggy_account")}`);
const refundResult = ledger.createTransaction("Refund - cold biryani", "swiggy_account", "rahul_wallet", 441);
console.log(`  Refund txn: ${refundResult.txnId}`);
console.log(`  Rahul after: Rs ${ledger.getBalance("rahul_wallet")}, Swiggy after: Rs ${ledger.getBalance("swiggy_account")}`);
console.log(`  Double-entry still balanced: ${ledger.verifyBalance().balanced}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 7 — Retry with Exponential Backoff
// ════════════════════════════════════════════════════════════════

// WHY: UPI on 2G networks timeout frequently — smart retry saves the day.

console.log("SECTION 7 — Retry with Exponential Backoff");
console.log("-".repeat(50));

class PaymentRetryManager {
  constructor(maxRetries = 3) { this.maxRetries = maxRetries; this.delays = [1000, 2000, 4000]; }
  processWithRetry(paymentFn, paymentId) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = paymentFn(attempt);
      if (result.success) return { success: true, attempts: attempt };
      console.log(`    Attempt ${attempt}: FAILED (${result.error}), retry in ${this.delays[attempt - 1]}ms`);
    }
    return { success: false, attempts: this.maxRetries, action: "Manual investigation required" };
  }
}

const retryMgr = new PaymentRetryManager(3);
let attemptCount = 0;
const retryResult = retryMgr.processWithRetry((attempt) => {
  attemptCount++;
  if (attemptCount <= 2) return { success: false, error: "TIMEOUT: Bank not responding" };
  return { success: true, paymentId: "pay_retry_001" };
}, "pay_retry_001");

console.log(`  Final: ${retryResult.success ? "SUCCESS" : "FAILED"} after ${retryResult.attempts} attempts`);
console.log("\n  Backoff: 1s -> 2s -> 4s. After 3 failures: STOP, alert ops.");
console.log("  NEVER retry without idempotency key!");
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Idempotency keys prevent duplicate charges on network retries.");
console.log("  2. Double-entry ledger: every debit has a credit — sum must be zero.");
console.log("  3. State machine prevents invalid transitions (e.g., FAILED -> SETTLED).");
console.log("  4. Reconciliation matches ledger against bank statements daily.");
console.log("  5. Refunds are reverse transactions following double-entry rules.");
console.log("  6. Exponential backoff prevents thundering herd on retries.");
console.log("  7. Even Re 1 mismatch in reconciliation triggers investigation.");
console.log();
console.log('  "In payments, there is no such thing as almost correct.');
console.log('   Either the money moved exactly right, or someone lost money."');
console.log();
