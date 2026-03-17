/** ============================================================
 *  FILE 10: DATABASE REPLICATION
 *  ============================================================
 *  Topic: Primary-replica, multi-master, sync vs async,
 *         replication lag, read replicas, failover, split-brain
 *
 *  WHY THIS MATTERS:
 *  A single database is a single point of failure. Replication
 *  copies data across servers for fault tolerance, read scaling,
 *  and disaster recovery. Wrong strategy leads to data loss,
 *  stale reads, or split-brain disasters.
 *  ============================================================ */

// STORY: SBI Core Banking System
// SBI processes 100M+ transactions daily across 22,000 branches.
// Primary DB in Mumbai, replicas in every district. A deposit in
// Varanasi updates locally, but Mumbai may be stale for seconds.
// This trade-off lets SBI serve millions without every TX waiting
// for a Mumbai round-trip.

console.log("=".repeat(70));
console.log("  FILE 10: DATABASE REPLICATION");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — Primary-Replica Setup
// ================================================================

// WHY: One node writes, replicas serve reads and provide failover.

console.log("--- SECTION 1: Primary-Replica Setup ---\n");

class DBNode {
  constructor(name, role = "primary") {
    this.name = name; this.role = role; this.data = new Map();
    this.wal = []; this.walPos = 0; this.healthy = true;
    this.writes = 0; this.reads = 0;
  }
  write(key, val) {
    if (this.role !== "primary" || !this.healthy) return false;
    this.data.set(key, { val, ver: this.walPos + 1 });
    this.wal.push({ key, val, pos: ++this.walPos }); this.writes++;
    return true;
  }
  read(key) { this.reads++; const e = this.data.get(key); return e ? { ...e, src: this.name } : { val: null, src: this.name }; }
  applyWal(entry) { this.data.set(entry.key, { val: entry.val, ver: entry.pos }); this.walPos = entry.pos; }
  walFrom(pos) { return this.wal.filter((e) => e.pos > pos); }
}

class ReplCluster {
  constructor(name) { this.primary = new DBNode(name); this.replicas = []; this.mode = "async"; }
  addReplica(name) {
    const r = new DBNode(name, "replica");
    for (const [k, v] of this.primary.data) r.data.set(k, { ...v });
    r.walPos = this.primary.walPos; this.replicas.push(r);
    console.log(`    Added "${name}" synced to WAL ${r.walPos}`);
    return r;
  }
  write(key, val) {
    const ok = this.primary.write(key, val);
    if (ok && this.mode === "sync") {
      const e = this.primary.wal.at(-1);
      for (const r of this.replicas) if (r.healthy) r.applyWal(e);
    }
    return ok;
  }
  syncAsync() {
    let n = 0;
    for (const r of this.replicas) {
      if (!r.healthy) continue;
      for (const e of this.primary.walFrom(r.walPos)) { r.applyWal(e); n++; }
    }
    return n;
  }
}

const sbi = new ReplCluster("Mumbai-Primary");
sbi.addReplica("Delhi-Replica");
sbi.addReplica("Chennai-Replica");

console.log("\n  Writes to primary:");
sbi.write("ACC-1001", { name: "Rajesh", balance: 50000 });
sbi.write("ACC-1002", { name: "Priya", balance: 125000 });
console.log(`  Primary WAL: ${sbi.primary.walPos}, Delhi WAL: ${sbi.replicas[0].walPos} (behind!)`);
sbi.syncAsync();
console.log(`  After sync: Delhi WAL: ${sbi.replicas[0].walPos}\n`);

// ================================================================
// SECTION 2 — Sync vs Async Replication
// ================================================================

console.log("--- SECTION 2: Sync vs Async ---\n");

function simReplication(mode) {
  const c = new ReplCluster(`SBI-${mode}`); c.mode = mode;
  c.addReplica("Delhi"); c.addReplica("Chennai");

  c.write("TX-001", { type: "deposit", amt: 10000 });
  c.write("TX-002", { type: "withdrawal", amt: 5000 });

  if (mode === "async") {
    console.log(`  Primary WAL: ${c.primary.walPos}, Replicas: ${c.replicas[0].walPos} (behind)`);
    c.syncAsync();
    console.log(`  After catch-up: all at WAL ${c.replicas[0].walPos}`);
  } else {
    console.log(`  All nodes at WAL ${c.replicas[0].walPos} (instant sync)`);
  }
}

console.log("  SYNC mode: writes wait for all replicas");
simReplication("sync");
console.log("  Pro: Zero data loss. Con: Latency = max(all replicas).\n");

console.log("  ASYNC mode: ack on primary write only");
simReplication("async");
console.log("  Pro: Low latency (2ms). Con: Data loss window on crash.\n");

// ================================================================
// SECTION 3 — Replication Lag
// ================================================================

console.log("--- SECTION 3: Replication Lag ---\n");

const primary = new DBNode("Mumbai", "primary");
const replica = new DBNode("Varanasi", "replica");
primary.write("ACC-5001", { balance: 100000 });
replica.applyWal(primary.wal[0]);

primary.write("ACC-5001", { balance: 125000 });
console.log(`  Amit deposits Rs.25K. Primary: Rs.125K, Replica: Rs.${replica.read("ACC-5001").val.balance} (STALE!)`);
console.log(`  Lag: ${primary.walPos - replica.walPos} WAL entries`);

for (const e of primary.walFrom(replica.walPos)) replica.applyWal(e);
console.log(`  After sync: Replica Rs.${replica.read("ACC-5001").val.balance}`);
console.log("  Mitigations: read-your-writes, monotonic reads, causal consistency.\n");

// ================================================================
// SECTION 4 — Read Replica Routing
// ================================================================

console.log("--- SECTION 4: Read Replica Routing ---\n");

class ReplicaRouter {
  constructor(primary, replicas) {
    this.primary = primary; this.replicas = replicas; this.rr = 0;
    this.recentWriters = new Map();
  }
  write(key, val, uid) { this.primary.write(key, val); this.recentWriters.set(uid, Date.now()); }
  read(key, uid) {
    if (this.recentWriters.has(uid) && Date.now() - this.recentWriters.get(uid) < 5000) {
      console.log(`    "${key}" -> ${this.primary.name} (read-your-writes for ${uid})`);
      return this.primary.read(key);
    }
    const healthy = this.replicas.filter((r) => r.healthy);
    const r = healthy[this.rr++ % healthy.length];
    console.log(`    "${key}" -> ${r.name} (round-robin)`);
    return r.read(key);
  }
}

const rp = new DBNode("Mumbai-Primary", "primary");
rp.write("ACC-2001", { balance: 80000 });
const reps = [new DBNode("Delhi-Rep", "replica"), new DBNode("Chennai-Rep", "replica")];
for (const rep of reps) for (const e of rp.wal) rep.applyWal(e);

const router = new ReplicaRouter(rp, reps);
router.write("ACC-2001", { balance: 90000 }, "amit");
router.read("ACC-2001", "amit"); // Primary (read-your-writes)
router.read("ACC-2001", "priya"); // Replica
router.read("ACC-2001", "deepa"); // Replica
console.log();

// ================================================================
// SECTION 5 — Automatic Failover
// ================================================================

console.log("--- SECTION 5: Automatic Failover ---\n");

class FailoverMgr {
  constructor(cluster) { this.cluster = cluster; this.missed = 0; this.threshold = 3; }
  heartbeat() {
    if (this.cluster.primary.healthy) { this.missed = 0; return "healthy"; }
    this.missed++;
    console.log(`    [HB] ${this.cluster.primary.name} missed #${this.missed}`);
    if (this.missed >= this.threshold) return this.failover();
    return "degraded";
  }
  failover() {
    console.log(`    [FAILOVER] "${this.cluster.primary.name}" declared DEAD`);
    const best = this.cluster.replicas.filter((r) => r.healthy).sort((a, b) => b.walPos - a.walPos)[0];
    if (!best) { console.log("    CRITICAL: No healthy replicas!"); return "failed"; }
    const loss = this.cluster.primary.walPos - best.walPos;
    console.log(`    Promoting "${best.name}" (WAL gap: ${loss})`);
    best.role = "primary"; this.cluster.primary = best;
    this.cluster.replicas = this.cluster.replicas.filter((r) => r !== best);
    this.missed = 0;
    return "completed";
  }
}

const foCluster = new ReplCluster("Mumbai-HQ");
foCluster.addReplica("Delhi-Rep"); foCluster.addReplica("Chennai-Rep");
foCluster.write("ACC-3001", { balance: 500000 });
foCluster.syncAsync();
foCluster.write("ACC-3002", { balance: 100000 }); // Not replicated

console.log(`\n  Primary WAL: ${foCluster.primary.walPos}, Replicas: ${foCluster.replicas[0].walPos}\n`);
foCluster.primary.healthy = false;
const fm = new FailoverMgr(foCluster);
for (let i = 0; i < 4; i++) { if (fm.heartbeat() === "completed") break; }
console.log(`  Write to new primary: ${foCluster.write("ACC-3003", { balance: 75000 })}\n`);

// ================================================================
// SECTION 6 — Multi-Master Replication
// ================================================================

console.log("--- SECTION 6: Multi-Master ---\n");

class MultiMaster {
  constructor(name) { this.name = name; this.data = new Map(); this.ver = new Map(); }
  write(key, val) {
    const ts = Date.now(); this.data.set(key, val); this.ver.set(key, { ts, origin: this.name });
    return { key, val, ts, origin: this.name };
  }
  receive(key, val, ts, origin) {
    const local = this.ver.get(key);
    if (!local || ts > local.ts || (ts === local.ts && origin > local.origin)) {
      this.data.set(key, val); this.ver.set(key, { ts, origin }); return "accepted (LWW)";
    }
    return "rejected (local newer)";
  }
}

const mm1 = new MultiMaster("Mumbai"), mm2 = new MultiMaster("Delhi");
const w1 = mm1.write("ACC-7001", { balance: 100000 });
const w2 = mm2.write("ACC-7002", { balance: 50000 });
console.log(`  Mumbai writes ACC-7001, Delhi writes ACC-7002`);
console.log(`  Cross-replicate: ${mm2.receive(w1.key, w1.val, w1.ts, w1.origin)}`);

console.log("\n  CONFLICT: Both update ACC-7001 simultaneously:");
const c1 = mm1.write("ACC-7001", { balance: 120000 });
const c2 = mm2.write("ACC-7001", { balance: 110000 });
console.log(`  Mumbai: Rs.120K, Delhi: Rs.110K`);
console.log(`  Resolve: ${mm1.receive(c2.key, c2.val, c2.ts, c2.origin)}`);
console.log("  Pro: Low write latency. Con: Conflicts need LWW/CRDT.\n");

// ================================================================
// SECTION 7 — Split-Brain Detection
// ================================================================

console.log("--- SECTION 7: Split-Brain ---\n");

class SplitBrainDetector {
  constructor(n, quorum) { this.n = n; this.q = quorum; this.fenceToken = 0; }
  partition(g1, g2) {
    console.log(`  Partition: [${g1.join(",")}](${g1.length}) vs [${g2.join(",")}](${g2.length}), Quorum: ${this.q}`);
    const g1q = g1.length >= this.q;
    console.log(`  -> ${g1q ? "Group1 continues, Group2 fenced" : "Group2 continues, Group1 fenced"}`);
  }
  fence(node) { console.log(`  [FENCE] Token #${++this.fenceToken} -> "${node}"`); return this.fenceToken; }
}

const sbd = new SplitBrainDetector(5, 3);
sbd.partition(["Mumbai", "Delhi", "Chennai"], ["Kolkata", "Bengaluru"]);
console.log();
sbd.fence("Mumbai");
sbd.fence("Delhi");
console.log("  Prevention: Odd nodes, majority quorum, fencing tokens.\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log(`
  1. Primary-replica: one writes, replicas serve reads + failover.
  2. Sync: zero data loss, latency = max(replicas).
  3. Async: low latency, but data loss window on crash.
  4. Replication lag causes stale reads -- use read-your-writes.
  5. Read replicas distribute load with smart routing.
  6. Auto-failover promotes highest-WAL replica when primary dies.
  7. Multi-master: any node writes, conflicts need LWW/CRDT.
  8. Split-brain: prevent with majority quorum + fencing tokens.
`);
