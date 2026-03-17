/**
 * FILE 28 : Retry & Circuit Breaker Patterns
 * Topic   : Retry with Backoff, Circuit Breaker, Timeout
 * Used in : API calls, microservices, any network request
 */

// STORY: Electrician Noor installs MCBs to protect the colony during monsoon
// surges. Retry = reconnect after power cut. MCB trips after too many surges.

(async function () {

const sleep = function (ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
};

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Retry with Exponential Backoff
// ────────────────────────────────────────────────────────────
console.log("=== BLOCK 1: Retry with Backoff ===");

async function retry(fn, maxRetries, baseDelay) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;

      // Delay doubles each time: 10, 20, 40...
      const delay = baseDelay * Math.pow(2, attempt);
      console.log("  Retry " + (attempt + 1) + "/" + maxRetries + ", wait " + delay + "ms");
      await sleep(delay);
    }
  }
  throw lastError;
}

// Flaky power: fails twice then stabilizes
let powerAttempts = 0;
async function powerSupply() {
  powerAttempts++;
  if (powerAttempts <= 2) {
    throw new Error("Power surge #" + powerAttempts);
  }
  return "Colony power stable";
}

try {
  const result = await retry(powerSupply, 3, 5);
  console.log("Retry result:", result);
} catch (e) {
  console.log("Gave up:", e.message);
}

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : MCB (Circuit Breaker)
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 2: MCB (Circuit Breaker) ===");

// States: ON -> TRIPPED (after N failures) -> TESTING (after cooldown) -> ON

class MCB {
  constructor(fn, threshold, cooldown) {
    this.fn = fn;
    this.state = "ON";
    this.failures = 0;
    this.threshold = threshold;
    this.cooldown = cooldown;
    this.nextTry = 0;
  }

  async call() {
    if (this.state === "TRIPPED") {
      if (Date.now() < this.nextTry) {
        throw new Error("MCB TRIPPED - load rejected");
      }
      this.state = "TESTING";
      console.log("  MCB -> TESTING");
    }

    try {
      const result = await this.fn();
      this.failures = 0;
      if (this.state === "TESTING") {
        console.log("  MCB -> ON (recovered)");
      }
      this.state = "ON";
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.threshold || this.state === "TESTING") {
        this.state = "TRIPPED";
        this.nextTry = Date.now() + this.cooldown;
        console.log("  MCB -> TRIPPED");
      }
      throw err;
    }
  }
}

let gridCall = 0;
async function unstableGrid() {
  gridCall++;
  if (gridCall <= 4) throw new Error("Surge #" + gridCall);
  return "Power restored";
}

const mcb = new MCB(unstableGrid, 3, 50);

// Calls 1-3: surges pile up, MCB trips on 3rd
for (let i = 1; i <= 3; i++) {
  try { await mcb.call(); }
  catch (e) { console.log("Call " + i + ": " + e.message + ", state=" + mcb.state); }
}

// Call 4: rejected immediately (tripped, no cooldown yet)
try { await mcb.call(); }
catch (e) { console.log("Call 4: " + e.message); }

await sleep(60);

// Call 5: TESTING, grid still fails
try { await mcb.call(); }
catch (e) { console.log("Call 5: " + e.message + ", state=" + mcb.state); }

await sleep(60);

// Call 6: TESTING, grid recovers
try {
  const r = await mcb.call();
  console.log("Call 6: " + r + ", state=" + mcb.state);
} catch (e) { console.log("Call 6: " + e.message); }

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Timeout
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 3: Timeout ===");

function withTimeout(promise, ms) {
  const timeout = new Promise(function (resolve, reject) {
    setTimeout(function () {
      reject(new Error("Timed out after " + ms + "ms"));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

try {
  const slow = new Promise(function (r) { setTimeout(r, 200); });
  await withTimeout(slow, 20);
} catch (e) {
  console.log("Timed out:", e.message);
}

// In production, combine all three:
// retry( withTimeout( circuitBreaker.call() ) )

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Retry + backoff recovers from transient failures without hammering the server.
// 2. Circuit breaker (ON -> TRIPPED -> TESTING) stops wasting resources on a dead service.
// 3. Timeout via Promise.race guarantees a deadline.
// 4. Combine all three for production-grade resilience.

})();
