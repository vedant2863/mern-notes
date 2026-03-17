/** ============================================================
 *  FILE 33: CONTAINERS AND DEPLOYMENT STRATEGIES
 *  ============================================================
 *  Topic: Containers, blue-green, canary, rolling update,
 *         feature flags, rollback mechanisms
 *
 *  WHY THIS MATTERS:
 *  A bad deploy can cost millions per minute. Modern strategies
 *  like canary and blue-green minimize blast radius, enabling
 *  teams to ship 10-50 times per day with confidence.
 *  ============================================================ */

// STORY: Flipkart Big Billion Days Deploy
// During BBD 2023, Flipkart deployed a checkout optimization via
// canary: 5% traffic got the new version. When canary showed a 2%
// error spike, automated rollback kicked in within 90 seconds.

console.log("=".repeat(70));
console.log("  FILE 33: CONTAINERS AND DEPLOYMENT STRATEGIES");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Container Concepts
// ════════════════════════════════════════════════════════════════

// WHY: Containers package code + deps into isolated units,
// solving "works on my machine".

console.log("SECTION 1: Container Concepts");
console.log("-".repeat(50));

class Container {
  constructor(image, version) {
    this.id = `ctr-${(Math.random()*1e6|0).toString(36)}`;
    this.image = image; this.version = version; this.status = "created";
    this.metrics = { requests: 0, errors: 0 };
  }
  start() { this.status = "running"; return this; }
  stop() { this.status = "stopped"; return this; }
  isHealthy() { return this.status === "running" && this.metrics.errors / Math.max(this.metrics.requests, 1) < 0.05; }
  simulateTraffic(n) { for (let i = 0; i < n; i++) { this.metrics.requests++; if (Math.random() < 0.01) this.metrics.errors++; } }
  toString() { return `[${this.id}] ${this.image}:${this.version} (${this.status})`; }
}

const ctrs = [1,2,3].map(() => new Container("flipkart/checkout", "v3.2.0").start());
console.log("  Running containers:");
ctrs.forEach(c => console.log(`    ${c}`));

console.log("\n  Container vs VM:");
[["Startup","ms","minutes"],["Size","MBs","GBs"],["Isolation","Process","Hardware"],["Density","100s/host","10s/host"]].forEach(
  ([a,c,v]) => console.log(`    ${a.padEnd(14)} Container: ${c.padEnd(14)} VM: ${v}`)
);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Blue-Green Deployment
// ════════════════════════════════════════════════════════════════

// WHY: Keeps old version running. Instant rollback via LB switch.

console.log("SECTION 2: Blue-Green Deployment");
console.log("-".repeat(50));

class BlueGreenDeploy {
  constructor(service, count = 3) {
    this.service = service; this.count = count;
    this.blue = { instances: [], version: null, active: false };
    this.green = { instances: [], version: null, active: false };
    this.active = null;
  }
  deployInitial(ver) {
    this.blue.instances = Array.from({length: this.count}, () => new Container(this.service, ver).start());
    this.blue.version = ver; this.blue.active = true; this.active = this.blue;
    console.log(`    [BG] Initial: ${ver} on BLUE (${this.count} instances)`);
  }
  deployNew(ver) {
    const inactive = this.active === this.blue ? this.green : this.blue;
    const name = inactive === this.blue ? "BLUE" : "GREEN";
    inactive.instances = Array.from({length: this.count}, () => new Container(this.service, ver).start());
    inactive.instances.forEach(c => c.simulateTraffic(100));
    inactive.version = ver;
    if (!inactive.instances.every(c => c.isHealthy())) { console.log("    [BG] ABORT: health check failed"); return false; }
    this.active.active = false; inactive.active = true; this.active = inactive;
    console.log(`    [BG] Traffic switched to ${name} (${ver})`);
    return true;
  }
  rollback() {
    const fallback = this.active === this.blue ? this.green : this.blue;
    if (!fallback.version) return false;
    console.log(`    [BG] ROLLBACK: ${this.active.version} -> ${fallback.version}`);
    this.active.active = false; fallback.active = true; this.active = fallback;
    return true;
  }
  status() {
    return { blue: { ver: this.blue.version, active: this.blue.active }, green: { ver: this.green.version, active: this.green.active } };
  }
}

console.log("\n  Blue-Green deploy:");
const bg = new BlueGreenDeploy("flipkart/checkout", 3);
bg.deployInitial("v3.2.0");
bg.deployNew("v3.3.0");
console.log(`    Status: ${JSON.stringify(bg.status())}`);
console.log("  Issue detected:");
bg.rollback();
console.log(`    Status: ${JSON.stringify(bg.status())}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Canary Deployment
// ════════════════════════════════════════════════════════════════

// WHY: Small % gets new version first. Only that % is affected if bad.

console.log("SECTION 3: Canary Deployment");
console.log("-".repeat(50));

class CanaryDeploy {
  constructor(service, total = 20) {
    this.service = service; this.total = total;
    this.stableVer = null; this.canaryVer = null; this.canaryPct = 0;
    this.metrics = { stable: { reqs: 0, errs: 0 }, canary: { reqs: 0, errs: 0 } };
  }
  deployStable(ver) { this.stableVer = ver; console.log(`    [Canary] Stable: ${ver} on ${this.total} instances`); }
  startCanary(ver, pct = 5) {
    this.canaryVer = ver; this.canaryPct = pct;
    console.log(`    [Canary] ${ver} at ${pct}% traffic`);
  }
  simulateTraffic(total) {
    const canaryReqs = Math.floor(total * this.canaryPct / 100);
    this.metrics.stable.reqs += total - canaryReqs;
    this.metrics.stable.errs += Math.floor((total - canaryReqs) * 0.005);
    this.metrics.canary.reqs += canaryReqs;
  }
  injectCanaryErrors(rate) { this.metrics.canary.errs = Math.floor(this.metrics.canary.reqs * rate); }
  analyze() {
    const sErr = this.metrics.stable.reqs > 0 ? +(this.metrics.stable.errs/this.metrics.stable.reqs*100).toFixed(2) : 0;
    const cErr = this.metrics.canary.reqs > 0 ? +(this.metrics.canary.errs/this.metrics.canary.reqs*100).toFixed(2) : 0;
    const diff = +(cErr - sErr).toFixed(2);
    return { stableErr: sErr, canaryErr: cErr, diff, verdict: diff > 1.0 ? "ROLLBACK" : diff > 0.5 ? "HOLD" : "PROMOTE" };
  }
  rollbackCanary() {
    console.log(`    [Canary] ROLLBACK: killing canary ${this.canaryVer}`);
    this.canaryPct = 0; this.canaryVer = null;
    console.log(`    [Canary] 100% traffic to stable ${this.stableVer}`);
  }
}

console.log("\n  Flipkart BBD Canary:");
const canary = new CanaryDeploy("flipkart/checkout", 20);
canary.deployStable("v3.2.0");
canary.startCanary("v3.3.0", 5);
canary.simulateTraffic(10000);
let a = canary.analyze();
console.log(`    Analysis: stable=${a.stableErr}% canary=${a.canaryErr}% -> ${a.verdict}`);

console.log("\n  Simulating error spike:");
canary.injectCanaryErrors(0.035);
a = canary.analyze();
console.log(`    Analysis: stable=${a.stableErr}% canary=${a.canaryErr}% diff=${a.diff}% -> ${a.verdict}`);
if (a.verdict === "ROLLBACK") canary.rollbackCanary();
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Rolling Update
// ════════════════════════════════════════════════════════════════

// WHY: Replaces instances batch-by-batch. No extra infra needed.

console.log("SECTION 4: Rolling Update");
console.log("-".repeat(50));

class RollingUpdate {
  constructor(count = 8) { this.instances = Array.from({length: count}, (_, i) => ({ id: i, version: null, status: "pending" })); this.maxUnavail = 2; }
  deployInitial(ver) { this.instances.forEach(i => { i.version = ver; i.status = "running"; }); }
  update(newVer, failAt = -1) {
    console.log(`    [Rolling] Updating to ${newVer} (batch=${this.maxUnavail})`);
    const batches = Math.ceil(this.instances.length / this.maxUnavail);
    for (let b = 0; b < batches; b++) {
      const start = b * this.maxUnavail, end = Math.min(start + this.maxUnavail, this.instances.length);
      for (let i = start; i < end; i++) {
        if (this.instances[i].id === failAt) {
          console.log(`      Batch ${b+1}: FAILURE at instance ${i}! Rolling back...`);
          this.instances.forEach(x => { if (x.version === newVer || x.status === "failed") { x.version = this.instances.find(y => y.version !== newVer)?.version; x.status = "running"; }});
          return false;
        }
        this.instances[i].version = newVer; this.instances[i].status = "running";
      }
      console.log(`      Batch ${b+1}/${batches}: instances ${start}-${end-1} updated`);
    }
    return true;
  }
}

const r1 = new RollingUpdate(8);
r1.deployInitial("v2.1.0");
r1.update("v2.2.0");

console.log("\n  Rolling update with failure:");
const r2 = new RollingUpdate(8);
r2.deployInitial("v2.1.0");
r2.update("v2.2.0", 5);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Feature Flags
// ════════════════════════════════════════════════════════════════

// WHY: Decouple deploy from release. Deploy everywhere, enable for 0% or specific users.

console.log("SECTION 5: Feature Flags");
console.log("-".repeat(50));

class FeatureFlagService {
  constructor() { this.flags = new Map(); }
  create(name, config) { this.flags.set(name, { enabled: config.enabled || false, pct: config.pct || 0, users: config.users || [], cities: config.cities || [] }); }
  evaluate(name, ctx = {}) {
    const f = this.flags.get(name);
    if (!f || !f.enabled) return false;
    if (f.users.length && ctx.userId && f.users.includes(ctx.userId)) return true;
    if (f.cities.length && ctx.city && f.cities.includes(ctx.city)) return true;
    if (f.pct > 0 && ctx.userId) {
      let h = 0; for (const c of ctx.userId + name) h = ((h << 5) - h) + c.charCodeAt(0) & 0x7fffffff;
      return (h % 100) < f.pct;
    }
    return f.enabled && f.pct === 100;
  }
}

const ff = new FeatureFlagService();
ff.create("bbd_flash_banner", { enabled: true, pct: 100 });
ff.create("new_checkout_flow", { enabled: true, pct: 20, cities: ["bengaluru"] });
ff.create("crypto_pay", { enabled: false });

const users = [{ userId: "user_42", city: "bengaluru" }, { userId: "user_88", city: "delhi" }];
const flags = ["bbd_flash_banner", "new_checkout_flow", "crypto_pay"];

console.log("\n  " + "User".padEnd(14) + "City".padEnd(14) + flags.map(f => f.substring(0,14).padEnd(16)).join(""));
users.forEach(u => {
  const results = flags.map(f => (ff.evaluate(f, u) ? "ON" : "OFF").padEnd(16));
  console.log(`  ${u.userId.padEnd(14)}${u.city.padEnd(14)}${results.join("")}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Pipeline and Strategy Comparison
// ════════════════════════════════════════════════════════════════

console.log("SECTION 6: Pipeline and Strategy Comparison");
console.log("-".repeat(50));

class Pipeline {
  constructor(service) { this.service = service; this.stages = []; }
  addStage(name, action) { this.stages.push({ name, action }); }
  run(version) {
    console.log(`\n  Pipeline: ${this.service} ${version}`);
    let artifacts = { version };
    for (let i = 0; i < this.stages.length; i++) {
      const s = this.stages[i];
      const result = s.action(artifacts);
      console.log(`    ${i+1}. [${result.ok ? "PASS" : "FAIL"}] ${s.name}: ${result.msg}`);
      if (result.artifacts) Object.assign(artifacts, result.artifacts);
      if (!result.ok) return false;
    }
    console.log("    Pipeline SUCCESS");
    return true;
  }
}

const pipe = new Pipeline("flipkart/checkout");
pipe.addStage("Unit Tests", () => ({ ok: true, msg: "1247 passed, 87% coverage" }));
pipe.addStage("Build Image", (a) => ({ ok: true, msg: `${a.version} (247MB)`, artifacts: { image: `flipkart/checkout:${a.version}` } }));
pipe.addStage("Security Scan", () => ({ ok: true, msg: "0 critical CVEs" }));
pipe.addStage("Canary 5%", () => ({ ok: true, msg: "err=0.3%, p99=95ms" }));
pipe.addStage("Full Rollout", (a) => ({ ok: true, msg: `${a.image} on all instances` }));
pipe.run("v3.3.0");

console.log("\n  Strategy Comparison:");
console.log("  " + "Strategy".padEnd(14) + "Downtime".padEnd(10) + "Rollback".padEnd(10) + "Cost".padEnd(12) + "Best For");
[["Recreate","Yes","Slow","1x","Dev/staging"],["Rolling","No","Slow","1x+surge","K8s default"],
 ["Blue-Green","No","Instant","2x","Critical svc"],["Canary","No","Fast","1x+small","User-facing"],
 ["Feature Flag","No","Instant","1x","A/B tests"]
].forEach(([s,d,r,c,b]) => console.log(`  ${s.padEnd(14)}${d.padEnd(10)}${r.padEnd(10)}${c.padEnd(12)}${b}`));
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Containers standardize packaging: same image in dev and prod.");
console.log("  2. Blue-green gives instant rollback at 2x cost.");
console.log("  3. Canary limits blast radius: 5% see new version first.");
console.log("  4. Rolling is the K8s default: batch replace, no extra infra.");
console.log("  5. Feature flags decouple deploy from release: toggle remotely.");
console.log("  6. Every deploy needs a rollback plan: not IF, but WHEN and HOW FAST.");
console.log("  7. Pipelines automate safety: test, scan, canary, promote.");
console.log();
console.log('  "During BBD, each deploy is a calculated risk — canary and');
console.log('   feature flags are our safety nets over a revenue tightrope."');
console.log();
