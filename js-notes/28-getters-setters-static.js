/**
 * ============================================================
 *  FILE 28: Getters, Setters, Static Members & Private Fields
 * ============================================================
 *  Topic: Controlling property access with get/set, class-level
 *         behavior with static, and encapsulation with #.
 * ============================================================
 *
 *  STORY: The State Bank of India (SBI). Every customer has an
 *  SBIAccount with access controls: read balance (getter),
 *  validated deposits/withdrawals (setter logic), bank-level
 *  tracking (static), and private internals (#fields).
 * ============================================================
 */

// ============================================================
//  BLOCK 1 — Getters & Setters
// ============================================================

// Getters/setters look like property access but run functions.
// Great for computed values (get) and validation (set).

const thermometer = {
  _celsius: 0,

  get celsius() { return this._celsius; },

  set celsius(value) {
    if (typeof value !== "number" || value < -273.15) return;
    this._celsius = value;
  },

  get fahrenheit() { return this._celsius * 9 / 5 + 32; },
};

console.log("--- Getters/Setters ---");
thermometer.celsius = 25;
console.log(`Celsius: ${thermometer.celsius}, Fahrenheit: ${thermometer.fahrenheit}`);
thermometer.celsius = -300; // rejected
console.log(`Still: ${thermometer.celsius}`); // 25


// ============================================================
//  BLOCK 2 — Full Feature Demo (SBI Account)
// ============================================================

// Combines getters, setters, static, and private fields (#).

class SBIAccount {
  #accountNumber;
  #balance;
  #frozen;

  static #totalAccounts = 0;

  constructor(ownerName, initialDeposit = 0) {
    SBIAccount.#totalAccounts++;
    this.#accountNumber = `SBI-${String(SBIAccount.#totalAccounts).padStart(6, "0")}`;
    this.ownerName = ownerName;
    this.#balance = initialDeposit;
    this.#frozen = false;
  }

  get balance() { return this.#balance; }
  set balance(_) { console.log("Blocked. Use deposit()/withdraw()."); }

  get accountInfo() {
    return `[${this.#accountNumber}] ${this.ownerName} — ₹${this.#balance.toFixed(2)}`;
  }

  deposit(amount) {
    if (this.#frozen) return "Account is frozen.";
    if (amount <= 0) return "Must be positive.";
    this.#balance += amount;
    return `Deposited ₹${amount}. Balance: ₹${this.#balance.toFixed(2)}`;
  }

  withdraw(amount) {
    if (this.#frozen) return "Account is frozen.";
    if (amount <= 0) return "Must be positive.";
    if (amount > this.#balance) return `Insufficient funds.`;
    this.#balance -= amount;
    return `Withdrew ₹${amount}. Balance: ₹${this.#balance.toFixed(2)}`;
  }

  freeze()   { this.#frozen = true;  return "Account FROZEN."; }
  unfreeze() { this.#frozen = false; return "Account UNFROZEN."; }

  static getTotalAccounts() { return SBIAccount.#totalAccounts; }
  static isValidAmount(n)   { return typeof n === "number" && n > 0 && isFinite(n); }
}

console.log("\n--- SBI Account ---");
const ramesh = new SBIAccount("Ramesh Kapoor", 1000);
console.log(ramesh.accountInfo);
console.log(ramesh.deposit(250));
console.log(ramesh.withdraw(100));

ramesh.balance = 999999; // blocked by setter
console.log(ramesh.freeze());
console.log(ramesh.deposit(100)); // frozen

console.log(`\nTotal accounts: ${SBIAccount.getTotalAccounts()}`);

// Private fields are enforced at the language level:
// ramesh.#balance => SyntaxError outside class


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. `get` runs a function on property read — great for
//    computed/derived values.
// 2. `set` runs validation on assignment — prevents bad state.
// 3. `static` members belong to the class, not instances.
//    Use for factories, counters, and utilities.
// 4. Private fields (#) provide TRUE encapsulation — enforced
//    by the engine, not just convention.
// 5. Combine all three for robust APIs: getters expose safe
//    reads, setters validate, statics provide class utilities,
//    and private fields hide internals.
// ============================================================
