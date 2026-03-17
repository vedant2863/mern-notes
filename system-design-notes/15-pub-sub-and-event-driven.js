/** ============================================================
 *  FILE 15: PUB/SUB AND EVENT-DRIVEN ARCHITECTURE
 *  ============================================================
 *  Topic: Pub/sub, topic routing, event bus, consumer groups,
 *         ordering guarantees
 *
 *  WHY THIS MATTERS:
 *  When Virat Kohli hits a six in an IPL match, the score update
 *  must reach the leaderboard, notification service, and fantasy
 *  points engine simultaneously. Pub/sub decouples the match
 *  engine from all subscribers.
 *  ============================================================ */

// STORY: Dream11 Live Scores
// Dream11 serves 150 million users during IPL. The match engine
// emits ball-by-ball events. Leaderboard, fantasy points, and
// notifications subscribe independently. Consumer groups let
// Dream11 scale each subscriber horizontally.

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  FILE 15 — PUB/SUB AND EVENT-DRIVEN ARCHITECTURE           ║");
console.log("║  Dream11: IPL match events -> leaderboard, fantasy, alerts  ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Simple Pub/Sub with Topic Routing
// ════════════════════════════════════════════════════════════════

// WHY: Publishers fire events without knowing who listens.
// Topic routing delivers events only to relevant subscribers.

console.log("=== SECTION 1: Simple Pub/Sub with Topic Routing ===\n");

class PubSub {
  constructor() { this.subscribers = {}; this.messageLog = []; }
  subscribe(topic, name, callback) {
    if (!this.subscribers[topic]) this.subscribers[topic] = [];
    this.subscribers[topic].push({ name, callback });
  }
  publish(topic, message) {
    const subs = this.subscribers[topic] || [];
    const deliveries = [];
    subs.forEach((sub) => {
      try { sub.callback(message); deliveries.push({ subscriber: sub.name, status: "delivered" }); }
      catch (err) { deliveries.push({ subscriber: sub.name, status: "failed" }); }
    });
    this.messageLog.push({ topic, deliveries }); return deliveries;
  }
}

function pubSubDemo() {
  const pubsub = new PubSub();
  const received = {};
  function track(service) {
    return (msg) => { if (!received[service]) received[service] = []; received[service].push(msg); };
  }

  // Subscribe to different topics
  pubsub.subscribe("match.score", "leaderboard-service", track("leaderboard"));
  pubsub.subscribe("match.score", "fantasy-points-engine", track("fantasy"));
  pubsub.subscribe("match.score", "notification-service", track("notifications"));
  pubsub.subscribe("match.score.boundary", "highlights-service", track("highlights"));
  pubsub.subscribe("match.wicket", "wicket-alerts", track("wickets"));

  console.log("Dream11 topic subscriptions:");
  console.log("  match.score           -> leaderboard, fantasy, notifications");
  console.log("  match.score.boundary  -> highlights");
  console.log("  match.wicket          -> wicket-alerts\n");

  const ballEvent = { match: "CSK vs MI", batsman: "MS Dhoni", runs: 6, type: "SIX", totalScore: "185/4" };
  console.log(`Publishing: ${ballEvent.batsman} hits a ${ballEvent.type}!`);
  const deliveries = pubsub.publish("match.score", ballEvent);
  pubsub.publish("match.score.boundary", ballEvent);
  console.log(`  Delivered to ${deliveries.length + 1} subscribers total`);

  console.log("\nEach service processes independently:");
  Object.entries(received).forEach(([service, msgs]) => {
    console.log(`  ${service}: received ${msgs.length} event(s)`);
  });
}

pubSubDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Wildcard Subscriptions
// ════════════════════════════════════════════════════════════════

// WHY: Subscribe to "match.score.*" for ALL score events without listing each.

console.log("\n\n=== SECTION 2: Wildcard Subscriptions ===\n");

class WildcardPubSub {
  constructor() { this.subscribers = []; }
  subscribe(pattern, name, callback) {
    const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+").replace(/#/g, ".*") + "$");
    this.subscribers.push({ pattern, regex, name, callback });
  }
  publish(topic, message) {
    const matched = [];
    this.subscribers.forEach((sub) => { if (sub.regex.test(topic)) { sub.callback({ topic, ...message }); matched.push(sub.name); } });
    return matched;
  }
}

function wildcardDemo() {
  const pubsub = new WildcardPubSub();
  const logs = {};
  function logger(name) { logs[name] = []; return (msg) => logs[name].push(msg.topic); }

  pubsub.subscribe("match.score.*", "all-scores", logger("all-scores"));
  pubsub.subscribe("match.#", "match-archiver", logger("match-archiver"));
  pubsub.subscribe("match.score.boundary", "boundary-only", logger("boundary-only"));

  console.log("Wildcard patterns:");
  console.log("  match.score.*  -> all-scores (single-level)");
  console.log("  match.#        -> match-archiver (multi-level)");
  console.log("  match.score.boundary -> boundary-only (exact)\n");

  ["match.score.boundary", "match.score.wicket", "match.commentary.text", "match.drs.review"].forEach((topic) => {
    const matched = pubsub.publish(topic, { ts: Date.now() });
    console.log(`  ${topic.padEnd(26)} -> [${matched.join(", ")}]`);
  });
}

wildcardDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Event Bus Pattern
// ════════════════════════════════════════════════════════════════

// WHY: A central event bus decouples all microservices with
// middleware for filtering, logging, and replay.

console.log("\n\n=== SECTION 3: Event Bus Pattern ===\n");

class EventBus {
  constructor() { this.handlers = {}; this.middleware = []; this.eventLog = []; }
  use(fn) { this.middleware.push(fn); }
  on(type, handler) { if (!this.handlers[type]) this.handlers[type] = []; this.handlers[type].push(handler); }
  emit(eventType, payload) {
    const event = { type: eventType, payload, id: `EVT-${Math.random().toString(36).slice(2,8)}` };
    for (const mw of this.middleware) { if (!mw(event)) return { delivered: 0, filtered: true }; }
    this.eventLog.push(event);
    let delivered = 0;
    (this.handlers[eventType] || []).forEach((h) => { try { h(event); delivered++; } catch(e) {} });
    return { delivered, id: event.id };
  }
}

function eventBusDemo() {
  const bus = new EventBus();
  const counts = {};
  function counter(service) { counts[service] = 0; return () => counts[service]++; }

  bus.use((event) => !(event.payload && event.payload.test)); // filter test events
  bus.on("BALL_BOWLED", counter("leaderboard"));
  bus.on("BALL_BOWLED", counter("fantasy-points"));
  bus.on("WICKET_FALLEN", counter("wicket-alerts"));
  bus.on("WICKET_FALLEN", counter("fantasy-points"));

  console.log("Dream11 Event Bus — Over 18:\n");
  const balls = [
    { event: "BALL_BOWLED", data: { ball: "18.1", batsman: "Dhoni", runs: 2 } },
    { event: "BALL_BOWLED", data: { ball: "18.3", batsman: "Dhoni", runs: 6 } },
    { event: "WICKET_FALLEN", data: { ball: "18.5", batsman: "Jadeja", bowler: "Bumrah" } },
    { event: "BALL_BOWLED", data: { ball: "18.6", batsman: "Shardul", runs: 1 } },
  ];

  balls.forEach((b) => {
    const result = bus.emit(b.event, b.data);
    console.log(`  ${b.event.padEnd(16)} -> ${b.data.batsman} (${result.delivered} handlers)`);
  });

  console.log(`\n  Event log: ${bus.eventLog.length} events stored for replay`);
  console.log("  Service counts:", JSON.stringify(counts));
}

eventBusDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Consumer Groups with Partitions
// ════════════════════════════════════════════════════════════════

// WHY: Scale consumers horizontally — each instance handles a subset.

console.log("\n\n=== SECTION 4: Consumer Groups with Partitions ===\n");

class PartitionedTopic {
  constructor(name, numPartitions) {
    this.name = name; this.partitions = {}; this.numPartitions = numPartitions; this.consumerGroups = {};
    for (let i = 0; i < numPartitions; i++) this.partitions[i] = [];
  }
  publish(key, message) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0x7fffffff;
    const p = hash % this.numPartitions; this.partitions[p].push({ key, message, partition: p }); return p;
  }
  registerConsumerGroup(groupName, count) {
    const assignments = {};
    for (let c = 0; c < count; c++) assignments[`${groupName}-${c}`] = [];
    const consumers = Object.keys(assignments);
    for (let p = 0; p < this.numPartitions; p++) assignments[consumers[p % consumers.length]].push(p);
    this.consumerGroups[groupName] = assignments; return assignments;
  }
}

function consumerGroupDemo() {
  const topic = new PartitionedTopic("match-events", 6);

  console.log("Dream11 — 6 partitions, keyed by match_id:\n");
  ["CSK-MI", "RCB-KKR", "DC-SRH", "PBKS-RR", "GT-LSG", "CSK-MI"].forEach((matchId, i) => {
    const partition = topic.publish(matchId, { ball: `${i}.1`, matchId });
    console.log(`  ${matchId.padEnd(10)} -> partition ${partition}`);
  });

  console.log("\nConsumer Group: 'fantasy-points' (3 consumers, 6 partitions):");
  const fpAssign = topic.registerConsumerGroup("fantasy-points", 3);
  Object.entries(fpAssign).forEach(([consumer, partitions]) => {
    console.log(`  ${consumer}: partitions [${partitions.join(", ")}]`);
  });

  console.log("\n  Same match always goes to same partition -> ordering guaranteed WITHIN partition");
  console.log("  No ordering across partitions — but different matches are independent.");
}

consumerGroupDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Event Filtering and Transformation
// ════════════════════════════════════════════════════════════════

// WHY: Not every consumer needs every event — filter at the bus.

console.log("\n\n=== SECTION 5: Event Filtering and Transformation ===\n");

function filteringDemo() {
  class FilteredSubscription {
    constructor() { this.subscriptions = []; }
    subscribe(name, filterFn, transformFn = null) {
      this.subscriptions.push({ name, filter: filterFn, transform: transformFn, received: [] });
    }
    publish(event) {
      this.subscriptions.forEach((sub) => {
        if (sub.filter(event)) sub.received.push(sub.transform ? sub.transform(event) : event);
      });
    }
  }

  const bus = new FilteredSubscription();
  bus.subscribe("six-alerts", (e) => e.runs === 6, (e) => ({ alert: `${e.batsman} hit a SIX!` }));
  bus.subscribe("wicket-alerts", (e) => e.wicket === true, (e) => ({ alert: `WICKET! ${e.batsman} out` }));
  bus.subscribe("raw-feed", () => true, null);

  const events = [
    { ball: "18.1", batsman: "Dhoni", runs: 2, wicket: false },
    { ball: "18.3", batsman: "Dhoni", runs: 6, wicket: false },
    { ball: "18.5", batsman: "Jadeja", runs: 0, wicket: true, bowler: "Bumrah" },
    { ball: "18.6", batsman: "Shardul", runs: 1, wicket: false },
  ];

  events.forEach((e) => bus.publish(e));

  console.log("Filtered message counts:");
  bus.subscriptions.forEach((sub) => {
    console.log(`  ${sub.name.padEnd(16)}: ${sub.received.length} events`);
    sub.received.forEach((msg) => { if (msg.alert) console.log(`    -> ${msg.alert}`); });
  });
}

filteringDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Pub/Sub vs Message Queue Comparison
// ════════════════════════════════════════════════════════════════

// WHY: They solve different problems — know when to use which.

console.log("\n\n=== SECTION 6: Pub/Sub vs Message Queue ===\n");

console.log("  Feature            Queue                      Pub/Sub");
console.log("  " + "-".repeat(62));
console.log("  Delivery           1 consumer                 All subscribers");
console.log("  Lifetime           Deleted after consumption  Retained per policy");
console.log("  Ordering           FIFO guaranteed            Per-partition only");
console.log("  Replay             No (consumed = gone)       Yes (from offset)");
console.log("  Use case           Task processing            Event broadcasting");

console.log("\n  Hybrid: Pub/Sub + Consumer Groups = scalable broadcast");
console.log("  Each GROUP gets every message (pub/sub), within a group only 1 consumer processes (queue).");
console.log("  This is exactly what Apache Kafka does.");

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("\n\n=== KEY TAKEAWAYS ===\n");
console.log("1. Pub/sub decouples publishers from subscribers — add services without changing publishers.");
console.log("2. Topic routing and wildcards deliver events only to relevant subscribers.");
console.log("3. An event bus is the backbone of event-driven microservices.");
console.log("4. Consumer groups scale subscribers horizontally with partition assignment.");
console.log("5. Ordering is guaranteed within a partition, not across partitions.");
console.log("6. Event filtering at the bus reduces unnecessary processing at consumers.");
console.log("7. Use queues for tasks, pub/sub for events — or combine both (Kafka).\n");
console.log('"When Dhoni hits a six at Wankhede, Dream11 publishes one event,');
console.log(' and 150 million fantasy scores update themselves."');
console.log("\n[End of File 15 — Pub/Sub and Event-Driven Architecture]");
