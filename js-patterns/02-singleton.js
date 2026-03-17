/**
 * ============================================================
 *  FILE 2 : Rajdhani Station Master Clock — Singleton Pattern
 *  Topic  : Singleton, Lazy Singleton, Pitfalls
 *  Where you'll see this: DB connections, Redux store, app config
 * ============================================================
 */

// STORY: Station Master Verma ensures there is only ONE master
// clock at Mughalsarai Junction. Every platform reads the same time.

console.log("=== FILE 02: Rajdhani Station Master Clock ===\n");

// ────────────────────────────────────
// BLOCK 1 — Simple Object Singleton
// ────────────────────────────────────

const StationClock = {
  hour: 12,
  minute: 0,

  tick() {
    this.minute++;
    if (this.minute >= 60) {
      this.minute = 0;
      this.hour = (this.hour % 12) + 1;
    }
  },

  time() {
    const h = String(this.hour).padStart(2, "0");
    const m = String(this.minute).padStart(2, "0");
    return h + ":" + m;
  },
};

console.log("Verma checks:", StationClock.time());
StationClock.tick();
StationClock.tick();
console.log("After 2 ticks:", StationClock.time());

// Both references point to the same object
const platform1 = StationClock;
const platform2 = StationClock;
console.log("Same instance?", platform1 === platform2); // true

// ────────────────────────────────────
// BLOCK 2 — Class-Based Lazy Singleton
// ────────────────────────────────────

// Created only when first requested — like the announcement
// system activating when the first train arrives.

console.log("\n--- Class-Based Lazy Singleton ---");

class AnnouncementSystem {
  constructor(volume) {
    this.volume = volume;
    this.armed = false;
  }

  arm() {
    this.armed = true;
    return "Announcement system armed at volume " + this.volume;
  }

  static getInstance() {
    if (!AnnouncementSystem._instance) {
      AnnouncementSystem._instance = new AnnouncementSystem(11);
      console.log("Verma activates the announcement system");
    }
    return AnnouncementSystem._instance;
  }
}
AnnouncementSystem._instance = null;

const announce1 = AnnouncementSystem.getInstance();
console.log(announce1.arm());
const announce2 = AnnouncementSystem.getInstance(); // no message — already exists
console.log("Same system?", announce1 === announce2); // true

// ────────────────────────────────────
// BLOCK 3 — Pitfalls & Frozen Config Singleton
// ────────────────────────────────────

console.log("\n--- Singleton Pitfalls ---");

const globalLogger = { entries: [], log(msg) { this.entries.push(msg); } };

function processTrainArrival(train) {
  // globalLogger is a hidden dependency — not visible in the function signature
  globalLogger.log("Processing " + train);
  return "Arrival: " + train;
}

console.log(processTrainArrival("Rajdhani Express"));
console.log("Hidden log:", globalLogger.entries);

// The idiomatic JS singleton — a frozen object
console.log("\n--- Frozen Config Singleton ---");

const StationConfig = Object.freeze({
  platforms: 8,
  tracks: 12,
  junction: "Mughalsarai",
});

StationConfig.platforms = 999; // silently fails
console.log("Still 8?", StationConfig.platforms); // 8

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Simplest singleton: a plain object — one instance by default.
// 2. Class singletons use a static getInstance() for lazy creation.
// 3. Pitfall: hidden dependencies make testing hard.
// 4. Object.freeze locks a config singleton so nobody mutates it.

console.log("\n=== Verma locks the cabin. The station clock keeps ticking. ===");
