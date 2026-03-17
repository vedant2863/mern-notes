/**
 * ============================================================
 *  FILE 34 : CQRS & Event Sourcing
 *  WHERE YOU SEE THIS: Banking systems, audit trails, Redux,
 *    any system that needs undo/replay or full history
 * ============================================================
 */

// STORY: Patwari Ramesh maintains the village land registry. Every sale
// or inheritance is an append-only entry. Nothing is ever erased —
// ownership can always be traced back.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Event Sourcing (Append-Only Log)
// ────────────────────────────────────────────────────────────
// Instead of storing current state, store every event that happened.
// Current state = replaying all events from the start.

class EventLog {
  constructor() {
    this.events = [];
  }

  append(event) {
    event.version = this.events.length + 1;
    event.timestamp = Date.now();
    this.events.push(event);
    return event;
  }

  getByPlotId(plotId) {
    var result = [];
    for (var i = 0; i < this.events.length; i++) {
      if (this.events[i].plotId === plotId) {
        result.push(this.events[i]);
      }
    }
    return result;
  }
}

// Rebuild state by walking through events one by one
function rebuildOwnership(events) {
  var state = null;

  for (var i = 0; i < events.length; i++) {
    var evt = events[i];

    if (evt.type === "REGISTERED") {
      state = { id: evt.plotId, owner: evt.owner, area: evt.area };
    } else if (evt.type === "INHERITED" || evt.type === "SOLD") {
      state.owner = evt.newOwner;
    } else if (evt.type === "MORTGAGED") {
      state.mortgagedTo = evt.bank;
    }
  }

  return state;
}

console.log("=== Event Sourcing ===");

var registry = new EventLog();
registry.append({ plotId: "P200", type: "REGISTERED", owner: "Hari Prasad", area: 10 });
registry.append({ plotId: "P200", type: "INHERITED", newOwner: "Mohan Prasad" });
registry.append({ plotId: "P200", type: "SOLD", newOwner: "Vikram Sharma" });
registry.append({ plotId: "P200", type: "MORTGAGED", bank: "SBI Raipur" });

var history = registry.getByPlotId("P200");
var current = rebuildOwnership(history);
console.log("Current owner:", current.owner, "| area:", current.area);

// Time-travel — rebuild state at any point
var atEvent2 = rebuildOwnership(history.slice(0, 2));
console.log("Owner at event 2:", atEvent2.owner);

// ────────────────────────────────────────────────────────────
// BLOCK 2 — CQRS (Separate Read and Write)
// ────────────────────────────────────────────────────────────
// Commands change state. Queries read state. Separating them
// lets you optimize each side independently.

class CommandHandler {
  constructor(eventLog) {
    this.store = eventLog;
  }

  handle(command) {
    if (command.type === "ADD_PLOT") {
      return this.store.append({
        plotId: command.plotId,
        type: "PLOT_ADDED",
        owner: command.owner,
        area: command.area,
        value: command.value
      });
    }

    if (command.type === "TRANSFER_PLOT") {
      return this.store.append({
        plotId: command.plotId,
        type: "PLOT_TRANSFERRED",
        newOwner: command.newOwner
      });
    }

    throw new Error("Unknown command: " + command.type);
  }
}

// Read model — fast lookups, no business logic
class ReadProjection {
  constructor() {
    this.data = {};
  }

  apply(event) {
    var id = event.plotId;
    if (!this.data[id]) {
      this.data[id] = { plots: [], totalValue: 0 };
    }

    var ledger = this.data[id];

    if (event.type === "PLOT_ADDED") {
      ledger.plots.push({ owner: event.owner, area: event.area });
      ledger.totalValue = ledger.totalValue + event.value;
    } else if (event.type === "PLOT_TRANSFERRED") {
      var last = ledger.plots[ledger.plots.length - 1];
      if (last) {
        last.owner = event.newOwner;
      }
    }
  }

  getLedger(id) {
    return this.data[id];
  }
}

console.log("\n=== CQRS ===");

var landLog = new EventLog();
var cmdHandler = new CommandHandler(landLog);
var projection = new ReadProjection();

var e1 = cmdHandler.handle({ type: "ADD_PLOT", plotId: "V1", owner: "Sukhdev", area: 5, value: 500000 });
var e2 = cmdHandler.handle({ type: "ADD_PLOT", plotId: "V1", owner: "Baldev", area: 3, value: 300000 });
var e3 = cmdHandler.handle({ type: "TRANSFER_PLOT", plotId: "V1", newOwner: "Gurpreet" });

projection.apply(e1);
projection.apply(e2);
projection.apply(e3);

var ledger = projection.getLedger("V1");
console.log("Plots:", ledger.plots.length, "| Total:", ledger.totalValue);

// Full audit trail
var trail = landLog.getByPlotId("V1");
var types = [];
for (var i = 0; i < trail.length; i++) {
  types.push(trail[i].type);
}
console.log("Event trail:", types.join(" -> "));

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Event Sourcing stores immutable events — state is rebuilt by replay.
// 2. Time-travel: rebuild ownership at any point by replaying a prefix.
// 3. CQRS separates writes (commands) from reads (projections).
// 4. Read projections are denormalized views for fast queries.
// 5. Together: audit trails, replay, and scalable read/write separation.
