/** ============================================================
 *  FILE 20: FAULT TOLERANCE PATTERNS
 *  ============================================================
 *  Topic: Active-active/passive, health checks, leader election,
 *         idempotency keys, chaos engineering
 *
 *  WHY THIS MATTERS:
 *  Systems will fail — hardware crashes, networks partition, and
 *  software has bugs. Fault tolerance ensures systems continue
 *  functioning despite component failures.
 *  ============================================================ */

// STORY: Railway Signal Redundancy
// Indian Railways operates 7,000+ stations. Signal cabins use dual-
// redundant systems. If primary fails, standby takes over through
// leader election. Every signal command uses idempotency keys so
// replays never cause duplicate transitions.

console.log("=".repeat(65));
console.log("  FILE 20: FAULT TOLERANCE PATTERNS");
console.log("  Railway Signal Redundancy — dual cabins, leader election");
console.log("=".repeat(65));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Active-Passive Redundancy
// ════════════════════════════════════════════════════════════════

// WHY: Simplest redundancy — one node handles traffic, standby waits.
console.log("--- Section 1: Active-Passive Redundancy ---\n");

class SignalCabin {
  constructor(id, role) { this.id = id; this.role = role; this.healthy = true; this.commands = 0; }
  process(cmd) {
    if (!this.healthy) return { status: "FAILED", cabin: this.id };
    if (this.role !== "PRIMARY") return { status: "REJECTED", cabin: this.id };
    this.commands++; return { status: "OK", cabin: this.id, cmd };
  }
  promote() { this.role = "PRIMARY"; }
  demote() { this.role = "STANDBY"; }
}

class ActivePassiveCluster {
  constructor(pId, sId) {
    this.primary = new SignalCabin(pId, "PRIMARY");
    this.standby = new SignalCabin(sId, "STANDBY");
    this.failovers = 0;
  }
  processCommand(cmd) {
    let r = this.primary.process(cmd);
    if (r.status === "FAILED") { this.failover(); r = this.primary.process(cmd); }
    return r;
  }
  failover() {
    this.failovers++;
    this.standby.promote();
    const tmp = this.primary; this.primary = this.standby; this.standby = tmp;
    this.standby.demote();
  }
  fail(id) { if (this.primary.id === id) this.primary.healthy = false; if (this.standby.id === id) this.standby.healthy = false; }
}

const cluster = new ActivePassiveCluster("cabin-A", "cabin-B");
console.log("  Phase 1: Normal (cabin-A primary)");
for (let i = 0; i < 3; i++) { const r = cluster.processCommand(`signal-${i}`); console.log(`    Cmd ${i}: ${r.status} via ${r.cabin}`); }

console.log("\n  Phase 2: cabin-A fails!");
cluster.fail("cabin-A");
const fr = cluster.processCommand("signal-3");
console.log(`    After failure: ${fr.status} via ${fr.cabin} (automatic failover)`);
console.log(`  Failovers: ${cluster.failovers}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Active-Active Redundancy
// ════════════════════════════════════════════════════════════════

// WHY: All nodes handle traffic simultaneously. Better utilization,
// no failover delay, but requires conflict resolution.
console.log("--- Section 2: Active-Active Redundancy ---\n");

class ActiveActiveCluster {
  constructor(count) {
    this.nodes = [];
    for (let i = 0; i < count; i++) this.nodes.push({ id: `node-${i+1}`, healthy: true, processed: 0 });
  }
  route() {
    const healthy = this.nodes.filter(n => n.healthy);
    if (!healthy.length) return { status: "ALL_DOWN" };
    healthy.sort((a,b) => a.processed - b.processed);
    healthy[0].processed++;
    return { status: "OK", node: healthy[0].id };
  }
  fail(id) { const n = this.nodes.find(n => n.id === id); if (n) n.healthy = false; }
  recover(id) { const n = this.nodes.find(n => n.id === id); if (n) n.healthy = true; }
}

const aa = new ActiveActiveCluster(3);
console.log("  All healthy — load balanced:");
for (let i = 0; i < 6; i++) console.log(`    Req ${i}: ${aa.route().node}`);
aa.fail("node-2");
console.log("\n  node-2 fails — traffic redistributes:");
for (let i = 6; i < 9; i++) console.log(`    Req ${i}: ${aa.route().node}`);
console.log(`  Distribution: ${aa.nodes.map(n => `${n.id}=${n.processed}`).join(", ")}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Health Checks and Leader Election
// ════════════════════════════════════════════════════════════════

// WHY: Detect failures early. When leader fails, elect a new one.
console.log("--- Section 3: Health Checks and Leader Election ---\n");

class HealthChecker {
  constructor() { this.targets = {}; }
  register(id, checkFn) { this.targets[id] = { id, checkFn, status: "UNKNOWN", failures: 0 }; }
  check(id) {
    const t = this.targets[id]; if (!t) return null;
    const r = t.checkFn();
    if (r.healthy) { t.status = "HEALTHY"; t.failures = 0; }
    else { t.failures++; t.status = t.failures >= 3 ? "DOWN" : "DEGRADED"; }
    return { target: id, status: t.status, failures: t.failures };
  }
}

const hc = new HealthChecker();
let cabinDown = false;
hc.register("cabin-A", () => ({ healthy: !cabinDown, latencyMs: cabinDown ? -1 : 5 }));
hc.register("cabin-B", () => ({ healthy: true, latencyMs: 3 }));

console.log("  All healthy:", [hc.check("cabin-A"), hc.check("cabin-B")].map(r => `${r.target}=${r.status}`).join(", "));
cabinDown = true;
for (let i = 0; i < 3; i++) hc.check("cabin-A");
console.log("  After 3 failures:", hc.check("cabin-A").status);

// Leader Election (Bully Algorithm)
console.log("\n  Leader Election (Bully Algorithm):");
class BullyElection {
  constructor() { this.nodes = {}; this.leader = null; }
  addNode(id, priority) { this.nodes[id] = { id, priority, alive: true }; }
  elect(initiatorId) {
    const init = this.nodes[initiatorId]; if (!init || !init.alive) return null;
    const higher = Object.values(this.nodes).filter(n => n.priority > init.priority && n.alive);
    if (higher.length === 0) { this.leader = initiatorId; return this.leader; }
    this.leader = higher.sort((a,b) => b.priority - a.priority)[0].id;
    return this.leader;
  }
  kill(id) { if (this.nodes[id]) this.nodes[id].alive = false; }
}

const elec = new BullyElection();
for (let i = 1; i <= 5; i++) elec.addNode(`signal-${i}`, i);
console.log(`    node-2 initiates: leader=${elec.elect("signal-2")}`);
elec.kill("signal-5");
console.log(`    node-5 fails, node-3 initiates: leader=${elec.elect("signal-3")}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Idempotency Keys for Safe Retries
// ════════════════════════════════════════════════════════════════

// WHY: Network failures cause duplicates. Idempotency keys ensure
// processing twice has the same effect as once.
console.log("--- Section 4: Idempotency Keys ---\n");

class IdempotentProcessor {
  constructor() { this.processed = {}; this.state = {}; this.stats = { exec: 0, dedup: 0 }; }
  process(cmd) {
    const key = cmd.idempotencyKey;
    if (this.processed[key]) { this.stats.dedup++; return { status: "ALREADY_PROCESSED" }; }
    if (cmd.type === "SET_SIGNAL") this.state[cmd.signalId] = cmd.value;
    this.processed[key] = true; this.stats.exec++;
    return { status: "PROCESSED" };
  }
}

const proc = new IdempotentProcessor();
const cmds = [
  { type: "SET_SIGNAL", signalId: "SIG-42", value: "RED", idempotencyKey: "cmd-001" },
  { type: "SET_SIGNAL", signalId: "SIG-42", value: "GREEN", idempotencyKey: "cmd-002" },
];

console.log("  First processing:");
cmds.forEach(c => console.log(`    ${c.idempotencyKey}: ${proc.process(c).status}`));
console.log("  Retry (duplicates):");
cmds.forEach(c => console.log(`    ${c.idempotencyKey}: ${proc.process(c).status}`));
console.log(`  Stats: ${JSON.stringify(proc.stats)}, State: ${JSON.stringify(proc.state)}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Chaos Engineering and Graceful Degradation
// ════════════════════════════════════════════════════════════════

// WHY: Test fault tolerance by injecting failures. Shed non-critical
// functionality to protect core services under stress.
console.log("--- Section 5: Chaos Engineering and Graceful Degradation ---\n");

console.log("  Chaos Experiments:");
const testCluster = new ActivePassiveCluster("main", "backup");
testCluster.fail("main");
const chaosR = testCluster.processCommand("test");
console.log(`    Primary failure: routed to ${chaosR.cabin} -> ${chaosR.status === "OK" ? "PASSED" : "FAILED"}`);

const testProc = new IdempotentProcessor();
for (let i = 0; i < 100; i++) testProc.process({ type: "SET_SIGNAL", signalId: "SIG-99", value: "RED", idempotencyKey: "dup-001" });
console.log(`    Duplicate storm: exec=${testProc.stats.exec}, dedup=${testProc.stats.dedup} -> ${testProc.stats.exec === 1 ? "PASSED" : "FAILED"}`);

console.log("\n  Graceful Degradation Levels:");
const features = ["signal-control", "train-tracking", "passenger-info", "analytics", "logging"];
const levels = [
  { name: "NORMAL", disabled: [] },
  { name: "ELEVATED", disabled: ["analytics"] },
  { name: "HIGH", disabled: ["analytics", "logging"] },
  { name: "CRITICAL", disabled: ["analytics", "logging", "passenger-info"] },
  { name: "EMERGENCY", disabled: ["analytics", "logging", "passenger-info", "train-tracking"] },
];
levels.forEach((l, i) => {
  const active = features.filter(f => !l.disabled.includes(f));
  console.log(`    Level ${i} (${l.name}): [${active.join(", ")}]`);
});
console.log("    signal-control NEVER degrades — most critical feature.");

// DR strategies
console.log("\n  Disaster Recovery Strategies:");
console.log("  Strategy              RPO        RTO        Cost");
console.log("  " + "-".repeat(52));
const fmt = m => m < 60 ? `${m} min` : `${(m/60).toFixed(0)} hrs`;
[{ name: "Backup & Restore", rpo: 1440, rto: 480, cost: 1 },
 { name: "Warm Standby", rpo: 15, rto: 30, cost: 3 },
 { name: "Multi-Site Active", rpo: 1, rto: 5, cost: 4 },
].forEach(s => {
  console.log(`  ${s.name.padEnd(22)} ${fmt(s.rpo).padEnd(10)} ${fmt(s.rto).padEnd(10)} ${"$".repeat(s.cost)}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════
console.log("=".repeat(65));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(65));
console.log(`
  1. Active-passive: standby takes over on failure (some downtime).
  2. Active-active: all nodes serve traffic (no failover delay).
  3. Health checks (shallow + deep) detect failures early.
  4. Leader election (bully) ensures one coordinator — highest priority wins.
  5. Idempotency keys guarantee safe retries — no duplicate effects.
  6. Chaos engineering tests fault tolerance with real failures.
  7. Graceful degradation sheds non-critical features under stress.
  8. DR strategies trade cost vs speed: RPO (data loss) and RTO (recovery time).

  Railway Wisdom: "A signal that fails must fail safe — in the
  business of moving a nation, redundancy is the foundation."
`);
