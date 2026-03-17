/**
 * ============================================================
 *  FILE 15 : The Observer Pattern
 *  Topic   : Observer, Event Emitter
 *  Impact  : DOM addEventListener, Node.js EventEmitter,
 *            React useEffect subscriptions, RxJS observables
 * ============================================================
 */

// STORY: Govind is the Nukkad Chaiwala. He shouts "Chai ready!"
// and all subscribed regulars come running. Anyone can unsubscribe
// at any time — Govind never needs to know who they are in advance.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Classic Observer (subscribe / unsubscribe / notify)
// ────────────────────────────────────────────────────────────

class NukkadChaiwala {
  constructor(name) {
    this.name = name;
    this.subscribers = [];
  }

  subscribe(fn) {
    this.subscribers.push(fn);
  }

  unsubscribe(fn) {
    let remaining = [];
    for (let i = 0; i < this.subscribers.length; i++) {
      if (this.subscribers[i] !== fn) {
        remaining.push(this.subscribers[i]);
      }
    }
    this.subscribers = remaining;
  }

  notify(message) {
    for (let i = 0; i < this.subscribers.length; i++) {
      this.subscribers[i](message);
    }
  }
}

console.log("=== BLOCK 1: Classic Observer ===");
let govind = new NukkadChaiwala("Govind");

let shopkeeper = function (msg) { console.log("Shopkeeper heard: " + msg); };
let autoDriver = function (msg) { console.log("Auto Driver heard: " + msg); };
let watchman = function (msg) { console.log("Watchman heard: " + msg); };

govind.subscribe(shopkeeper);
govind.subscribe(autoDriver);
govind.subscribe(watchman);

govind.notify("Masala chai ready!");

govind.unsubscribe(autoDriver);
govind.notify("Cutting chai ready!");
console.log("Active subscribers: " + govind.subscribers.length);

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Node.js EventEmitter Pattern
// ────────────────────────────────────────────────────────────

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (!this.events[event]) return this;
    let remaining = [];
    for (let i = 0; i < this.events[event].length; i++) {
      if (this.events[event][i] !== listener) {
        remaining.push(this.events[event][i]);
      }
    }
    this.events[event] = remaining;
    return this;
  }

  // once wraps the listener so it auto-removes after first call
  once(event, listener) {
    let self = this;
    function wrapper() {
      listener.apply(null, arguments);
      self.off(event, wrapper);
    }
    return this.on(event, wrapper);
  }

  emit(event, data) {
    if (!this.events[event]) return false;
    for (let i = 0; i < this.events[event].length; i++) {
      this.events[event][i](data);
    }
    return true;
  }
}

console.log("\n=== BLOCK 2: EventEmitter Pattern ===");
let tapri = new EventEmitter();

tapri.on("chai:ready", function (type) {
  console.log("Shopkeeper: " + type);
});

tapri.once("special:offer", function (msg) {
  console.log("Watchman (once): " + msg);
});

tapri.emit("chai:ready", "Adrak wali chai brewing");
tapri.emit("special:offer", "Bun maska at half price!");
tapri.emit("special:offer", "Another offer!");
// No output for second special:offer — once listener removed itself

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Observer = one-to-many: subject changes, all observers get notified.
// 2. EventEmitter (on/off/emit/once) is Node's flavor of Observer.
// 3. DOM addEventListener is the same pattern in the browser.
// 4. An Event Bus (global EventEmitter) decouples modules completely.
