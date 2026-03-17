/**
 * ============================================================
 *  FILE 38 : MatchDay Event System (Mini Project)
 *  Patterns used: Observer, Pub/Sub, Middleware, Command
 *  WHERE YOU SEE THIS: React event systems, Node EventEmitter,
 *    Redux middleware, game engines
 * ============================================================
 */

// STORY: On IPL match day, every ball bowled passes through Hotstar
// inspection (middleware), can be reviewed via DRS (undo), and
// coordinates batsman, bowler, and scorer.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Event Bus with Middleware
// ────────────────────────────────────────────────────────────

class EventBus {
  constructor() {
    this.listeners = {};
    this.middlewares = [];
    this.history = [];
  }

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  off(event, fn) {
    var list = this.listeners[event];
    if (!list) return;
    this.listeners[event] = list.filter(function(f) { return f !== fn; });
  }

  use(middlewareFn) {
    this.middlewares.push(middlewareFn);
  }

  emit(event, data) {
    var ctx = { event: event, data: data, cancelled: false };

    // Run through middleware — any can block the event
    for (var i = 0; i < this.middlewares.length; i++) {
      this.middlewares[i](ctx);
      if (ctx.cancelled) return ctx;
    }

    this.history.push({ event: event, data: ctx.data });
    this._dispatch(event, ctx.data);

    // Wildcard: "match:*" catches "match:ball", "match:wicket"
    var keys = Object.keys(this.listeners);
    for (var k = 0; k < keys.length; k++) {
      var pattern = keys[k];
      if (pattern.indexOf(":*") === pattern.length - 2) {
        var prefix = pattern.slice(0, pattern.length - 1);
        if (event.indexOf(prefix) === 0 && event !== pattern) {
          this._dispatch(pattern, ctx.data);
        }
      }
    }

    return ctx;
  }

  _dispatch(key, data) {
    var list = this.listeners[key] || [];
    for (var i = 0; i < list.length; i++) {
      list[i](data);
    }
  }
}

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Command with Undo/Redo (DRS)
// ────────────────────────────────────────────────────────────

class CommandScheduler {
  constructor(bus) {
    this.bus = bus;
    this.executed = [];
    this.undone = [];
  }

  run(command) {
    var result = command.execute();
    this.executed.push(command);
    this.undone = [];
    this.bus.emit("command:executed", { name: command.name, result: result });
    return result;
  }

  undo() {
    var cmd = this.executed.pop();
    if (!cmd) return null;
    var result = cmd.undo();
    this.undone.push(cmd);
    return result;
  }

  redo() {
    var cmd = this.undone.pop();
    if (!cmd) return null;
    var result = cmd.execute();
    this.executed.push(cmd);
    return result;
  }
}

// ────────────────────────────────────────────────────────────
// DEMO — Everything working together
// ────────────────────────────────────────────────────────────

console.log("=== MatchDay Event System ===\n");

var bus = new EventBus();

// Middleware: block tampering events
bus.use(function(ctx) {
  if (ctx.event.indexOf("tampering") !== -1) {
    ctx.cancelled = true;
  }
});

// Wildcard subscription
var matchLog = [];
bus.on("match:*", function(data) {
  matchLog.push("wildcard: " + JSON.stringify(data));
});

bus.on("match:ball", function(data) {
  matchLog.push("ball: " + data.runs + " runs");
});

bus.emit("match:ball", { runs: 4 });
bus.emit("match:wicket", { batsman: "Kohli" });
console.log(matchLog.join(" | "));

// Middleware blocks tampering
var tamperResult = bus.emit("match:tampering", { action: "ball-scuffing" });
console.log("Tampering blocked:", tamperResult.cancelled);

// Command pattern with undo/redo (DRS)
console.log("\n--- DRS Command System ---");
var scheduler = new CommandScheduler(bus);
var runs = 0;

var boundaryCmd = {
  name: "boundary",
  execute: function() { runs = runs + 4; return runs; },
  undo: function() { runs = runs - 4; return runs; }
};

scheduler.run(boundaryCmd);
console.log("After boundary:", runs);

scheduler.undo();
console.log("DRS undo:", runs);

scheduler.redo();
console.log("Redo:", runs);

console.log("Event history count:", bus.history.length);

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Event bus with namespaces prevents naming collisions.
// 2. Wildcard subscriptions ("match:*") catch entire categories.
// 3. Middleware intercepts events before delivery.
// 4. Command pattern wraps actions with execute() and undo().
// 5. Modules coordinate through the bus — never import each other.
