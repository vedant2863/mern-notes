// ============================================================
// FILE 24: LRU CACHE
// Topic: Fixed-size cache that evicts the Least Recently Used item when full
// WHY: LRU Cache powers browser caches, CDNs, database query caches,
//   and DNS resolution. Also LeetCode #146 -- one of the most asked
//   coding interview questions. Tests HashMap + Doubly Linked List knowledge.
// ============================================================

// ============================================================
// STORY: Swiggy caches the top 1000 restaurant menus in memory
// (~0.01ms) vs database (~100ms). When full, evict the menu nobody
// has viewed for the longest time. This is the LRU eviction policy.
// ============================================================

console.log("=== LRU CACHE ===\n");

// ============================================================
// BLOCK 1 -- Why HashMap + Doubly Linked List?
// HashMap only: no way to know which key is LRU.
// HashMap + Array: moving element to front = O(n) shift.
// HashMap + DLL: O(1) lookup, O(1) add/remove/move. All O(1)!
//   Head = Most Recently Used, Tail = Least Recently Used.
// ============================================================

// ============================================================
// SECTION 1 -- Full LRU Cache Implementation
// ============================================================

class DoublyLinkedListNode {
  constructor(key, value) {
    this.key = key; this.value = value; this.prev = null; this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
    // Sentinel (dummy) nodes eliminate null-pointer edge cases
    this.head = new DoublyLinkedListNode(0, 0);
    this.tail = new DoublyLinkedListNode(0, 0);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _addToFront(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  _moveToFront(node) { this._removeNode(node); this._addToFront(node); }

  get(key) {
    if (!this.map.has(key)) return -1;
    const node = this.map.get(key);
    this._moveToFront(node);
    return node.value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      const node = this.map.get(key);
      node.value = value;
      this._moveToFront(node);
    } else {
      const newNode = new DoublyLinkedListNode(key, value);
      this.map.set(key, newNode);
      this._addToFront(newNode);
      if (this.map.size > this.capacity) {
        const lru = this.tail.prev;
        this._removeNode(lru);
        this.map.delete(lru.key);
      }
    }
  }

  _getState() {
    const items = [];
    let cur = this.head.next;
    while (cur !== this.tail) { items.push(`${cur.key}:${cur.value}`); cur = cur.next; }
    return `[${items.join(" <-> ")}] (${this.map.size}/${this.capacity})`;
  }
}

// ============================================================
// SECTION 2 -- Step-by-Step Trace
// ============================================================

console.log("=== STEP-BY-STEP TRACE (capacity: 3) ===\n");
const cache = new LRUCache(3);

cache.put(1, "Biryani Paradise");
console.log("put(1, 'Biryani'):", cache._getState());

cache.put(2, "Pizza Hut");
console.log("put(2, 'Pizza'):", cache._getState());

cache.put(3, "Dominos");
console.log("put(3, 'Dominos'):", cache._getState());

cache.get(1);
console.log("get(1) moves to front:", cache._getState());

cache.put(4, "KFC");
console.log("put(4, 'KFC') evicts LRU:", cache._getState());

console.log("get(2):", cache.get(2), "(evicted!)");

cache.put(5, "McDonalds");
console.log("put(5) evicts LRU:", cache._getState());
console.log();

// ============================================================
// SECTION 3 -- Map-Based LRU (Simpler Approach)
// JS Map maintains insertion order. Delete + re-insert = move to end.
// ============================================================

class LRUCacheSimple {
  constructor(capacity) { this.capacity = capacity; this.cache = new Map(); }

  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // Move to end (most recent)
    return value;
  }

  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      this.cache.delete(this.cache.keys().next().value); // Evict first (LRU)
    }
  }
}

console.log("=== MAP-BASED LRU ===");
const sc = new LRUCacheSimple(2);
sc.put(1, "A"); sc.put(2, "B");
console.log("get(1):", sc.get(1));
sc.put(3, "C");
console.log("get(2):", sc.get(2), "(evicted)\n");

// ============================================================
// SECTION 4 -- Cache Eviction Policies
// ============================================================

console.log("=== EVICTION POLICIES ===");
console.log("LRU:  Evict least recently USED   (general purpose)");
console.log("LFU:  Evict least FREQUENTLY used  (CDN popularity)");
console.log("FIFO: Evict oldest inserted         (message queues)");
console.log("TTL:  Evict after time-to-live       (sessions, DNS)");
console.log();

// ============================================================
// SECTION 5 -- Tests
// ============================================================

console.log("=== RUNNING TESTS ===");

const t1 = new LRUCache(2);
t1.put(1, 1); t1.put(2, 2);
console.assert(t1.get(1) === 1, "get(1)");
t1.put(3, 3);
console.assert(t1.get(2) === -1, "key 2 evicted");
t1.put(4, 4);
console.assert(t1.get(1) === -1, "key 1 evicted");
console.assert(t1.get(3) === 3 && t1.get(4) === 4, "3 and 4 present");
console.log("Basic get/put: Passed");

const t2 = new LRUCache(2);
t2.put(1, 1); t2.put(2, 2); t2.put(1, 10);
console.assert(t2.get(1) === 10, "Updated value");
t2.put(3, 3);
console.assert(t2.get(2) === -1, "Key 2 evicted, not updated key 1");
console.log("Update existing: Passed");

const t3 = new LRUCache(3);
t3.put(1, 1); t3.put(2, 2); t3.put(3, 3);
t3.get(1);
t3.put(4, 4);
console.assert(t3.get(2) === -1, "Key 2 was LRU");
console.assert(t3.get(1) === 1, "Key 1 survived (recently accessed)");
console.log("Access pattern: Passed");

const t4 = new LRUCache(100);
for (let i = 0; i < 1000; i++) t4.put(i, i);
console.assert(t4.get(899) === -1 && t4.get(900) === 900, "Stress test");
console.log("Stress test: Passed");

console.log("\nAll LRU Cache tests passed!");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. LRU Cache = HashMap + Doubly Linked List. Both needed for O(1).
// 2. Sentinel head/tail nodes eliminate null-pointer edge cases.
// 3. get(): move accessed node to front (most recently used).
// 4. put(): if exists, update + move. If new, add to front, evict tail.prev if full.
// 5. Node stores BOTH key and value -- key needed to delete from HashMap on eviction.
// 6. JS Map insertion order enables a simpler LRU (delete + re-set).
// 7. Real-world: browser cache, CDN, Redis, CPU L1/L2/L3, OS page replacement.
// ============================================================

console.log("\n=== BIG-O SUMMARY ===");
console.log("+--------------------+-------+-----------+");
console.log("| Operation          | Time  | Space     |");
console.log("+--------------------+-------+-----------+");
console.log("| get(key)           | O(1)  | O(1)      |");
console.log("| put(key, value)    | O(1)  | O(1)      |");
console.log("| evict LRU          | O(1)  | O(1)      |");
console.log("| Overall            | --    | O(capacity)|");
console.log("+--------------------+-------+-----------+");
