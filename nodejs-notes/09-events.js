/** ============================================================
 FILE 9: The Event System — Node's Backbone
 ============================================================
 Topic: EventEmitter — on, emit, once, off, error, custom classes
 ============================================================ */

// ============================================================
// STORY: Radio Mirchi 98.3 FM — DJs broadcast, listeners tune
// in on shows, and a breaking news channel must never be ignored.
// ============================================================

const EventEmitter = require("events");

// ============================================================
// EXAMPLE BLOCK 1 — EventEmitter Basics
// ============================================================

console.log("=== BLOCK 1: EventEmitter Basics ===\n");

// ──────────────────────────────────────────────────────────────
// SECTION 1 — on() and emit()
// ──────────────────────────────────────────────────────────────

const mirchi = new EventEmitter();

mirchi.on("song", (title, artist) => {
  console.log(`  Now playing: "${title}" by ${artist}`);
});

mirchi.emit("song", "Chaiyya Chaiyya", "A.R. Rahman");

// ──────────────────────────────────────────────────────────────
// SECTION 2 — once() fires only one time
// ──────────────────────────────────────────────────────────────
// Perfect for one-time setup: 'ready', 'connected', etc.

console.log("\n--- .once() demo ---");
const newsDesk = new EventEmitter();

newsDesk.once("breaking-news", (headline) => {
  console.log(`  BREAKING: ${headline}`);
});

newsDesk.emit("breaking-news", "Chandrayaan-4 launched!");
newsDesk.emit("breaking-news", "This will NOT print");
console.log("  Second emit produced no output (as expected)");

// ──────────────────────────────────────────────────────────────
// SECTION 3 — off() / removeListener
// ──────────────────────────────────────────────────────────────
// Must pass the exact same function reference.

console.log("\n--- .off() demo ---");
const fm983 = new EventEmitter();

function weatherReport(temp) {
  console.log(`  Weather: ${temp} C`);
}

fm983.on("weather", weatherReport);
fm983.emit("weather", 38);
fm983.off("weather", weatherReport);
fm983.emit("weather", 42);
console.log("  After .off(), second emit produced no output");

// ──────────────────────────────────────────────────────────────
// SECTION 4 — listenerCount and eventNames
// ──────────────────────────────────────────────────────────────

console.log("\n--- Introspection ---");
const dashboard = new EventEmitter();
dashboard.on("click", () => {});
dashboard.on("click", () => {});
dashboard.on("hover", () => {});
console.log("  listenerCount('click'):", dashboard.listenerCount("click")); // 2
console.log("  eventNames():", dashboard.eventNames());

// ============================================================
// EXAMPLE BLOCK 2 — Error Events and Listener Management
// ============================================================

console.log("\n=== BLOCK 2: Error Events & Listener Management ===\n");

// ──────────────────────────────────────────────────────────────
// SECTION 1 — The special 'error' event
// ──────────────────────────────────────────────────────────────
// Unhandled 'error' events crash the process. Always handle them.

try {
  new EventEmitter().emit("error", new Error("Antenna disconnected!"));
} catch (err) {
  console.log("  Unhandled error caught:", err.message);
}

const safeMirchi = new EventEmitter();
safeMirchi.on("error", (err) => {
  console.log("  [Error Handler]", err.message);
});
safeMirchi.emit("error", new Error("Signal lost on 98.3 MHz"));

// ──────────────────────────────────────────────────────────────
// SECTION 2 — prependListener and setMaxListeners
// ──────────────────────────────────────────────────────────────

console.log("\n--- prependListener ---");
const broadcast = new EventEmitter();
broadcast.on("signal", () => console.log("  Listener A (added first)"));
broadcast.prependListener("signal", () => console.log("  Listener B (prepended — runs first!)"));
broadcast.emit("signal");

const crowded = new EventEmitter();
crowded.setMaxListeners(20);
console.log("\n  Max listeners set to:", crowded.getMaxListeners());

// ============================================================
// EXAMPLE BLOCK 3 — Custom Class Extending EventEmitter
// ============================================================

console.log("\n=== BLOCK 3: Custom Class Extending EventEmitter ===\n");

// ──────────────────────────────────────────────────────────────
// SECTION 1 — MirchiStation class
// ──────────────────────────────────────────────────────────────
// This is how Node core works — streams, HTTP, sockets all extend EventEmitter.

class MirchiStation extends EventEmitter {
  constructor(name, frequency) {
    super();
    this.name = name;
    this.frequency = frequency;
    this.isLive = false;
  }

  goLive() {
    this.isLive = true;
    this.emit("live", this.name, this.frequency);
  }

  broadcast(message) {
    if (!this.isLive) {
      this.emit("error", new Error(`${this.name} is not live yet!`));
      return;
    }
    this.emit("broadcast", { station: this.name, message });
  }

  signOff() {
    this.isLive = false;
    this.emit("off-air", this.name);
    this.removeAllListeners();
  }
}

const radio = new MirchiStation("Radio Mirchi", "98.3 MHz");
radio.on("error", (err) => console.log(`  [Error] ${err.message}`));
radio.on("live", (name, freq) => console.log(`  ${name} is LIVE on ${freq}!`));
radio.on("off-air", (name) => console.log(`  ${name} signed off.`));
radio.on("broadcast", (data) => console.log(`  [Listener] ${data.message}`));

radio.broadcast("Test"); // Error — not live yet
radio.goLive();
radio.broadcast("Suniye Chaiyya Chaiyya!");

console.log("  Events before signOff:", radio.eventNames());
radio.signOff();
console.log("  Events after signOff:", radio.eventNames()); // []

// ──────────────────────────────────────────────────────────────
// SECTION 2 — Async pattern: events.once()
// ──────────────────────────────────────────────────────────────

const { once } = require("events");

async function waitForSignal() {
  const emitter = new EventEmitter();
  setTimeout(() => emitter.emit("ready", "all systems go"), 50);
  const [message] = await once(emitter, "ready");
  console.log(`\n  Async once() received: ${message}`);
}

waitForSignal().then(() => {
  // ============================================================
  // KEY TAKEAWAYS
  // ============================================================
  // 1. .on() listens persistently, .emit() fires with arguments.
  // 2. .once() auto-removes after one call — great for init events.
  // 3. .off() needs the same function reference to remove.
  // 4. Always handle 'error' events or the process crashes.
  // 5. prependListener() jumps ahead in the listener queue.
  // 6. Extend EventEmitter for custom classes — the Node.js pattern.
  // 7. events.once() returns a Promise for async/await usage.
  // ============================================================
  console.log("");
});
