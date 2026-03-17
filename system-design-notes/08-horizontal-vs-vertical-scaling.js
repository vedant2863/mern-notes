/** ============================================================
 *  FILE 08: HORIZONTAL VS VERTICAL SCALING
 *  ============================================================
 *  Topic: Scale up vs out, stateless services, shared-nothing,
 *         auto-scaling, CAP theorem intro
 *
 *  WHY THIS MATTERS:
 *  Every growing app faces: upgrade the machine (vertical) or
 *  add more machines (horizontal)? This choice impacts cost,
 *  fault tolerance, and data consistency.
 *  ============================================================ */

// STORY: Indian Railways Ticket Counters
// Vertical scaling = giving the fastest clerk a faster computer.
// Horizontal scaling = opening more counters. IRCTC auto-scales:
// 10 counters normally, 50 during Tatkal, 200 during Diwali.

console.log("=".repeat(70));
console.log("  FILE 08: HORIZONTAL VS VERTICAL SCALING");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — Vertical Scaling
// ================================================================

// WHY: Scale up adds CPU/RAM to one machine. Simple but limited
// by hardware ceiling and single point of failure.

console.log("--- SECTION 1: Vertical Scaling ---\n");

class VerticalServer {
  constructor(cpu, ram, name = "Server") {
    this.name = name; this.cpu = cpu; this.ram = ram;
    this.rps = cpu * 100; this.cost = cpu * 500 + ram * 50;
  }
  process(incoming) {
    const handled = Math.min(incoming, this.rps);
    const dropped = incoming - handled;
    return { handled, dropped };
  }
  scaleUp(newCpu, newRam) {
    if (newCpu > 128) { console.log(`    [LIMIT] Max 128 CPU!`); newCpu = 128; }
    this.cpu = newCpu; this.ram = newRam;
    this.rps = newCpu * 100; this.cost = newCpu * 500 + newRam * 50;
    console.log(`    [SCALE UP] ${this.rps} req/s (CPU:${newCpu}, RAM:${newRam}GB, Rs.${this.cost}/hr)`);
  }
}

const server = new VerticalServer(4, 16, "IRCTC-Main");
console.log(`  Initial: ${server.cpu} CPU, ${server.ram}GB RAM, ${server.rps} req/s\n`);

const traffic = [
  { label: "Normal day", rps: 200 }, { label: "Tatkal 10am", rps: 800 },
  { label: "Diwali rush", rps: 2000 }, { label: "Diwali+Tatkal", rps: 5000 },
];

for (const t of traffic) {
  const r = server.process(t.rps);
  console.log(`  ${t.label} (${t.rps} rps): Handled=${r.handled}, Dropped=${r.dropped}`);
  if (r.dropped > 0) { server.scaleUp(Math.min(server.cpu * 2, 128), server.ram * 2); }
}
console.log("\n  Limits: Hardware ceiling, SPOF, downtime during upgrade.\n");

// ================================================================
// SECTION 2 — Horizontal Scaling
// ================================================================

// WHY: Add more machines behind a load balancer. No ceiling,
// better fault tolerance, but more complexity.

console.log("--- SECTION 2: Horizontal Scaling ---\n");

class HorizontalCluster {
  constructor(cpu, ram) { this.cpu = cpu; this.ram = ram; this.instances = []; this.addInstance(); }
  addInstance() {
    this.instances.push(new VerticalServer(this.cpu, this.ram, `Counter-${this.instances.length + 1}`));
    console.log(`    [SCALE OUT] #${this.instances.length} -- Total: ${this.instances.length}`);
  }
  capacity() { return this.instances.reduce((s, i) => s + i.rps, 0); }
  cost() { return this.instances.reduce((s, i) => s + i.cost, 0); }
}

const cluster = new HorizontalCluster(4, 16);
for (const t of traffic) {
  while (cluster.capacity() < t.rps && cluster.instances.length < 50) cluster.addInstance();
  console.log(`  ${t.label}: ${cluster.instances.length} instances, Cap=${cluster.capacity()}, Rs.${cluster.cost()}/hr\n`);
}

// ================================================================
// SECTION 3 — Stateless vs Stateful
// ================================================================

// WHY: Horizontal scaling needs stateless services. Local session
// data forces sticky sessions, limiting scalability.

console.log("--- SECTION 3: Stateless vs Stateful ---\n");

class SharedStore {
  constructor() { this.data = new Map(); }
  set(k, v) { this.data.set(k, v); }
  get(k) { return this.data.get(k); }
}

class StatelessCounter {
  constructor(id, store) { this.id = id; this.store = store; }
  handle(uid, action) {
    if (action === "login") { this.store.set(uid, { cart: [] }); return `Session created via Counter-${this.id}`; }
    const s = this.store.get(uid);
    if (!s) return `No session!`;
    if (action === "book") { s.cart.push("Ticket"); return `Booked via Counter-${this.id} (shared store)`; }
  }
}

console.log("  Stateful problem: login at Counter-1, booking at Counter-2 FAILS.\n");

const store = new SharedStore();
const sc1 = new StatelessCounter(1, store), sc2 = new StatelessCounter(2, store);
console.log(`  ${sc1.handle("ravi", "login")}`);
console.log(`  ${sc2.handle("ravi", "book")}`);
console.log("  Any counter serves any request -- true horizontal scaling.\n");

// ================================================================
// SECTION 4 — Shared-Nothing Architecture
// ================================================================

// WHY: Each node owns its data partition. No shared disk/memory,
// no contention, linear scalability.

console.log("--- SECTION 4: Shared-Nothing ---\n");

class SNCluster {
  constructor(n) {
    this.nodes = Array.from({ length: n }, (_, i) => ({ id: i + 1, data: new Map() }));
  }
  hash(key) { let h = 0; for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) & 0x7fffffff; return h % this.nodes.length; }
  write(key, val) { const n = this.nodes[this.hash(key)]; n.data.set(key, val); return n.id; }
}

const sn = new SNCluster(4);
const pnrs = ["PNR-452189", "PNR-283746", "PNR-901234", "PNR-123456", "PNR-678901", "PNR-345678"];
for (const pnr of pnrs) console.log(`  ${pnr} -> Node ${sn.write(pnr, { status: "confirmed" })}`);
console.log("\n  No shared state = no contention = linear scale.\n");

// ================================================================
// SECTION 5 — Session Affinity (Sticky Sessions)
// ================================================================

// WHY: When you can't go stateless, sticky sessions route the
// same user to the same server. A compromise.

console.log("--- SECTION 5: Sticky Sessions ---\n");

class StickyLB {
  constructor(servers) { this.servers = servers; this.map = new Map(); this.rr = 0; }
  route(uid) {
    if (this.map.has(uid)) {
      const s = this.servers.find((x) => x.id === this.map.get(uid) && x.healthy);
      if (s) return { server: s.name, type: "sticky" };
      this.map.delete(uid);
    }
    const healthy = this.servers.filter((s) => s.healthy);
    const s = healthy[this.rr++ % healthy.length];
    this.map.set(uid, s.id);
    return { server: s.name, type: "new" };
  }
}

const servers = [{ id: 1, name: "C-1", healthy: true }, { id: 2, name: "C-2", healthy: true }, { id: 3, name: "C-3", healthy: true }];
const lb = new StickyLB(servers);
for (const u of ["Ravi", "Priya", "Ravi", "Priya"]) {
  const { server, type } = lb.route(u);
  console.log(`  ${u} -> ${server} (${type})`);
}
servers[1].healthy = false;
console.log("  C-2 fails:");
console.log(`  Priya -> ${lb.route("Priya").server} (re-routed)\n`);

// ================================================================
// SECTION 6 — Auto-Scaling
// ================================================================

// WHY: Auto-scaling adjusts instance count by metrics. Optimizes
// cost (down at night) and availability (up during peaks).

console.log("--- SECTION 6: Auto-Scaling ---\n");

class AutoScaler {
  constructor(min, max, capPerInst, up, down) {
    this.min = min; this.max = max; this.cap = capPerInst;
    this.up = up; this.down = down; this.curr = min;
  }
  evaluate(load) {
    const cpu = ((load / (this.curr * this.cap)) * 100).toFixed(1);
    let action = "steady";
    if (cpu > this.up && this.curr < this.max) {
      const needed = Math.min(Math.ceil(load / (this.cap * this.up / 100)), this.max);
      action = `+${needed - this.curr}`; this.curr = needed;
    } else if (cpu < this.down && this.curr > this.min) {
      const needed = Math.max(this.min, Math.ceil(load / (this.cap * this.up / 100)));
      if (needed < this.curr) { action = `-${this.curr - needed}`; this.curr = needed; }
    }
    return { cpu: cpu + "%", instances: this.curr, action };
  }
}

const as = new AutoScaler(2, 20, 400, 70, 30);
console.log("  Time             | Load  | CPU%  | Inst | Action");
console.log("  " + "-".repeat(50));
[["00:00 Night", 100], ["08:00 Morning", 600], ["10:00 Tatkal!", 3000],
 ["10:05 Peak", 5000], ["12:00 Afternoon", 800], ["23:00 Late", 200],
].forEach(([label, load]) => {
  const r = as.evaluate(load);
  console.log(`  ${label.padEnd(18)}| ${String(load).padEnd(5)} | ${r.cpu.padEnd(5)} | ${String(r.instances).padEnd(4)} | ${r.action}`);
});
console.log("\n  20 instances 24/7 = Rs.240K/hr. Auto-scale: ~Rs.60K/hr.\n");

// ================================================================
// SECTION 7 — CAP Theorem
// ================================================================

// WHY: A distributed system can only guarantee 2 of 3:
// Consistency, Availability, Partition tolerance.

console.log("--- SECTION 7: CAP Theorem ---\n");

console.log("       C (Consistency)");
console.log("      / \\");
console.log("    CP   CA");
console.log("    /     \\");
console.log("   P -- AP -- A\n");

const cap = [
  ["IRCTC Booking (CP)",  "Rejects requests during split -- no double-booking"],
  ["Zomato Listings (AP)", "Shows stale data during split -- user sees menu, not error"],
];
cap.forEach(([sys, behavior]) => console.log(`  ${sys}\n    ${behavior}\n`));

// ================================================================
// SECTION 8 — Scaling Decision Framework
// ================================================================

console.log("--- SECTION 8: Decision Framework ---\n");

function decide(p) {
  let v = 0, h = 0;
  if (p.rps < 1000) v += 2; else h += 2;
  if (p.growth === "low") v++; else h += 2;
  if (p.team < 5) v += 2; else h++;
  if (p.downOk) v++; else h += 2;
  return v > h ? "VERTICAL" : "HORIZONTAL";
}

[{ name: "IRCTC 2005", rps: 100, growth: "low", team: 3, downOk: true },
 { name: "IRCTC 2015", rps: 5000, growth: "high", team: 20, downOk: false },
 { name: "IRCTC 2024", rps: 50000, growth: "high", team: 100, downOk: false },
].forEach((e) => console.log(`  ${e.name}: ${decide(e)} (${e.rps} rps, team=${e.team})`));
console.log("\n  Start vertical, go horizontal beyond ~10K req/s.\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log(`
  1. Vertical: simpler but hardware ceiling, single point of failure.
  2. Horizontal: complex but unlimited capacity, fault tolerant.
  3. Stateless services: externalize state for true horizontal scaling.
  4. Shared-nothing: each node owns its data -- no contention.
  5. Sticky sessions: compromise -- works but uneven load.
  6. Auto-scaling adjusts by metrics -- saves cost.
  7. CAP theorem: choose CP (consistent) or AP (available) during partitions.
  8. Start vertical, go horizontal beyond ~10K req/s.
`);
