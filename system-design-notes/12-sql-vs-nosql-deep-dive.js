/** ============================================================
 *  FILE 12: SQL vs NoSQL DEEP DIVE
 *  ============================================================
 *  Topic: Document (MongoDB), key-value (Redis), column-family
 *         (Cassandra), graph, time-series, polyglot persistence
 *
 *  WHY THIS MATTERS:
 *  No single database fits every use case. Modern systems combine
 *  multiple types. Choosing wrong costs months of migration.
 *  ============================================================ */

// STORY: Ola Ride Platform
// Ola serves 2M rides daily across 250 cities. Ride history in a
// document store, driver location in key-value, trip analytics in
// column-family. Each DB type plays to its strength.

console.log("=".repeat(70));
console.log("  FILE 12: SQL vs NoSQL DEEP DIVE");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — Document Store (MongoDB-style)
// ================================================================

// WHY: Each record can have a different shape -- perfect for
// varied ride types (auto, share, outstation, rental).

console.log("--- SECTION 1: Document Store ---\n");

class DocumentStore {
  constructor() { this.collections = {}; }
  createCollection(name) { this.collections[name] = []; }
  insert(coll, doc) {
    const id = `ObjectId_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.collections[coll].push({ _id: id, ...doc });
    return id;
  }
  find(coll, query = {}) {
    return this.collections[coll].filter((doc) =>
      Object.entries(query).every(([k, v]) => doc[k] === v)
    );
  }
}

const db = new DocumentStore();
db.createCollection("rides");

const rides = [
  { type: "auto", rider: "Priya", fare: 85, city: "Bangalore" },
  { type: "share", rider: "Meera", fare: 45, city: "Chennai", co_riders: ["Deepa"], seats_shared: 2 },
  { type: "outstation", rider: "Vikram", fare: 3500, city: "Mumbai", distance_km: 148, tolls: 2 },
  { type: "rental", rider: "Sneha", fare: 1200, city: "Delhi", hours_booked: 4, package: "4hr-40km" },
];
rides.forEach((r) => db.insert("rides", r));

console.log("  Each ride type has different fields:");
db.find("rides").forEach((r) => {
  const fields = Object.keys(r).filter((k) => k !== "_id").join(", ");
  console.log(`    ${r.type.padEnd(12)} [${fields}]`);
});

console.log("\n  Bangalore rides with fare > 50:");
db.find("rides", { city: "Bangalore" }).filter((r) => r.fare > 50)
  .forEach((r) => console.log(`    ${r.rider}: Rs.${r.fare}`));
console.log();

// ================================================================
// SECTION 2 — Key-Value Store (Redis-style)
// ================================================================

// WHY: Sub-millisecond reads for driver location, sessions, caches.

console.log("--- SECTION 2: Key-Value Store ---\n");

class KVStore {
  constructor() { this.data = new Map(); this.expiry = new Map(); }
  set(key, val, ttlMs = 0) {
    this.data.set(key, JSON.stringify(val));
    if (ttlMs > 0) this.expiry.set(key, Date.now() + ttlMs);
  }
  get(key) {
    if (this.expiry.has(key) && Date.now() > this.expiry.get(key)) { this.data.delete(key); this.expiry.delete(key); return null; }
    const v = this.data.get(key); return v ? JSON.parse(v) : null;
  }
  geoAdd(key, lng, lat, member) {
    const geo = this.get(key) || {}; geo[member] = { lng, lat }; this.set(key, geo);
  }
  geoNearby(key, lng, lat, radiusKm) {
    const geo = this.get(key) || {};
    return Object.entries(geo)
      .map(([m, p]) => ({ member: m, dist: Math.sqrt((p.lng - lng) ** 2 + (p.lat - lat) ** 2) * 111 }))
      .filter((e) => e.distance <= radiusKm || e.dist <= radiusKm)
      .sort((a, b) => a.dist - b.dist);
  }
}

const redis = new KVStore();
redis.geoAdd("drivers:blr", 77.610, 12.935, "driver:raju");
redis.geoAdd("drivers:blr", 77.620, 12.940, "driver:suresh");
redis.geoAdd("drivers:blr", 77.631, 12.928, "driver:kamal");

const nearby = redis.geoNearby("drivers:blr", 77.615, 12.937, 2);
console.log("  Nearby drivers (2km):");
nearby.forEach((d) => console.log(`    ${d.member}: ${d.dist.toFixed(2)}km`));

redis.set("session:priya", { userId: "U-001", role: "rider" }, 1800000);
redis.set("surge:koramangala", { multiplier: 1.8 }, 300000);
console.log(`\n  Session: ${JSON.stringify(redis.get("session:priya"))}`);
console.log(`  Surge: ${JSON.stringify(redis.get("surge:koramangala"))}\n`);

// ================================================================
// SECTION 3 — Column-Family Store (Cassandra-style)
// ================================================================

// WHY: Optimized for write-heavy workloads and time-range queries.

console.log("--- SECTION 3: Column-Family Store ---\n");

class ColumnFamilyStore {
  constructor() { this.tables = {}; }
  createTable(name, pk, ck) { this.tables[name] = { pk, ck, partitions: {} }; }
  insert(table, row) {
    const t = this.tables[table];
    if (!t.partitions[row[t.pk]]) t.partitions[row[t.pk]] = {};
    t.partitions[row[t.pk]][row[t.ck]] = { ...row };
  }
  queryPartition(table, pkVal, from, to) {
    const t = this.tables[table];
    return Object.values(t.partitions[pkVal] || {})
      .filter((r) => (!from || r[t.ck] >= from) && (!to || r[t.ck] <= to))
      .sort((a, b) => (a[t.ck] < b[t.ck] ? -1 : 1));
  }
}

const cassandra = new ColumnFamilyStore();
cassandra.createTable("trips", "city", "timestamp");

["Bangalore", "Mumbai", "Delhi"].forEach((city) => {
  ["2024-01", "2024-02", "2024-03"].forEach((month) => {
    cassandra.insert("trips", {
      city, timestamp: `${month}-01`,
      total_rides: Math.floor(Math.random() * 100000) + 50000,
      avg_fare: Math.floor(Math.random() * 200) + 100,
    });
  });
});

console.log("  Bangalore trips Q1 2024 (single partition scan):");
cassandra.queryPartition("trips", "Bangalore", "2024-01", "2024-03-31")
  .forEach((r) => console.log(`    ${r.timestamp}: ${r.total_rides} rides, avg Rs.${r.avg_fare}`));
console.log("\n  Partition by city = data locality. Cluster by time = ordered scans.\n");

// ================================================================
// SECTION 4 — Graph Database
// ================================================================

// WHY: Relationships (fraud rings, recommendations) via traversals.

console.log("--- SECTION 4: Graph Database ---\n");

class GraphDB {
  constructor() { this.nodes = new Map(); this.edges = []; }
  addNode(id, props) { this.nodes.set(id, props); }
  addEdge(from, to, type) { this.edges.push({ from, to, type }); }
}

const graph = new GraphDB();
graph.addNode("rider:priya", { name: "Priya" });
graph.addNode("rider:fake1", { name: "FakeUser1" });
graph.addNode("rider:fake2", { name: "FakeUser2" });
graph.addNode("device:D001", { model: "Samsung A52" });
graph.addNode("promo:FIRST50", { discount: 50 });

graph.addEdge("rider:priya", "device:D001", "USES");
graph.addEdge("rider:fake1", "device:D001", "USES");
graph.addEdge("rider:fake2", "device:D001", "USES");
graph.addEdge("rider:fake1", "promo:FIRST50", "REDEEMED");
graph.addEdge("rider:fake2", "promo:FIRST50", "REDEEMED");

console.log("  Fraud detection: accounts sharing device D001:");
const shared = graph.edges.filter((e) => e.to === "device:D001").map((e) => e.from);
shared.forEach((r) => console.log(`    ${r} -> ${graph.nodes.get(r).name}`));
console.log(`  ${shared.length} accounts on 1 device + same promo = FRAUD RING!\n`);

// ================================================================
// SECTION 5 — Time-Series Data
// ================================================================

// WHY: GPS pings, ride metrics, telemetry -- all time-series.

console.log("--- SECTION 5: Time-Series ---\n");

class TimeSeriesDB {
  constructor() { this.series = {}; }
  write(key, fields, ts) { if (!this.series[key]) this.series[key] = []; this.series[key].push({ ts, ...fields }); }
  query(key, from, to) { return (this.series[key] || []).filter((p) => p.ts >= from && p.ts <= to); }
  downsample(key, from, to, interval) {
    const points = this.query(key, from, to);
    const buckets = {};
    points.forEach((p) => {
      const b = Math.floor(p.ts / interval) * interval;
      if (!buckets[b]) buckets[b] = { count: 0, sum: 0 };
      buckets[b].count++; if (p.speed !== undefined) buckets[b].sum += p.speed;
    });
    return Object.entries(buckets).map(([ts, b]) => ({
      ts: Number(ts), avgSpeed: (b.sum / b.count).toFixed(1), points: b.count,
    }));
  }
}

const tsdb = new TimeSeriesDB();
const base = 1700000000000;
for (let i = 0; i < 30; i++) {
  tsdb.write("raju:RIDE-5001", { lat: 12.935 + i * 0.001, speed: 20 + Math.random() * 30 }, base + i * 3000);
}

const pts = tsdb.query("raju:RIDE-5001", base, base + 15000);
console.log(`  GPS pings (first 5 of ${pts.length}):`);
pts.slice(0, 3).forEach((p) => console.log(`    +${(p.ts - base) / 1000}s speed=${p.speed.toFixed(0)}km/h`));

const ds = tsdb.downsample("raju:RIDE-5001", base, base + 90000, 15000);
console.log(`\n  Downsampled (15s buckets): ${ds.length} points`);
ds.slice(0, 3).forEach((d) => console.log(`    +${(d.ts - base) / 1000}s avg=${d.avgSpeed}km/h (${d.points} pts)`));
console.log();

// ================================================================
// SECTION 6 — Polyglot Persistence
// ================================================================

console.log("--- SECTION 6: Polyglot Persistence ---\n");

const architecture = [
  ["Ride History",    "MongoDB (Document)",       "Flexible schema per ride type"],
  ["Driver Location", "Redis (Key-Value)",        "Sub-ms reads, 3s TTL updates"],
  ["Trip Analytics",  "Cassandra (Column-Family)", "Write-heavy, time-range scans"],
  ["Fraud Detection", "Neo4j (Graph)",            "Traverse rider-device links"],
  ["GPS Tracking",    "InfluxDB (Time-Series)",   "Millions of pings/sec"],
  ["User Profiles",   "PostgreSQL (Relational)",  "ACID for payments, KYC"],
];

architecture.forEach(([use, db, why]) => {
  console.log(`  ${use.padEnd(18)} -> ${db.padEnd(30)} ${why}`);
});

console.log("\n  Single ride data flow:");
console.log("    1. Redis: fetch nearby drivers (<1ms)");
console.log("    2. PostgreSQL: create ride record (ACID)");
console.log("    3. InfluxDB: GPS pings every 3s");
console.log("    4. MongoDB: store full ride document");
console.log("    5. Cassandra: write analytics row");
console.log();

// ================================================================
// SECTION 7 — Decision Matrix
// ================================================================

console.log("--- SECTION 7: Decision Matrix ---\n");

const matrix = [
  ["Flexible schema",       "Document (MongoDB)",    "Schema-free, nested JSON"],
  ["Ultra-fast lookups",     "Key-Value (Redis)",     "O(1), in-memory"],
  ["Heavy writes + ranges",  "Column-Family (Cassandra)", "LSM tree, wide rows"],
  ["Relationship traversal", "Graph (Neo4j)",         "O(1) per hop"],
  ["Time-ordered data",      "Time-Series (InfluxDB)", "Compression, downsampling"],
  ["ACID transactions",      "Relational (PostgreSQL)", "Strong consistency"],
];

console.log(`  ${"Need".padEnd(24)} ${"Best DB".padEnd(30)} Why`);
console.log(`  ${"---".repeat(26)}`);
matrix.forEach(([need, best, why]) => console.log(`  ${need.padEnd(24)} ${best.padEnd(30)} ${why}`));

console.log("\n  Anti-patterns:");
console.log("    X MongoDB for financial transactions (pre-4.0 no multi-doc ACID)");
console.log("    X PostgreSQL for real-time driver locations (too slow)");
console.log("    X Redis for analytics (volatile, no range scans)");
console.log();

// ================================================================
// SECTION 8 — Migration Strategy
// ================================================================

console.log("--- SECTION 8: Migration ---\n");

console.log("  Ola: MySQL -> MongoDB for ride history\n");
console.log("  Phase 1: Dual-write (both DBs receive every write)");
console.log("  Phase 2: Verify consistency (diff checks)");
console.log("  Phase 3: Switch reads to MongoDB (feature flag 1%->100%)");
console.log("  Phase 4: Stop MySQL writes");
console.log("  Phase 5: Decommission MySQL after 30-day observation\n");
console.log("  Strangler Fig: gradually replace old system from edges inward.\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log(`
  1. Document stores: flexible schemas -- different fields per record.
  2. Key-value: sub-millisecond reads for hot data like locations.
  3. Column-family: write-heavy analytics with time-range queries.
  4. Graph databases: fraud detection and recommendations via traversals.
  5. Time-series: compress and downsample high-frequency sensor data.
  6. Polyglot persistence: right DB for each use case, not one for all.
  7. Migration: dual-write, verify, switch reads, stop writes, decommission.
  8. Choose DB AFTER understanding access patterns, not before.
`);
