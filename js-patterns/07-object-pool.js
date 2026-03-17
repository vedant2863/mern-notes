/**
 * ============================================================
 *  FILE 7 : The Auto-Rickshaw Stand — Object Pool Pattern
 *  Topic  : Object Pool, Connection Pool
 *  Where you'll see this: DB connection pools, thread pools, game engines
 * ============================================================
 */

// STORY: Munna bhai manages the auto stand outside the railway station.
// Limited autos — grab one when available, return it when done.

console.log("=== FILE 07: The Auto-Rickshaw Stand ===\n");

// ────────────────────────────────────
// BLOCK 1 — Generic Object Pool
// ────────────────────────────────────

class AutoRickshaw {
  constructor(id) {
    this.id = id;
    this.passenger = null;
  }

  reset() {
    this.passenger = null;
  }

  use(name) {
    this.passenger = name;
    return "Auto " + this.id + " carrying " + name;
  }
}

class ObjectPool {
  constructor(factory, resetFn, initialSize) {
    this._resetFn = resetFn;
    this._available = [];
    this._inUse = new Set();

    // Create all objects upfront — pay the cost once
    for (let i = 0; i < initialSize; i++) {
      this._available.push(factory(i + 1));
    }
  }

  acquire() {
    if (this._available.length === 0) return null;
    const obj = this._available.pop();
    this._inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!this._inUse.has(obj)) {
      throw new Error("Object not from this pool");
    }
    this._resetFn(obj);
    this._inUse.delete(obj);
    this._available.push(obj);
  }

  status() {
    return "Available: " + this._available.length + ", In use: " + this._inUse.size;
  }
}

console.log("--- Block 1: Generic Object Pool ---");
console.log("Munna bhai opens the stand with 3 rickshaws.\n");

function createAuto(id) { return new AutoRickshaw(id); }
function resetAuto(auto) { auto.reset(); }

const pool = new ObjectPool(createAuto, resetAuto, 3);
console.log("Start:", pool.status());

const a1 = pool.acquire();
console.log(a1.use("Ramesh"));
const a2 = pool.acquire();
console.log(a2.use("Suresh"));
const a3 = pool.acquire();
console.log(a3.use("Priya"));

console.log("All taken:", pool.status());
console.log("4th passenger gets:", pool.acquire()); // null

// Release and reuse
pool.release(a1);
const a4 = pool.acquire();
console.log(a4.use("Dinesh"));
console.log("Reused auto?", a4.id === a1.id); // true

pool.release(a2);
pool.release(a3);
pool.release(a4);
console.log("End of day:", pool.status());

// ────────────────────────────────────
// BLOCK 2 — Connection Pool with Async Waiting
// ────────────────────────────────────

console.log("\n--- Block 2: Connection Pool Simulation ---");

class ConnectionPool {
  constructor(maxSize) {
    this._maxSize = maxSize;
    this._available = [];
    this._inUse = new Set();
    this._waitQueue = [];
    this._nextId = 1;
  }

  async acquire() {
    if (this._available.length > 0) {
      const conn = this._available.pop();
      this._inUse.add(conn);
      return conn;
    }

    if (this._inUse.size < this._maxSize) {
      const conn = { id: this._nextId++, queryCount: 0 };
      this._inUse.add(conn);
      return conn;
    }

    // All connections busy — caller waits in a queue
    return new Promise(function (resolve) {
      this._waitQueue.push(resolve);
    }.bind(this));
  }

  release(conn) {
    this._inUse.delete(conn);

    // Hand directly to next waiter if someone is waiting
    if (this._waitQueue.length > 0) {
      const nextWaiter = this._waitQueue.shift();
      this._inUse.add(conn);
      nextWaiter(conn);
    } else {
      this._available.push(conn);
    }
  }

  status() {
    return "available=" + this._available.length
      + " inUse=" + this._inUse.size
      + " waiting=" + this._waitQueue.length;
  }
}

async function demo() {
  const dbPool = new ConnectionPool(2);

  const c1 = await dbPool.acquire();
  const c2 = await dbPool.acquire();
  console.log("Pool full:", dbPool.status());

  // Third request waits — we release c1 after 50ms
  const waitPromise = dbPool.acquire();
  setTimeout(function () { dbPool.release(c1); }, 50);

  const c3 = await waitPromise;
  console.log("Waiter got conn:", c3.id);

  dbPool.release(c2);
  dbPool.release(c3);
  console.log("All returned:", dbPool.status());
}

demo();

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Object Pool pre-allocates and recycles expensive objects.
// 2. Always reset objects before returning them to the pool.
// 3. Connection pools add async waiting so callers queue up.
// 4. Pool size limits prevent resource exhaustion.
