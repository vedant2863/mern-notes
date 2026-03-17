/** ============================================================
 *  FILE 13: TRANSACTIONS AND CONSISTENCY
 *  ============================================================
 *  Topic: 2PC, saga pattern, eventual consistency, conflict
 *         resolution (LWW, vector clocks), CRDTs intro
 *
 *  WHY THIS MATTERS:
 *  When money moves between SBI and HDFC through UPI, the debit
 *  and credit must both succeed or both fail. Distributed systems
 *  make this hard — network partitions and node failures can
 *  leave data inconsistent.
 *  ============================================================ */

// STORY: UPI Payment (NPCI)
// India's UPI processes 10 billion transactions/month. A transfer
// from SBI to HDFC involves multiple banks and the NPCI switch.
// If SBI debits but HDFC fails, NPCI triggers a compensating
// refund via the saga pattern.

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  FILE 13 — TRANSACTIONS AND CONSISTENCY                    ║");
console.log("║  UPI (NPCI): SBI -> HDFC distributed payment saga          ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Local Transactions (ACID Review)
// ════════════════════════════════════════════════════════════════

// WHY: Understand what we lose when we go distributed.

console.log("=== SECTION 1: Local Transactions (ACID Review) ===\n");

function localTransactionDemo() {
  class BankLedger {
    constructor() { this.accounts = {}; this.lockSet = new Set(); }
    createAccount(id, balance) { this.accounts[id] = { balance }; }
    transfer(from, to, amount) {
      if (this.lockSet.has(from) || this.lockSet.has(to))
        return { success: false, reason: "Lock conflict — Isolation prevents dirty reads" };
      this.lockSet.add(from); this.lockSet.add(to);
      try {
        if (!this.accounts[from] || !this.accounts[to]) throw new Error("Account not found");
        if (this.accounts[from].balance < amount)
          throw new Error(`Insufficient funds: Rs.${this.accounts[from].balance} < Rs.${amount}`);
        this.accounts[from].balance -= amount;
        this.accounts[to].balance += amount;
        return { success: true };
      } catch (err) {
        return { success: false, reason: err.message };
      } finally { this.lockSet.delete(from); this.lockSet.delete(to); }
    }
  }

  const bank = new BankLedger();
  bank.createAccount("SBI-001", 50000);
  bank.createAccount("HDFC-002", 30000);

  console.log("Local ACID transfer: SBI -> HDFC Rs.5000");
  const r1 = bank.transfer("SBI-001", "HDFC-002", 5000);
  console.log(`  Result: success=${r1.success}`);
  console.log(`  SBI-001: Rs.${bank.accounts["SBI-001"].balance}, HDFC-002: Rs.${bank.accounts["HDFC-002"].balance}`);

  console.log("\nAttempt overdraft: SBI -> HDFC Rs.100000");
  const r2 = bank.transfer("SBI-001", "HDFC-002", 100000);
  console.log(`  Result: ${r2.reason} — Atomicity preserved.`);
}

localTransactionDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Two-Phase Commit Protocol (2PC)
// ════════════════════════════════════════════════════════════════

// WHY: 2PC coordinates multi-node commits but has blocking problems.

console.log("\n\n=== SECTION 2: Two-Phase Commit Protocol (2PC) ===\n");

function twoPCDemo() {
  class TwoPCCoordinator {
    constructor(participants) { this.participants = participants; }
    execute(transaction) {
      console.log(`  Coordinator: Starting 2PC for ${transaction.description}`);
      // Phase 1: PREPARE
      console.log("\n  --- Phase 1: PREPARE ---");
      let allPrepared = true;
      for (const [name, p] of Object.entries(this.participants)) {
        const vote = p.prepare(transaction);
        console.log(`  ${name}: ${vote ? "VOTE-COMMIT" : "VOTE-ABORT"}`);
        if (!vote) allPrepared = false;
      }
      // Phase 2: COMMIT or ABORT
      console.log(`\n  --- Phase 2: ${allPrepared ? "COMMIT" : "ABORT"} ---`);
      for (const [name, p] of Object.entries(this.participants)) {
        if (allPrepared) { p.commit(transaction); console.log(`  ${name}: COMMITTED`); }
        else { p.abort(); console.log(`  ${name}: ABORTED`); }
      }
      return allPrepared;
    }
  }

  class BankParticipant {
    constructor(name, balance, shouldFail = false) {
      this.name = name; this.balance = balance; this.shouldFail = shouldFail;
    }
    prepare(tx) {
      if (this.shouldFail) return false;
      if (tx.debitFrom === this.name && this.balance < tx.amount) return false;
      return true;
    }
    commit(tx) {
      if (tx.debitFrom === this.name) this.balance -= tx.amount;
      if (tx.creditTo === this.name) this.balance += tx.amount;
    }
    abort() {}
  }

  const tx = { description: "UPI Rs.2000 SBI->HDFC", debitFrom: "SBI", creditTo: "HDFC", amount: 2000 };

  console.log("Scenario: HDFC node is down\n");
  const sbi = new BankParticipant("SBI", 50000);
  const hdfc = new BankParticipant("HDFC", 30000, true);
  const coordinator = new TwoPCCoordinator({ SBI: sbi, HDFC: hdfc });
  const result = coordinator.execute(tx);
  console.log(`\n  Final: SBI=Rs.${sbi.balance}, HDFC=Rs.${hdfc.balance}, Success=${result}`);
  console.log("  Both rolled back — atomicity preserved!");
  console.log("\n  2PC problem: If coordinator crashes after PREPARE, participants BLOCK forever.");
}

twoPCDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Saga Pattern (Orchestration)
// ════════════════════════════════════════════════════════════════

// WHY: Sagas avoid blocking by using compensating actions on failure.
// Orchestrator centralizes saga logic — easier to trace than choreography.

console.log("\n\n=== SECTION 3: Saga Pattern — Orchestration ===\n");

function sagaOrchestration() {
  class SagaOrchestrator {
    constructor(steps) { this.steps = steps; this.completedSteps = []; }
    execute() {
      console.log("  Orchestrator: Starting saga...\n");
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        console.log(`  Step ${i + 1}: ${step.name}`);
        const result = step.action();
        if (!result.success) {
          console.log(`  FAILED at step ${i + 1}: ${result.error}\n  --- Rolling back ---`);
          for (let j = this.completedSteps.length - 1; j >= 0; j--) {
            const s = this.completedSteps[j];
            console.log(`  Compensate: ${s.name}\n    -> ${s.compensate().message}`);
          }
          return { success: false, failedAt: step.name };
        }
        this.completedSteps.push(step);
        console.log(`    -> ${result.message}`);
      }
      return { success: true };
    }
  }

  const accounts = { SBI: 50000, HDFC: 30000 };

  const steps = [
    {
      name: "Validate UPI PIN",
      action: () => ({ success: true, message: "PIN verified" }),
      compensate: () => ({ message: "No compensation needed" }),
    },
    {
      name: "Debit SBI Account",
      action: () => { accounts.SBI -= 5000; return { success: true, message: `SBI debited, balance: Rs.${accounts.SBI}` }; },
      compensate: () => { accounts.SBI += 5000; return { message: `SBI refunded, balance: Rs.${accounts.SBI}` }; },
    },
    {
      name: "Credit HDFC Account",
      action: () => ({ success: false, error: "HDFC CBS timeout after 30s" }),
      compensate: () => ({ message: "HDFC credit never happened" }),
    },
    {
      name: "Send Confirmation SMS",
      action: () => ({ success: true, message: "SMS sent" }),
      compensate: () => ({ message: "Send failure SMS instead" }),
    },
  ];

  const orchestrator = new SagaOrchestrator(steps);
  const result = orchestrator.execute();
  console.log(`\n  Final balances: SBI=Rs.${accounts.SBI}, HDFC=Rs.${accounts.HDFC}`);
  console.log(`  Saga result: ${result.success ? "SUCCESS" : `FAILED at ${result.failedAt}`}`);

  console.log("\n  Choreography alternative: services emit events (SBI_DEBITED -> NPCI_RECEIVED -> HDFC_CREDITED).");
  console.log("  Decoupled but harder to debug. Orchestration is easier to trace.");
}

sagaOrchestration();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Eventual Consistency and LWW
// ════════════════════════════════════════════════════════════════

// WHY: Not all systems need immediate consistency. LWW is simple
// but can silently drop writes.

console.log("\n\n=== SECTION 4: Eventual Consistency and Last-Write-Wins ===\n");

function eventualConsistencyDemo() {
  class ReplicaNode {
    constructor(name) { this.name = name; this.data = {}; }
    localWrite(key, value, timestamp) { this.data[key] = { value, timestamp }; }
    receiveReplication(key, value, timestamp) {
      const existing = this.data[key];
      if (!existing || existing.timestamp < timestamp) { this.data[key] = { value, timestamp }; return true; }
      return false;
    }
  }

  const nodes = { mumbai: new ReplicaNode("Mumbai"), delhi: new ReplicaNode("Delhi") };
  const t1 = Date.now();

  // Write to Mumbai, Delhi is stale until replication
  nodes.mumbai.localWrite("balance:U001", 50000, t1);
  console.log("T=0ms   Mumbai writes balance:U001 = 50000");
  console.log("T=0ms   Delhi reads balance:U001 =", nodes.delhi.data["balance:U001"] || "MISS (stale)");
  nodes.delhi.receiveReplication("balance:U001", 50000, t1);
  console.log("T=50ms  Delhi receives replication -> converged\n");

  // Conflicting writes — LWW resolution
  console.log("--- Conflicting writes (LWW) ---");
  const t2 = t1 + 100, t3 = t1 + 110;
  nodes.mumbai.localWrite("balance:U001", 45000, t2); // withdraw Rs.5000
  nodes.delhi.localWrite("balance:U001", 48000, t3);   // withdraw Rs.2000
  console.log(`T=100ms Mumbai writes 45000 (withdraw Rs.5000)`);
  console.log(`T=110ms Delhi writes 48000 (withdraw Rs.2000)`);

  nodes.mumbai.receiveReplication("balance:U001", 48000, t3);
  console.log("\nAfter replication (Last-Write-Wins):");
  Object.entries(nodes).forEach(([name, node]) => {
    console.log(`  ${name}: balance = ${node.data["balance:U001"].value}`);
  });
  console.log("  Expected: Rs.42000 (both withdrawals), Got: Rs.48000");
  console.log("  LWW lost Mumbai's withdrawal! Rs.5000 evaporated.");
  console.log("\n  LWW is fine for: profile updates, last-seen timestamps");
  console.log("  LWW is DANGEROUS for: balances, counters, inventory");
}

eventualConsistencyDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Vector Clocks
// ════════════════════════════════════════════════════════════════

// WHY: Vector clocks detect concurrent writes that LWW silently drops.

console.log("\n\n=== SECTION 5: Vector Clocks ===\n");

function vectorClockDemo() {
  class VectorClock {
    constructor(nodeId, clocks = {}) { this.nodeId = nodeId; this.clocks = { ...clocks }; }
    increment() { this.clocks[this.nodeId] = (this.clocks[this.nodeId] || 0) + 1; return this; }
    merge(other) {
      const m = new VectorClock(this.nodeId, { ...this.clocks });
      for (const [node, time] of Object.entries(other.clocks)) m.clocks[node] = Math.max(m.clocks[node] || 0, time);
      return m;
    }
    isConcurrent(other) {
      let thisLess = false, otherLess = false;
      const all = new Set([...Object.keys(this.clocks), ...Object.keys(other.clocks)]);
      for (const n of all) {
        if ((this.clocks[n]||0) < (other.clocks[n]||0)) thisLess = true;
        if ((this.clocks[n]||0) > (other.clocks[n]||0)) otherLess = true;
      }
      return thisLess && otherLess;
    }
    toString() { return `{${Object.entries(this.clocks).map(([k,v])=>`${k}:${v}`).join(", ")}}`; }
  }

  const sbi = new VectorClock("SBI").increment();
  const hdfc = new VectorClock("HDFC").increment();
  console.log(`1. SBI deposit:  SBI=${sbi}`);
  console.log(`2. HDFC deposit: HDFC=${hdfc}`);
  console.log(`   Concurrent? ${sbi.isConcurrent(hdfc)} — neither knows about the other`);

  const npci = new VectorClock("NPCI").increment();
  const merged = npci.merge(sbi).merge(hdfc).increment();
  console.log(`\n3. NPCI merges:  NPCI=${merged}`);

  console.log("\n   Vector clocks detect conflicts without data loss,");
  console.log("   but require the APPLICATION to resolve conflicts.");
}

vectorClockDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — CRDTs Introduction
// ════════════════════════════════════════════════════════════════

// WHY: CRDTs resolve conflicts automatically — no human intervention.

console.log("\n\n=== SECTION 6: CRDTs (Conflict-Free Replicated Data Types) ===\n");

function crdtDemo() {
  // G-Counter: grow-only counter (each node has its own counter)
  class GCounter {
    constructor(nodeId) { this.nodeId = nodeId; this.counts = {}; }
    increment(amount = 1) { this.counts[this.nodeId] = (this.counts[this.nodeId] || 0) + amount; }
    value() { return Object.values(this.counts).reduce((s, v) => s + v, 0); }
    merge(other) { for (const [n, c] of Object.entries(other.counts)) this.counts[n] = Math.max(this.counts[n] || 0, c); }
    toString() { return `{${Object.entries(this.counts).map(([k,v])=>`${k}:${v}`).join(", ")}} = ${this.value()}`; }
  }

  console.log("G-Counter: UPI daily transaction count across NPCI nodes\n");
  const node1 = new GCounter("NPCI-Mumbai");
  const node2 = new GCounter("NPCI-Delhi");
  const node3 = new GCounter("NPCI-Bangalore");

  node1.increment(1500000);
  node2.increment(2000000);
  node3.increment(1200000);

  console.log(`  Node1 (Mumbai):    ${node1}`);
  console.log(`  Node2 (Delhi):     ${node2}`);
  console.log(`  Node3 (Bangalore): ${node3}`);

  node1.merge(node2);
  node1.merge(node3);
  console.log(`\n  After merge at Node1: ${node1}`);
  console.log(`  Total UPI transactions: ${node1.value().toLocaleString()}`);
  console.log("\n  CRDTs guarantee convergence WITHOUT coordination!");
}

crdtDemo();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("\n\n=== KEY TAKEAWAYS ===\n");
console.log("1. Local ACID is easy — distributed ACID across nodes is the hard problem.");
console.log("2. 2PC ensures atomicity but BLOCKS if the coordinator crashes.");
console.log("3. Saga (orchestration) uses a central coordinator with compensating actions.");
console.log("4. Saga (choreography) uses events — decoupled but harder to debug.");
console.log("5. Eventual consistency is a spectrum — tune per use case.");
console.log("6. LWW is simple but silently loses concurrent writes — dangerous for money.");
console.log("7. Vector clocks detect concurrency; the app resolves conflicts.");
console.log("8. CRDTs auto-resolve conflicts with mathematical guarantees.\n");
console.log('"When SBI debits Rs.2000 but HDFC never credits it, the saga pattern');
console.log(" doesn't panic — it simply reverses the debit. The money always has a home.\"");
console.log("\n[End of File 13 — Transactions and Consistency]");
