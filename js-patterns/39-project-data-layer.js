/**
 * ============================================================
 *  FILE 39 : Aadhaar Data Layer (Mini Project)
 *  Patterns used: Repository, Factory, Strategy, Proxy/Cache
 *  WHERE YOU SEE THIS: Any backend with database abstraction,
 *    ORMs like Prisma/Sequelize, caching layers
 * ============================================================
 */

// STORY: The UIDAI maintains citizen records. It stores data in any
// vault (Adapter), caches frequent lookups, and can swap encryption
// strategies without changing business code.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Storage Adapter
// ────────────────────────────────────────────────────────────
// Wraps different storage engines behind one interface.

class MemoryStore {
  constructor() {
    this.data = {};
  }

  async get(key) { return this.data[key] || null; }
  async set(key, value) { this.data[key] = value; }
  async remove(key) { delete this.data[key]; }
  async keys() { return Object.keys(this.data); }
}

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Encryption Strategy
// ────────────────────────────────────────────────────────────
// Swap how data is encoded without changing repo code.

var JsonStrategy = {
  name: "JSON",
  encode: function(obj) { return JSON.stringify(obj); },
  decode: function(str) { return JSON.parse(str); }
};

var Base64Strategy = {
  name: "Base64",
  encode: function(obj) {
    return Buffer.from(JSON.stringify(obj)).toString("base64");
  },
  decode: function(str) {
    return JSON.parse(Buffer.from(str, "base64").toString("utf-8"));
  }
};

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Caching Proxy
// ────────────────────────────────────────────────────────────

class CacheProxy {
  constructor(store) {
    this.store = store;
    this.cache = {};
    this.hits = 0;
    this.misses = 0;
  }

  async get(key) {
    if (this.cache[key] !== undefined) {
      this.hits++;
      return this.cache[key];
    }
    this.misses++;
    var value = await this.store.get(key);
    if (value !== null) this.cache[key] = value;
    return value;
  }

  async set(key, value) {
    await this.store.set(key, value);
    this.cache[key] = value;
  }

  async remove(key) {
    delete this.cache[key];
    await this.store.remove(key);
  }

  async keys() { return this.store.keys(); }

  stats() {
    return { hits: this.hits, misses: this.misses };
  }
}

// ────────────────────────────────────────────────────────────
// BLOCK 4 — Repository (ties everything together)
// ────────────────────────────────────────────────────────────

class CitizenRepo {
  constructor(store, strategy) {
    this.store = store;
    this.strategy = strategy || JsonStrategy;
    this.counter = 0;
  }

  async create(type, data) {
    this.counter++;
    var id = type + "_" + this.counter;
    var record = {
      id: id,
      type: type,
      name: data.name,
      state: data.state,
      age: data.age
    };
    await this.store.set(id, this.strategy.encode(record));
    return record;
  }

  async findById(id) {
    var raw = await this.store.get(id);
    if (!raw) return null;
    return this.strategy.decode(raw);
  }

  async findAll() {
    var allKeys = await this.store.keys();
    var results = [];
    for (var i = 0; i < allKeys.length; i++) {
      var raw = await this.store.get(allKeys[i]);
      if (raw) results.push(this.strategy.decode(raw));
    }
    return results;
  }
}

// ────────────────────────────────────────────────────────────
// DEMO — All patterns working together
// ────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Aadhaar Data Layer ===\n");

  var rawStore = new MemoryStore();
  var cachedStore = new CacheProxy(rawStore);
  var repo = new CitizenRepo(cachedStore, JsonStrategy);

  await repo.create("citizen", { name: "Amit Sharma", state: "Maharashtra", age: 34 });
  await repo.create("citizen", { name: "Priya Patel", state: "Gujarat", age: 28 });
  await repo.create("citizen", { name: "Deepa Nair", state: "Maharashtra", age: 52 });

  // Cache hits
  await repo.findById("citizen_1");
  await repo.findById("citizen_1");
  console.log("Cache stats:", cachedStore.stats());

  // Simple query — filter by state
  var all = await repo.findAll();
  var maharashtra = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].state === "Maharashtra") {
      maharashtra.push(all[i].name);
    }
  }
  console.log("Maharashtra:", maharashtra.join(", "));

  // Strategy swap — Base64 encoding
  var secureStore = new MemoryStore();
  var secureRepo = new CitizenRepo(secureStore, Base64Strategy);
  var bio = await secureRepo.create("biometric", { name: "iris-scan", state: "encrypted", age: 0 });

  var rawValue = await secureStore.get(bio.id);
  console.log("Base64 stored:", rawValue.slice(0, 30) + "...");

  var decoded = await secureRepo.findById(bio.id);
  console.log("Decoded name:", decoded.name);
}

main();

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Adapter wraps storage behind a uniform API — swap backends freely.
// 2. Strategy makes encoding pluggable — JSON, Base64, etc.
// 3. Cache Proxy intercepts reads and serves from memory.
// 4. Factory stamps every record with an ID and type.
// 5. Repository is the single doorway for all data operations.
