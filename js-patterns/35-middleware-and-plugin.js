/**
 * ============================================================
 *  FILE 35 : Middleware, Plugin & Hook System
 *  WHERE YOU SEE THIS: Express app.use(), Webpack plugins,
 *    WordPress hooks, Babel plugins, VS Code extensions
 * ============================================================
 */

// STORY: Station Master Pandey configures Mughalsarai junction with
// signal cabins (middleware), optional coaches (plugins), and
// departure/arrival hooks.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Middleware Pipeline
// ────────────────────────────────────────────────────────────
// A chain of functions. Each can transform the request,
// short-circuit, or pass to the next. This is how Express works.

class Pipeline {
  constructor() {
    this.stack = [];
  }

  use(fn) {
    this.stack.push(fn);
  }

  run(req, res) {
    var index = 0;
    var stack = this.stack;

    function next() {
      if (index < stack.length) {
        var fn = stack[index];
        index++;
        fn(req, res, next);
      }
    }

    next();
  }
}

console.log("=== Middleware Pipeline ===");
var junction = new Pipeline();

junction.use(function(req, res, next) {
  req.trackClear = true;
  console.log("  [Cabin 1] Track clear");
  next();
});

junction.use(function(req, res, next) {
  req.pointsSet = true;
  console.log("  [Cabin 2] Points set: platform 3");
  next();
});

junction.use(function(req, res, next) {
  res.body = req.trainName + " cleared";
  console.log("  [Signal Green]", res.body);
});

junction.run({ trainName: "Rajdhani Express" }, {});

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Plugin Architecture
// ────────────────────────────────────────────────────────────
// Plugins extend your app through a controlled API.
// The host defines what plugins can do — they cannot access internals.

class PluginHost {
  constructor(name) {
    this.name = name;
    this.plugins = [];
    this.capabilities = {};
  }

  register(plugin) {
    var self = this;
    var api = {
      hostName: self.name,
      addCapability: function(name, fn) {
        self.capabilities[name] = fn;
      }
    };
    plugin.install(api);
    this.plugins.push(plugin.name);
  }

  run(capabilityName, arg1, arg2) {
    var fn = this.capabilities[capabilityName];
    if (!fn) return "No capability: " + capabilityName;
    return fn(arg1, arg2);
  }
}

console.log("\n=== Plugin Architecture ===");
var station = new PluginHost("Mughalsarai Junction");

station.register({
  name: "PantryCar",
  install: function(api) {
    api.addCapability("serveMeal", function(train, meal) {
      return "[" + api.hostName + "] Pantry: " + meal + " on " + train;
    });
  }
});

station.register({
  name: "ACFirstClass",
  install: function(api) {
    api.addCapability("upgrade", function(passenger) {
      return "[AC 1A] " + passenger + " upgraded";
    });
  }
});

console.log("Plugins:", station.plugins.join(", "));
console.log(station.run("serveMeal", "Rajdhani Express", "Veg Thali"));

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Hook System (Actions & Filters)
// ────────────────────────────────────────────────────────────
// Actions = side effects. Filters = transform values through a chain.

class HookSystem {
  constructor() {
    this.actions = {};
    this.filters = {};
  }

  addAction(name, fn) {
    if (!this.actions[name]) this.actions[name] = [];
    this.actions[name].push(fn);
  }

  doAction(name, data) {
    var list = this.actions[name] || [];
    for (var i = 0; i < list.length; i++) {
      list[i](data);
    }
  }

  addFilter(name, fn) {
    if (!this.filters[name]) this.filters[name] = [];
    this.filters[name].push(fn);
  }

  applyFilters(name, value) {
    var list = this.filters[name] || [];
    var result = value;
    for (var i = 0; i < list.length; i++) {
      result = list[i](result);
    }
    return result;
  }
}

console.log("\n=== Hook System ===");
var hooks = new HookSystem();

hooks.addAction("train:arrive", function(train) {
  console.log("  Action: " + train + " arrived");
});
hooks.addAction("train:arrive", function(train) {
  console.log("  Action: chai-wala dispatched for " + train);
});

hooks.doAction("train:arrive", "Shatabdi Express");

// Filter hooks transform a value step by step
hooks.addFilter("fare:adjust", function(price) { return price * 0.9; });
hooks.addFilter("fare:adjust", function(price) { return price + 50; });
hooks.addFilter("fare:adjust", function(price) { return Math.round(price); });

console.log("Final fare:", hooks.applyFilters("fare:adjust", 2000));

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Middleware composes processing steps — Express next().
// 2. Plugins extend apps through a controlled API surface.
// 3. Action hooks fire side effects, filter hooks transform values.
// 4. These patterns power Express, Webpack, WordPress, and VS Code.
