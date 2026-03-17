/**
 * ============================================================
 *  FILE 16 : Publish-Subscribe Pattern
 *  Topic   : Pub/Sub, Event Bus, Message Broker
 *  Impact  : Redis pub/sub, Kafka topics, Redux actions,
 *            Socket.io rooms, AWS SNS/SQS
 * ============================================================
 */

// STORY: Postmaster Lakshmi runs the local India Post office.
// Residents subscribe to dak categories (speed post, money order).
// Senders and receivers never meet — the post office routes everything.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Pub/Sub vs Observer (decoupled via broker)
// ────────────────────────────────────────────────────────────

console.log("=== BLOCK 1: Pub/Sub vs Observer ===");

// Observer (for contrast): subject holds direct references
class WeatherStation {
  constructor() {
    this.observers = [];
  }
  addObserver(obs) {
    this.observers.push(obs);
  }
  notify(temp) {
    for (let i = 0; i < this.observers.length; i++) {
      this.observers[i].update(temp);
    }
  }
}

let station = new WeatherStation();
station.addObserver({
  update: function (t) { console.log("  Observer got temp: " + t + "C"); }
});
station.notify(42);

// Pub/Sub removes direct coupling via a broker (Lakshmi's post office)
class IndiaPostOffice {
  constructor() {
    this.topics = {};
  }

  subscribe(topic, callback) {
    if (!this.topics[topic]) {
      this.topics[topic] = [];
    }
    this.topics[topic].push(callback);
  }

  publish(topic, message) {
    if (!this.topics[topic]) return;
    for (let i = 0; i < this.topics[topic].length; i++) {
      this.topics[topic][i](message);
    }
  }

  unsubscribe(topic, callback) {
    if (!this.topics[topic]) return;
    let remaining = [];
    for (let i = 0; i < this.topics[topic].length; i++) {
      if (this.topics[topic][i] !== callback) {
        remaining.push(this.topics[topic][i]);
      }
    }
    this.topics[topic] = remaining;
  }
}

let post = new IndiaPostOffice();

let sureshHandler = function (msg) { console.log("  Suresh received: " + msg); };
let meenaHandler = function (msg) { console.log("  Meena received: " + msg); };
let kavithaHandler = function (msg) { console.log("  Kavitha received: " + msg); };

post.subscribe("speed-post", sureshHandler);
post.subscribe("speed-post", meenaHandler);
post.subscribe("money-order", kavithaHandler);

console.log("Lakshmi delivers speed post:");
post.publish("speed-post", "Parcel from Chennai");

console.log("Lakshmi delivers money order:");
post.publish("money-order", "Rs.5000 from Varanasi");

post.unsubscribe("speed-post", sureshHandler);
console.log("After Suresh unsubscribes:");
post.publish("speed-post", "Letter from Mumbai");

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Event Bus (singleton Pub/Sub for decoupled modules)
// ────────────────────────────────────────────────────────────

console.log("\n=== BLOCK 2: Event Bus ===");

class CentralSortingOffice {
  constructor() {
    this.topics = {};
    this.idCounter = 0;
  }

  subscribe(topic, callback) {
    if (!this.topics[topic]) {
      this.topics[topic] = {};
    }
    this.idCounter = this.idCounter + 1;
    let id = this.idCounter;
    this.topics[topic][id] = callback;
    return id;
  }

  publish(topic, data) {
    if (!this.topics[topic]) return;
    let callbacks = Object.values(this.topics[topic]);
    for (let i = 0; i < callbacks.length; i++) {
      callbacks[i](data);
    }
  }

  unsubscribe(topic, id) {
    if (this.topics[topic] && this.topics[topic][id]) {
      delete this.topics[topic][id];
      return true;
    }
    return false;
  }
}

let bus = new CentralSortingOffice();

let dashId = bus.subscribe("postmaster:login", function (user) {
  console.log("  Dashboard: Welcome back, " + user.username + "!");
});

bus.subscribe("postmaster:login", function (user) {
  console.log("  Analytics: Tracked login for " + user.username);
});

console.log("Auth module fires login event:");
bus.publish("postmaster:login", { username: "Lakshmi" });

bus.unsubscribe("postmaster:login", dashId);
console.log("After dashboard unsubscribes:");
bus.publish("postmaster:login", { username: "Lakshmi" });

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Pub/Sub decouples via a broker — senders and receivers never reference each other.
// 2. Event Bus is a singleton Pub/Sub shared across modules.
// 3. Namespaced topics (dak:delivered) organize events hierarchically.
// 4. Return an ID from subscribe for easy unsubscribe without keeping function references.
