/** ============================================================
 *  FILE 14: MESSAGE QUEUES
 *  ============================================================
 *  Topic: Producer-consumer, delivery guarantees, dead letter
 *         queues, backpressure, FIFO, fan-out
 *
 *  WHY THIS MATTERS:
 *  Without message queues, a slow payment service blocks the
 *  entire order flow. Queues decouple producers from consumers,
 *  absorb traffic spikes, and guarantee no order is lost even
 *  when downstream systems temporarily fail.
 *  ============================================================ */

// STORY: BigBasket Order Processing
// BigBasket processes 2 lakh orders daily across 30 cities. Orders
// enter a queue like a warehouse slip rack. Workers pick slips one
// by one. Problem slips go to the Dead Letter Queue. Backpressure
// prevents overflow during festival rush.

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  FILE 14 — MESSAGE QUEUES                                  ║");
console.log("║  BigBasket: order slip rack, problem shelf, festival rush   ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Simple Queue with Producer-Consumer
// ════════════════════════════════════════════════════════════════

// WHY: A queue is a FIFO buffer between producers and consumers.

console.log("=== SECTION 1: Simple Queue with Producer-Consumer ===\n");

class SimpleQueue {
  constructor(name, capacity = Infinity) {
    this.name = name; this.buffer = []; this.capacity = capacity;
    this.totalEnqueued = 0; this.totalDequeued = 0;
  }
  enqueue(message) {
    if (this.buffer.length >= this.capacity) return { success: false, reason: "Queue full — backpressure!" };
    this.buffer.push({ ...message, id: `MSG-${++this.totalEnqueued}` });
    return { success: true, id: `MSG-${this.totalEnqueued}` };
  }
  dequeue() { if (this.buffer.length === 0) return null; this.totalDequeued++; return this.buffer.shift(); }
  size() { return this.buffer.length; }
  isEmpty() { return this.buffer.length === 0; }
}

function simpleQueueDemo() {
  const orderQueue = new SimpleQueue("bigbasket-orders", 5);

  const orders = [
    { customer: "Priya", items: ["Rice 5kg", "Dal 1kg"], city: "Bangalore" },
    { customer: "Arjun", items: ["Milk 1L", "Bread"], city: "Mumbai" },
    { customer: "Meera", items: ["Onions 2kg"], city: "Chennai" },
    { customer: "Vikram", items: ["Atta 10kg", "Oil 1L"], city: "Delhi" },
    { customer: "Sneha", items: ["Eggs 12", "Butter"], city: "Bangalore" },
    { customer: "Ravi", items: ["Paneer", "Curd"], city: "Hyderabad" },
  ];

  console.log("BigBasket order queue (capacity: 5):\n");
  orders.forEach((o) => {
    const result = orderQueue.enqueue(o);
    const status = result.success ? `Enqueued ${result.id}` : result.reason;
    console.log(`  ${o.customer.padEnd(8)} -> ${status}`);
  });

  console.log("\n  Processing orders:");
  while (!orderQueue.isEmpty()) {
    const msg = orderQueue.dequeue();
    console.log(`    Processed ${msg.id}: ${msg.customer}'s order (${msg.city})`);
  }
}

simpleQueueDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Delivery Guarantees
// ════════════════════════════════════════════════════════════════

// WHY: Three modes — at-most-once (fast, lossy), at-least-once
// (retry, may duplicate), exactly-once (idempotent consumer).

console.log("\n\n=== SECTION 2: Delivery Guarantees ===\n");

function deliveryGuaranteesDemo() {
  // At-least-once with ack/nack
  class AtLeastOnceQueue {
    constructor() { this.buffer = []; this.unacked = new Map(); this.counter = 0; }
    send(msg) { const id = `MSG-${++this.counter}`; this.buffer.push({ id, payload: msg, attempts: 0 }); return id; }
    receive() {
      const msg = this.buffer.shift(); if (!msg) return null;
      msg.attempts++; this.unacked.set(msg.id, msg); return msg;
    }
    ack(id) { this.unacked.delete(id); }
    nack(id) { const m = this.unacked.get(id); if (m) { this.unacked.delete(id); this.buffer.push(m); } }
  }

  const queue = new AtLeastOnceQueue();
  console.log("At-least-once delivery:\n");
  queue.send({ order: "ORD-001", customer: "Priya", total: 850 });
  queue.send({ order: "ORD-002", customer: "Arjun", total: 1200 });
  queue.send({ order: "ORD-003", customer: "Meera", total: 430 });

  let count = 0;
  while (queue.buffer.length > 0 && count < 10) {
    const msg = queue.receive(); if (!msg) break; count++;
    if (msg.payload.order === "ORD-002" && msg.attempts === 1) {
      console.log(`  Attempt ${msg.attempts}: ${msg.payload.order} — FAILED (payment timeout)`);
      queue.nack(msg.id); continue;
    }
    queue.ack(msg.id);
    console.log(`  Attempt ${msg.attempts}: ${msg.payload.order} — SUCCESS (${msg.payload.customer})`);
  }
  console.log("  ORD-002 delivered TWICE — consumer must be IDEMPOTENT.\n");

  // Exactly-once via idempotent consumer
  console.log("Exactly-once via idempotent consumer:\n");
  const processedIds = new Set();
  const messages = [
    { id: "MSG-1", order: "ORD-001" }, { id: "MSG-2", order: "ORD-002" },
    { id: "MSG-1", order: "ORD-001" }, { id: "MSG-2", order: "ORD-002" }, // duplicates
  ];
  let processed = 0;
  messages.forEach((msg) => {
    if (processedIds.has(msg.id)) { console.log(`  ${msg.id}: DUPLICATE_SKIPPED`); return; }
    processedIds.add(msg.id); processed++;
    console.log(`  ${msg.id}: PROCESSED`);
  });
  console.log(`\n  Received: ${messages.length}, Processed: ${processed}, Skipped: ${messages.length - processed}`);
  console.log("  Exactly-once = at-least-once + idempotent consumer with deduplication key");
}

deliveryGuaranteesDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Dead Letter Queue (DLQ)
// ════════════════════════════════════════════════════════════════

// WHY: Messages that fail repeatedly need a separate "problem shelf."

console.log("\n\n=== SECTION 3: Dead Letter Queue ===\n");

class MessageQueueWithDLQ {
  constructor(name, maxRetries = 3) {
    this.name = name; this.mainQueue = []; this.dlq = [];
    this.maxRetries = maxRetries; this.stats = { success: 0, dlqd: 0, retries: 0 };
  }
  enqueue(msg) {
    this.mainQueue.push({ ...msg, attempts: 0, id: `M-${Date.now()}-${Math.random().toString(36).slice(2,6)}` });
  }
  processAll(handler) {
    while (this.mainQueue.length > 0) {
      const msg = this.mainQueue.shift(); msg.attempts++;
      try { handler(msg); this.stats.success++; }
      catch (err) {
        if (msg.attempts >= this.maxRetries) { this.dlq.push({ ...msg, error: err.message }); this.stats.dlqd++; }
        else { this.mainQueue.push(msg); this.stats.retries++; }
      }
    }
  }
}

function dlqDemo() {
  const queue = new MessageQueueWithDLQ("bigbasket-orders", 3);

  const orders = [
    { order: "ORD-101", customer: "Priya", amount: 850, address: "valid" },
    { order: "ORD-102", customer: "Arjun", amount: 1200, address: "valid" },
    { order: "ORD-103", customer: "Ghost", amount: 0, address: "invalid" },
    { order: "ORD-104", customer: "Meera", amount: 430, address: "valid" },
  ];
  orders.forEach((o) => queue.enqueue(o));

  console.log("BigBasket order processing with DLQ (max 3 retries):\n");
  queue.processAll((msg) => {
    if (msg.amount <= 0) throw new Error(`Invalid amount: ${msg.amount}`);
    if (msg.address === "invalid") throw new Error(`Bad address`);
  });

  console.log(`  Successfully processed: ${queue.stats.success}`);
  console.log(`  Retries attempted: ${queue.stats.retries}`);
  console.log(`  Moved to DLQ: ${queue.stats.dlqd}\n`);
  console.log("  Dead Letter Queue contents:");
  queue.dlq.forEach((msg) => {
    console.log(`    ${msg.order} (${msg.customer}): ${msg.error} [${msg.attempts} attempts]`);
  });
}

dlqDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Backpressure Handling
// ════════════════════════════════════════════════════════════════

// WHY: During Diwali rush, producers must slow down or orders overflow.

console.log("\n\n=== SECTION 4: Backpressure Handling ===\n");

function backpressureDemo() {
  class BackpressureQueue {
    constructor(capacity, hw = 0.8, lw = 0.3) {
      this.buffer = []; this.capacity = capacity;
      this.highWater = Math.floor(capacity * hw); this.lowWater = Math.floor(capacity * lw);
      this.accepting = true; this.dropped = 0; this.accepted = 0;
    }
    enqueue(msg) {
      if (this.buffer.length >= this.capacity) { this.dropped++; return "DROPPED"; }
      if (this.buffer.length >= this.highWater && this.accepting) this.accepting = false;
      if (!this.accepting) { this.dropped++; return "REJECTED"; }
      this.buffer.push(msg); this.accepted++; return "ACCEPTED";
    }
    dequeue(count = 1) {
      for (let i = 0; i < count && this.buffer.length > 0; i++) this.buffer.shift();
      if (this.buffer.length <= this.lowWater && !this.accepting) this.accepting = true;
    }
  }

  const queue = new BackpressureQueue(100, 0.8, 0.3);

  console.log("BigBasket Diwali rush — queue capacity: 100, high-water: 80%\n");
  console.log("Phase 1: Order burst (150 orders)");
  for (let i = 0; i < 150; i++) queue.enqueue({ order: `ORD-${i}` });
  console.log(`  Accepted: ${queue.accepted}, Dropped: ${queue.dropped}`);

  console.log("\nPhase 2: Workers process 60 orders");
  queue.dequeue(60);
  console.log(`  Queue size: ${queue.buffer.length}, Accepting: ${queue.accepting}`);

  console.log("\n  Backpressure strategies:");
  console.log("  1. Reject (HTTP 429)  2. Buffer to disk  3. Sample every Nth  4. Shed low-priority");
}

backpressureDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — FIFO Queue with Ordering
// ════════════════════════════════════════════════════════════════

// WHY: Some messages MUST be processed in order (payment before shipment).

console.log("\n\n=== SECTION 5: FIFO Queue with Ordering ===\n");

function fifoDemo() {
  class FIFOQueue {
    constructor() { this.groups = {}; this.processing = {}; }
    send(msg, groupId) { if (!this.groups[groupId]) this.groups[groupId] = []; this.groups[groupId].push(msg); }
    receive(groupId) {
      if (this.processing[groupId]) return null;
      const g = this.groups[groupId]; if (!g || g.length === 0) return null;
      this.processing[groupId] = true; return g[0];
    }
    ack(groupId) { this.processing[groupId] = false; if (this.groups[groupId]) this.groups[groupId].shift(); }
  }

  const fifo = new FIFOQueue();
  console.log("BigBasket order lifecycle (FIFO per order group):\n");

  fifo.send({ event: "ORDER_PLACED", time: "10:00" }, "ORD-500");
  fifo.send({ event: "PAYMENT_SUCCESS", time: "10:01" }, "ORD-500");
  fifo.send({ event: "PICKING_STARTED", time: "10:15" }, "ORD-500");
  fifo.send({ event: "OUT_FOR_DELIVERY", time: "11:00" }, "ORD-500");
  fifo.send({ event: "DELIVERED", time: "11:30" }, "ORD-500");

  console.log("  Processing ORD-500 (must be in order):");
  for (let i = 0; i < 5; i++) {
    const msg = fifo.receive("ORD-500");
    if (msg) { console.log(`    [${msg.time}] ${msg.event}`); fifo.ack("ORD-500"); }
  }
  console.log("\n  FIFO within group, parallel across groups.");
}

fifoDemo();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Fan-Out Pattern
// ════════════════════════════════════════════════════════════════

// WHY: One order event triggers inventory, payment, notification, analytics.

console.log("\n\n=== SECTION 6: Fan-Out Pattern ===\n");

function fanOutDemo() {
  class FanOutQueue {
    constructor() { this.subscribers = {}; }
    addQueue(name) { this.subscribers[name] = []; }
    publish(msg) {
      let n = 0;
      for (const [name, q] of Object.entries(this.subscribers)) { q.push({ ...msg }); n++; }
      return n;
    }
  }

  const exchange = new FanOutQueue();
  ["inventory-service", "payment-service", "notification-service", "analytics-service"].forEach(s => exchange.addQueue(s));

  console.log("BigBasket order fan-out — 1 order triggers 4 services:\n");
  const count = exchange.publish({ orderId: "ORD-777", customer: "Priya", total: 590 });
  console.log(`  Published order ORD-777 -> fanned to ${count} queues\n`);

  [{ name: "inventory-service", action: "Reserve items" },
   { name: "payment-service", action: "Charge Rs.590" },
   { name: "notification-service", action: "Send SMS: 'Order confirmed'" },
   { name: "analytics-service", action: "Record: Bangalore, groceries, Rs.590" },
  ].forEach((s) => console.log(`  ${s.name}: ${s.action}`));

  console.log("\n  Fan-out decouples order service from downstream.");
  console.log("  If analytics is down, inventory and payment still work.");
}

fanOutDemo();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("\n\n=== KEY TAKEAWAYS ===\n");
console.log("1. Queues decouple producers from consumers — neither blocks the other.");
console.log("2. At-most-once is fast but lossy — fine for notifications, not orders.");
console.log("3. At-least-once guarantees delivery but consumers MUST be idempotent.");
console.log("4. Exactly-once = at-least-once + idempotent consumer with deduplication.");
console.log("5. Dead Letter Queues catch poison messages — review and reprocess them.");
console.log("6. Backpressure prevents queue overflow during traffic spikes.");
console.log("7. FIFO per message group ensures ordering where it matters.");
console.log("8. Fan-out broadcasts one event to many services — failure isolation.\n");
console.log('"BigBasket\'s warehouse slip rack never drops an order on the floor.');
console.log(" If a slip can\'t be fulfilled, it goes to the problem shelf —");
console.log(' but it never disappears."');
console.log("\n[End of File 14 — Message Queues]");
