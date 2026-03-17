/** ============================================================
 *  FILE 16: EVENT SOURCING AND CQRS
 *  ============================================================
 *  Topic: Event sourcing, event replay, snapshots, CQRS,
 *         read models, projections, event versioning,
 *         temporal queries
 *
 *  WHY THIS MATTERS:
 *  Traditional CRUD overwrites data, destroying history. Event
 *  sourcing captures every change as an immutable event, enabling
 *  full audit trails and time-travel debugging. CQRS separates
 *  read and write for independent scaling.
 *  ============================================================ */

// STORY: IRCTC Booking Ledger
// Every IRCTC action — search, reserve, pay, confirm, cancel — is
// an immutable event. PNR status is a projected view from replaying
// events. Disputes are resolved by replaying the event chain.

console.log("=".repeat(65));
console.log("  FILE 16: EVENT SOURCING AND CQRS");
console.log("  IRCTC Booking Ledger — every action is an event");
console.log("=".repeat(65));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Traditional CRUD vs Event Sourcing
// ════════════════════════════════════════════════════════════════

// WHY: CRUD mutates state in place, losing all history.
console.log("--- Section 1: Traditional CRUD vs Event Sourcing ---\n");

class TraditionalBookingCRUD {
  constructor() { this.bookings = {}; }
  createBooking(pnr, passenger, train) {
    this.bookings[pnr] = { pnr, passenger, train, status: "CONFIRMED", seat: "B1-32" };
  }
  cancelBooking(pnr) { if (this.bookings[pnr]) this.bookings[pnr].status = "CANCELLED"; }
  get(pnr) { return this.bookings[pnr]; }
}

const crud = new TraditionalBookingCRUD();
crud.createBooking("PNR001", "Rajesh Kumar", "Rajdhani Express");
console.log("CRUD after create:", JSON.stringify(crud.get("PNR001")));
crud.cancelBooking("PNR001");
console.log("CRUD after cancel:", JSON.stringify(crud.get("PNR001")));
console.log("Problem: Cannot tell WHEN it was confirmed or WHO cancelled.\n");

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Event Store and Replay
// ════════════════════════════════════════════════════════════════

// WHY: The event store is an append-only log. State is rebuilt by replaying events.
console.log("--- Section 2: Event Store and Replay ---\n");

class EventStore {
  constructor() { this.events = []; this.subscribers = []; this.seq = 0; }
  append(streamId, eventType, data) {
    const event = { seq: ++this.seq, streamId, eventType, data,
      metadata: { timestamp: Date.now() + this.seq, version: 1 } };
    this.events.push(event);
    this.subscribers.forEach(fn => fn(event));
    return event;
  }
  getStream(id) { return this.events.filter(e => e.streamId === id); }
  getAllEvents() { return [...this.events]; }
  subscribe(fn) { this.subscribers.push(fn); }
  get length() { return this.events.length; }
}

class BookingProjection {
  constructor() { this.state = {}; }
  apply(event) {
    const pnr = event.streamId;
    if (!this.state[pnr]) this.state[pnr] = { pnr, status: "UNKNOWN", history: [] };
    const b = this.state[pnr];
    switch (event.eventType) {
      case "BookingInitiated": Object.assign(b, event.data); b.status = "INITIATED"; break;
      case "SeatAllocated": b.coach = event.data.coach; b.seat = event.data.seat; b.status = "SEAT_ALLOCATED"; break;
      case "PaymentProcessed": b.amountPaid = event.data.amount; b.status = "PAYMENT_DONE"; break;
      case "BookingConfirmed": b.status = "CONFIRMED"; break;
      case "BookingCancelled": b.status = "CANCELLED"; b.refundAmount = event.data.refundAmount; break;
      case "ChartPrepared": b.finalSeat = event.data.finalSeat; b.status = "CHART_PREPARED"; break;
    }
    b.history.push({ event: event.eventType, at: event.metadata.timestamp });
    return b;
  }
  replayAll(events) { this.state = {}; events.forEach(e => this.apply(e)); return this.state; }
  getState(pnr) { return this.state[pnr]; }
}

const store = new EventStore();
store.append("PNR-4512", "BookingInitiated", { passenger: "Priya Sharma", train: "12301 Rajdhani", class: "3A" });
store.append("PNR-4512", "SeatAllocated", { coach: "B1", seat: 32 });
store.append("PNR-4512", "PaymentProcessed", { amount: 2450, method: "UPI" });
store.append("PNR-4512", "BookingConfirmed", { status: "CNF" });
store.append("PNR-4512", "ChartPrepared", { finalSeat: "B1-32" });

console.log("Events in stream PNR-4512:");
store.getStream("PNR-4512").forEach(e => {
  console.log(`  [${e.seq}] ${e.eventType}: ${JSON.stringify(e.data)}`);
});

const projection = new BookingProjection();
projection.replayAll(store.getAllEvents());
const pnrState = projection.getState("PNR-4512");
console.log(`\nRebuilt state: ${pnrState.passenger}, Status: ${pnrState.status}, Seat: ${pnrState.finalSeat}`);

store.append("PNR-4512", "BookingCancelled", { refundAmount: 2200, reason: "passenger request" });
projection.replayAll(store.getAllEvents());
const afterCancel = projection.getState("PNR-4512");
console.log(`After cancel: Status=${afterCancel.status}, Refund=Rs ${afterCancel.refundAmount}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Snapshots for Performance
// ════════════════════════════════════════════════════════════════

// WHY: Replaying thousands of events is slow. Snapshots checkpoint state.
console.log("--- Section 3: Snapshots for Performance ---\n");

class SnapshotStore {
  constructor(eventStore) { this.eventStore = eventStore; this.snapshots = {}; }
  takeSnapshot(streamId) {
    const events = this.eventStore.getStream(streamId);
    const proj = new BookingProjection();
    events.forEach(e => proj.apply(e));
    this.snapshots[streamId] = {
      state: JSON.parse(JSON.stringify(proj.getState(streamId))),
      lastSeq: events[events.length - 1].seq
    };
  }
  rebuildFromSnapshot(streamId) {
    const snapshot = this.snapshots[streamId];
    const proj = new BookingProjection();
    if (snapshot) {
      proj.state[streamId] = JSON.parse(JSON.stringify(snapshot.state));
      const newEvents = this.eventStore.getStream(streamId).filter(e => e.seq > snapshot.lastSeq);
      console.log(`  Snapshot at seq ${snapshot.lastSeq}, replaying ${newEvents.length} new events`);
      newEvents.forEach(e => proj.apply(e));
    } else {
      const all = this.eventStore.getStream(streamId);
      console.log(`  No snapshot, replaying all ${all.length} events`);
      all.forEach(e => proj.apply(e));
    }
    return proj.getState(streamId);
  }
}

const snapStore = new SnapshotStore(store);
snapStore.takeSnapshot("PNR-4512");
store.append("PNR-4512", "BookingInitiated", { passenger: "Priya Sharma", train: "12302 Return", class: "3A" });
const rebuilt = snapStore.rebuildFromSnapshot("PNR-4512");
console.log(`  Rebuilt status: ${rebuilt.status}\n`);

// ════════════════════════════════════════════════════════════════
// SECTION 4 — CQRS Pattern (Separate Read/Write)
// ════════════════════════════════════════════════════════════════

// WHY: Reads and writes have different scaling needs. CQRS separates them.
console.log("--- Section 4: CQRS Pattern ---\n");

class BookingCommandHandler {
  constructor(es) { this.es = es; }
  initiateBooking(pnr, p, t, c) { return this.es.append(pnr, "BookingInitiated", { passenger: p, train: t, class: c }); }
  processPayment(pnr, amt, m) { return this.es.append(pnr, "PaymentProcessed", { amount: amt, method: m }); }
  confirmBooking(pnr) { return this.es.append(pnr, "BookingConfirmed", { status: "CNF" }); }
  cancelBooking(pnr, refund, reason) { return this.es.append(pnr, "BookingCancelled", { refundAmount: refund, reason }); }
}

class BookingQueryHandler {
  constructor() { this.details = {}; this.occupancy = {}; this.revenue = {}; }
  handleEvent(event) {
    const pnr = event.streamId;
    if (event.eventType === "BookingInitiated") {
      this.details[pnr] = { ...event.data, status: "INITIATED", pnr };
    } else if (event.eventType === "BookingConfirmed") {
      if (this.details[pnr]) this.details[pnr].status = "CONFIRMED";
      const train = this.details[pnr] ? this.details[pnr].train : "?";
      this.occupancy[train] = (this.occupancy[train] || 0) + 1;
    } else if (event.eventType === "PaymentProcessed") {
      const train = this.details[pnr] ? this.details[pnr].train : "unknown";
      this.revenue[train] = (this.revenue[train] || 0) + event.data.amount;
    }
  }
}

const cqrsStore = new EventStore();
const cmd = new BookingCommandHandler(cqrsStore);
const query = new BookingQueryHandler();
cqrsStore.subscribe(e => query.handleEvent(e));

cmd.initiateBooking("PNR-100", "Amit Patel", "12951 Mumbai Rajdhani", "2A");
cmd.processPayment("PNR-100", 3200, "UPI");
cmd.confirmBooking("PNR-100");
cmd.initiateBooking("PNR-101", "Sneha Reddy", "12951 Mumbai Rajdhani", "3A");
cmd.processPayment("PNR-101", 2100, "Card");
cmd.confirmBooking("PNR-101");

console.log("Query — Booking:", JSON.stringify(query.details["PNR-100"]));
console.log("Query — Occupancy:", JSON.stringify(query.occupancy));
console.log("Query — Revenue:", JSON.stringify(query.revenue));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Event Versioning
// ════════════════════════════════════════════════════════════════

// WHY: Event schemas evolve. Handle old formats without breaking replay.
console.log("--- Section 5: Event Versioning ---\n");

class EventUpgrader {
  constructor() { this.upgraders = {}; }
  register(type, from, to, fn) { this.upgraders[`${type}:${from}:${to}`] = fn; }
  upgrade(event) {
    let upgraded = { ...event, data: { ...event.data }, metadata: { ...event.metadata } };
    let v = event.metadata.version || 1;
    while (this.upgraders[`${event.eventType}:${v}:${v+1}`]) {
      upgraded = this.upgraders[`${event.eventType}:${v}:${v+1}`](upgraded);
      upgraded.metadata.version = ++v;
    }
    return upgraded;
  }
}

const upgrader = new EventUpgrader();
upgrader.register("PaymentProcessed", 1, 2, e => ({ ...e, data: { ...e.data, currency: e.data.currency || "INR" } }));
upgrader.register("PaymentProcessed", 2, 3, e => ({ ...e, data: { ...e.data, gateway: e.data.gateway || "IRCTC-PG" } }));

const oldEvt = { eventType: "PaymentProcessed", data: { amount: 2500, method: "UPI" }, metadata: { version: 1 } };
const upgradedEvt = upgrader.upgrade(oldEvt);
console.log("Original v1:", JSON.stringify(oldEvt.data));
console.log("Upgraded v3:", JSON.stringify(upgradedEvt.data));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Temporal Queries
// ════════════════════════════════════════════════════════════════

// WHY: Event sourcing enables time-travel — see state at any point.
console.log("--- Section 6: Temporal Queries ---\n");

class TemporalQueryEngine {
  constructor(es) { this.es = es; }
  getStateHistory(streamId) {
    const events = this.es.getStream(streamId);
    const proj = new BookingProjection();
    return events.map(e => { proj.apply(e); return { seq: e.seq, event: e.eventType, status: proj.getState(streamId).status }; });
  }
}

const temporal = new TemporalQueryEngine(store);
console.log("Time-travel: PNR-4512 state after each event:");
temporal.getStateHistory("PNR-4512").forEach(h => {
  console.log(`  [seq ${h.seq}] ${h.event} => ${h.status}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════
console.log("=".repeat(65));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(65));
console.log(`
  1. Event sourcing stores every change as an immutable event.
  2. Current state is derived by replaying events from the start.
  3. Snapshots checkpoint state so replay skips old events.
  4. CQRS separates commands (writes) from queries (reads).
  5. Read model projections are denormalized views from events.
  6. Event versioning handles schema evolution without breakage.
  7. Temporal queries let you time-travel to any past state.

  IRCTC Wisdom: "In the ledger of events, nothing is ever lost —
  every ticket tells its complete story from search to journey's end."
`);
