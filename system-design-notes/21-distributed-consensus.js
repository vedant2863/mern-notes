/** ============================================================
 *  FILE 21: DISTRIBUTED CONSENSUS
 *  ============================================================
 *  Topic: Raft (election, log replication, safety), quorum,
 *         split-brain, consistency levels
 *
 *  WHY THIS MATTERS:
 *  In any distributed system, nodes must agree on a single source
 *  of truth even when some crash or become unreachable. Consensus
 *  algorithms like Raft make databases, config stores, and
 *  coordination services reliable.
 *  ============================================================ */

// STORY: Election Commission of India — Vote Counting
// Counting centers tally votes like Raft nodes. The Returning
// Officer is the elected leader who announces results only after
// a quorum confirms. If the officer falls ill, a new one is
// appointed — exactly like Raft leader election.

console.log("=".repeat(70));
console.log("  FILE 21: DISTRIBUTED CONSENSUS");
console.log("  Raft, Quorum, Split-Brain, Consistency Levels");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Why Consensus Matters
// ════════════════════════════════════════════════════════════════

// WHY: Without consensus, distributed nodes disagree on state,
// leading to data loss and conflicting operations.

console.log("--- SECTION 1: Why Consensus Matters ---\n");

const nodes = [{ id: "Node-A", value: null }, { id: "Node-B", value: null }, { id: "Node-C", value: null }];
nodes[0].value = "Result-X"; nodes[2].value = "Result-Y";
console.log("Without Consensus — two clients write different values:");
nodes.forEach((n) => console.log(`  ${n.id}: value = ${n.value || "EMPTY"}`));
console.log("  PROBLEM: No agreement on which value is correct!\n");

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Raft Leader Election
// ════════════════════════════════════════════════════════════════

// WHY: Raft ensures one leader coordinates all writes via
// randomized timeouts and majority voting.

console.log("--- SECTION 2: Raft Leader Election ---\n");

class RaftNode {
  constructor(id, clusterSize) {
    this.id = id; this.state = "follower"; this.currentTerm = 0;
    this.votedFor = null; this.clusterSize = clusterSize; this.votesReceived = 0;
  }
  startElection() {
    this.currentTerm++; this.state = "candidate"; this.votedFor = this.id; this.votesReceived = 1;
    console.log(`  [Term ${this.currentTerm}] ${this.id} becomes CANDIDATE`);
    return this.currentTerm;
  }
  requestVote(candidateId, candidateTerm) {
    if (candidateTerm > this.currentTerm) { this.currentTerm = candidateTerm; this.votedFor = null; }
    if (candidateTerm >= this.currentTerm && this.votedFor === null) {
      this.votedFor = candidateId;
      console.log(`  [Term ${this.currentTerm}] ${this.id} votes for ${candidateId}`);
      return true;
    }
    return false;
  }
  becomeLeader() {
    this.state = "leader";
    console.log(`  [Term ${this.currentTerm}] ${this.id} becomes LEADER with ${this.votesReceived}/${this.clusterSize} votes`);
  }
}

function simulateElection() {
  const raftNodes = Array.from({ length: 5 }, (_, i) => new RaftNode(`Booth-${i + 1}`, 5));
  const candidate = raftNodes[0]; // first node times out
  const term = candidate.startElection();
  const quorum = 3;
  for (const node of raftNodes) {
    if (node.id !== candidate.id && node.requestVote(candidate.id, term)) candidate.votesReceived++;
    if (candidate.votesReceived >= quorum) { candidate.becomeLeader(); return candidate; }
  }
  return candidate;
}
const leader = simulateElection();
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Log Replication
// ════════════════════════════════════════════════════════════════

// WHY: Leader replicates writes to a majority before committing.

console.log("--- SECTION 3: Log Replication ---\n");

class RaftCluster {
  constructor(size) {
    this.size = size;
    this.nodes = Array.from({ length: size }, (_, i) => ({ id: `Node-${i}`, log: [], isAlive: true }));
    this.leader = this.nodes[0];
    console.log(`  Cluster of ${size} nodes. Leader: ${this.leader.id}`);
  }
  appendEntry(command) {
    const entry = { term: 1, index: this.leader.log.length, command };
    this.leader.log.push(entry);
    let acks = 1;
    const quorum = Math.floor(this.size / 2) + 1;
    for (let i = 1; i < this.nodes.length; i++) {
      if (this.nodes[i].isAlive) { this.nodes[i].log.push({ ...entry }); acks++; }
      else console.log(`    ${this.nodes[i].id} is DOWN — skipped`);
      if (acks >= quorum) { console.log(`  "${command}" — ${acks} acks — COMMITTED`); return true; }
    }
    if (acks < quorum) console.log(`  "${command}" — only ${acks} acks — NOT committed`);
    return acks >= quorum;
  }
}

const raftCluster = new RaftCluster(5);
raftCluster.appendEntry("SET constituency=Varanasi winner=CandidateA");
raftCluster.nodes[3].isAlive = false; raftCluster.nodes[4].isAlive = false;
console.log("  Two nodes go DOWN...");
raftCluster.appendEntry("SET constituency=Lucknow winner=CandidateC");
raftCluster.nodes[2].isAlive = false;
console.log("  Third node goes DOWN...");
raftCluster.appendEntry("SET constituency=Patna winner=CandidateD");
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Quorum and Split-Brain
// ════════════════════════════════════════════════════════════════

// WHY: Quorum ensures overlapping operations. Split-brain is
// prevented because only one partition can have a majority.

console.log("--- SECTION 4: Quorum and Split-Brain ---\n");

console.log("  Cluster Size | Quorum | Tolerated Failures");
console.log("  -------------|--------|-------------------");
[3, 5, 7, 9].forEach((s) => {
  const q = Math.floor(s / 2) + 1;
  console.log(`  ${String(s).padStart(13)} | ${String(q).padStart(6)} | ${String(s - q).padStart(18)}`);
});

console.log("\n  Split-Brain Scenario:");
console.log("    Partition A: [N1, N2] (has old leader)");
console.log("    Partition B: [N3, N4, N5]");
console.log("    Quorum needed: 3");
console.log("    Partition A (2 nodes): REJECTED — lacks quorum");
console.log("    Partition B (3 nodes): N3 elected leader — has quorum");
console.log("    PREVENTION: Only one partition can make progress.\n");

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Consistency Levels
// ════════════════════════════════════════════════════════════════

// WHY: Different apps need different consistency: banking needs
// strong, social feeds tolerate eventual.

console.log("--- SECTION 5: Consistency Levels ---\n");

class ConsistencyDemo {
  constructor() { this.nodes = [{ id: "Primary", data: {} }, { id: "Replica-1", data: {} }, { id: "Replica-2", data: {} }]; }
  strongWrite(key, value) {
    console.log(`  [STRONG] Writing ${key}=${value}`);
    this.nodes.forEach((n) => { n.data[key] = value; });
    console.log(`    Acknowledged after ALL ${this.nodes.length} nodes confirmed`);
  }
  eventualWrite(key, value) {
    console.log(`  [EVENTUAL] Writing ${key}=${value}`);
    this.nodes[0].data[key] = value;
    console.log(`    Acknowledged after PRIMARY confirms`);
    console.log(`    Replica-1 reads: ${this.nodes[1].data[key] || "STALE/EMPTY"} (until replication)`);
  }
}
const cDemo = new ConsistencyDemo();
cDemo.strongWrite("constituency", "Varanasi");
cDemo.eventualWrite("constituency", "Amethi");
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Comparing Consensus Protocols
// ════════════════════════════════════════════════════════════════

// WHY: Raft is not the only protocol. Know the alternatives.

console.log("--- SECTION 6: Consensus Protocols and Real Systems ---\n");

[{ name: "Paxos", usedBy: "Google Chubby, Spanner", strength: "Theoretical foundation" },
 { name: "Raft", usedBy: "etcd, CockroachDB, Consul", strength: "Understandability, strong leader" },
 { name: "Zab", usedBy: "Apache ZooKeeper", strength: "Ordered broadcasts" },
].forEach((p) => console.log(`  ${p.name}: ${p.usedBy} | ${p.strength}`));

console.log("\n  Consensus in Real Systems:");
[["MongoDB Replica Set", "Raft-like", "Electing primary, replicating oplog"],
 ["etcd (Kubernetes)", "Raft", "Storing cluster state"],
 ["Apache Kafka", "ISR", "Replicating partitions"],
 ["CockroachDB", "Raft", "Range-level replication"],
].forEach(([sys, proto, use]) => console.log(`    ${sys}: ${proto} — ${use}`));
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Consensus ensures all nodes agree on a single state.");
console.log("  2. Raft uses leader election, log replication, and safety rules.");
console.log("  3. Quorum (majority) ensures overlapping operations for consistency.");
console.log("  4. Split-brain is prevented by quorum — only one partition progresses.");
console.log("  5. Strong consistency waits for all; eventual allows stale reads.");
console.log("  6. Raft is preferred over Paxos for understandability.");
console.log("  7. MongoDB, etcd, and Kafka all use consensus internally.");
console.log();
console.log('  "Just as India\'s Election Commission ensures every vote is counted');
console.log('   fairly, distributed consensus ensures every node agrees on the');
console.log('   truth — even when some nodes fail."');
console.log();
