/**
 * ============================================================
 *  FILE 36 : Registry & Lazy Loading
 *  WHERE YOU SEE THIS: React.lazy(), dynamic import(),
 *    service containers, route-based code splitting
 * ============================================================
 */

// STORY: Harbor Master Meenakshi manages Chennai Port. She registers
// every vessel that docks, and dispatches crane operators only when
// cargo actually arrives — not before.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Registry Pattern
// ────────────────────────────────────────────────────────────
// One central place to register and look up things by name.

class VesselRegistry {
  constructor() {
    this.vessels = {};
  }

  register(name, info) {
    if (this.vessels[name]) {
      throw new Error("Already docked: " + name);
    }
    this.vessels[name] = info;
  }

  get(name) {
    if (!this.vessels[name]) {
      throw new Error("Not found: " + name);
    }
    return this.vessels[name];
  }

  has(name) {
    return this.vessels[name] !== undefined;
  }

  listAll() {
    return Object.keys(this.vessels);
  }
}

console.log("=== Registry Pattern ===");
var port = new VesselRegistry();
port.register("MV Chennai Express", { type: "container", capacity: 5000 });
port.register("INS Vikrant", { type: "naval", capacity: 1200 });

console.log("Lookup:", port.get("MV Chennai Express").type);
console.log("All docked:", port.listAll().join(", "));

try {
  port.register("MV Chennai Express", { type: "bulk" });
} catch (e) {
  console.log("Duplicate error:", e.message);
}

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Service Registry with Tags
// ────────────────────────────────────────────────────────────
// Tags let you query by capability — "give me all dock workers"

class ServiceRegistry {
  constructor() {
    this.services = {};
    this.tags = {};
    this.instances = {};
  }

  register(name, factory, tagList) {
    this.services[name] = factory;

    tagList = tagList || [];
    for (var i = 0; i < tagList.length; i++) {
      var tag = tagList[i];
      if (!this.tags[tag]) this.tags[tag] = [];
      this.tags[tag].push(name);
    }
  }

  // Lazy singleton — factory runs only on first call
  resolve(name) {
    if (!this.services[name]) {
      throw new Error("Service not found: " + name);
    }
    if (!this.instances[name]) {
      this.instances[name] = this.services[name]();
    }
    return this.instances[name];
  }

  findByTag(tag) {
    var names = this.tags[tag] || [];
    var results = [];
    for (var i = 0; i < names.length; i++) {
      results.push({ name: names[i], service: this.resolve(names[i]) });
    }
    return results;
  }
}

console.log("\n=== Service Registry with Tags ===");
var services = new ServiceRegistry();

services.register("crane", function() { return { operate: function() { return "Lifting containers"; } }; }, ["dock", "heavy"]);
services.register("stevedore", function() { return { inspect: function() { return "Checking manifest"; } }; }, ["dock"]);

console.log("Crane:", services.resolve("crane").operate());

var dockCrew = services.findByTag("dock");
var names = [];
for (var i = 0; i < dockCrew.length; i++) {
  names.push(dockCrew[i].name);
}
console.log("Dock crew:", names.join(", "));

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Lazy Loading
// ────────────────────────────────────────────────────────────
// Load modules only when needed. Users who never visit a route
// never pay the cost of loading that module.

var moduleStore = {
  tracking: function() { return { render: function(data) { return "Tracker with " + data.length + " ships"; } }; },
  manifest: function() { return { generate: function(title) { return "Manifest: " + title; } }; }
};

function loadModule(name) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      var factory = moduleStore[name];
      if (factory) {
        resolve(factory());
      } else {
        reject(new Error("Module not found: " + name));
      }
    }, 10);
  });
}

class LazyRouter {
  constructor() {
    this.routes = {};
    this.cache = {};
  }

  addRoute(path, loaderFn) {
    this.routes[path] = loaderFn;
  }

  async navigate(path) {
    if (this.cache[path]) {
      return { module: this.cache[path], cached: true };
    }

    var loader = this.routes[path];
    if (!loader) throw new Error("No route: " + path);

    var mod = await loader();
    this.cache[path] = mod;
    return { module: mod, cached: false };
  }
}

async function demo() {
  console.log("\n=== Lazy Loading ===");
  var router = new LazyRouter();
  router.addRoute("/tracking", function() { return loadModule("tracking"); });
  router.addRoute("/manifest", function() { return loadModule("manifest"); });

  var r1 = await router.navigate("/manifest");
  console.log("First load:", r1.module.generate("Chennai Report"), "| cached:", r1.cached);

  var r2 = await router.navigate("/manifest");
  console.log("Second load cached:", r2.cached);
}

demo();

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Registry = central lookup. Register once, resolve anywhere.
// 2. Tags let you query by capability, not exact name.
// 3. Lazy singletons defer expensive work until first use.
// 4. Route-based lazy loading + caching keeps apps fast.
