// ============================================================
// FILE 20: CLOSURES
// Topic: What closures are, how they work, and practical patterns
// WHY: Closures power data privacy, factories, memoization, and
//      most callback patterns — one of the most tested JS concepts.
// ============================================================

// ============================================================
// EXAMPLE 1 — The Hawala Operator's Coded Ledger
// Story: Hawala operator Munna keeps a private ledger
// that only his trusted function can access.
// ============================================================

// A closure is a function bundled with its lexical environment.
// It retains access to outer variables even after the outer function returns.

function createHawalaChannel(secretCode) {
  return function verifyAgent(guess) {
    return guess === secretCode
      ? "Code MATCHED! Transaction approved."
      : "Wrong code. Transaction denied.";
  };
}

const munnaChannel = createHawalaChannel("saffron-42");
console.log(munnaChannel("cardamom-99")); // denied
console.log(munnaChannel("saffron-42"));  // approved
// secretCode is truly private — no way to access it directly

// --- Classic Counter ---

function createCounter(start = 0) {
  let count = start;
  return {
    increment() { return ++count; },
    decrement() { return --count; },
    getCount() { return count; },
    reset()    { count = start; return count; },
  };
}

const log = createCounter();
console.log(log.increment()); // 1
console.log(log.increment()); // 2
console.log(log.reset());     // 0

// Each counter is independent
const other = createCounter(100);
console.log(other.increment()); // 101
console.log(log.getCount());    // 0 — not affected


// ============================================================
// EXAMPLE 2 — Data Privacy & Factory Functions
// ============================================================

function createLedger(owner, initialBalance) {
  let balance = initialBalance;

  return {
    deposit(amount) {
      if (amount <= 0) return "Invalid amount.";
      balance += amount;
      return `Deposited ${amount}. Balance: ${balance}`;
    },
    withdraw(amount) {
      if (amount > balance) return "Insufficient funds!";
      balance -= amount;
      return `Withdrew ${amount}. Balance: ${balance}`;
    },
    getBalance() { return `${owner}: ${balance}`; },
  };
}

const ledger = createLedger("Munna", 1000);
console.log(ledger.deposit(500));  // Balance: 1500
console.log(ledger.withdraw(200)); // Balance: 1300
// ledger.balance is undefined — truly private

// --- Factory with isolated state ---

function createNetwork(cityTier) {
  const agents = new Map();
  return {
    register(id, code) { agents.set(id, code); },
    authenticate(id, code) {
      if (!agents.has(id)) return "Unknown agent.";
      return agents.get(id) === code ? "SUCCESS" : "FAILED";
    },
  };
}

const mumbai = createNetwork(1);
const jaipur = createNetwork(3);
mumbai.register("Munna", "alpha");
console.log(mumbai.authenticate("Munna", "alpha")); // SUCCESS
console.log(jaipur.authenticate("Munna", "alpha")); // Unknown agent


// ============================================================
// EXAMPLE 3 — Classic Traps & Practical Utilities
// ============================================================

// --- The var loop bug ---
// All callbacks share the SAME function-scoped `i`
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var bug:", i), 10);
}
// All print 3

// FIX: use `let` — each iteration gets its own block-scoped copy
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log("let fix:", i), 20);
}
// Prints 0, 1, 2

// --- Memoization ---

function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = memoize((n) => {
  let sum = 0;
  for (let i = 0; i < n * 1000; i++) sum += i;
  return sum;
});
console.log(expensiveCalc(100)); // computed
console.log(expensiveCalc(100)); // cache hit

// --- once() ---

function once(fn) {
  let called = false, result;
  return function (...args) {
    if (called) return result;
    called = true;
    result = fn(...args);
    return result;
  };
}

const initLedger = once((city) => ({ city, initialized: true }));
console.log(initLedger("Mumbai")); // { city: 'Mumbai', initialized: true }
console.log(initLedger("Delhi"));  // same Mumbai result — only runs once

// --- Debounce ---

function debounce(fn, delayMs) {
  let timerId = null;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delayMs);
  };
}

const processEntry = debounce((code) => console.log(`Processing: ${code}`), 100);
processEntry("1111"); // cancelled
processEntry("2222"); // cancelled
processEntry("3333"); // fires after 100ms


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. A CLOSURE = function + its lexical environment.
// 2. Closures capture variables by REFERENCE, not value.
// 3. Closures enable true DATA PRIVACY — enclosed vars are
//    inaccessible from outside.
// 4. FACTORY FUNCTIONS use closures for independent instances.
// 5. var loop bug: all closures share one var. Fix with let.
// 6. MEMOIZATION: closure-enclosed cache for expensive calls.
// 7. once(): closure flag ensures single execution.
// 8. DEBOUNCE: closure holds a timer reference.
// ============================================================
