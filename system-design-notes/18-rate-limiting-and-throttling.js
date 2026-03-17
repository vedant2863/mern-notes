/** ============================================================
 *  FILE 18: RATE LIMITING AND THROTTLING
 *  ============================================================
 *  Topic: Token bucket, leaky bucket, fixed/sliding window,
 *         distributed rate limiting, exponential backoff
 *
 *  WHY THIS MATTERS:
 *  Without rate limiting, a single misbehaving client can bring
 *  down an entire API. Rate limiting protects services from abuse,
 *  ensures fair sharing, and prevents cascading failures.
 *  ============================================================ */

// STORY: Aadhaar eKYC API
// UIDAI's Aadhaar eKYC API is used by banks and telecoms to verify
// identity. Each entity is limited to 1000 calls/min. Exceeding
// the quota returns HTTP 429, requiring exponential backoff.

console.log("=".repeat(65));
console.log("  FILE 18: RATE LIMITING AND THROTTLING");
console.log("  Aadhaar eKYC API — UIDAI limits each bank to 1000/min");
console.log("=".repeat(65));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Token Bucket Algorithm
// ════════════════════════════════════════════════════════════════

// WHY: Allows bursts while enforcing average rate. Tokens refill
// at steady rate; each request consumes a token.
console.log("--- Section 1: Token Bucket Algorithm ---\n");

class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity; this.tokens = capacity;
    this.refillRate = refillRate; this.stats = { allowed: 0, rejected: 0 };
  }
  tryConsume() {
    if (this.tokens >= 1) { this.tokens--; this.stats.allowed++; return true; }
    this.stats.rejected++; return false;
  }
  simulateRefill(intervals) { this.tokens = Math.min(this.capacity, this.tokens + intervals * this.refillRate); }
}

const bucket = new TokenBucket(10, 2);
console.log("Token Bucket: capacity=10, refill=2/sec\n");

const burst = [];
for (let i = 0; i < 12; i++) burst.push(bucket.tryConsume() ? "OK" : "REJECTED");
console.log(`  Burst of 12: [${burst.join(", ")}]`);
console.log(`  State: ${JSON.stringify(bucket.stats)}`);

bucket.simulateRefill(3);
console.log(`\n  After 3s (6 tokens refilled): tokens=${bucket.tokens}`);
const after = [];
for (let i = 0; i < 8; i++) after.push(bucket.tryConsume() ? "OK" : "REJECTED");
console.log(`  8 requests: [${after.join(", ")}]\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Leaky Bucket Algorithm
// ════════════════════════════════════════════════════════════════

// WHY: Smooths traffic to constant output rate. Requests queue up
// and "leak" at fixed rate.
console.log("--- Section 2: Leaky Bucket Algorithm ---\n");

class LeakyBucket {
  constructor(capacity, leakRate) {
    this.capacity = capacity; this.queue = [];
    this.stats = { enqueued: 0, dropped: 0, leaked: 0 };
  }
  add(req) {
    if (this.queue.length >= this.capacity) { this.stats.dropped++; return "DROPPED"; }
    this.queue.push(req); this.stats.enqueued++; return "QUEUED";
  }
  leak(count) { const l = this.queue.splice(0, count); this.stats.leaked += l.length; }
}

const leaky = new LeakyBucket(5, 2);
console.log("Leaky Bucket: capacity=5, leak=2/sec\n");
console.log("  Adding 8 requests:");
for (let i = 0; i < 8; i++) console.log(`    Request ${i}: ${leaky.add({ id: i })}`);
leaky.leak(2);
console.log(`\n  After 1s (2 leaked): queue=${leaky.queue.length}`);
console.log(`  Stats: ${JSON.stringify(leaky.stats)}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Fixed Window Counter
// ════════════════════════════════════════════════════════════════

// WHY: Simplest rate limiter — count requests in fixed time windows.
// Easy but has the boundary problem (2x burst at edges).
console.log("--- Section 3: Fixed Window Counter ---\n");

class FixedWindowCounter {
  constructor(windowMs, maxReq) { this.windowMs = windowMs; this.maxReq = maxReq; this.windows = {}; this.stats = { allowed: 0, rejected: 0 }; }
  getKey(ts) { return Math.floor(ts / this.windowMs); }
  allow(clientId, ts) {
    const k = `${clientId}:${this.getKey(ts)}`;
    if (!this.windows[k]) this.windows[k] = 0;
    if (this.windows[k] >= this.maxReq) { this.stats.rejected++; return { allowed: false, count: this.windows[k] }; }
    this.windows[k]++; this.stats.allowed++;
    return { allowed: true, count: this.windows[k] };
  }
}

const fw = new FixedWindowCounter(60000, 5);
const now = 1700000000000;
console.log("Fixed Window: 5 req per 60s\n");
for (let i = 0; i < 7; i++) {
  const r = fw.allow("SBI", now + i * 1000);
  console.log(`  Request ${i+1}: ${r.allowed ? "ALLOWED" : "REJECTED"} (${r.count}/5)`);
}

// Boundary problem
const bp = new FixedWindowCounter(60000, 5);
for (let i = 0; i < 5; i++) bp.allow("HDFC", now + 58000 + i * 100);
for (let i = 0; i < 5; i++) bp.allow("HDFC", now + 60000 + i * 100);
console.log(`\n  Boundary Problem: HDFC got ${bp.stats.allowed} through in ~2s across edge!\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Sliding Window Counter
// ════════════════════════════════════════════════════════════════

// WHY: Combines fixed window efficiency with sliding window accuracy.
// Uses weighted count from current and previous windows.
console.log("--- Section 4: Sliding Window Counter ---\n");

class SlidingWindowCounter {
  constructor(windowMs, maxReq) { this.windowMs = windowMs; this.maxReq = maxReq; this.windows = {}; this.stats = { allowed: 0, rejected: 0 }; }
  getStart(ts) { return Math.floor(ts / this.windowMs) * this.windowMs; }
  allow(clientId, ts) {
    const ws = this.getStart(ts);
    if (!this.windows[clientId]) this.windows[clientId] = { prevCount: 0, currCount: 0, currStart: ws };
    const s = this.windows[clientId];
    if (ws !== s.currStart) {
      s.prevCount = ws - s.currStart === this.windowMs ? s.currCount : 0;
      s.currCount = 0; s.currStart = ws;
    }
    const prevWeight = 1 - (ts - ws) / this.windowMs;
    const weighted = s.prevCount * prevWeight + s.currCount;
    if (weighted >= this.maxReq) { this.stats.rejected++; return { allowed: false, weighted: weighted.toFixed(1) }; }
    s.currCount++; this.stats.allowed++;
    return { allowed: true, weighted: (weighted + 1).toFixed(1) };
  }
}

const sc = new SlidingWindowCounter(60000, 10);
console.log("Sliding Window Counter: 10 req per 60s (weighted)\n");
for (let i = 0; i < 8; i++) sc.allow("Jio", now + i * 1000);
const halfway = now + 60000 + 30000;
console.log("  Prev window had 8 req, now 30s in (weight=0.5, phantom=4)\n");
for (let i = 0; i < 8; i++) {
  const r = sc.allow("Jio", halfway + i * 100);
  console.log(`    Request ${i+1}: ${r.allowed ? "ALLOWED" : "REJECTED"} (weighted: ${r.weighted}/10)`);
}
console.log(`\n  Memory: only 3 values per client vs full timestamp log.\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Distributed Rate Limiting
// ════════════════════════════════════════════════════════════════

// WHY: Multi-server deployments need global limits via shared store.
console.log("--- Section 5: Distributed Rate Limiting ---\n");

class DistributedRateLimiter {
  constructor(maxReq, windowMs) { this.maxReq = maxReq; this.windowMs = windowMs; this.store = {}; }
  allow(clientId, serverId, ts) {
    const k = `${clientId}:${Math.floor(ts / this.windowMs)}`;
    if (!this.store[k]) this.store[k] = 0;
    this.store[k]++;
    const ok = this.store[k] <= this.maxReq;
    return { allowed: ok, count: this.store[k], server: serverId };
  }
}

const dist = new DistributedRateLimiter(10, 60000);
const servers = ["api-1", "api-2", "api-3"];
console.log("Aadhaar eKYC: 10 req/min per bank, across 3 servers\n");

["SBI", "HDFC"].forEach(bank => {
  const results = [];
  for (let i = 0; i < 12; i++) {
    const r = dist.allow(bank, servers[i%3], now + i * 100);
    results.push(`${r.allowed ? "OK" : "429"}(${servers[i%3].split("-")[1]})`);
  }
  console.log(`  ${bank}: [${results.join(", ")}]`);
});
console.log("\n  Counter shared across servers — 11th request rejected globally.\n");

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Exponential Backoff with Jitter
// ════════════════════════════════════════════════════════════════

// WHY: When rate-limited (429), retry intelligently. Backoff prevents
// thundering herds. Jitter spreads retries.
console.log("--- Section 6: Exponential Backoff with Jitter ---\n");

class ExponentialBackoff {
  constructor(baseMs, maxMs, maxRetries) {
    this.baseMs = baseMs; this.maxMs = maxMs; this.maxRetries = maxRetries; this.seed = 42;
  }
  random() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return (this.seed % 1000) / 1000; }
  simulate(strategy) {
    this.seed = 42;
    const attempts = [];
    for (let i = 0; i < this.maxRetries; i++) {
      const exp = Math.min(this.maxMs, this.baseMs * Math.pow(2, i));
      let delay;
      switch (strategy) {
        case "exponential": delay = exp; break;
        case "full-jitter": delay = Math.floor(this.random() * exp); break;
        case "equal-jitter": delay = Math.floor(exp/2 + this.random() * exp/2); break;
        default: delay = this.baseMs;
      }
      attempts.push(delay);
    }
    return attempts;
  }
}

const bo = new ExponentialBackoff(100, 10000, 6);
["exponential", "full-jitter", "equal-jitter"].forEach(s => {
  const delays = bo.simulate(s);
  console.log(`  ${s}: [${delays.map(d => d+"ms").join(", ")}] total=${delays.reduce((a,b)=>a+b)}ms`);
});

// Algorithm comparison
console.log("\n  Algorithm Comparison:");
console.log("  Algorithm            Accuracy    Memory     Burst");
console.log("  " + "-".repeat(52));
console.log("  Token Bucket         Medium      O(1)       Allows");
console.log("  Leaky Bucket         High        O(N)       Smooths");
console.log("  Fixed Window         Low         O(1)       2x at edge");
console.log("  Sliding Counter      High        O(1)       Approximates");
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════
console.log("=".repeat(65));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(65));
console.log(`
  1. Token bucket allows bursts while maintaining average rate.
  2. Leaky bucket enforces strict constant output rate.
  3. Fixed window is simple but allows 2x burst at boundaries.
  4. Sliding window counter approximates with minimal memory.
  5. Distributed rate limiting uses shared store (Redis) for
     global enforcement across all API servers.
  6. Exponential backoff with jitter prevents thundering herds.
  7. Always return rate limit headers so clients self-regulate.

  Aadhaar Wisdom: "In a nation of 1.4 billion identities, rate
  limiting is not a restriction — it is the guardian of fairness."
`);
