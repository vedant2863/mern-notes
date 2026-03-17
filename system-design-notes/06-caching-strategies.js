/** ============================================================
 *  FILE 06: CACHING STRATEGIES
 *  ============================================================
 *  Topic: Cache-aside, write-through, write-behind, TTL,
 *         LRU eviction, cache stampede, multi-tier caching
 *
 *  WHY THIS MATTERS:
 *  Caching is the single most impactful technique for reducing
 *  latency. A well-designed cache turns a 200ms DB query into a
 *  1ms memory lookup. Wrong strategy = stale data or thundering
 *  herds.
 *  ============================================================ */

// STORY: Zomato Menu Caching
// Waiter Raju memorizes top dishes so he quotes prices instantly.
// When memory is full, he forgets the least-recently-ordered item.
// That is LRU eviction.

console.log("=".repeat(70));
console.log("  FILE 06: CACHING STRATEGIES");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — LRU Cache Implementation
// ================================================================

// WHY: LRU is the most common eviction policy. Every other section
// depends on it.

class LRUCache {
  constructor(capacity, name = "Cache") {
    this.capacity = capacity; this.name = name; this.cache = new Map();
    this.hits = 0; this.misses = 0;
  }
  get(key) {
    if (!this.cache.has(key)) { this.misses++; return null; }
    const val = this.cache.get(key); this.cache.delete(key); this.cache.set(key, val);
    this.hits++; return val;
  }
  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      const lru = this.cache.keys().next().value;
      console.log(`    [${this.name}] Evicting LRU: "${lru}"`);
      this.cache.delete(lru);
    }
    this.cache.set(key, value);
  }
  has(key) { return this.cache.has(key); }
  delete(key) { return this.cache.delete(key); }
  stats() {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, ratio: total ? ((this.hits / total) * 100).toFixed(1) + "%" : "N/A" };
  }
  entries() { return [...this.cache.entries()]; }
}

console.log("--- SECTION 1: LRU Cache ---\n");
const raju = new LRUCache(5, "Raju");
const menu = [
  ["Butter Chicken", 350], ["Paneer Tikka", 280], ["Biryani", 300],
  ["Dal Makhani", 220], ["Naan", 50], ["Gulab Jamun", 120], ["Masala Dosa", 180],
];
for (const [dish, price] of menu) {
  raju.put(dish, price);
  console.log(`  Order: ${dish} (Rs.${price}) -- Memory: ${raju.cache.size}/${raju.capacity}`);
}
console.log("\n  Raju remembers:", raju.entries().map(([k, v]) => `${k}=Rs.${v}`).join(", "));
console.log();

// ================================================================
// SECTION 2 — Cache-Aside (Lazy Loading)
// ================================================================

// WHY: Most common pattern. Check cache first, query DB on miss.

console.log("--- SECTION 2: Cache-Aside ---\n");

class ZomatoDB {
  constructor() {
    this.data = new Map([
      ["Biryani", { price: 300, prep: 30 }], ["Naan", { price: 50, prep: 5 }],
      ["Dal Makhani", { price: 220, prep: 15 }], ["Paneer Tikka", { price: 280, prep: 20 }],
    ]);
    this.queries = 0;
  }
  query(key) { this.queries++; console.log(`    [DB] Query "${key}" (~50ms)`); return this.data.get(key) || null; }
}

function cacheAsideRead(cache, db, key) {
  let data = cache.get(key);
  if (data !== null) { console.log(`    [HIT] "${key}" (~1ms)`); return data; }
  console.log(`    [MISS] "${key}"`);
  data = db.query(key);
  if (data) { cache.put(key, data); console.log(`    [FILL] Cached "${key}"`); }
  return data;
}

const caCache = new LRUCache(4, "CacheAside");
const db = new ZomatoDB();
for (const dish of ["Biryani", "Naan", "Biryani", "Dal Makhani", "Biryani"]) {
  console.log(`  Request: ${dish}`);
  const r = cacheAsideRead(caCache, db, dish);
  if (r) console.log(`    -> Rs.${r.price}`);
  console.log();
}
console.log(`  Stats: ${JSON.stringify(caCache.stats())}, DB queries: ${db.queries}\n`);

// ================================================================
// SECTION 3 — Write-Through Cache
// ================================================================

// WHY: Writes to cache AND DB simultaneously. Consistent but
// doubles write latency.

console.log("--- SECTION 3: Write-Through ---\n");

class WriteThroughCache {
  constructor(cap, db) { this.cache = new LRUCache(cap, "WT"); this.db = db; }
  write(key, val) {
    console.log(`    [WT] "${key}" -> cache + DB simultaneously`);
    this.cache.put(key, val); this.db.data.set(key, val);
  }
  read(key) {
    const c = this.cache.get(key);
    if (c !== null) return c;
    const d = this.db.query(key); if (d) this.cache.put(key, d); return d;
  }
}

const wt = new WriteThroughCache(5, new ZomatoDB());
wt.write("Butter Chicken", { price: 399, prep: 25 });
const r = wt.read("Butter Chicken");
console.log(`  New price: Rs.${r.price} -- no stale data.`);
console.log("  Trade-off: 2x write latency but reads always fresh.\n");

// ================================================================
// SECTION 4 — Write-Behind (Write-Back)
// ================================================================

// WHY: Cache immediately, batch DB writes asynchronously. Fast
// writes but risks data loss on crash.

console.log("--- SECTION 4: Write-Behind ---\n");

class WriteBehindCache {
  constructor(cap, db, batch = 3) {
    this.cache = new LRUCache(cap, "WB"); this.db = db;
    this.queue = []; this.batch = batch;
  }
  write(key, val) {
    this.cache.put(key, val); this.queue.push({ key, val });
    console.log(`    [WB] "${key}" cached -- DB queued (${this.queue.length} pending)`);
    if (this.queue.length >= this.batch) this.flush();
  }
  flush() {
    console.log(`    [WB-FLUSH] Writing ${this.queue.length} to DB`);
    for (const e of this.queue) this.db.data.set(e.key, e.val);
    this.queue = [];
  }
}

const wb = new WriteBehindCache(5, new ZomatoDB(), 3);
wb.write("Biryani", { price: 250 });
wb.write("Dal Makhani", { price: 180 });
console.log("  (2 queued, not in DB yet)");
wb.write("Paneer Tikka", { price: 230 });
console.log("  Risk: Cache crash before flush = data LOST.\n");

// ================================================================
// SECTION 5 — TTL (Time To Live)
// ================================================================

// WHY: Auto-expire entries so cached data doesn't go stale forever.

console.log("--- SECTION 5: TTL ---\n");

class TTLCache {
  constructor(ttl = 5000) { this.cache = new Map(); this.ttl = ttl; }
  set(key, val, ttl = this.ttl) {
    this.cache.set(key, { val, exp: Date.now() + ttl });
    console.log(`    [TTL] SET "${key}" -- expires in ${ttl}ms`);
  }
  get(key) {
    const e = this.cache.get(key); if (!e) return null;
    if (Date.now() > e.exp) { this.cache.delete(key); return null; }
    return e.val;
  }
}

const ttl = new TTLCache(100);
ttl.set("Meghana Foods", { open: true }, 200);
ttl.set("Truffles", { open: true }, 50);
console.log(`  Now: Meghana=${ttl.get("Meghana Foods") ? "CACHED" : "EXPIRED"}, Truffles=${ttl.get("Truffles") ? "CACHED" : "EXPIRED"}`);
console.log("  Guideline: Short TTL for volatile data, long for stable.\n");

// ================================================================
// SECTION 6 — Cache Stampede Prevention
// ================================================================

// WHY: Hot key expires, hundreds of requests hit DB simultaneously.

console.log("--- SECTION 6: Cache Stampede ---\n");

class StampedeCache {
  constructor() { this.cache = new Map(); this.locks = new Map(); this.dbCalls = 0; }
  readUnprotected(key, fn) {
    if (this.cache.has(key)) return "cache";
    this.dbCalls++; this.cache.set(key, fn()); return "db";
  }
  readWithLock(key, fn) {
    if (this.cache.has(key)) return "cache";
    if (this.locks.has(key)) return "coalesced";
    this.locks.set(key, true); this.dbCalls++; this.cache.set(key, fn());
    this.locks.delete(key); return "db";
  }
}

function runStampede(useLock) {
  const c = new StampedeCache();
  for (let i = 0; i < 10; i++) useLock ? c.readWithLock("Biryani", () => 300) : c.readUnprotected("Biryani", () => 300);
  return c.dbCalls;
}
const without = runStampede(false), withLock = runStampede(true);
console.log(`  10 concurrent requests: WITHOUT lock = ${without} DB calls, WITH lock = ${withLock}\n`);

// ================================================================
// SECTION 7 — Multi-Tier Caching (L1/L2)
// ================================================================

// WHY: L1 (in-process, fast, small) + L2 (shared, slower, larger)
// like CPU cache hierarchy.

console.log("--- SECTION 7: Multi-Tier (L1/L2) ---\n");

class MultiTierCache {
  constructor(l1Sz, l2Sz) {
    this.l1 = new LRUCache(l1Sz, "L1"); this.l2 = new LRUCache(l2Sz, "L2");
    this.db = new ZomatoDB(); this.log = [];
  }
  read(key) {
    let d = this.l1.get(key);
    if (d !== null) { this.log.push("L1"); console.log(`    [L1 HIT] "${key}" ~0.1ms`); return d; }
    d = this.l2.get(key);
    if (d !== null) { this.l1.put(key, d); this.log.push("L2"); console.log(`    [L2 HIT] "${key}" ~2ms`); return d; }
    d = this.db.query(key);
    if (d) { this.l2.put(key, d); this.l1.put(key, d); this.log.push("DB"); }
    return d;
  }
}

const mt = new MultiTierCache(3, 6);
for (const d of ["Biryani", "Naan", "Biryani", "Dal Makhani", "Biryani"]) mt.read(d);
const c = { L1: 0, L2: 0, DB: 0 };
mt.log.forEach((t) => c[t]++);
console.log(`\n  Hits: L1=${c.L1}, L2=${c.L2}, DB=${c.DB}\n`);

// ================================================================
// SECTION 8 — Cache Invalidation
// ================================================================

// WHY: "Two hard things in CS: cache invalidation and naming things."

console.log("--- SECTION 8: Invalidation Strategies ---\n");

const inv = new LRUCache(10, "Inv");
inv.put("menu:biryani", 300); inv.put("menu:naan", 50); inv.put("review:biryani", 4);

console.log("  1. Purge: delete specific key");
inv.delete("menu:biryani");
console.log(`     "menu:biryani" gone: ${!inv.has("menu:biryani")}\n`);

console.log("  2. Ban prefix: delete all keys matching pattern");
let banned = 0;
for (const [k] of inv.entries()) { if (k.startsWith("menu:")) { inv.delete(k); banned++; } }
console.log(`     "menu:*" removed ${banned} keys, "review:biryani" survived: ${inv.has("review:biryani")}\n`);

console.log("  3. Version-based: biryani:v2 = Rs.350 (old v1 naturally expires)");
console.log("  4. Event-driven: pub/sub notifies caches on DB write\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log(`
  1. Cache-Aside: cache on demand -- best for read-heavy loads.
  2. Write-Through: cache+DB in sync -- consistent but slower writes.
  3. Write-Behind: batch async writes -- fast but risks data loss.
  4. TTL auto-expires entries -- short for volatile, long for stable.
  5. LRU evicts least recently accessed -- fits temporal locality.
  6. Cache stampede: use locks/coalescing to prevent DB floods.
  7. Multi-tier (L1+L2) combines speed and capacity.
  8. Invalidation: purge, ban prefix, version, or event-driven.
`);
