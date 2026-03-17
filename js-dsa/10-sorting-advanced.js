// ============================================================
// FILE 10: ADVANCED SORTING — MERGE SORT, QUICK SORT, AND BEYOND
// Topic: O(n log n) comparison sorts and O(n) non-comparison sorts
// WHY: Merge sort and quick sort handle millions of data points
//   where O(n^2) sorts from File 09 fail completely.
// ============================================================

// ============================================================
// STORY: Google indexes billions of pages. Sorting by relevance
// requires O(n log n) algorithms. For n = 1,000,000:
//   O(n^2) = ~17 minutes, O(n log n) = ~0.02 seconds.
// ============================================================

// ============================================================
// SECTION 1 — Merge Sort: Divide, Sort, Merge
// ============================================================

// WHY: Splits in half, recursively sorts each half, then merges.
// O(n log n) always — no worst case.

//  [38, 27, 43, 3]        [3, 27, 38, 43]
//     /         \             /         \
//  [38, 27]   [43, 3]    [27, 38]    [3, 43]
//   /   \      /   \      /   \       /   \
//  [38] [27]  [43] [3]  [38] [27]   [43] [3]

// --- merge: combine two sorted arrays into one ---
// Two pointers compare current elements, pick the smaller one.
// Time: O(n + m), Space: O(n + m)
function merge(left, right) {
  const result = [];
  let i = 0, j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) { result.push(left[i]); i++; }
    else { result.push(right[j]); j++; }
  }

  while (i < left.length) { result.push(left[i]); i++; }
  while (j < right.length) { result.push(right[j]); j++; }

  return result;
}

// --- mergeSort: recursive divide-and-conquer ---
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  return merge(mergeSort(arr.slice(0, mid)), mergeSort(arr.slice(mid)));
}

console.log("=== Merge Sort ===");
console.log("Result:", mergeSort([38, 27, 43, 3, 9, 82, 10]));

// Big-O: Best/Avg/Worst O(n log n), Space O(n), Stable: YES
// Great for linked lists (O(1) merge space) and external sorting (disk).
// Downside: O(n) extra space, slightly slower than quicksort in practice.

// ============================================================
// SECTION 2 — Quick Sort: Pivot, Partition, Recurse
// ============================================================

// WHY: In-place O(log n) stack, cache-friendly, fastest comparison
// sort in practice for random in-memory data.

// --- Lomuto Partition ---
// Pivot is LAST element. Boundary `i` keeps elements <= pivot on left.
function lomutoPartition(arr, low, high) {
  const pivot = arr[high];
  let i = low;
  for (let j = low; j < high; j++) {
    if (arr[j] <= pivot) { [arr[i], arr[j]] = [arr[j], arr[i]]; i++; }
  }
  [arr[i], arr[high]] = [arr[high], arr[i]];
  return i;
}

// --- Quick Sort with Random Pivot ---
// Random pivot prevents O(n^2) on sorted input.
function quickSort(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    const ri = low + Math.floor(Math.random() * (high - low + 1));
    [arr[ri], arr[high]] = [arr[high], arr[ri]];
    const pi = lomutoPartition(arr, low, high);
    quickSort(arr, low, pi - 1);
    quickSort(arr, pi + 1, high);
  }
  return arr;
}

console.log("\n=== Quick Sort (random pivot) ===");
const qArr = [10, 80, 30, 90, 40, 50, 70];
console.log("Before:", [...qArr]);
quickSort(qArr);
console.log("After: ", qArr);

// Big-O: Best/Avg O(n log n), Worst O(n^2) (mitigated by random pivot)
// Space O(log n), Stable: NO, Cache-friendly: YES

// ============================================================
// SECTION 3 — Counting Sort: Beyond Comparison
// ============================================================

// WHY: Comparison sorts can't beat O(n log n). If values are integers
// in a known range, counting sort achieves O(n + k).

function countingSort(arr) {
  if (arr.length <= 1) return arr;
  const max = Math.max(...arr), min = Math.min(...arr);
  const range = max - min + 1;

  const count = new Array(range).fill(0);
  for (const num of arr) count[num - min]++;
  for (let i = 1; i < range; i++) count[i] += count[i - 1];

  const output = new Array(arr.length);
  for (let i = arr.length - 1; i >= 0; i--) {
    output[count[arr[i] - min] - 1] = arr[i];
    count[arr[i] - min]--;
  }
  return output;
}

console.log("\n=== Counting Sort ===");
console.log("Result:", countingSort([4, 2, 2, 8, 3, 3, 1, 7, 5, 4, 3, 2, 8, 1, 4]).join(", "));

// Big-O: Time O(n + k), Space O(n + k), Stable: YES
// When k <= n: effectively O(n). When k >> n: worse than O(n log n).
// Only works for integers. Range must be reasonable.

// ============================================================
// SECTION 4 — Radix Sort: Digit by Digit
// ============================================================

// WHY: Sorts digit by digit (LSD to MSD) using counting sort per pass.
// For fixed-length integers: effectively O(n).

function radixSort(arr) {
  if (arr.length <= 1) return arr;
  const result = [...arr];
  const max = Math.max(...result);
  const digits = Math.floor(Math.log10(max)) + 1;

  let exp = 1;
  for (let d = 0; d < digits; d++) {
    const count = new Array(10).fill(0);
    const output = new Array(result.length);

    for (const num of result) count[Math.floor(num / exp) % 10]++;
    for (let i = 1; i < 10; i++) count[i] += count[i - 1];
    for (let i = result.length - 1; i >= 0; i--) {
      const digit = Math.floor(result[i] / exp) % 10;
      output[count[digit] - 1] = result[i];
      count[digit]--;
    }
    for (let i = 0; i < result.length; i++) result[i] = output[i];
    exp *= 10;
  }
  return result;
}

console.log("\n=== Radix Sort (LSD) ===");
console.log("Result:", radixSort([170, 45, 75, 90, 802, 24, 2, 66, 345, 111]).join(", "));

// Big-O: Time O(d * (n + k)), Space O(n + k), Stable: YES

// ============================================================
// SECTION 5 — Performance Comparison
// ============================================================

function genRandom(size) { return Array.from({ length: size }, () => Math.floor(Math.random() * size)); }

console.log("\n=== Performance Comparison ===");
for (const size of [10000, 50000]) {
  console.log(`\n--- n = ${size.toLocaleString()} ---`);
  const orig = genRandom(size);
  let t, c;

  c = [...orig]; t = Date.now(); mergeSort(c);             console.log(`  Merge Sort:    ${Date.now() - t}ms`);
  c = [...orig]; t = Date.now(); quickSort(c);              console.log(`  Quick Sort:    ${Date.now() - t}ms`);
  c = [...orig]; t = Date.now(); countingSort(c);           console.log(`  Counting Sort: ${Date.now() - t}ms`);
  c = [...orig]; t = Date.now(); c.sort((a, b) => a - b);  console.log(`  JS .sort():    ${Date.now() - t}ms`);
}

// ============================================================
// SECTION 6 — Merge Sort on Linked List
// ============================================================

// WHY: On linked lists, merge sort needs no extra array space —
// just re-point node pointers. O(1) merge space.

class ListNode {
  constructor(val) { this.val = val; this.next = null; }
}

function sortLinkedList(head) {
  if (!head || !head.next) return head;
  let slow = head, fast = head.next;
  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }
  const right = slow.next; slow.next = null;
  return mergeLLists(sortLinkedList(head), sortLinkedList(right));
}

function mergeLLists(l1, l2) {
  const dummy = new ListNode(0); let c = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { c.next = l1; l1 = l1.next; }
    else { c.next = l2; l2 = l2.next; }
    c = c.next;
  }
  c.next = l1 || l2;
  return dummy.next;
}

console.log("\n=== Merge Sort on Linked List ===");
let llH = new ListNode(4); llH.next = new ListNode(2);
llH.next.next = new ListNode(1); llH.next.next.next = new ListNode(3);
function printLL(h) { const v = []; while (h) { v.push(h.val); h = h.next; } console.log(v.join(" -> ")); }
console.log("Before:"); printLL(llH);
llH = sortLinkedList(llH);
console.log("After: "); printLL(llH);

// ============================================================
// SECTION 7 — Multi-Key Sorting
// ============================================================

// WHY: Stable sorts preserve relative order of equal elements,
// enabling multi-key sorting via a single comparator.

console.log("\n=== Multi-Key Sorting ===");
const groceries = [
  { name: "Amul Butter", cat: "Dairy", price: 56, rating: 4.5 },
  { name: "Tata Salt", cat: "Essentials", price: 24, rating: 4.2 },
  { name: "Mother Dairy Milk", cat: "Dairy", price: 68, rating: 4.7 },
  { name: "Aashirvaad Atta", cat: "Essentials", price: 320, rating: 4.6 },
  { name: "Amul Cheese", cat: "Dairy", price: 99, rating: 4.3 },
];

const sorted = [...groceries].sort((a, b) => {
  if (a.cat !== b.cat) return a.cat.localeCompare(b.cat);
  if (a.price !== b.price) return a.price - b.price;
  return b.rating - a.rating;
});

let lastCat = "";
for (const item of sorted) {
  if (item.cat !== lastCat) { console.log(`\n  [${item.cat}]`); lastCat = item.cat; }
  console.log(`    Rs.${item.price} Rating:${item.rating} ${item.name}`);
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Merge Sort: O(n log n) always, stable, O(n) space.
//    Best for linked lists and external sorting.
// 2. Quick Sort: O(n log n) avg, in-place O(log n), cache-friendly.
//    Use random pivot to avoid O(n^2). NOT stable.
// 3. Counting Sort: O(n+k) for integers in known range.
// 4. Radix Sort: O(d*(n+k)), digit-by-digit using counting sort.
// 5. O(n log n) lower bound applies ONLY to comparison sorts.
// 6. Stability matters for multi-key sorting.
// 7. In practice: JS .sort() (TimSort) handles most cases well.

console.log("\n=== FILE 10 COMPLETE ===");
