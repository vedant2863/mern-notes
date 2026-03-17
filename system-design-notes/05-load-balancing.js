/** ============================================================
 *  FILE 05: LOAD BALANCING
 *  ============================================================
 *  Topics: Round-robin, weighted, least-connections, IP hash,
 *          consistent hashing intro, health checks, L4 vs L7
 *
 *  WHY THIS MATTERS:
 *  When millions hit your servers -- like Flipkart Big Billion
 *  Days -- a single server cannot cope. Load balancers distribute
 *  traffic so no machine is overwhelmed. Wrong algorithm = some
 *  servers crash while others sit idle.
 *  ============================================================ */

// STORY: Flipkart Big Billion Days
// Millions rush in at midnight. The load balancer is traffic police
// at the entrance, directing crowds to different counters. Without
// it, one counter is crushed while others are empty.

console.log("=".repeat(70));
console.log("  FILE 05: LOAD BALANCING");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — Round-Robin
// ================================================================

// WHY: Simplest algorithm -- distribute in circular order. Even
// when servers are identical, but ignores current load.

console.log("--- SECTION 1: Round-Robin ---\n");

class RoundRobinBalancer {
  constructor(servers) {
    this.servers = servers.map((s) => ({ ...s, count: 0 }));
    this.idx = 0;
  }
  next() {
    const s = this.servers[this.idx];
    this.idx = (this.idx + 1) % this.servers.length;
    s.count++;
    return s;
  }
}

const rr = new RoundRobinBalancer([{ name: "Server-A" }, { name: "Server-B" }, { name: "Server-C" }]);
const requests = ["iPhone search", "Add to cart", "Checkout", "Payment", "Track order", "Browse deals"];
requests.forEach((req, i) => {
  const s = rr.next();
  console.log(`    ${(i + 1).toString().padStart(2)}. "${req}" -> ${s.name}`);
});
console.log();
rr.servers.forEach((s) => console.log(`    ${s.name}: ${s.count} requests ${"#".repeat(s.count * 2)}`));
console.log("\n  Pros: Simple, even when servers identical. Cons: Ignores capacity.\n");

// ================================================================
// SECTION 2 — Weighted Round-Robin
// ================================================================

// WHY: Not all servers are equal. A 32-core machine should handle
// more traffic than a 4-core one.

console.log("--- SECTION 2: Weighted Round-Robin ---\n");

class WeightedRR {
  constructor(servers) {
    this.servers = servers.map((s) => ({ ...s, count: 0 }));
    this.expanded = [];
    this.servers.forEach((s) => { for (let i = 0; i < s.weight; i++) this.expanded.push(s); });
    this.idx = 0;
  }
  next() { const s = this.expanded[this.idx]; this.idx = (this.idx + 1) % this.expanded.length; s.count++; return s; }
}

const wrr = new WeightedRR([
  { name: "Mega-Server", weight: 5, spec: "32 CPU" },
  { name: "Standard", weight: 3, spec: "16 CPU" },
  { name: "Small", weight: 1, spec: "4 CPU" },
]);

for (let i = 0; i < 18; i++) wrr.next();
const total = wrr.servers.reduce((s, srv) => s + srv.count, 0);
wrr.servers.forEach((s) => {
  console.log(`    ${s.name.padEnd(14)} ${String(s.count).padStart(2)} reqs (${((s.count / total) * 100).toFixed(0)}%) ${"#".repeat(s.count)}`);
});
console.log();

// ================================================================
// SECTION 3 — Least Connections
// ================================================================

// WHY: Some requests are heavier than others. Least-connections
// sends new requests to the server with fewest active connections.

console.log("--- SECTION 3: Least Connections ---\n");

class LeastConnBalancer {
  constructor(servers) {
    this.servers = servers.map((s) => ({ ...s, active: 0, total: 0 }));
  }
  next() {
    const s = this.servers.reduce((a, b) => a.active <= b.active ? a : b);
    s.active++; s.total++; return s;
  }
  release(s) { if (s.active > 0) s.active--; }
}

const lc = new LeastConnBalancer([{ name: "A" }, { name: "B" }, { name: "C" }]);

const workload = [
  { name: "Search", dur: 1 }, { name: "Cart", dur: 1 },
  { name: "Checkout (heavy)", dur: 5 }, { name: "Browse", dur: 1 },
  { name: "Payment (heavy)", dur: 4 }, { name: "Quick view", dur: 1 },
];
const active = [];
workload.forEach((req, i) => {
  active.forEach((a) => { a.rem--; if (a.rem <= 0) lc.release(a.srv); });
  const still = active.filter((a) => a.rem > 0); active.length = 0; active.push(...still);
  const srv = lc.next();
  active.push({ srv, rem: req.dur });
  console.log(`    "${req.name.padEnd(20)}" -> ${srv.name} (active: ${lc.servers.map((s) => s.name + ":" + s.active).join(", ")})`);
});
console.log("\n  Smart for mixed workloads: heavy requests don't pile up.\n");

// ================================================================
// SECTION 4 — IP Hash
// ================================================================

// WHY: Same user always reaches same server (session affinity).
// Useful for server-side sessions and caching.

console.log("--- SECTION 4: IP Hash ---\n");

function hashIP(ip) { let h = 0; for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) & 0x7fffffff; return h; }
const ipServers = ["Server-A", "Server-B", "Server-C"];
const ips = ["192.168.1.10", "10.0.0.25", "172.16.0.100", "192.168.1.10", "10.0.0.25"];
ips.forEach((ip, i) => {
  const srv = ipServers[hashIP(ip) % ipServers.length];
  const repeat = i > 0 && ips.indexOf(ip) < i;
  console.log(`    ${ip.padEnd(18)} -> ${srv}${repeat ? " <-- same as before (affinity)" : ""}`);
});
console.log("\n  Use: Shopping cart stored in server memory.\n");

// ================================================================
// SECTION 5 — Consistent Hashing Intro
// ================================================================

// WHY: Adding/removing a server with IP hash remaps nearly ALL
// clients. Consistent hashing moves only K/N keys.

console.log("--- SECTION 5: Consistent Hashing ---\n");

class ConsistentRing {
  constructor(replicas = 3) { this.replicas = replicas; this.ring = new Map(); this.sorted = []; }
  hash(key) { let h = 0; for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) & 0x7fffffff; return h % 360; }
  addServer(name) {
    const positions = [];
    for (let i = 0; i < this.replicas; i++) { const pos = this.hash(`${name}-r${i}`); this.ring.set(pos, name); positions.push(pos); }
    this.sorted = Array.from(this.ring.keys()).sort((a, b) => a - b);
    console.log(`    Added ${name} at [${positions.join(", ")}] degrees`);
  }
  getServer(key) {
    const h = this.hash(key);
    for (const pos of this.sorted) { if (pos >= h) return this.ring.get(pos); }
    return this.ring.get(this.sorted[0]);
  }
}

const ring = new ConsistentRing(3);
ring.addServer("Cache-1"); ring.addServer("Cache-2"); ring.addServer("Cache-3");
console.log();

const products = ["iphone-15", "samsung-s24", "macbook-pro", "dell-xps"];
console.log("  Before adding server:");
const before = {};
products.forEach((p) => { const s = ring.getServer(p); before[p] = s; console.log(`    ${p.padEnd(14)} -> ${s}`); });

ring.addServer("Cache-4");
console.log("\n  After adding Cache-4:");
let moved = 0;
products.forEach((p) => { const s = ring.getServer(p); if (s !== before[p]) moved++; console.log(`    ${p.padEnd(14)} -> ${s}${s !== before[p] ? " (moved)" : ""}`); });
console.log(`\n  Only ${moved}/${products.length} keys moved (vs ALL with simple hash).\n`);

// ================================================================
// SECTION 6 — Health Checks
// ================================================================

// WHY: Without health checks, requests go to dead servers.

console.log("--- SECTION 6: Health Checks ---\n");

const healthServers = [
  { name: "Server-A", ms: 45 }, { name: "Server-B", ms: 52 },
  { name: "Server-C", ms: 200 }, { name: "Server-D", ms: -1 },
];
console.log(`  ${"Server".padEnd(12)} ${"Response".padEnd(12)} Status`);
console.log(`  ${"---".repeat(15)}`);
healthServers.forEach((s) => {
  const status = s.ms < 0 ? "UNHEALTHY" : s.ms > 150 ? `DEGRADED (${s.ms}ms)` : `HEALTHY (${s.ms}ms)`;
  console.log(`  ${s.name.padEnd(12)} ${(s.ms + "ms").padEnd(12)} ${status}`);
});
console.log("\n  Types: TCP (port), HTTP (GET /health), Deep (DB+Redis+disk)");
console.log("  K8s: Liveness (restart), Readiness (remove from LB)\n");

// ================================================================
// SECTION 7 — L4 vs L7 Load Balancing
// ================================================================

// WHY: L4 routes by IP/port (fast). L7 inspects HTTP content (smart).

console.log("--- SECTION 7: L4 vs L7 ---\n");

console.log("  L4 (Transport): sees IP + Port only");
[{ port: 80, dest: "web-1:80" }, { port: 443, dest: "web-1:443" }].forEach((r) => {
  console.log(`    *:${r.port} -> ${r.dest}`);
});

console.log("\n  L7 (Application): sees URL, method, headers");
[["GET /api/search", "search-svc"], ["POST /api/cart", "cart-svc"], ["GET /static/logo", "cdn-edge"]].forEach(([req, dest]) => {
  console.log(`    ${req.padEnd(22)} -> ${dest}`);
});
console.log("\n  L4: fast+cheap (NLB). L7: smart+expensive (ALB, SSL termination, path routing).\n");

// ================================================================
// SECTION 8 — Big Billion Days Simulation
// ================================================================

console.log("--- SECTION 8: BBD Traffic Simulation ---\n");

const servers = [
  { name: "Mumbai-1", maxRPS: 5000, weight: 5 }, { name: "Mumbai-2", maxRPS: 3000, weight: 3 },
  { name: "Delhi-1", maxRPS: 4000, weight: 4 },
];
const totalCap = servers.reduce((s, srv) => s + srv.maxRPS, 0);

const traffic = [
  ["11:55 PM", 2000], ["12:00 AM (SALE!)", 15000],
  ["12:01 AM (PEAK)", 18000], ["12:30 AM", 8000],
];
traffic.forEach(([time, rps]) => {
  const load = ((rps / totalCap) * 100).toFixed(0);
  const status = rps > totalCap ? "OVERLOADED" : rps > totalCap * 0.7 ? "HIGH" : "OK";
  console.log(`    ${time.padEnd(22)} ${String(rps).padEnd(8)} ${(status + " " + load + "%").padEnd(16)} ${"|".repeat(Math.min(15, Math.round(rps / 1200)))}`);
});
console.log(`\n  Total capacity: ${totalCap} RPS. Peak 18K -> OVERLOADED!`);
console.log("  Auto-scaling adds 3 servers -> 24K RPS -> crisis averted.\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================
console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Round-robin: simple, assumes equal servers. Weighted for unequal.");
console.log();
console.log("  2. Least-connections: best for mixed fast/slow workloads.");
console.log();
console.log("  3. IP hash: session affinity -- same client, same server.");
console.log();
console.log("  4. Consistent hashing: only K/N keys move when adding servers.");
console.log();
console.log("  5. Health checks are non-negotiable -- never route to dead servers.");
console.log();
console.log("  6. L4 (fast, IP/port) vs L7 (smart, URL/header routing).");
console.log();
console.log("  7. Auto-scaling + load balancing together handle traffic spikes.");
console.log();
