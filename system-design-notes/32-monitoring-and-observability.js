/** ============================================================
 *  FILE 32: MONITORING AND OBSERVABILITY
 *  ============================================================
 *  Topic: Metrics/logs/traces, RED/USE methods, distributed
 *         tracing, SLI/SLO/SLA, alerting rules
 *
 *  WHY THIS MATTERS:
 *  You cannot improve what you cannot measure. A single request
 *  might touch 20+ services. Without observability, a latency
 *  spike cascades into a mystery outage affecting millions.
 *  ============================================================ */

// STORY: Jio Network Operations
// Jio serves 450M subscribers. Their NOC monitors 5B daily events.
// When error rates spike, distributed traces pinpoint root cause
// in under 4 minutes mean-time-to-detect.

console.log("=".repeat(70));
console.log("  FILE 32: MONITORING AND OBSERVABILITY");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Three Pillars of Observability
// ════════════════════════════════════════════════════════════════

// WHY: Metrics tell WHAT is wrong, logs tell WHY, traces tell WHERE.

console.log("SECTION 1: Three Pillars of Observability");
console.log("-".repeat(50));

const pillars = {
  metrics: { what: "Numeric measurements over time", tools: "Prometheus, Datadog" },
  logs:    { what: "Timestamped discrete events", tools: "ELK, Loki, Splunk" },
  traces:  { what: "End-to-end request path", tools: "Jaeger, Zipkin, X-Ray" }
};
Object.entries(pillars).forEach(([name, info]) => {
  console.log(`  ${name.toUpperCase()}: ${info.what} | Tools: ${info.tools}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Metrics Collection
// ════════════════════════════════════════════════════════════════

// WHY: Counters, gauges, histograms are the building blocks.

console.log("SECTION 2: Metrics Collection");
console.log("-".repeat(50));

class MetricsCollector {
  constructor() { this.counters = {}; this.histograms = {}; }
  incCounter(name, labels = {}, val = 1) {
    const k = `${name}:${JSON.stringify(labels)}`;
    if (!this.counters[k]) this.counters[k] = { name, labels, value: 0 };
    this.counters[k].value += val;
  }
  recordHist(name, labels = {}, val) {
    const k = `${name}:${JSON.stringify(labels)}`;
    if (!this.histograms[k]) this.histograms[k] = { values: [], count: 0, sum: 0 };
    const h = this.histograms[k]; h.values.push(val); h.count++; h.sum += val;
  }
  percentiles(name, labels = {}) {
    const h = this.histograms[`${name}:${JSON.stringify(labels)}`];
    if (!h || !h.values.length) return null;
    const s = [...h.values].sort((a, b) => a - b), n = s.length;
    return { p50: s[n * 0.5 | 0], p90: s[n * 0.9 | 0], p99: s[n * 0.99 | 0], avg: +(h.sum / h.count).toFixed(1), count: h.count };
  }
}

const jioMetrics = new MetricsCollector();
const circles = ["mumbai", "delhi", "chennai", "kolkata", "bengaluru"];
for (let i = 0; i < 1000; i++) {
  const circle = circles[i % circles.length];
  const status = Math.random() < 0.03 ? "5xx" : "2xx";
  const latency = status === "5xx" ? 500 + Math.random() * 4500 : 5 + Math.random() * 200;
  jioMetrics.incCounter("http_requests_total", { circle, status });
  jioMetrics.recordHist("request_duration_ms", { circle }, Math.round(latency));
}

console.log("\n  Latency Percentiles by Circle:");
circles.forEach(c => {
  const p = jioMetrics.percentiles("request_duration_ms", { circle: c });
  if (p) console.log(`    ${c.padEnd(12)} p50=${p.p50}ms p90=${p.p90}ms p99=${p.p99}ms (n=${p.count})`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Structured Logging
// ════════════════════════════════════════════════════════════════

// WHY: JSON logs enable filtering and correlation across services.

console.log("SECTION 3: Structured Logging");
console.log("-".repeat(50));

class Logger {
  constructor(service) { this.service = service; this.logs = []; }
  _log(level, msg, ctx = {}) {
    const entry = { ts: new Date().toISOString(), level, service: this.service, msg, ...ctx };
    this.logs.push(entry); return entry;
  }
  info(msg, ctx) { return this._log("INFO", msg, ctx); }
  warn(msg, ctx) { return this._log("WARN", msg, ctx); }
  error(msg, ctx) { return this._log("ERROR", msg, ctx); }
  query(filters = {}) { return this.logs.filter(l => (!filters.level || l.level === filters.level) && (!filters.traceId || l.traceId === filters.traceId)); }
}

const logger = new Logger("jio-call-service");
logger.info("Call setup initiated", { traceId: "trace-abc", callee: "9123456789" });
logger.warn("High latency on SGW", { traceId: "trace-abc", latencyMs: 450 });
logger.error("Call setup timeout", { traceId: "trace-abc", reason: "MSC_UNREACHABLE" });

console.log("\n  Structured Logs:");
logger.logs.forEach((e, i) => console.log(`    ${i+1}. [${e.level}] ${e.msg}${e.reason ? " reason="+e.reason : ""}`));
console.log("  Error query:", logger.query({ level: "ERROR" }).map(e => e.msg).join(", "));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Distributed Tracing
// ════════════════════════════════════════════════════════════════

// WHY: A Jio call setup touches 8+ elements. Tracing shows timing per hop.

console.log("SECTION 4: Distributed Tracing");
console.log("-".repeat(50));

class DistributedTracer {
  constructor() { this.traces = new Map(); this.spanId = 0; }
  startTrace(op, service) {
    const traceId = `trace-${Date.now()}-${(Math.random()*1e6|0).toString(36)}`;
    const span = { traceId, spanId: `s-${++this.spanId}`, op, service, duration: 0, status: "OK" };
    this.traces.set(traceId, [span]);
    return span;
  }
  addSpan(traceId, op, service, durationMs, status = "OK") {
    const span = { traceId, spanId: `s-${++this.spanId}`, op, service, duration: durationMs, status };
    if (!this.traces.has(traceId)) this.traces.set(traceId, []);
    this.traces.get(traceId).push(span);
    return span;
  }
  visualize(traceId) {
    const spans = this.traces.get(traceId) || [];
    const maxDur = Math.max(...spans.map(s => s.duration), 1);
    console.log(`\n  Trace: ${traceId}`);
    console.log(`  ${"Service".padEnd(18)} ${"Operation".padEnd(20)} ${"Dur".padEnd(8)} Waterfall`);
    spans.forEach(sp => {
      const bar = (sp.status === "ERROR" ? "X" : "#").repeat(Math.max(1, Math.round((sp.duration / maxDur) * 30)));
      console.log(`  ${sp.service.padEnd(18)} ${sp.op.padEnd(20)} ${(sp.duration+"ms").padEnd(8)} |${bar}`);
    });
  }
}

const tracer = new DistributedTracer();
const root = tracer.startTrace("volte-call-setup", "api-gateway"); root.duration = 120;
const tid = root.traceId;
tracer.addSpan(tid, "authenticate-sim", "hss-auth", 15);
tracer.addSpan(tid, "locate-subscriber", "vlr-location", 25);
tracer.addSpan(tid, "route-call", "msc-routing", 35);
tracer.addSpan(tid, "allocate-media", "mgw-media", 20);
tracer.visualize(tid);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — RED and USE Methods
// ════════════════════════════════════════════════════════════════

// WHY: RED for services (Rate, Errors, Duration). USE for resources
// (Utilization, Saturation, Errors).

console.log("SECTION 5: RED and USE Methods");
console.log("-".repeat(50));

class REDMonitor {
  constructor(name) { this.name = name; this.requests = []; }
  record(status, durationMs) { this.requests.push({ status, duration: durationMs }); }
  getMetrics() {
    const r = this.requests; if (!r.length) return {};
    const errs = r.filter(x => x.status >= 500).length;
    const d = r.map(x => x.duration).sort((a, b) => a - b);
    return { rate: +(r.length / 60).toFixed(2), errorRate: +((errs / r.length) * 100).toFixed(2), p50: d[d.length*0.5|0], p99: d[d.length*0.99|0] };
  }
}

const services = { "call-setup": new REDMonitor("call-setup"), "data-session": new REDMonitor("data-session") };
Object.entries(services).forEach(([name, mon]) => {
  const base = name === "call-setup" ? 80 : 30;
  for (let i = 0; i < 500; i++) {
    const st = Math.random() < 0.02 ? 500 : 200;
    mon.record(st, Math.round(st === 500 ? base*10+Math.random()*2000 : base+Math.random()*base*2));
  }
});

console.log("\n  RED Metrics:");
console.log("  " + "Service".padEnd(16) + "Rate".padEnd(10) + "Err%".padEnd(10) + "p50".padEnd(8) + "p99");
Object.entries(services).forEach(([name, mon]) => {
  const m = mon.getMetrics();
  console.log(`  ${name.padEnd(16)}${(m.rate+"rps").padEnd(10)}${(m.errorRate+"%").padEnd(10)}${(m.p50+"ms").padEnd(8)}${m.p99}ms`);
});

console.log("\n  USE Method (for resources):");
console.log("    Utilization: % of resource capacity used");
console.log("    Saturation: queued work (>0 = bottleneck)");
console.log("    Errors: resource-level errors (disk, network)");
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — SLI/SLO/SLA and Error Budgets
// ════════════════════════════════════════════════════════════════

// WHY: SLIs measure quality, SLOs set targets, SLAs are contracts.

console.log("SECTION 6: SLI/SLO/SLA Tracking");
console.log("-".repeat(50));

class SLOTracker {
  constructor(name, sloTarget) { this.name = name; this.sloTarget = sloTarget; this.good = 0; this.total = 0; }
  record(isGood) { this.total++; if (isGood) this.good++; }
  status() {
    const sli = this.total > 0 ? +(this.good / this.total * 100).toFixed(3) : 100;
    const budget = 100 - this.sloTarget * 100;
    const used = 100 - sli;
    return { sli: sli+"%", slo: (this.sloTarget*100)+"%", budgetUsed: used.toFixed(3)+"%",
             remaining: (budget - used).toFixed(3)+"%", verdict: (budget - used) > 0 ? "WITHIN BUDGET" : "BUDGET EXHAUSTED" };
  }
}

const slos = [new SLOTracker("Call Completion", 0.9995), new SLOTracker("Data Session <500ms", 0.999)];
slos.forEach(t => {
  const failP = t.name.includes("Call") ? 0.0003 : 0.0008;
  for (let i = 0; i < 10000; i++) t.record(Math.random() > failP);
});

console.log("\n  Error Budget Status:");
slos.forEach(t => {
  const s = t.status();
  console.log(`    ${t.name}: SLI=${s.sli} SLO=${s.slo} budget-remaining=${s.remaining} -> ${s.verdict}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 7 — Alerting Rules
// ════════════════════════════════════════════════════════════════

// WHY: Alerts bridge monitoring data and human action.

console.log("SECTION 7: Alerting Rules");
console.log("-".repeat(50));

class AlertManager {
  constructor() { this.rules = []; this.active = []; }
  addRule(name, severity, condition, team) { this.rules.push({ name, severity, condition, team }); }
  evaluate(metrics) {
    const fired = [];
    this.rules.forEach(rule => { try { if (rule.condition(metrics)) { fired.push(rule); this.active.push(rule); } } catch(e) {} });
    return fired;
  }
}

const alertMgr = new AlertManager();
alertMgr.addRule("HighCallErrorRate", "critical", m => m.callErrorRate > 1.0, "network-core");
alertMgr.addRule("HighP99Latency", "warning", m => m.p99 > 500, "network-core");
alertMgr.addRule("CPUOverload", "critical", m => m.cpu > 90, "infrastructure");

[{ circle: "mumbai", callErrorRate: 0.3, p99: 120, cpu: 65 },
 { circle: "delhi", callErrorRate: 2.1, p99: 850, cpu: 92 },
].forEach(m => {
  const alerts = alertMgr.evaluate(m);
  if (alerts.length) {
    console.log(`\n    ${m.circle.toUpperCase()}:`);
    alerts.forEach(a => console.log(`      [${a.severity.toUpperCase()}] ${a.name} -> team: ${a.team}`));
  } else console.log(`\n    ${m.circle.toUpperCase()}: All clear`);
});

console.log("\n  Best Practices:");
["Alert on symptoms, not causes", "Every alert needs a runbook",
 "Page for critical; ticket for warning", "Deduplicate to avoid alert storms"].forEach((p, i) => console.log(`    ${i+1}. ${p}`));
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Three pillars: Metrics=WHAT, Logs=WHY, Traces=WHERE.");
console.log("  2. RED for services: Rate, Errors, Duration cover 90% of monitoring.");
console.log("  3. USE for resources: Utilization, Saturation, Errors per resource.");
console.log("  4. SLIs must be user-centric — measure latency and availability.");
console.log("  5. Error budgets drive priorities: exhausted = freeze features.");
console.log("  6. Structured JSON logs with trace IDs enable cross-service correlation.");
console.log("  7. Alert on burn rate, not instantaneous spikes — noise vs signal.");
console.log();
console.log('  "In a network serving 450M subscribers, every second');
console.log('   without observability is a second flying blind."');
console.log();
