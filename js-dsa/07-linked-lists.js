// ============================================================
// FILE 07: LINKED LISTS — SINGLY, DOUBLY, AND CLASSIC PROBLEMS
// Topic: Node-based data structures and pointer manipulation
// WHY: Linked lists teach pointer thinking essential for trees,
//   graphs, and memory management. Foundation for advanced DSA.
// ============================================================

// ============================================================
// STORY — Spotify India Playlist
// Each song is a node pointing to the next. Insert/remove songs
// without shifting an entire array — just rewire pointers.
// ============================================================

// Arrays: O(n) shift on insert/delete. Linked lists: O(1) if you have the node.
// But arrays win on cache locality and random access O(1).

// ============================================================
// SECTION 1 — Singly Linked List
// ============================================================

class SLLNode {
  constructor(value) { this.value = value; this.next = null; }
}

class SinglyLinkedList {
  constructor() { this.head = null; this._size = 0; }

  append(value) { // O(n) — traverse to tail. O(1) with tail pointer.
    const node = new SLLNode(value);
    if (!this.head) { this.head = node; }
    else { let c = this.head; while (c.next) c = c.next; c.next = node; }
    this._size++;
    return this;
  }

  prepend(value) { // O(1)
    const node = new SLLNode(value);
    node.next = this.head;
    this.head = node;
    this._size++;
    return this;
  }

  insertAt(index, value) { // O(n)
    if (index < 0 || index > this._size) throw new RangeError("Out of bounds");
    if (index === 0) return this.prepend(value);
    const node = new SLLNode(value);
    let c = this.head;
    for (let i = 0; i < index - 1; i++) c = c.next;
    node.next = c.next;
    c.next = node;
    this._size++;
    return this;
  }

  removeAt(index) { // O(n)
    if (index < 0 || index >= this._size) throw new RangeError("Out of bounds");
    let val;
    if (index === 0) { val = this.head.value; this.head = this.head.next; }
    else {
      let c = this.head;
      for (let i = 0; i < index - 1; i++) c = c.next;
      val = c.next.value;
      c.next = c.next.next;
    }
    this._size--;
    return val;
  }

  get(index) {
    if (index < 0 || index >= this._size) return undefined;
    let c = this.head;
    for (let i = 0; i < index; i++) c = c.next;
    return c.value;
  }

  contains(value) {
    let c = this.head;
    while (c) { if (c.value === value) return true; c = c.next; }
    return false;
  }

  toArray() { const r = []; let c = this.head; while (c) { r.push(c.value); c = c.next; } return r; }
  print() { console.log(this.toArray().join(" -> ") + " -> null"); }
  size() { return this._size; }
}

console.log("=== Singly Linked List ===");
const playlist = new SinglyLinkedList();
playlist.append("Tum Hi Ho").append("Chaiyya Chaiyya").append("Kal Ho Naa Ho");
playlist.prepend("Kun Faya Kun");
playlist.print();
console.log("Get index 1:", playlist.get(1));
console.log("Contains 'Chaiyya Chaiyya':", playlist.contains("Chaiyya Chaiyya"));
console.log();

// ============================================================
// SECTION 2 — Doubly Linked List
// next + prev pointers. O(1) removeLast (impossible in SLL without traversal).
// ============================================================

class DLLNode {
  constructor(value) { this.value = value; this.next = null; this.prev = null; }
}

class DoublyLinkedList {
  constructor() { this.head = null; this.tail = null; this._size = 0; }

  append(value) { // O(1) — tail pointer
    const node = new DLLNode(value);
    if (!this.head) { this.head = node; this.tail = node; }
    else { node.prev = this.tail; this.tail.next = node; this.tail = node; }
    this._size++; return this;
  }

  prepend(value) { // O(1)
    const node = new DLLNode(value);
    if (!this.head) { this.head = node; this.tail = node; }
    else { node.next = this.head; this.head.prev = node; this.head = node; }
    this._size++; return this;
  }

  removeFirst() { // O(1)
    if (!this.head) return undefined;
    const val = this.head.value;
    if (this.head === this.tail) { this.head = null; this.tail = null; }
    else { this.head = this.head.next; this.head.prev = null; }
    this._size--; return val;
  }

  removeLast() { // O(1) — DLL advantage over SLL!
    if (!this.tail) return undefined;
    const val = this.tail.value;
    if (this.head === this.tail) { this.head = null; this.tail = null; }
    else { this.tail = this.tail.prev; this.tail.next = null; }
    this._size--; return val;
  }

  toArray() { const r = []; let c = this.head; while (c) { r.push(c.value); c = c.next; } return r; }
  print() { console.log("null <- " + this.toArray().join(" <-> ") + " -> null"); }
  size() { return this._size; }
}

console.log("=== Doubly Linked List ===");
const products = new DoublyLinkedList();
products.append("iPhone 15").append("Samsung S24").append("OnePlus 12").append("Pixel 8");
products.print();
console.log("Removed last:", products.removeLast()); // Pixel 8
console.log("Removed first:", products.removeFirst()); // iPhone 15
products.print();
console.log();

// ============================================================
// SECTION 3 — Classic Problems
// ============================================================

// --- Reverse a Linked List (Iterative) ---
// Flip next pointers using prev/curr/next. O(n) time, O(1) space.
function reverseLinkedList(head) {
  let prev = null, curr = head;
  while (curr !== null) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev; // new head
}

console.log("--- Reverse ---");
const stops = new SinglyLinkedList();
stops.append("Delhi").append("Agra").append("Bhopal").append("Chennai");
console.log("Original:"); stops.print();
stops.head = reverseLinkedList(stops.head);
console.log("Reversed:"); stops.print();

// --- Detect Cycle (Floyd's Tortoise and Hare) ---
// Slow (1 step) + fast (2 steps). If they meet, cycle exists. O(n), O(1).
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

console.log("\n--- Cycle Detection ---");
const noCycle = new SLLNode(1);
noCycle.next = new SLLNode(2); noCycle.next.next = new SLLNode(3);
console.log("1->2->3 has cycle?", hasCycle(noCycle)); // false

const withCycle = new SLLNode(1);
withCycle.next = new SLLNode(2); withCycle.next.next = new SLLNode(3);
withCycle.next.next.next = withCycle.next; // 3 -> 2 (cycle)
console.log("1->2->3->(2) has cycle?", hasCycle(withCycle)); // true

// --- Find Middle Node ---
// Slow (1 step) + fast (2 steps). When fast reaches end, slow is at middle.
function findMiddle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }
  return slow.value;
}

console.log("\n--- Find Middle ---");
const waitlist = new SinglyLinkedList();
waitlist.append("A").append("B").append("C").append("D").append("E");
console.log("Middle:", findMiddle(waitlist.head)); // C

// --- Merge Two Sorted Lists ---
// Two-pointer merge with dummy node. O(n+m), O(1) extra space.
function mergeSortedLists(h1, h2) {
  const dummy = new SLLNode(0);
  let curr = dummy;
  while (h1 && h2) {
    if (h1.value <= h2.value) { curr.next = h1; h1 = h1.next; }
    else { curr.next = h2; h2 = h2.next; }
    curr = curr.next;
  }
  curr.next = h1 || h2;
  return dummy.next;
}

console.log("\n--- Merge Sorted Lists ---");
const l1 = new SinglyLinkedList(); l1.append(1).append(3).append(5);
const l2 = new SinglyLinkedList(); l2.append(2).append(4).append(6);
const merged = mergeSortedLists(l1.head, l2.head);
let c = merged; const arr = [];
while (c) { arr.push(c.value); c = c.next; }
console.log("Merged:", arr.join(" -> "));

// --- Remove Nth from End ---
// Two pointers with n-gap. Single pass. O(n), O(1).
function removeNthFromEnd(head, n) {
  const dummy = new SLLNode(0); dummy.next = head;
  let fast = dummy, slow = dummy;
  for (let i = 0; i <= n; i++) fast = fast.next;
  while (fast) { fast = fast.next; slow = slow.next; }
  slow.next = slow.next.next;
  return dummy.next;
}

console.log("\n--- Remove Nth from End ---");
const txns = new SinglyLinkedList();
txns.append("A").append("B").append("C").append("D").append("E");
console.log("Before:"); txns.print();
txns.head = removeNthFromEnd(txns.head, 2); // removes D
console.log("After removing 2nd from end:"); txns.print();

// ============================================================
// SECTION 4 — When to Use Linked Lists vs Arrays
// ============================================================
// USE Arrays: random access, mostly reading, cache performance
// USE Linked Lists: frequent insert/delete at arbitrary positions,
//   LRU cache, undo/redo, implementing stacks/queues/hash chaining
// JS has no built-in LinkedList — V8 optimizes arrays well enough
//   for most use cases.

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. SLL: prepend O(1), append O(n) unless tail pointer maintained
// 2. DLL: insert/remove from both ends O(1). removeLast is O(1)
// 3. Reverse: prev/curr/next flipping. O(n), O(1)
// 4. Cycle detection: Floyd's slow/fast. O(n), O(1)
// 5. Find middle: slow/fast pointers. O(n)
// 6. Merge sorted: two-pointer with dummy node. O(n+m)
// 7. Remove nth from end: two pointers with n-gap
// 8. Linked lists are foundation for trees and graphs
// ============================================================
