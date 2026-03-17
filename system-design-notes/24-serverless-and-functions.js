/** ============================================================
 *  FILE 24: SERVERLESS AND FUNCTIONS
 *  ============================================================
 *  Topic: FaaS, cold start, event triggers, step functions,
 *         cost model
 *
 *  WHY THIS MATTERS:
 *  Serverless lets you run code without provisioning servers.
 *  You pay only when your code executes. For bursty workloads
 *  like IRCTC's 10 AM Tatkal rush, serverless scales from zero
 *  to thousands of instances in seconds.
 *  ============================================================ */

// STORY: IRCTC Tatkal Surge
// Every morning at 10:00 AM, millions open IRCTC for Tatkal tickets.
// Traffic spikes from near-zero to lakhs of requests in seconds.
// Serverless spins up thousands of instances automatically. But
// cold start delay can mean confirmed ticket vs waitlist.

console.log("=".repeat(70));
console.log("  FILE 24: SERVERLESS AND FUNCTIONS");
console.log("  FaaS, Cold Start, Event Triggers, Step Functions, Cost");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — What is Serverless / FaaS
// ════════════════════════════════════════════════════════════════

// WHY: Developer writes function code only. Cloud provider
// handles provisioning, scaling, and patching.

console.log("--- SECTION 1: What is Serverless / FaaS ---\n");

[["Aspect", "Traditional Server", "Serverless / FaaS"],
 ["Provisioning", "You choose instance type", "Automatic"],
 ["Scaling", "Configure auto-scaling", "Instant, per-request"],
 ["Billing", "Pay for uptime (24/7)", "Pay per invocation"],
 ["Cold Start", "N/A (always running)", "Possible delay"],
 ["Max Runtime", "Unlimited", "5-15 minutes"],
 ["State", "Stateful (disk, memory)", "Stateless (ephemeral)"],
].forEach(([a, t, s]) => console.log(`  ${a.padEnd(16)} | ${t.padEnd(28)} | ${s}`));
console.log("\n  Providers: AWS Lambda | Google Cloud Functions | Azure Functions\n");

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Function Lifecycle (Cold/Warm)
// ════════════════════════════════════════════════════════════════

// WHY: Cold starts add latency on first invocation.

console.log("--- SECTION 2: Function Lifecycle ---\n");

class FaaSRuntime {
  constructor() { this.instances = {}; this.log = []; this.nextId = 0; }
  invoke(fnName, payload) {
    let inst = this.instances[fnName];
    let coldStart = false, initTime = 0;
    if (!inst || inst.state === "terminated") {
      coldStart = true;
      initTime = 200 + Math.floor(Math.random() * 300);
      inst = { id: `inst-${++this.nextId}`, fnName, state: "running", invocations: 0 };
      this.instances[fnName] = inst;
      console.log(`  [COLD START] ${fnName} (${inst.id}): Init ${initTime}ms`);
    } else {
      console.log(`  [WARM START] ${fnName} (${inst.id}): Reusing container`);
    }
    const execTime = 10 + Math.floor(Math.random() * 50);
    inst.invocations++;
    const total = (coldStart ? initTime : 0) + execTime;
    console.log(`    Exec: ${execTime}ms | Total: ${total}ms | Invocations: ${inst.invocations}`);
    this.log.push({ fnName, coldStart, total });
    return { status: 200, duration: total, coldStart };
  }
  idle(fnName) {
    if (this.instances[fnName]) {
      this.instances[fnName].state = "terminated";
      console.log(`  [IDLE] ${fnName}: Container terminated`);
    }
  }
}

const faas = new FaaSRuntime();
console.log("  IRCTC Tatkal function invocations:\n");
faas.invoke("irctc-search", { from: "DEL", to: "BOM" });
faas.invoke("irctc-search", { from: "BLR", to: "CHN" });
faas.idle("irctc-search");
console.log();
faas.invoke("irctc-search", { from: "MUM", to: "GOA" });
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Event Triggers
// ════════════════════════════════════════════════════════════════

// WHY: Serverless functions trigger from HTTP, queues, schedules,
// uploads, and DB changes.

console.log("--- SECTION 3: Event Triggers ---\n");

class TriggerSystem {
  constructor(runtime) { this.runtime = runtime; this.triggers = []; }
  register(type, fnName) { this.triggers.push({ type, fnName }); console.log(`  [Trigger] ${type} -> ${fnName}`); }
  fire(type, payload) {
    const matching = this.triggers.filter((t) => t.type === type);
    console.log(`\n  [Event] ${type} — ${matching.length} function(s) triggered`);
    matching.forEach((t) => this.runtime.invoke(t.fnName, payload));
  }
}

const triggers = new TriggerSystem(new FaaSRuntime());
triggers.register("HTTP", "irctc-book");
triggers.register("Queue", "process-payment");
triggers.register("Schedule", "tatkal-opener");
triggers.register("S3Upload", "generate-pdf");
triggers.fire("HTTP", { trainId: "12301", class: "3A" });
triggers.fire("Queue", { bookingId: "BK-5001", amount: 1250 });
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Step Functions (Workflow Orchestration)
// ════════════════════════════════════════════════════════════════

// WHY: Complex processes like booking involve ordered steps with
// error handling. Step functions orchestrate as a state machine.

console.log("\n--- SECTION 4: Step Functions — IRCTC Booking Workflow ---\n");

class StepFunction {
  constructor(name) { this.name = name; this.steps = []; this.ctx = {}; }
  addStep(name, handler, compensator = null) { this.steps.push({ name, handler, compensator }); }
  execute(input) {
    this.ctx = { ...input };
    console.log(`  [StepFn:${this.name}] Starting workflow\n`);
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      console.log(`  Step ${i + 1}: ${step.name}`);
      try {
        const result = step.handler(this.ctx);
        this.ctx = { ...this.ctx, ...result };
        console.log(`    Result: ${JSON.stringify(result)}\n`);
      } catch (err) {
        console.log(`    FAILED: ${err.message}\n  --- Compensating ---`);
        for (let j = i - 1; j >= 0; j--) {
          if (this.steps[j].compensator) {
            console.log(`  Compensate: ${this.steps[j].name}`);
            this.steps[j].compensator(this.ctx);
          }
        }
        return { status: "FAILED", error: err.message };
      }
    }
    return { status: "COMPLETED" };
  }
}

const booking = new StepFunction("IRCTC-Tatkal");
booking.addStep("SearchTrains", (ctx) => ({ trainId: "12301-Rajdhani", fare: 1850 }));
booking.addStep("ReserveSeat", (ctx) => {
  const pnr = "PNR-" + Math.floor(Math.random() * 9000000 + 1000000);
  return { pnr, seats: ["B3-42"] };
}, (ctx) => console.log(`    Releasing reservation: ${ctx.pnr}`));
booking.addStep("ProcessPayment", (ctx) => {
  return { paymentId: "PAY-" + Math.floor(Math.random() * 90000 + 10000) };
}, (ctx) => console.log(`    Refunding: ${ctx.paymentId}`));
booking.addStep("Confirm", (ctx) => ({ bookingStatus: "CONFIRMED" }));
booking.execute({ from: "New Delhi", to: "Mumbai", passengers: 2, class: "3A" });

// Payment failure scenario
console.log("  --- Payment Failure Scenario ---\n");
const failBooking = new StepFunction("IRCTC-Fail");
failBooking.addStep("Reserve", () => ({ pnr: "PNR-8765432" }), (ctx) => console.log(`    Releasing PNR ${ctx.pnr}`));
failBooking.addStep("Payment", () => { throw new Error("UPI server down"); });
failBooking.execute({ from: "BLR", to: "CHN", passengers: 1 });
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Cold Start Optimization and Cost Model
// ════════════════════════════════════════════════════════════════

// WHY: Cold starts matter for latency. Cost model determines
// when serverless beats traditional servers.
console.log("--- SECTION 5: Cold Start Optimization and Cost ---\n");

console.log("  Cold Start Mitigations:");
[["Provisioned Concurrency", "Pre-warm N instances before rush"],
 ["Smaller Package", "Tree-shake, use layers: save 100-300ms"],
 ["Language Choice", "Node.js ~100ms vs Java ~1-3s cold start"],
 ["Keep-Alive Ping", "Scheduled pings every 5 min keep warm"],
].forEach(([name, desc]) => console.log(`    ${name}: ${desc}`));

console.log("\n  Cost Comparison:");
const lambdaPerReq = 0.0000002, lambdaPerGBs = 0.0000166667, memGB = 0.512, avgDur = 0.2;
const ec2Monthly = 30, ec2RPS = 100;
[["Low Traffic", 10000], ["Medium Traffic", 1000000], ["Tatkal Rush", 50000000]].forEach(([name, daily]) => {
  const monthly = daily * 30;
  const lambdaCost = monthly * lambdaPerReq + monthly * avgDur * memGB * lambdaPerGBs;
  const servers = Math.max(Math.ceil(daily / (ec2RPS * 86400)), 1);
  const ec2Cost = servers * ec2Monthly;
  const winner = lambdaCost < ec2Cost ? "SERVERLESS" : "EC2";
  console.log(`    ${name} (${daily.toLocaleString()}/day): Lambda $${lambdaCost.toFixed(2)} vs EC2 $${ec2Cost.toFixed(2)} -> ${winner}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Tatkal Surge Simulation
// ════════════════════════════════════════════════════════════════

// WHY: Seeing the 10 AM surge with scaling and cold starts.
console.log("--- SECTION 6: IRCTC Tatkal Surge Simulation ---\n");

console.log("  Time        | Requests | Instances | Cold Starts");
console.log("  ------------|----------|-----------|------------");
let active = 0, totalCold = 0;
[["9:55 AM", 100], ["9:59 AM", 5000], ["10:00 AM", 50000],
 ["10:01 AM", 80000], ["10:05 AM", 30000], ["10:30 AM", 1000], ["11:00 AM", 200],
].forEach(([time, reqs]) => {
  const needed = Math.ceil(reqs / 100);
  const cold = Math.max(0, needed - active);
  totalCold += cold;
  active = needed;
  console.log(`  ${time.padEnd(12)} | ${String(reqs).padStart(8)} | ${String(active).padStart(9)} | ${String(cold).padStart(11)}`);
});
console.log(`\n  Total cold starts: ${totalCold} | Peak instances: 800`);
console.log("  After surge: scale to zero. Pay only for invocations.\n");

// ════════════════════════════════════════════════════════════════
// SECTION 7 — When to Use and Avoid Serverless
// ════════════════════════════════════════════════════════════════

console.log("--- SECTION 7: When to Use and Avoid ---\n");
console.log("  USE: Bursty traffic, event-driven, zero infra management, short-lived functions");
console.log("  AVOID: Sustained high-throughput, >15 min execution, persistent WebSockets, vendor lock-in concern\n");
console.log("  Hybrid: Tatkal search=Serverless | PNR API=Container | Reports=Serverless\n");

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Serverless runs functions without managing servers.");
console.log("  2. Cold starts add latency; mitigate with provisioned concurrency.");
console.log("  3. Functions trigger from HTTP, queues, schedules, uploads, DB changes.");
console.log("  4. Step functions orchestrate multi-step workflows with saga rollback.");
console.log("  5. Pay-per-invocation is cheaper for bursty, costlier for sustained.");
console.log("  6. Serverless is stateless — use DynamoDB/S3/Redis for state.");
console.log("  7. Hybrid works best: serverless for spikes, containers for steady APIs.");
console.log("  8. Design for idempotency — functions may be invoked multiple times.");
console.log();
console.log('  "When the 10 AM Tatkal rush hits, IRCTC needs 800 function instances');
console.log('   for 30 minutes and zero for the rest of the day. That is serverless."');
console.log();
