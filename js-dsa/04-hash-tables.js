// ============================================================
// FILE 04: HASH TABLES
// Topic: Hash tables — the most important data structure in computing
// WHY: O(1) lookups power everything — Aadhaar's 1.4 billion IDs,
//   database indexes, DNS, caching. Non-negotiable knowledge.
// ============================================================

// ============================================================
// STORY — Aadhaar: 1.4 Billion Records, O(1) Lookup
// Your Aadhaar is looked up via hash table — O(1) regardless of
// whether there are 1 million or 1.4 billion records.
// ============================================================

// Key -> hash function -> index -> stored value
// Average time for get/set/delete: O(1)

console.log("=== HASH TABLE FUNDAMENTALS ===\n");

// ============================================================
// SECTION 1 — Building a Hash Table from Scratch
// Uses chaining (array of buckets) for collision handling.
// ============================================================

class HashTable {
  constructor(initialSize = 16) {
    this.buckets = new Array(initialSize).fill(null).map(() => []);
    this.size = 0;
    this.capacity = initialSize;
  }

  _hash(key) { // O(k) where k = key length
    let hash = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i++)
      hash = (hash * 31 + str.charCodeAt(i)) % this.capacity;
    // 31 is an odd prime — spreads bits evenly (same as Java's hashCode)
    return hash;
  }

  set(key, value) { // O(1) average
    if (this.size / this.capacity > 0.75) this._resize();
    const bucket = this.buckets[this._hash(key)];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) { bucket[i][1] = value; return; }
    }
    bucket.push([key, value]);
    this.size++;
  }

  get(key) { // O(1) average
    const bucket = this.buckets[this._hash(key)];
    for (const [k, v] of bucket) if (k === key) return v;
    return undefined;
  }

  delete(key) { // O(1) average
    const bucket = this.buckets[this._hash(key)];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) { bucket.splice(i, 1); this.size--; return true; }
    }
    return false;
  }

  has(key) { return this.get(key) !== undefined; }
  keys() { return this.buckets.flat().map(([k]) => k); }

  _resize() { // O(n) — rehash all entries when load factor > 0.75
    const old = this.buckets;
    this.capacity *= 2;
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.size = 0;
    for (const bucket of old)
      for (const [key, value] of bucket) this.set(key, value);
  }
}

const aadhaarDB = new HashTable(8);
aadhaarDB.set("123456789012", "Arjun Sharma, Delhi");
aadhaarDB.set("234567890123", "Priya Patel, Mumbai");
aadhaarDB.set("345678901234", "Rahul Verma, Bangalore");
console.log("Get:", aadhaarDB.get("345678901234")); // Rahul Verma, Bangalore
console.log("Has '999':", aadhaarDB.has("999999999999")); // false
aadhaarDB.delete("234567890123");
console.log("Keys:", aadhaarDB.keys());

// ============================================================
// SECTION 2 — Collision Handling: Open Addressing
// Alternative to chaining — probe for next empty slot.
// ============================================================

class HashTableLinearProbe {
  constructor(size = 16) {
    this.capacity = size;
    this.keys = new Array(size).fill(null);
    this.values = new Array(size).fill(null);
    this.size = 0;
  }

  _hash(key) {
    let hash = 0;
    for (let i = 0; i < String(key).length; i++)
      hash = (hash * 31 + String(key).charCodeAt(i)) % this.capacity;
    return hash;
  }

  set(key, value) { // Linear probing: if slot taken, try slot+1, slot+2...
    let index = this._hash(key);
    while (this.keys[index] !== null && this.keys[index] !== key)
      index = (index + 1) % this.capacity;
    if (this.keys[index] === null) this.size++;
    this.keys[index] = key;
    this.values[index] = value;
  }

  get(key) {
    let index = this._hash(key), probes = 0;
    while (this.keys[index] !== null) {
      if (this.keys[index] === key) return this.values[index];
      index = (index + 1) % this.capacity;
      if (++probes >= this.capacity) break;
    }
    return undefined;
  }
}

console.log("\n--- Linear Probing ---");
const openTable = new HashTableLinearProbe(16);
openTable.set("Mumbai", "Maharashtra");
openTable.set("Delhi", "NCR");
console.log("Get Mumbai:", openTable.get("Mumbai"));

// ============================================================
// SECTION 3 — Map vs Object in JavaScript
// ============================================================

// Object coerces keys to strings; Map keeps actual type
const obj = {};
obj[1] = "one"; obj["1"] = "one-string";
console.log("\nObject: obj[1] === obj['1']:", obj[1] === obj["1"]); // true! Collision.

const map = new Map();
map.set(1, "one"); map.set("1", "one-string");
console.log("Map: get(1):", map.get(1), "| get('1'):", map.get("1")); // Different!

console.log(`
| Feature          | Object          | Map             |
|------------------|-----------------|-----------------|
| Key types        | String/Symbol   | Any type        |
| Order            | Numeric first   | Insertion order |
| Size             | O(n) to compute | O(1) .size      |
| Prototype        | Yes (pollution!)| No              |
| Perf (add/del)   | Slower          | Faster          |

USE Object: JSON data, config, static structures
USE Map: dynamic key-value stores, caches, counters
`);

// ============================================================
// SECTION 4 — Set: Unique Values Collection
// Hash table with only keys. O(1) add/has/delete.
// ============================================================

const frontend = new Set(["React", "JavaScript", "CSS", "HTML"]);
const backend = new Set(["Node.js", "JavaScript", "MongoDB", "Express"]);

// Union, Intersection, Difference
const union = new Set([...frontend, ...backend]);
const intersection = new Set([...frontend].filter(x => backend.has(x)));
const difference = new Set([...frontend].filter(x => !backend.has(x)));

console.log("Union:", [...union]);
console.log("Intersection:", [...intersection]); // ["JavaScript"]
console.log("Difference:", [...difference]);

// ============================================================
// SECTION 5 — Two-Sum: O(n) with Hash Map
// Check if complement (target - current) was already seen. LeetCode #1.
// ============================================================

function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return null; // O(n) time, O(n) space
}

console.log("Two-Sum [100,250,400,150] target 500:", twoSum([100, 250, 400, 150], 500)); // [0, 2]

// ============================================================
// SECTION 6 — Subarray Sum Equals K (Prefix Sum + Map)
// Count subarrays summing to K. O(n) instead of O(n^2).
// ============================================================

function subarraySumK(nums, k) {
  const prefixCount = new Map([[0, 1]]);
  let currentSum = 0, count = 0;
  for (const num of nums) {
    currentSum += num;
    if (prefixCount.has(currentSum - k))
      count += prefixCount.get(currentSum - k);
    prefixCount.set(currentSum, (prefixCount.get(currentSum) || 0) + 1);
  }
  return count;
}

console.log("\nSubarray sum=5:", subarraySumK([1, 2, 3, -1, 4, -2, 1], 5));

// ============================================================
// SECTION 7 — Longest Consecutive Sequence
// Set gives O(n) by only starting counts from sequence beginnings.
// ============================================================

function longestConsecutive(nums) {
  const numSet = new Set(nums);
  let maxLen = 0;
  for (const num of numSet) {
    if (!numSet.has(num - 1)) { // Only start from beginning of sequence
      let cur = num, len = 1;
      while (numSet.has(cur + 1)) { cur++; len++; }
      maxLen = Math.max(maxLen, len);
    }
  }
  return maxLen;
}

console.log("Longest consecutive [100,4,200,1,3,2]:", longestConsecutive([100, 4, 200, 1, 3, 2])); // 4

// ============================================================
// SECTION 8 — LRU Cache
// Map preserves insertion order. Delete + re-set moves to end.
// Get and put both O(1).
// ============================================================

class LRUCache {
  constructor(capacity) { this.capacity = capacity; this.cache = new Map(); }
  get(key) {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val); // Move to end (most recent)
    return val;
  }
  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey); // Evict least recent (first in Map)
    }
    this.cache.set(key, value);
  }
}

const cache = new LRUCache(3);
cache.put("A001", "Arjun"); cache.put("A002", "Priya"); cache.put("A003", "Rahul");
console.log("\nLRU get A001:", cache.get("A001")); // "Arjun" — moves to end
cache.put("A004", "Sneha"); // Evicts A002
console.log("LRU get A002:", cache.get("A002")); // -1 (evicted)

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Hash tables: O(1) average for get/set/delete
// 2. Hash function: key -> index. Good hash = uniform distribution
// 3. Collisions: chaining (lists) or open addressing (probing)
// 4. Load factor > 0.75 triggers resize (O(n) rehash)
// 5. Use Map over Object for dynamic stores, any key type, no prototype issues
// 6. Use Set for uniqueness, O(1) membership, set operations
// 7. Two-Sum: check complement in Map — O(n) vs O(n^2)
// 8. Prefix sum + Map: count target-sum subarrays in O(n)
// 9. LRU Cache: Map insertion order + O(1) ops
// ============================================================
