// ============================================================
// FILE 14: HEAPS AND PRIORITY QUEUES
// Topic: Min-Heap, Max-Heap, Heap Sort, and Priority Queue Problems
// WHY: Heaps give the min/max in O(1) and rebalance in O(log n).
//   Without heaps, every "find minimum" requires sorting the entire list.
// ============================================================

// ============================================================
// STORY: Swiggy assigns delivery partners by picking the nearest
// available. A min-heap gives the closest partner in O(1) and
// rebalances in O(log n) — vs O(n) linear scan per order.
// ============================================================

// ============================================================
// SECTION 1 — Heap Basics
// ============================================================

// A heap is a COMPLETE binary tree stored as an ARRAY.
// Min-Heap: parent <= children. Max-Heap: parent >= children.
// For index i: Parent = floor((i-1)/2), Left = 2i+1, Right = 2i+2

//         10
//        /  \
//       20   30
//      / \   / \
//     40 50 60 70
// Array: [10, 20, 30, 40, 50, 60, 70]

// ============================================================
// SECTION 2 — MinHeap Implementation
// ============================================================

class MinHeap {
  constructor() { this.heap = []; }

  size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }
  peek() { return this.isEmpty() ? null : this.heap[0]; }
  toArray() { return [...this.heap]; }

  // --- INSERT: O(log n) — add to end, bubble up ---
  insert(value) {
    this.heap.push(value);
    this._bubbleUp(this.heap.length - 1);
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.heap[parentIdx] <= this.heap[index]) break;
      [this.heap[parentIdx], this.heap[index]] = [this.heap[index], this.heap[parentIdx]];
      index = parentIdx;
    }
  }

  // --- EXTRACT MIN: O(log n) — remove root, bubble down ---
  extractMin() {
    if (this.isEmpty()) return null;
    if (this.size() === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._bubbleDown(0);
    return min;
  }

  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1, right = 2 * index + 2;
      if (left < length && this.heap[left] < this.heap[smallest]) smallest = left;
      if (right < length && this.heap[right] < this.heap[smallest]) smallest = right;
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

console.log('=== MINHEAP OPERATIONS ===');
const minHeap = new MinHeap();
[4.5, 2.1, 7.3, 1.8, 5.6, 3.2].forEach(d => minHeap.insert(d));
console.log('Heap:', minHeap.toArray());
console.log('Peek (min):', minHeap.peek()); // 1.8

console.log('\nExtracting in order:');
while (!minHeap.isEmpty()) console.log(' ', minHeap.extractMin());

// ============================================================
// SECTION 3 — Heapify: Array to Heap in O(n)
// ============================================================

// WHY: Individual inserts = O(n log n). Heapify = O(n) because
// most nodes are near the bottom and need very few swaps.

function heapify(arr) {
  for (let i = Math.floor(arr.length / 2) - 1; i >= 0; i--) bubbleDown(arr, i, arr.length);
  return arr;
}

function bubbleDown(arr, index, length) {
  while (true) {
    let smallest = index;
    const left = 2 * index + 1, right = 2 * index + 2;
    if (left < length && arr[left] < arr[smallest]) smallest = left;
    if (right < length && arr[right] < arr[smallest]) smallest = right;
    if (smallest === index) break;
    [arr[index], arr[smallest]] = [arr[smallest], arr[index]];
    index = smallest;
  }
}

console.log('\n=== HEAPIFY ===');
const raw = [5.6, 3.2, 7.3, 1.8, 4.5, 2.1];
heapify(raw);
console.log('Heapified:', raw, '| Root:', raw[0]);

// ============================================================
// SECTION 4 — Heap Sort
// ============================================================

// WHY: O(n log n) guaranteed AND in-place O(1). Build max-heap,
// repeatedly extract max to the end.

function bubbleDownMax(arr, index, length) {
  while (true) {
    let largest = index;
    const left = 2 * index + 1, right = 2 * index + 2;
    if (left < length && arr[left] > arr[largest]) largest = left;
    if (right < length && arr[right] > arr[largest]) largest = right;
    if (largest === index) break;
    [arr[index], arr[largest]] = [arr[largest], arr[index]];
    index = largest;
  }
}

function heapSort(arr) {
  const n = arr.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) bubbleDownMax(arr, i, n);
  for (let i = n - 1; i > 0; i--) {
    [arr[0], arr[i]] = [arr[i], arr[0]];
    bubbleDownMax(arr, 0, i);
  }
  return arr;
}

console.log('\n=== HEAP SORT ===');
const times = [23, 8, 45, 12, 5, 34, 18, 2];
console.log('Sorted:', heapSort([...times]));

// ============================================================
// SECTION 5 — Priority Queue
// ============================================================

class PriorityQueue {
  constructor() { this.heap = []; }
  size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }
  peek() { return this.isEmpty() ? null : this.heap[0]; }

  enqueue(value, priority) {
    this.heap.push({ value, priority });
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.heap[p].priority <= this.heap[i].priority) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  dequeue() {
    if (this.isEmpty()) return null;
    if (this.size() === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    let i = 0;
    while (true) {
      let s = i, l = 2 * i + 1, r = 2 * i + 2;
      if (l < this.heap.length && this.heap[l].priority < this.heap[s].priority) s = l;
      if (r < this.heap.length && this.heap[r].priority < this.heap[s].priority) s = r;
      if (s === i) break;
      [this.heap[i], this.heap[s]] = [this.heap[s], this.heap[i]];
      i = s;
    }
    return top;
  }
}

console.log('\n=== PRIORITY QUEUE ===');
const pq = new PriorityQueue();
pq.enqueue('Regular Order', 3);
pq.enqueue('Pro Order', 1);
pq.enqueue('Gold Order', 2);
while (!pq.isEmpty()) {
  const o = pq.dequeue();
  console.log(`  Priority ${o.priority}: ${o.value}`);
}

// ============================================================
// SECTION 6 — Heap Problems
// ============================================================

// --- Kth Largest: min-heap of size K ---
function kthLargest(arr, k) {
  const heap = new MinHeap();
  for (const num of arr) {
    heap.insert(num);
    if (heap.size() > k) heap.extractMin();
  }
  return heap.peek();
}

console.log('\n=== KTH LARGEST ===');
const prices = [3, 2, 1, 5, 6, 4, 8, 7, 10, 9];
console.log('3rd largest:', kthLargest(prices, 3)); // 8

// --- Top K Frequent ---
function topKFrequent(arr, k) {
  const freqMap = new Map();
  for (const item of arr) freqMap.set(item, (freqMap.get(item) || 0) + 1);

  const pq = new PriorityQueue();
  for (const [item, freq] of freqMap) {
    pq.enqueue(item, freq);
    if (pq.size() > k) pq.dequeue();
  }

  const result = [];
  while (!pq.isEmpty()) result.push(pq.dequeue().value);
  return result.reverse();
}

console.log('\n=== TOP K FREQUENT ===');
const searches = ['iphone', 'samsung', 'iphone', 'pixel', 'samsung', 'iphone', 'samsung'];
console.log('Top 2:', topKFrequent(searches, 2));

// --- Merge K Sorted Arrays ---
function mergeKSortedArrays(arrays) {
  const result = [], pq = new PriorityQueue();
  for (let i = 0; i < arrays.length; i++) {
    if (arrays[i].length > 0) pq.enqueue({ arrayIdx: i, elemIdx: 0 }, arrays[i][0]);
  }
  while (!pq.isEmpty()) {
    const { value: info, priority: val } = pq.dequeue();
    result.push(val);
    const next = info.elemIdx + 1;
    if (next < arrays[info.arrayIdx].length) {
      pq.enqueue({ arrayIdx: info.arrayIdx, elemIdx: next }, arrays[info.arrayIdx][next]);
    }
  }
  return result;
}

console.log('\n=== MERGE K SORTED ARRAYS ===');
console.log('Merged:', mergeKSortedArrays([[1, 4, 7], [2, 5, 8], [3, 6, 9]]));

// --- Streaming Median (Two Heaps) ---
class MaxHeap {
  constructor() { this.heap = []; }
  size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }
  peek() { return this.isEmpty() ? null : this.heap[0]; }

  insert(value) {
    this.heap.push(value);
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.heap[p] >= this.heap[i]) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  extractMax() {
    if (this.isEmpty()) return null;
    if (this.size() === 1) return this.heap.pop();
    const max = this.heap[0];
    this.heap[0] = this.heap.pop();
    let i = 0;
    while (true) {
      let lg = i, l = 2 * i + 1, r = 2 * i + 2;
      if (l < this.heap.length && this.heap[l] > this.heap[lg]) lg = l;
      if (r < this.heap.length && this.heap[r] > this.heap[lg]) lg = r;
      if (lg === i) break;
      [this.heap[i], this.heap[lg]] = [this.heap[lg], this.heap[i]];
      i = lg;
    }
    return max;
  }
}

class MedianFinder {
  constructor() {
    this.maxHeap = new MaxHeap(); // lower half
    this.minHeap = new MinHeap(); // upper half
  }

  addNum(num) {
    if (this.maxHeap.isEmpty() || num <= this.maxHeap.peek()) this.maxHeap.insert(num);
    else this.minHeap.insert(num);

    if (this.maxHeap.size() > this.minHeap.size() + 1) this.minHeap.insert(this.maxHeap.extractMax());
    else if (this.minHeap.size() > this.maxHeap.size()) this.maxHeap.insert(this.minHeap.extractMin());
  }

  findMedian() {
    if (this.maxHeap.size() > this.minHeap.size()) return this.maxHeap.peek();
    return (this.maxHeap.peek() + this.minHeap.peek()) / 2;
  }
}

console.log('\n=== STREAMING MEDIAN ===');
const mf = new MedianFinder();
for (const t of [15, 8, 23, 12, 30]) {
  mf.addNum(t);
  console.log(`  Added ${t} -> Median: ${mf.findMedian()}`);
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Heap: complete binary tree as array. Parent=floor((i-1)/2).
// 2. peek O(1), insert O(log n), extractMin O(log n).
// 3. Heapify: array to heap in O(n), not O(n log n).
// 4. Heap Sort: O(n log n) guaranteed, in-place, not stable.
// 5. Kth Largest: min-heap of size K. O(n log K).
// 6. Top K Frequent: frequency map + min-heap of size K.
// 7. Merge K Sorted: min-heap of K elements. O(N log K).
// 8. Streaming Median: max-heap (lower) + min-heap (upper).
//    Insert O(log n), median O(1).

console.log('\n=== ALL HEAP EXAMPLES COMPLETE ===');
