/** ============================================================
 *  FILE 11: DATABASE SHARDING
 *  ============================================================
 *  Topic: Shard keys, range vs hash sharding, consistent hashing,
 *         hot spots, re-sharding, cross-shard queries
 *
 *  WHY THIS MATTERS:
 *  A single DB has finite CPU, memory, and disk. When data grows
 *  beyond one machine, sharding splits it across servers. Done
 *  wrong, you get hot spots and cascading failures.
 *  ============================================================ */

// STORY: Flipkart Product Catalog
// Flipkart hosts 150M+ products. During Diwali, Electronics gets
// 10x traffic. If all electronics land on one shard, it melts.
// Consistent hashing means adding a shard moves only a fraction
// of products.

console.log("=".repeat(70));
console.log("  FILE 11: DATABASE SHARDING");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — Why Shard
// ================================================================

console.log("--- SECTION 1: Why Shard ---\n");

const singleDb = { maxStorageGB: 2000, maxQPS: 50000 };
const flipkart = { storageTB: 8, diwaliQPS: 300000 };

console.log(`  Single DB: ${JSON.stringify(singleDb)}`);
console.log(`  Flipkart:  ${JSON.stringify(flipkart)}`);
console.log(`  Storage fits? ${flipkart.storageTB * 1000 <= singleDb.maxStorageGB ? "YES" : "NO -- need sharding"}`);
console.log(`  Diwali QPS fits? ${flipkart.diwaliQPS <= singleDb.maxQPS ? "YES" : "NO -- need sharding"}`);
console.log(`  Minimum shards: ${Math.ceil(flipkart.diwaliQPS / singleDb.maxQPS)}\n`);

// ================================================================
// SECTION 2 — Shard Key Selection
// ================================================================

console.log("--- SECTION 2: Shard Key Selection ---\n");

function simpleHash(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0x7fffffff;
  return h;
}

// Strategy 1: By category (BAD)
const categories = ["Electronics", "Fashion", "Home", "Books"];
const byCat = { Electronics: 400, Fashion: 200, Home: 200, Books: 200 };
console.log("  By category (SKEWED):");
Object.entries(byCat).forEach(([cat, cnt]) => {
  console.log(`    ${cat.padEnd(14)} ${cnt} ${"#".repeat(cnt / 10)}`);
});

// Strategy 2: By product_id hash (GOOD)
const byHash = [0, 0, 0, 0];
for (let i = 0; i < 1000; i++) byHash[simpleHash(`PROD-${String(i).padStart(6, "0")}`) % 4]++;
console.log("\n  By product_id hash (EVEN):");
byHash.forEach((cnt, i) => console.log(`    Shard ${i}: ${cnt} ${"#".repeat(cnt / 10)}`));
console.log();

// ================================================================
// SECTION 3 — Range-Based Sharding
// ================================================================

console.log("--- SECTION 3: Range Sharding ---\n");

const ranges = [
  { shard: "A", min: 0, max: 999999 }, { shard: "B", min: 1000000, max: 1999999 },
  { shard: "C", min: 2000000, max: 2999999 }, { shard: "D", min: 3000000, max: 3999999 },
];

function routeByRange(pid) {
  const num = parseInt(pid.replace("PROD-", ""));
  for (const r of ranges) { if (num >= r.min && num <= r.max) return r.shard; }
  return "Overflow";
}

["PROD-000100", "PROD-1500000", "PROD-3999999", "PROD-4500000"].forEach((pid) => {
  console.log(`  ${pid} -> Shard-${routeByRange(pid)}`);
});
console.log("\n  Pro: Range queries hit single shard. Con: New IDs pile on last shard.\n");

// ================================================================
// SECTION 4 — Hash-Based Sharding
// ================================================================

console.log("--- SECTION 4: Hash Sharding ---\n");

const counts = [0, 0, 0, 0];
for (let i = 0; i < 10000; i++) counts[simpleHash(`PROD-${String(i).padStart(6, "0")}`) % 4]++;
console.log("  10,000 products across 4 shards:");
counts.forEach((c, i) => console.log(`    Shard-${i}: ${c} (${((c / 10000) * 100).toFixed(1)}%)`));

let moved = 0;
for (let i = 0; i < 10000; i++) {
  const h = simpleHash(`PROD-${String(i).padStart(6, "0")}`);
  if (h % 4 !== h % 5) moved++;
}
console.log(`\n  Adding 5th shard: ${moved}/10000 (${((moved / 10000) * 100).toFixed(0)}%) must move!`);
console.log("  Too much movement -- use consistent hashing.\n");

// ================================================================
// SECTION 5 — Consistent Hashing with Virtual Nodes
// ================================================================

console.log("--- SECTION 5: Consistent Hashing ---\n");

class ConsistentHashRing {
  constructor(vnPerServer = 50) { this.ring = new Map(); this.sorted = []; this.vn = vnPerServer; this.servers = new Set(); }
  _hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) & 0x7fffffff; return h % 360; }
  addServer(name) {
    this.servers.add(name);
    for (let i = 0; i < this.vn; i++) this.ring.set(this._hash(`${name}#VN${i}`), name);
    this.sorted = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }
  getServer(key) {
    const h = this._hash(key);
    for (const pos of this.sorted) { if (pos >= h) return this.ring.get(pos); }
    return this.ring.get(this.sorted[0]);
  }
  distribution(keys) {
    const dist = {}; for (const s of this.servers) dist[s] = 0;
    keys.forEach((k) => dist[this.getServer(k)]++);
    return dist;
  }
}

const ring = new ConsistentHashRing(50);
["Shard-A", "Shard-B", "Shard-C", "Shard-D"].forEach((s) => ring.addServer(s));

const products = Array.from({ length: 10000 }, (_, i) => `PROD-${i}`);
const before = ring.distribution(products);
console.log("  4 shards:");
Object.entries(before).forEach(([s, c]) => console.log(`    ${s}: ${c} (${((c / 10000) * 100).toFixed(1)}%)`));

const assignBefore = {};
products.forEach((p) => { assignBefore[p] = ring.getServer(p); });

ring.addServer("Shard-E");
const after = ring.distribution(products);
console.log("\n  After adding Shard-E:");
Object.entries(after).forEach(([s, c]) => console.log(`    ${s}: ${c} (${((c / 10000) * 100).toFixed(1)}%)`));

let chMoved = 0;
products.forEach((p) => { if (assignBefore[p] !== ring.getServer(p)) chMoved++; });
console.log(`\n  Moved: ${chMoved}/10000 (${((chMoved / 10000) * 100).toFixed(1)}%) vs ~80% with naive hash!\n`);

// ================================================================
// SECTION 6 — Hot Spot Detection
// ================================================================

console.log("--- SECTION 6: Hot Spots ---\n");

const shards = {
  "Shard-A (Electronics)": { normal: 5000, diwali: 50000 },
  "Shard-B (Fashion)": { normal: 5000, diwali: 15000 },
  "Shard-C (Books)": { normal: 5000, diwali: 5000 },
};

console.log("  Diwali QPS:");
Object.entries(shards).forEach(([s, { diwali }]) => {
  console.log(`    ${s.padEnd(25)} ${diwali} QPS ${diwali > 20000 ? "<-- HOT SPOT!" : ""}`);
});

console.log("\n  Mitigations:");
console.log("    1. Split shard: Electronics -> Phones + Laptops");
console.log("    2. Read replicas for browsing traffic");
console.log("    3. Redis cache for top 1000 trending products");
console.log("    4. Salted keys for intra-shard distribution\n");

// ================================================================
// SECTION 7 — Re-Sharding Strategies
// ================================================================

console.log("--- SECTION 7: Re-Sharding ---\n");

console.log("  Strategy 1 -- Shard Splitting (Doubling):");
[2014, 2016, 2019, 2023].forEach((year, i) => console.log(`    ${year}: ${4 * Math.pow(2, i)} shards`));
console.log("    Only double, not add one at a time.\n");

console.log("  Strategy 2 -- Virtual Shards:");
console.log("    256 virtual shards mapped to 4 physical servers.");
console.log("    Add server: migrate 52 virtual shards. Zero downtime.\n");

console.log("  Strategy 3 -- Shadow Writes:");
console.log("    Phase 1: Dual-write old+new. Phase 2: Backfill history.");
console.log("    Phase 3: Verify. Phase 4: Switch reads. Phase 5: Stop old writes.\n");

// ================================================================
// SECTION 8 — Cross-Shard Queries
// ================================================================

console.log("--- SECTION 8: Cross-Shard Queries ---\n");

console.log("  Scatter-Gather: 'Top 5 by price across all shards'");
console.log("    Each shard returns local top 5 -> coordinator merges -> global top 5.\n");

console.log("  Cross-Shard JOIN Problem:");
console.log("    Products sharded by product_id, Orders by order_id.");
console.log("    'Orders for products rated > 4.5' = full scan of BOTH!\n");

console.log("  Solutions:");
console.log("    1. Denormalize: store rating inside order document");
console.log("    2. Broadcast join: query all product shards, then order shards");
console.log("    3. Co-locate: shard orders by product_id (same key)\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log(`
  1. Shard when single DB can't handle storage, QPS, or connections.
  2. Shard key is the MOST critical decision -- hard to change later.
  3. Range sharding: good for range queries, bad for write hot spots.
  4. Hash sharding: even distribution, loses range query efficiency.
  5. Consistent hashing with virtual nodes minimizes data movement.
  6. Hot spots are inevitable during spikes -- detect and split.
  7. Re-sharding: splitting, virtual shards, or shadow writes.
  8. Cross-shard queries use scatter-gather; avoid cross-shard JOINs.
`);
