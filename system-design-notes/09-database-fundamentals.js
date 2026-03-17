/** ============================================================
 *  FILE 09: DATABASE FUNDAMENTALS
 *  ============================================================
 *  Topic: SQL vs NoSQL, ACID, BASE, normalization, indexing
 *         (B-tree, hash), query optimization
 *
 *  WHY THIS MATTERS:
 *  Databases are the backbone of every application. Choosing the
 *  right model, understanding ACID, and proper indexing can mean
 *  the difference between 50ms and 5-second responses.
 *  ============================================================ */

// STORY: Aadhaar Database (UIDAI)
// Aadhaar stores biometric data for 1.4 billion residents. ACID
// ensures no duplicate numbers. Indexing by pincode jumps to
// 10,000 records instead of scanning all 1.4 billion.

console.log("=".repeat(70));
console.log("  FILE 09: DATABASE FUNDAMENTALS");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — SQL Table Simulation
// ================================================================

console.log("--- SECTION 1: SQL Table ---\n");

class SQLTable {
  constructor(name, columns) {
    this.name = name; this.columns = columns; this.rows = []; this.autoId = 1;
    this.indexes = new Map();
  }
  insert(row) {
    for (const col of this.columns) {
      if (col.notNull && row[col.name] == null) throw new Error(`NOT NULL: ${col.name}`);
      if (col.unique && this.rows.find((r) => r[col.name] === row[col.name]))
        throw new Error(`UNIQUE violation: ${col.name}='${row[col.name]}'`);
    }
    const pk = this.columns.find((c) => c.pk);
    if (pk && !row[pk.name]) row[pk.name] = this.autoId++;
    this.rows.push({ ...row });
    for (const [col, idx] of this.indexes) {
      const v = row[col]; if (!idx.has(v)) idx.set(v, []);
      idx.get(v).push(this.rows.length - 1);
    }
    return row;
  }
  select(where = null) {
    if (!where) return this.rows;
    return this.rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
  }
  createIndex(col) {
    const idx = new Map();
    this.rows.forEach((r, i) => { const v = r[col]; if (!idx.has(v)) idx.set(v, []); idx.get(v).push(i); });
    this.indexes.set(col, idx);
    console.log(`    [INDEX] Created on ${this.name}.${col}`);
  }
  count() { return this.rows.length; }
}

const aadhaar = new SQLTable("aadhaar", [
  { name: "id", type: "INT", pk: true },
  { name: "aadhaar_no", type: "VARCHAR", unique: true, notNull: true },
  { name: "name", type: "VARCHAR", notNull: true },
  { name: "pincode", type: "VARCHAR", notNull: true },
  { name: "state", type: "VARCHAR", notNull: true },
]);

const citizens = [
  { aadhaar_no: "1234-5678-9012", name: "Rajesh Kumar", pincode: "110001", state: "Delhi" },
  { aadhaar_no: "2345-6789-0123", name: "Priya Sharma", pincode: "400001", state: "Maharashtra" },
  { aadhaar_no: "3456-7890-1234", name: "Arun Nair", pincode: "682001", state: "Kerala" },
  { aadhaar_no: "4567-8901-2345", name: "Lakshmi Devi", pincode: "110001", state: "Delhi" },
  { aadhaar_no: "5678-9012-3456", name: "Mohammed Rafi", pincode: "500001", state: "Telangana" },
];
for (const c of citizens) { const r = aadhaar.insert(c); console.log(`  INSERT: ${r.name} (${r.aadhaar_no})`); }

console.log("\n  Duplicate attempt:");
try { aadhaar.insert({ aadhaar_no: "1234-5678-9012", name: "Fake", pincode: "0", state: "X" }); }
catch (e) { console.log(`  ERROR: ${e.message}`); }

console.log(`\n  SELECT WHERE state='Delhi':`);
aadhaar.select({ state: "Delhi" }).forEach((r) => console.log(`    ${r.name}, PIN:${r.pincode}`));
console.log();

// ================================================================
// SECTION 2 — NoSQL Document Store
// ================================================================

console.log("--- SECTION 2: NoSQL Document Store ---\n");

class DocStore {
  constructor() { this.docs = new Map(); this.autoId = 1; }
  insert(doc) { const id = doc._id || `doc_${this.autoId++}`; this.docs.set(id, { _id: id, ...doc }); return this.docs.get(id); }
  find(query = {}) {
    return [...this.docs.values()].filter((doc) => {
      for (const [key, val] of Object.entries(query)) {
        const parts = key.split("."); let cur = doc;
        for (const p of parts) { if (cur == null) return false; cur = cur[p]; }
        if (cur !== val) return false;
      }
      return true;
    });
  }
}

const docDb = new DocStore();
[{ _id: "A001", name: "Rajesh", address: { city: "Delhi", pin: "110001" }, services: ["PAN", "Bank"] },
 { _id: "A002", name: "Priya", address: { city: "Mumbai", pin: "400001" }, services: ["PAN"] },
].forEach((d) => { docDb.insert(d); console.log(`  INSERT: ${d.name} -- nested address, services array`); });

console.log(`\n  find({ "address.city": "Delhi" }):`);
docDb.find({ "address.city": "Delhi" }).forEach((d) => console.log(`    ${d.name}`));
console.log("\n  SQL: Fixed schema, JOINs, ACID. NoSQL: Flexible, embedded, BASE.\n");

// ================================================================
// SECTION 3 — ACID Properties
// ================================================================

console.log("--- SECTION 3: ACID ---\n");

class TransactionalDB {
  constructor() { this.data = new Map(); this.wal = []; this.tx = null; this.buf = new Map(); }
  begin(id) { this.tx = id; this.buf = new Map(); console.log(`    [TX ${id}] BEGIN`); }
  set(k, v) { if (this.tx) this.buf.set(k, v); else this.data.set(k, v); }
  get(k) { return (this.tx && this.buf.has(k)) ? this.buf.get(k) : this.data.get(k); }
  commit() {
    this.wal.push({ tx: this.tx, changes: [...this.buf.entries()] });
    for (const [k, v] of this.buf) this.data.set(k, v);
    console.log(`    [TX ${this.tx}] COMMIT -- ${this.buf.size} changes`);
    this.tx = null; this.buf = new Map();
  }
  rollback() {
    console.log(`    [TX ${this.tx}] ROLLBACK -- ${this.buf.size} changes discarded`);
    this.tx = null; this.buf = new Map();
  }
}

const txDb = new TransactionalDB();
txDb.data.set("count", 1400000000);

console.log("  Atomicity (success):");
txDb.begin("TX-001");
txDb.set("count", txDb.get("count") + 1);
txDb.commit();
console.log(`    count = ${txDb.get("count")}\n`);

console.log("  Atomicity (failure -> rollback):");
txDb.begin("TX-002");
txDb.set("count", txDb.get("count") + 1);
txDb.rollback();
console.log(`    count = ${txDb.get("count")} (unchanged)\n`);

console.log("  C: Constraints (Aadhaar must match /^\\d{4}-\\d{4}-\\d{4}$/)");
console.log("  I: Concurrent TXs don't see uncommitted data");
console.log("  D: WAL has", txDb.wal.length, "entries -- replay on crash\n");

// ================================================================
// SECTION 4 — BASE Properties
// ================================================================

console.log("--- SECTION 4: BASE ---\n");

class EventualStore {
  constructor(n) {
    this.replicas = Array.from({ length: n }, (_, i) => ({ id: i + 1, data: new Map() }));
    this.pending = [];
  }
  write(k, v) {
    this.replicas[0].data.set(k, v);
    for (let i = 1; i < this.replicas.length; i++) this.pending.push({ rid: i, k, v });
    console.log(`    [PRIMARY] "${k}" written, ${this.pending.length} sync ops pending`);
  }
  sync() { while (this.pending.length) { const op = this.pending.shift(); this.replicas[op.rid].data.set(op.k, op.v); } }
}

const base = new EventualStore(3);
base.write("citizen-1001", { city: "Bengaluru" });
console.log("  Before sync:");
for (let i = 0; i < 3; i++) console.log(`    Replica ${i + 1}: ${JSON.stringify(base.replicas[i].data.get("citizen-1001") || "NOT_FOUND")}`);
base.sync();
console.log("  After sync: all replicas consistent.\n");

// ================================================================
// SECTION 5 — Normalization
// ================================================================

console.log("--- SECTION 5: Normalization ---\n");
console.log(`  1NF: Atomic values (no comma-separated phone numbers)
  2NF: No partial dependencies (separate services table)
  3NF: No transitive deps (pincode -> state in own table)
  Stores "Delhi" once, not per citizen.\n`);

// ================================================================
// SECTION 6 — B-Tree Index
// ================================================================

console.log("--- SECTION 6: B-Tree Index ---\n");

class SimpleBTree {
  constructor(order = 4) { this.root = { keys: [], children: [], leaf: true }; this.order = order; this.comp = 0; }
  insert(key, val) {
    if (this.root.keys.length >= this.order - 1) {
      const newRoot = { keys: [], children: [this.root], leaf: false };
      this._split(newRoot, 0); this.root = newRoot;
    }
    this._insertNF(this.root, key, val);
  }
  _insertNF(node, key) {
    let i = node.keys.length - 1;
    if (node.leaf) { while (i >= 0 && key < node.keys[i]) i--; node.keys.splice(i + 1, 0, key); }
    else {
      while (i >= 0 && key < node.keys[i]) i--; i++;
      if (node.children[i].keys.length >= this.order - 1) { this._split(node, i); if (key > node.keys[i]) i++; }
      this._insertNF(node.children[i], key);
    }
  }
  _split(parent, idx) {
    const child = parent.children[idx]; const mid = Math.floor((this.order - 1) / 2);
    const newChild = { keys: child.keys.splice(mid + 1), children: child.leaf ? [] : child.children.splice(mid + 1), leaf: child.leaf };
    parent.keys.splice(idx, 0, child.keys.pop());
    parent.children.splice(idx + 1, 0, newChild);
  }
  search(key) {
    this.comp = 0; return this._search(this.root, key);
  }
  _search(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) { this.comp++; i++; }
    this.comp++;
    if (i < node.keys.length && key === node.keys[i]) return { found: true, comp: this.comp };
    if (node.leaf) return { found: false, comp: this.comp };
    return this._search(node.children[i], key);
  }
}

const bt = new SimpleBTree(4);
const pins = [[110001, "Delhi"], [400001, "Mumbai"], [560001, "Bengaluru"], [600001, "Chennai"],
  [500001, "Hyderabad"], [700001, "Kolkata"], [682001, "Kochi"], [302001, "Jaipur"]];
for (const [pin] of pins) bt.insert(pin);

for (const pin of [560001, 110001, 999999]) {
  const r = bt.search(pin);
  console.log(`  Search ${pin}: ${r.found ? "FOUND" : "NOT FOUND"} (${r.comp} comparisons)`);
}
console.log("\n  Without index: scan 1.4B = O(n). With B-Tree: ~30 comparisons!\n");

// ================================================================
// SECTION 7 — Hash Index
// ================================================================

console.log("--- SECTION 7: Hash Index ---\n");

class HashIndex {
  constructor(buckets = 8) { this.buckets = Array.from({ length: buckets }, () => []); this.collisions = 0; }
  hash(key) { let h = 0; for (const c of String(key)) h = ((h << 5) - h + c.charCodeAt(0)) & 0x7fffffff; return h % this.buckets.length; }
  put(k, v) {
    const b = this.hash(k);
    if (this.buckets[b].length > 0 && !this.buckets[b].find((x) => x.k === k)) this.collisions++;
    const e = this.buckets[b].find((x) => x.k === k);
    if (e) e.v = v; else this.buckets[b].push({ k, v });
  }
  get(k) { const e = this.buckets[this.hash(k)].find((x) => x.k === k); return e ? e.v : null; }
}

const hi = new HashIndex(8);
for (const c of citizens) hi.put(c.aadhaar_no, c.name);

for (const a of ["1234-5678-9012", "5678-9012-3456", "0000-0000-0000"]) {
  console.log(`  "${a}": ${hi.get(a) || "NOT FOUND"}`);
}
console.log(`  Collisions: ${hi.collisions}`);
console.log("\n  B-Tree: O(log n), range queries. Hash: O(1) exact match only.\n");

// ================================================================
// SECTION 8 — Query Optimization
// ================================================================

console.log("--- SECTION 8: Query Optimization ---\n");

aadhaar.createIndex("pincode");
const indexed = ["pincode", "aadhaar_no"];

const queries = [
  "SELECT * FROM aadhaar WHERE pincode = '110001'",
  "SELECT * FROM aadhaar WHERE state = 'Delhi'",
];
for (const q of queries) {
  const where = q.match(/WHERE\s+(\w+)\s*=/);
  const hasIdx = where && indexed.includes(where[1]);
  const plan = hasIdx ? `INDEX SCAN on ${where[1]}` : `FULL SCAN (no index on ${where[1]})`;
  console.log(`  ${q}\n    Plan: ${plan}\n`);
}
console.log("  Tips: Index WHERE/JOIN cols, avoid SELECT *, use LIMIT, check EXPLAIN.\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log(`
  1. SQL: rigid schema, ACID -- banking, government IDs.
  2. NoSQL: flexible schema, BASE -- rapid dev, horizontal scale.
  3. ACID: Atomicity, Consistency, Isolation, Durability.
  4. BASE: Eventually consistent, trades consistency for availability.
  5. Normalization (1NF-3NF) eliminates redundancy.
  6. B-tree: O(log n) + range queries -- default index type.
  7. Hash: O(1) exact lookups, no range support.
  8. Index WHERE columns, avoid SELECT *, use LIMIT.
`);
