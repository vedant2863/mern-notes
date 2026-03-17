// ============================================================
// FILE 06: QUEUES — FIFO, PRIORITY QUEUES, AND DEQUES
// Topic: Queue data structures and their variants
// WHY: Queues are fundamental to scheduling, buffering, and BFS.
//   Every web server, task runner, and message broker uses them.
// ============================================================

// ============================================================
// STORY — Ola Ride Request Queue
// Thousands of requests per minute, dispatched first-come first-served.
// FIFO ensures fairness — like standing in line at SBI.
// ============================================================

// ============================================================
// SECTION 1 — Array Queue (Simple but Flawed)
// push() is O(1), but shift() is O(n) — every element re-indexes.
// ============================================================

class ArrayQueue {
  constructor() { this.items = []; }
  enqueue(item) { this.items.push(item); }          // O(1)
  dequeue() { return this.items.shift(); }           // O(n) — the problem!
  front() { return this.items[0]; }                  // O(1)
  isEmpty() { return this.items.length === 0; }
  size() { return this.items.length; }
}

console.log("=== Array Queue ===");
const olaQueue = new ArrayQueue();
olaQueue.enqueue("Ride#101"); olaQueue.enqueue("Ride#102"); olaQueue.enqueue("Ride#103");
console.log("Assigning:", olaQueue.dequeue()); // Ride#101
console.log("Pending:", olaQueue.size());      // 2
console.log();

// ============================================================
// SECTION 2 — Linked-List Queue (Optimal)
// Enqueue at tail, dequeue from head — both O(1).
// ============================================================

class QueueNode {
  constructor(value) { this.value = value; this.next = null; }
}

class LinkedListQueue {
  constructor() { this.head = null; this.tail = null; this._size = 0; }
  enqueue(value) { // O(1)
    const node = new QueueNode(value);
    if (this.isEmpty()) { this.head = node; this.tail = node; }
    else { this.tail.next = node; this.tail = node; }
    this._size++;
  }
  dequeue() { // O(1)
    if (this.isEmpty()) return undefined;
    const val = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this._size--;
    return val;
  }
  front() { return this.isEmpty() ? undefined : this.head.value; }
  isEmpty() { return this._size === 0; }
  size() { return this._size; }
}

console.log("=== Linked-List Queue ===");
const olaLL = new LinkedListQueue();
olaLL.enqueue("Ride#201"); olaLL.enqueue("Ride#202"); olaLL.enqueue("Ride#203");
console.log("Assigned:", olaLL.dequeue()); // Ride#201
console.log("Size:", olaLL.size());
console.log();

// ============================================================
// SECTION 3 — Circular Buffer Queue (Fixed Capacity)
// Modulo wrapping on a fixed array — O(1) everything, zero allocation.
// ============================================================

class CircularQueue {
  constructor(capacity) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    this.headIdx = 0; this.tailIdx = 0; this._size = 0;
  }
  enqueue(value) {
    if (this.isFull()) return false;
    this.items[this.tailIdx] = value;
    this.tailIdx = (this.tailIdx + 1) % this.capacity;
    this._size++; return true;
  }
  dequeue() {
    if (this.isEmpty()) return undefined;
    const val = this.items[this.headIdx];
    this.headIdx = (this.headIdx + 1) % this.capacity;
    this._size--; return val;
  }
  front() { return this.isEmpty() ? undefined : this.items[this.headIdx]; }
  isFull() { return this._size === this.capacity; }
  isEmpty() { return this._size === 0; }
  size() { return this._size; }
}

console.log("=== Circular Buffer ===");
const cq = new CircularQueue(4);
cq.enqueue("A"); cq.enqueue("B"); cq.enqueue("C"); cq.enqueue("D");
console.log("Full:", cq.isFull()); // true
cq.dequeue(); cq.dequeue(); // remove A, B
cq.enqueue("E"); cq.enqueue("F"); // wraps around
console.log("Front:", cq.front()); // C
console.log();

// ============================================================
// SECTION 4 — Deque (Double-Ended Queue)
// Insert/remove from BOTH ends in O(1). Generalizes stacks and queues.
// ============================================================

class DequeNode {
  constructor(value) { this.value = value; this.next = null; this.prev = null; }
}

class Deque {
  constructor() { this.head = null; this.tail = null; this._size = 0; }
  addFront(value) {
    const node = new DequeNode(value);
    if (this.isEmpty()) { this.head = node; this.tail = node; }
    else { node.next = this.head; this.head.prev = node; this.head = node; }
    this._size++;
  }
  addRear(value) {
    const node = new DequeNode(value);
    if (this.isEmpty()) { this.head = node; this.tail = node; }
    else { node.prev = this.tail; this.tail.next = node; this.tail = node; }
    this._size++;
  }
  removeFront() {
    if (this.isEmpty()) return undefined;
    const val = this.head.value;
    this.head = this.head.next;
    this.head ? (this.head.prev = null) : (this.tail = null);
    this._size--; return val;
  }
  removeRear() {
    if (this.isEmpty()) return undefined;
    const val = this.tail.value;
    this.tail = this.tail.prev;
    this.tail ? (this.tail.next = null) : (this.head = null);
    this._size--; return val;
  }
  isEmpty() { return this._size === 0; }
}

console.log("=== Deque ===");
const support = new Deque();
support.addRear("Complaint#1"); support.addRear("Complaint#2");
support.addFront("ESCALATION"); // VIP pushed to front
console.log("Agent picks:", support.removeFront()); // ESCALATION
console.log();

// ============================================================
// SECTION 5 — Priority Queue (Array-Based)
// enqueue O(1), dequeue O(n) — scans for highest priority.
// Heap-based PQ (File 14) achieves O(log n) for both.
// ============================================================

class PriorityQueue {
  constructor() { this.items = []; }
  enqueue(value, priority) { this.items.push({ value, priority }); }
  dequeue() {
    if (this.isEmpty()) return undefined;
    let minIdx = 0;
    for (let i = 1; i < this.items.length; i++)
      if (this.items[i].priority < this.items[minIdx].priority) minIdx = i;
    return this.items.splice(minIdx, 1)[0];
  }
  isEmpty() { return this.items.length === 0; }
}

console.log("=== Priority Queue ===");
const olaPQ = new PriorityQueue();
olaPQ.enqueue("Mini - Koramangala", 3);
olaPQ.enqueue("Premier - Airport", 1);
olaPQ.enqueue("Prime - MG Road", 2);
console.log("First:", olaPQ.dequeue().value);  // Premier - Airport
console.log("Second:", olaPQ.dequeue().value); // Prime - MG Road
console.log();

// ============================================================
// SECTION 6 — Problems
// ============================================================

// --- Generate Binary Numbers 1 to N using Queue ---
// BFS-like: dequeue "1", enqueue "10" and "11", repeat. O(n).
function generateBinaryNumbers(n) {
  const result = [], queue = new LinkedListQueue();
  queue.enqueue("1");
  for (let i = 0; i < n; i++) {
    const curr = queue.dequeue();
    result.push(curr);
    queue.enqueue(curr + "0");
    queue.enqueue(curr + "1");
  }
  return result;
}
console.log("Binary 1-10:", generateBinaryNumbers(10));

// --- First Non-Repeating Character in Stream ---
// Queue + frequency map. Pop front while count > 1. O(n) overall.
function firstNonRepeating(stream) {
  const freq = {}, queue = new ArrayQueue(), results = [];
  for (const ch of stream) {
    freq[ch] = (freq[ch] || 0) + 1;
    queue.enqueue(ch);
    while (!queue.isEmpty() && freq[queue.front()] > 1) queue.dequeue();
    results.push(queue.isEmpty() ? null : queue.front());
  }
  return results;
}
console.log("\nFirst non-repeating in 'aabcbcd':", firstNonRepeating("aabcbcd"));

// --- Ring Buffer (Overwrite Oldest) ---
// Unlike CircularQueue that rejects when full, ring buffer overwrites.
// Ideal for logs, telemetry, streaming.
class RingBuffer {
  constructor(cap) {
    this.cap = cap; this.items = new Array(cap).fill(null);
    this.writeIdx = 0; this._count = 0;
  }
  write(value) {
    this.items[this.writeIdx] = value;
    this.writeIdx = (this.writeIdx + 1) % this.cap;
    this._count++;
  }
  readAll() {
    if (this._count < this.cap) return this.items.slice(0, this._count);
    const r = [];
    for (let i = 0; i < this.cap; i++) r.push(this.items[(this.writeIdx + i) % this.cap]);
    return r;
  }
}

console.log("\n--- Ring Buffer ---");
const cctv = new RingBuffer(4);
cctv.write("F1"); cctv.write("F2"); cctv.write("F3"); cctv.write("F4");
cctv.write("F5"); cctv.write("F6"); // overwrites F1, F2
console.log("Latest 4:", cctv.readAll()); // F3, F4, F5, F6

// --- BFS Preview ---
function bfsPreview(graph, start) {
  const visited = new Set(), queue = new LinkedListQueue(), order = [];
  queue.enqueue(start); visited.add(start);
  while (!queue.isEmpty()) {
    const node = queue.dequeue();
    order.push(node);
    for (const neighbor of (graph[node] || []))
      if (!visited.has(neighbor)) { visited.add(neighbor); queue.enqueue(neighbor); }
  }
  return order;
}

console.log("\nBFS from Bangalore:", bfsPreview({
  Bangalore: ["Mysore", "Tumkur", "Hosur"],
  Mysore: ["Ooty"], Tumkur: ["Davangere"], Hosur: ["Chennai"],
  Ooty: [], Davangere: [], Chennai: []
}, "Bangalore"));

// ============================================================
// SECTION 7 — Big-O Summary
// ============================================================
//
// | Queue Type        | enqueue | dequeue | Space        |
// |-------------------|---------|---------|--------------|
// | Array Queue       | O(1)*   | O(n)   | O(n) dynamic |
// | Linked List Queue | O(1)    | O(1)   | O(n) dynamic |
// | Circular Buffer   | O(1)    | O(1)   | O(k) fixed   |
// | Deque (DLL)       | O(1)    | O(1)   | O(n) dynamic |
// | Priority Queue    | O(1)    | O(n)   | O(n) dynamic |
// | PQ (Heap, F.14)   | O(logn) | O(logn)| O(n) dynamic |

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Queue = FIFO. Array shift() is O(n) — use linked list for O(1)
// 2. Circular buffer: O(1) everything, fixed capacity, no allocation
// 3. Deque: insert/remove from both ends O(1)
// 4. Priority Queue: array version O(n) dequeue, heap version O(log n)
// 5. BFS and round-robin scheduling rely on queues
// 6. Ring buffer overwrites oldest — ideal for logs and telemetry
// ============================================================
