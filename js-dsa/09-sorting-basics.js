// ============================================================
// FILE 09: SORTING BASICS — BUBBLE, SELECTION, AND INSERTION SORT
// Topic: Fundamental O(n^2) sorts and their trade-offs
// WHY: Understanding basic sorts builds intuition for O(n log n).
//   Insertion sort is used inside TimSort for small sub-arrays.
// ============================================================

// ============================================================
// STORY — Flipkart Product Sorting
// 50 million products sorted by price, rating, relevance. Wrong
// algorithm = 30 seconds instead of 3. For small pages (20 items),
// even bubble sort works. For full catalog, you need O(n log n).
// ============================================================

// Sorting properties to know:
// STABLE: equal elements keep original relative order
// IN-PLACE: O(1) extra memory
// ADAPTIVE: faster on nearly-sorted data
//
// | Algorithm  | Best  | Avg    | Worst  | Space | Stable | Adaptive |
// |------------|-------|--------|--------|-------|--------|----------|
// | Bubble     | O(n)  | O(n^2) | O(n^2) | O(1) | Yes    | Yes      |
// | Selection  | O(n^2)| O(n^2) | O(n^2) | O(1) | No     | No       |
// | Insertion  | O(n)  | O(n^2) | O(n^2) | O(1) | Yes    | Yes      |
// | JS .sort() | O(n)  | O(nlogn)| O(nlogn)| O(n) | Yes   | Yes      |

// ============================================================
// SECTION 1 — Bubble Sort
// Compare adjacent pairs, swap if wrong. Largest "bubbles up" each pass.
// Early-exit flag makes best case O(n) on sorted input.
// ============================================================

function bubbleSort(arr) {
  const a = [...arr], n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break; // Already sorted — early exit
  }
  return a;
}

console.log("=== Bubble Sort ===");
console.log("Sorted:", bubbleSort([64, 34, 25, 12, 22, 11, 90]));
console.log("Already sorted:", bubbleSort([1, 2, 3, 4, 5])); // O(n) best case

// ============================================================
// SECTION 2 — Selection Sort
// Find minimum in unsorted portion, swap to front. Repeat.
// Always O(n^2) comparisons. Only O(n) swaps — useful when writes are expensive.
// NOT stable: swapping can reorder equal elements.
// ============================================================

function selectionSort(arr) {
  const a = [...arr], n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++)
      if (a[j] < a[minIdx]) minIdx = j;
    if (minIdx !== i) [a[i], a[minIdx]] = [a[minIdx], a[i]];
  }
  return a;
}

console.log("\n=== Selection Sort ===");
console.log("Sorted:", selectionSort([64, 25, 12, 22, 11]));
// Not stable: [3a, 3b, 1] -> swap 3a with 1 -> [1, 3b, 3a] — order changed

// ============================================================
// SECTION 3 — Insertion Sort
// Insert each element into its correct position in the sorted prefix.
// Like sorting cards in a Rummy hand — shift right, slide card in.
// Best O(n) on nearly sorted data. Used inside TimSort for n < 16-32.
// ============================================================

function insertionSort(arr) {
  const a = [...arr], n = a.length;
  for (let i = 1; i < n; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j]; // shift right
      j--;
    }
    a[j + 1] = key; // insert at correct position
  }
  return a;
}

console.log("\n=== Insertion Sort ===");
console.log("Sorted:", insertionSort([12, 11, 13, 5, 6]));
console.log("Nearly sorted:", insertionSort([1, 2, 4, 3, 5])); // Very fast

// ============================================================
// SECTION 4 — Performance Comparison
// ============================================================

function generateRandomArray(size) {
  return Array.from({ length: size }, () => Math.floor(Math.random() * size));
}

console.log("\n=== Benchmark (n = 5000) ===");
const original = generateRandomArray(5000);

let start, copy;

copy = [...original]; start = Date.now();
bubbleSort(copy);
console.log(`Bubble:    ${Date.now() - start}ms`);

copy = [...original]; start = Date.now();
selectionSort(copy);
console.log(`Selection: ${Date.now() - start}ms`);

copy = [...original]; start = Date.now();
insertionSort(copy);
console.log(`Insertion: ${Date.now() - start}ms`);

copy = [...original]; start = Date.now();
copy.sort((a, b) => a - b);
console.log(`JS .sort(): ${Date.now() - start}ms`);

// ============================================================
// SECTION 5 — JavaScript .sort() Gotchas
// Default sort is LEXICOGRAPHIC (string-based). Always use a comparator.
// ============================================================

console.log("\n=== JS .sort() Gotchas ===");
const ages = [10, 9, 80, 3, 21];
console.log("Default (WRONG):", [...ages].sort());            // [10, 21, 3, 80, 9]
console.log("Numeric (RIGHT):", [...ages].sort((a, b) => a - b)); // [3, 9, 10, 21, 80]

// Multi-key sort: rating desc, then price asc
const products = [
  { name: "iPhone 15", price: 79999, rating: 4.5 },
  { name: "Samsung S24", price: 69999, rating: 4.7 },
  { name: "OnePlus 12", price: 49999, rating: 4.6 },
  { name: "Pixel 8", price: 59999, rating: 4.8 },
];

const sorted = [...products].sort((a, b) => {
  if (b.rating !== a.rating) return b.rating - a.rating;
  return a.price - b.price;
});
console.log("\nBy rating desc, price asc:");
sorted.forEach(p => console.log(`  ${p.rating} Rs.${p.price} - ${p.name}`));

// TimSort is STABLE: if you sort by price first, then rating,
// same-rating products keep their price order.

// ============================================================
// SECTION 6 — Algorithm Selection Guide
// ============================================================

console.log(`
| Scenario         | Best Algorithm                      |
|------------------|-------------------------------------|
| n < 20           | Insertion Sort (low overhead)        |
| Nearly sorted    | Insertion Sort (O(n) best case)      |
| Minimal swaps    | Selection Sort (O(n) swaps)          |
| General purpose  | JS .sort() / TimSort                 |
| Need stability   | Merge Sort / Insertion Sort          |
| Large dataset    | Quick Sort / Merge Sort (File 10)    |
| Integers in range| Counting / Radix Sort (File 10)     |
`);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Bubble: adjacent swaps, O(n) best with early-exit. Stable.
// 2. Selection: find min, swap to front. Always O(n^2). Not stable.
//    Only advantage: O(n) swaps.
// 3. Insertion: insert into sorted prefix. O(n) best for nearly sorted.
//    Used inside TimSort/IntroSort for small sub-arrays.
// 4. JS .sort() = TimSort: O(n log n), stable, adaptive.
//    ALWAYS pass a comparator for numbers: (a, b) => a - b.
// 5. Stability matters for multi-key sorts.
// 6. All O(n^2) sorts are in-place: O(1) extra space.
// ============================================================
