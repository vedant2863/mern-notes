/** ============================================================
 *  FILE 19: CIRCUIT BREAKER AND BULKHEAD
 *  ============================================================
 *  Topic: Circuit breaker states, failure threshold, bulkhead
 *         isolation, timeout, retry, fallback
 *
 *  WHY THIS MATTERS:
 *  In distributed systems, one failing service can cascade and
 *  bring down everything. Circuit breakers stop calling a failing
 *  service. Bulkheads isolate failures so a problem in one area
 *  does not sink the entire ship.
 *  ============================================================ */

// STORY: Paytm Payment Gateway
// When YES Bank experienced a moratorium in 2020, Paytm's circuit
// breaker stopped routing to YES Bank, preventing cascading timeouts.
// Bulkhead isolation kept SBI, HDFC, and ICICI pools independent.

console.log("=".repeat(65));
console.log("  FILE 19: CIRCUIT BREAKER AND BULKHEAD");
console.log("  Paytm — circuit breaker on YES Bank, bulkhead per bank");
console.log("=".repeat(65));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Circuit Breaker Implementation
// ════════════════════════════════════════════════════════════════

// WHY: Three states control request flow. CLOSED (normal),
// OPEN (fast-fail), HALF-OPEN (probe for recovery).
console.log("--- Section 1: Circuit Breaker Implementation ---\n");

console.log("  CLOSED  --[failure threshold]--> OPEN  --[timeout]--> HALF-OPEN");
console.log("  HALF-OPEN --[success]--> CLOSED  |  HALF-OPEN --[failure]--> OPEN\n");

class CircuitBreaker {
  constructor(name, opts = {}) {
    this.name = name; this.state = "CLOSED"; this.failureCount = 0;
    this.successCount = 0; this.failThreshold = opts.failThreshold || 5;
    this.successThreshold = opts.successThreshold || 3;
    this.resetTimeoutMs = opts.resetTimeoutMs || 30000;
    this.lastFailTime = 0; this.halfOpenAttempts = 0;
    this.simTime = 0; this.history = [];
  }
  canExecute() {
    if (this.state === "CLOSED") return true;
    if (this.state === "OPEN") {
      if (this.simTime - this.lastFailTime >= this.resetTimeoutMs) {
        this.history.push({ from: "OPEN", to: "HALF_OPEN", reason: "timeout elapsed" });
        this.state = "HALF_OPEN"; this.halfOpenAttempts = 0; return true;
      }
      return false;
    }
    return true;
  }
  recordSuccess() {
    this.successCount++;
    if (this.state === "HALF_OPEN") {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.successThreshold) {
        this.failureCount = 0; this.state = "CLOSED";
        this.history.push({ from: "HALF_OPEN", to: "CLOSED", reason: `${this.successThreshold} successes` });
      }
    }
  }
  recordFailure() {
    this.failureCount++; this.lastFailTime = this.simTime;
    if (this.state === "HALF_OPEN") { this.state = "OPEN"; this.history.push({ from: "HALF_OPEN", to: "OPEN", reason: "failure in half-open" }); }
    else if (this.failureCount >= this.failThreshold) { this.state = "OPEN"; this.history.push({ from: "CLOSED", to: "OPEN", reason: `${this.failThreshold} failures` }); }
  }
  execute(fn) {
    if (!this.canExecute()) return { status: "CIRCUIT_OPEN" };
    const result = fn();
    result.success ? this.recordSuccess() : this.recordFailure();
    return result;
  }
  advanceTime(ms) { this.simTime += ms; }
}

const yesCB = new CircuitBreaker("YES-Bank-UPI", { failThreshold: 3, successThreshold: 2, resetTimeoutMs: 5000 });

console.log("Paytm CB for YES Bank:\n");
console.log("  Phase 1: YES Bank failing");
for (let i = 0; i < 5; i++) {
  const r = yesCB.execute(() => ({ success: false }));
  console.log(`    Req ${i+1}: state=${yesCB.state}, result=${r.status || "FAILURE"}`);
}

console.log("\n  Phase 2: Circuit OPEN — fast-fail");
for (let i = 0; i < 3; i++) {
  const r = yesCB.execute(() => ({ success: true }));
  console.log(`    Req ${i+6}: state=${yesCB.state}, result=${r.status}`);
}

console.log("\n  Phase 3: Wait 5s, probe (HALF_OPEN)");
yesCB.advanceTime(5000);
for (let i = 0; i < 2; i++) {
  const r = yesCB.execute(() => ({ success: true }));
  console.log(`    Probe ${i+1}: state=${yesCB.state}, result=${r.status || "SUCCESS"}`);
}

console.log("\n  State transitions:");
yesCB.history.forEach(h => console.log(`    ${h.from} -> ${h.to}: ${h.reason}`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Bulkhead Pattern (Thread Pool Isolation)
// ════════════════════════════════════════════════════════════════

// WHY: Isolate resources so one failing partition cannot affect others.
console.log("--- Section 2: Bulkhead Pattern ---\n");

class BulkheadPool {
  constructor(name, maxConcurrent, queueSize) {
    this.name = name; this.maxConcurrent = maxConcurrent; this.queueSize = queueSize;
    this.active = 0; this.queued = 0; this.completed = 0; this.rejected = 0;
  }
  submit(task) {
    if (this.active < this.maxConcurrent) {
      this.active++;
      try { task(); this.completed++; } catch(e) { /* failure */ }
      this.active--;
      return "EXECUTED";
    }
    if (this.queued < this.queueSize) { this.queued++; return "QUEUED"; }
    this.rejected++; return "REJECTED";
  }
  getStats() { return { pool: this.name, completed: this.completed, rejected: this.rejected }; }
}

const sbiPool = new BulkheadPool("SBI", 5, 3);
const yesPool = new BulkheadPool("YES-Bank", 3, 2);

console.log("SBI Pool (cap=5, queue=3):");
for (let i = 0; i < 7; i++) console.log(`  Task ${i}: ${sbiPool.submit(() => "ok")}`);

console.log("\nYES Bank Pool (cap=3, queue=2) — overloaded:");
for (let i = 0; i < 8; i++) console.log(`  Task ${i}: ${yesPool.submit(() => { throw new Error("timeout"); })}`);
console.log(`\n  YES Bank isolated — SBI unaffected: ${JSON.stringify(sbiPool.getStats())}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Timeout and Retry with Backoff
// ════════════════════════════════════════════════════════════════

// WHY: Timeout bounds wait time. Retry recovers transient failures.
console.log("--- Section 3: Timeout and Retry ---\n");

class TimeoutWrapper {
  constructor(timeoutMs) { this.timeoutMs = timeoutMs; this.stats = { success: 0, timeout: 0 }; }
  execute(name, latency) {
    if (latency > this.timeoutMs) { this.stats.timeout++; return { status: "TIMEOUT", name }; }
    this.stats.success++; return { status: "SUCCESS", name };
  }
}

const timeout = new TimeoutWrapper(2000);
[{ name: "SBI-UPI", lat: 800 }, { name: "HDFC-UPI", lat: 1500 }, { name: "YES-UPI", lat: 5000 },
 { name: "ICICI-UPI", lat: 1900 }
].forEach(op => {
  const r = timeout.execute(op.name, op.lat);
  console.log(`  ${op.name}: ${r.status} (${op.lat}ms, limit: 2000ms)`);
});
console.log(`  Stats: ${JSON.stringify(timeout.stats)}\n`);

class RetryHandler {
  constructor(maxRetries, baseMs, maxMs) { this.maxRetries = maxRetries; this.baseMs = baseMs; this.maxMs = maxMs; }
  execute(name, failUntil) {
    for (let a = 0; a <= this.maxRetries; a++) {
      const delay = a > 0 ? Math.min(this.maxMs, this.baseMs * Math.pow(2, a-1)) : 0;
      if (a >= failUntil) return { name, status: "SUCCESS", attempts: a+1, totalDelay: delay };
    }
    return { name, status: "EXHAUSTED", attempts: this.maxRetries+1 };
  }
}

const retry = new RetryHandler(4, 200, 5000);
console.log(`  ${retry.execute("YES-Bank-Payment", 2).name}: SUCCESS after ${retry.execute("YES-Bank-Payment", 2).attempts} attempts`);
console.log(`  ${retry.execute("YES-Bank-Balance", 99).name}: ${retry.execute("YES-Bank-Balance", 99).status}`);
console.log(`  ${retry.execute("SBI-Payment", 0).name}: SUCCESS on first attempt\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Fallback Strategies
// ════════════════════════════════════════════════════════════════

// WHY: When primary fails, fallback provides degraded but functional experience.
console.log("--- Section 4: Fallback Strategies ---\n");

class FallbackChain {
  constructor(name) { this.name = name; this.strategies = []; }
  add(name, fn) { this.strategies.push({ name, fn }); return this; }
  execute() {
    for (const s of this.strategies) {
      try { const r = s.fn(); if (r.success) return { status: "OK", via: s.name, data: r.data }; } catch(e) { /* next */ }
    }
    return { status: "ALL_FAILED" };
  }
}

const fb = new FallbackChain("Paytm-Payment");
fb.add("YES-Bank-UPI", () => { throw new Error("moratorium"); })
  .add("SBI-UPI", () => ({ success: true, data: "Paid via SBI UPI" }))
  .add("Paytm-Wallet", () => ({ success: true, data: "Paid via Wallet" }));

const fbr = fb.execute();
console.log(`  Result: ${fbr.status} via "${fbr.via}" -> ${fbr.data}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Resilience Pipeline (Combined)
// ════════════════════════════════════════════════════════════════

// WHY: In production, combine CB + bulkhead + timeout + retry + fallback.
console.log("--- Section 5: Resilience Pipeline ---\n");

class ResiliencePipeline {
  constructor(name, opts = {}) {
    this.name = name;
    this.cb = new CircuitBreaker(`${name}-CB`, { failThreshold: opts.cbThreshold || 3, successThreshold: 2, resetTimeoutMs: 5000 });
    this.timeoutMs = opts.timeoutMs || 2000;
    this.fallbackFn = opts.fallback || null;
    this.metrics = { success: 0, cbOpen: 0, timeout: 0, fallback: 0 };
  }
  execute(latency, fn) {
    if (!this.cb.canExecute()) {
      this.metrics.cbOpen++;
      if (this.fallbackFn) { this.metrics.fallback++; return { status: "FALLBACK", reason: "circuit-open", data: this.fallbackFn() }; }
      return { status: "REJECTED", reason: "circuit-open" };
    }
    if (latency > this.timeoutMs) {
      this.cb.recordFailure(); this.metrics.timeout++;
      if (this.fallbackFn) { this.metrics.fallback++; return { status: "FALLBACK", reason: "timeout", data: this.fallbackFn() }; }
      return { status: "TIMEOUT" };
    }
    this.cb.recordSuccess(); this.metrics.success++;
    return { status: "SUCCESS", data: fn() };
  }
  advanceTime(ms) { this.cb.advanceTime(ms); }
}

const yesPipe = new ResiliencePipeline("YES", { cbThreshold: 3, fallback: () => "route to SBI" });

console.log("  YES Bank Pipeline — failing then recovering:");
for (let i = 0; i < 5; i++) {
  const r = yesPipe.execute(5000, () => "YES OK");
  console.log(`    Req ${i}: ${r.status} (${r.reason||"ok"}) CB=${yesPipe.cb.state}`);
}
yesPipe.advanceTime(5000);
const probe = yesPipe.execute(500, () => "YES recovered!");
console.log(`    Probe: ${probe.status} — ${probe.data}`);
console.log(`\n  Metrics: ${JSON.stringify(yesPipe.metrics)}`);

console.log("\n  Pattern Summary:");
console.log("  Circuit Breaker  -> Stop calling failing service");
console.log("  Bulkhead         -> Isolate resource pools");
console.log("  Timeout          -> Bound max wait time");
console.log("  Retry            -> Recover transient errors");
console.log("  Fallback         -> Degraded functionality");
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════
console.log("=".repeat(65));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(65));
console.log(`
  1. Circuit breakers detect failures and fast-fail, preventing cascading failures.
  2. Three states: CLOSED (normal), OPEN (fast-fail), HALF-OPEN (probing).
  3. Bulkhead isolates resource pools — one failing dependency cannot exhaust all resources.
  4. Timeout bounds maximum wait, preventing indefinite hangs.
  5. Retry with backoff recovers transient failures without overwhelming a recovering service.
  6. Fallback provides degraded service — cache, alternate provider, or queue.
  7. Combine into a pipeline: CB -> Bulkhead -> Timeout -> Retry -> Fallback.

  Paytm Wisdom: "When one bank goes down, the payment must still
  flow — resilience is not optional, it is the product itself."
`);
