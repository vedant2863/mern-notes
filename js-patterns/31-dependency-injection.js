/**
 * ============================================================
 *  FILE 31 : Dependency Injection & Inversion of Control
 *  WHERE YOU SEE THIS: Express route handlers, React context,
 *    NestJS services, any app with testable architecture
 * ============================================================
 */

// STORY: Urban Planner Sharma designs Naya Raipur. Buildings never
// create their own water or electricity — Sharma injects municipal
// utilities from outside.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Constructor Injection
// ────────────────────────────────────────────────────────────

class JalBoard {
  getWater() {
    return "filtered Jal Board water";
  }
}

class CSPDCL {
  getPower() {
    return "220V CSPDCL power";
  }
}

// Building does NOT create its own services — they come from outside
class Building {
  constructor(water, electric) {
    this.water = water;
    this.electric = electric;
  }

  status() {
    var w = this.water.getWater();
    var e = this.electric.getPower();
    return "Building gets: " + w + " & " + e;
  }
}

var office = new Building(new JalBoard(), new CSPDCL());
console.log(office.status());

// For testing — inject fake services, no real infrastructure needed
var testBuilding = new Building(
  { getWater: function() { return "mock tanker water"; } },
  { getPower: function() { return "mock 5V"; } }
);
console.log(testBuilding.status());

// ────────────────────────────────────────────────────────────
// BLOCK 2 — DI Container (Register / Resolve)
// ────────────────────────────────────────────────────────────

class Container {
  constructor() {
    this.services = {};
    this.singletons = {};
  }

  register(name, factory, isSingleton) {
    this.services[name] = {
      factory: factory,
      singleton: isSingleton || false
    };
  }

  resolve(name) {
    var entry = this.services[name];
    if (!entry) {
      throw new Error("Service not found: " + name);
    }

    if (entry.singleton) {
      if (!this.singletons[name]) {
        this.singletons[name] = entry.factory(this);
      }
      return this.singletons[name];
    }

    return entry.factory(this);
  }
}

var container = new Container();
var count = 0;

container.register("water", function() { return new JalBoard(); }, true);
container.register("electric", function() { return new CSPDCL(); }, true);
container.register("internet", function() { count++; return { id: count }; }, false);
container.register("building", function(c) {
  return new Building(c.resolve("water"), c.resolve("electric"));
});

console.log(container.resolve("building").status());

// Singleton returns same object every time
var w1 = container.resolve("water");
var w2 = container.resolve("water");
console.log("Same instance?", w1 === w2);

// Transient creates new object every time
var n1 = container.resolve("internet");
var n2 = container.resolve("internet");
console.log("Different ids:", n1.id, n2.id);

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Service Locator vs DI
// ────────────────────────────────────────────────────────────

// Service Locator — dependency is hidden inside the function
function handleWithLocator(locator, reqId) {
  var db = locator.get("db");
  return db.find(reqId);
}

// DI approach — dependencies are visible in the function signature
function createHandler(logger, db) {
  return function handle(req) {
    var record = db.find(req.id);
    logger.log(record.name);
    return { status: 200, body: record };
  };
}

var fakeLogger = { log: function(msg) { console.log("LOG:", msg); } };
var fakeDb = {
  find: function(id) { return { id: id, name: "Sector-" + id + "-Tower" }; }
};

var handler = createHandler(fakeLogger, fakeDb);
handler({ id: 7 });

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Constructor Injection makes dependencies visible and testable.
// 2. DI Container automates wiring — singleton vs transient controls lifetime.
// 3. Service Locator hides deps — prefer DI for clarity.
// 4. In Express, inject services into handler factories.
// 5. Inversion of Control = the framework calls YOU.
