// ============================================================
// FILE 02: ARRAYS DEEP DIVE
// Topic: Array internals, operations, and classic array algorithms
// WHY: Arrays are the backbone of every app. Understanding their
//   Big-O and V8 internals prevents performance disasters.
// ============================================================

// ============================================================
// STORY — Zomato Restaurant Listings
// 500+ restaurants sorted by distance, rating, or delivery time.
// Each sort/filter is an array operation with real Big-O consequences.
// ============================================================

// ============================================================
// SECTION 1 — V8 Array Internals
// ============================================================

// V8 classifies arrays by "element kinds" — keeping arrays
// homogeneous (same type) gives best performance.

// PACKED_SMI: all small integers — FASTEST
const smiArray = [1, 2, 3, 4, 5];

// PACKED_DOUBLE: has floating-point numbers
const doubleArray = [1, 2, 3.5, 4, 5];

// PACKED_ELEMENTS: mixed types — SLOWEST packed
const mixedArray = [1, "hello", { name: "Zomato" }, true];

// HOLEY: missing indices — forces prototype chain lookups
const holeyArray = [1, 2, , 4, 5]; // HOLEY_SMI

// GOOD: pre-allocate with fill() to avoid holes
const goodArray = new Array(100).fill(0);
// BAD: creates 100 holes — marked HOLEY forever
const badArray = new Array(100);

// Key rule: element kinds only DEGRADE, never upgrade back.

// ============================================================
// SECTION 2 — Array Operations Big-O
// ============================================================

const restaurants = ["Biryani House", "Dosa Palace", "Chai Point", "Pizza Hub"];
console.log("O(1) — Access:", restaurants[2]);

const cart = ["Butter Chicken", "Naan"];
cart.push("Raita");        // O(1) amortized
console.log("O(1) — Push:", cart);
console.log("O(1) — Pop:", cart.pop(), "| Cart:", cart);

const queue = ["Order1", "Order2", "Order3"];
queue.unshift("Priority"); // O(n) — shifts everything right
console.log("O(n) — Unshift:", queue);

console.log(`
| Operation         | Big-O     | Why                          |
|-------------------|-----------|------------------------------|
| Access arr[i]     | O(1)      | Direct memory offset         |
| Push/Pop (end)    | O(1)*     | Append/remove at end         |
| Shift/Unshift     | O(n)      | Must shift all elements      |
| Splice            | O(n)      | Shifting after splice point  |
| indexOf/includes  | O(n)      | Linear scan                  |
| Sort              | O(n lg n) | Comparison-based             |
* amortized
`);

// ============================================================
// SECTION 3 — Two-Pointer: Pair with Target Sum
// O(n) on sorted array instead of O(n^2) brute force.
// ============================================================

function twoSumSorted(sortedArr, target) {
  let left = 0, right = sortedArr.length - 1;
  while (left < right) {
    const sum = sortedArr[left] + sortedArr[right];
    if (sum === target) return [left, right];
    else if (sum < target) left++;
    else right--;
  }
  return null; // O(n) — each element visited at most once
}

const deliveryTimes = [10, 15, 20, 25, 30, 35, 40, 45];
console.log("Two-Pointer target 50:", twoSumSorted(deliveryTimes, 50)); // [0,6]

// ============================================================
// SECTION 4 — Kadane's Algorithm: Maximum Subarray Sum
// Find the contiguous subarray with maximum total. O(n), O(1).
// ============================================================

function maxSubarraySum(arr) {
  let maxSum = arr[0], currentSum = arr[0];
  for (let i = 1; i < arr.length; i++) {
    // Extend current subarray or start fresh — whichever is larger
    currentSum = Math.max(arr[i], currentSum + arr[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  return maxSum;
}

console.log("\nKadane's:", maxSubarraySum([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6

// ============================================================
// SECTION 5 — Prefix Sum: O(1) Range Queries
// O(n) preprocessing, then every range sum query is O(1).
// ============================================================

function buildPrefixSum(arr) {
  const prefix = new Array(arr.length + 1).fill(0);
  for (let i = 0; i < arr.length; i++) prefix[i + 1] = prefix[i] + arr[i];
  return prefix;
}

function rangeSum(prefix, left, right) {
  return prefix[right + 1] - prefix[left]; // O(1)
}

const dailyOrders = [5, 12, 8, 3, 15, 7, 20, 1, 9, 11];
const prefix = buildPrefixSum(dailyOrders);
console.log("\nPrefix sum days 2-5:", rangeSum(prefix, 2, 5)); // 33

// ============================================================
// SECTION 6 — Dutch National Flag: Three-Way Partition
// Sort 0s, 1s, 2s in O(n) time, O(1) space — one pass.
// ============================================================

function dutchNationalFlag(arr) {
  let low = 0, mid = 0, high = arr.length - 1;
  while (mid <= high) {
    if (arr[mid] === 0) {
      [arr[low], arr[mid]] = [arr[mid], arr[low]];
      low++; mid++;
    } else if (arr[mid] === 1) {
      mid++;
    } else {
      [arr[mid], arr[high]] = [arr[high], arr[mid]];
      high--; // Don't increment mid — swapped element needs checking
    }
  }
  return arr;
}

console.log("\nDutch Flag:", dutchNationalFlag([2, 0, 1, 2, 0, 1, 0, 2, 1, 0]));

// ============================================================
// SECTION 7 — Rotate Array (Three Reversals Trick)
// O(n) time, O(1) space — beats naive O(n*k) shift approach.
// ============================================================

function reverseSection(arr, start, end) {
  while (start < end) {
    [arr[start], arr[end]] = [arr[end], arr[start]];
    start++; end--;
  }
}

function rotateArray(arr, k) {
  const n = arr.length;
  k = k % n;
  if (k === 0) return arr;
  reverseSection(arr, 0, n - 1);   // Reverse all
  reverseSection(arr, 0, k - 1);   // Reverse first k
  reverseSection(arr, k, n - 1);   // Reverse rest
  return arr;
}

console.log("\nRotate by 3:", rotateArray([1, 2, 3, 4, 5, 6, 7], 3)); // [5,6,7,1,2,3,4]

// ============================================================
// SECTION 8 — Merge Two Sorted Arrays
// Foundation of merge sort. O(n + m) time.
// ============================================================

function mergeSortedArrays(arr1, arr2) {
  const result = [];
  let i = 0, j = 0;
  while (i < arr1.length && j < arr2.length) {
    if (arr1[i] <= arr2[j]) result.push(arr1[i++]);
    else result.push(arr2[j++]);
  }
  while (i < arr1.length) result.push(arr1[i++]);
  while (j < arr2.length) result.push(arr2[j++]);
  return result;
}

console.log("\nMerge sorted:", mergeSortedArrays([3.5, 4.0, 4.2], [3.8, 4.1, 4.5]));

// ============================================================
// SECTION 9 — Classic Problems
// ============================================================

// Move Zeroes to End — write-pointer pattern, O(n), O(1)
function moveZeroes(arr) {
  let write = 0;
  for (let read = 0; read < arr.length; read++)
    if (arr[read] !== 0) arr[write++] = arr[read];
  while (write < arr.length) arr[write++] = 0;
  return arr;
}
console.log("\nMove zeroes:", moveZeroes([0, 1001, 0, 1003, 0, 0, 1007]));

// Find Missing Number — sum formula, O(n), O(1)
function findMissingNumber(arr, n) {
  return n * (n + 1) / 2 - arr.reduce((s, x) => s + x, 0);
}
console.log("Missing:", findMissingNumber([0, 1, 2, 3, 5, 6, 7, 8, 9], 9)); // 4

// Max Profit (Buy/Sell Stock) — track min price, O(n), O(1)
function maxProfit(prices) {
  let minPrice = Infinity, best = 0;
  for (const price of prices) {
    minPrice = Math.min(minPrice, price);
    best = Math.max(best, price - minPrice);
  }
  return best;
}
console.log("Max profit:", maxProfit([120, 95, 110, 85, 130, 105, 140])); // 55

// Sliding Window: Max Sum of K Consecutive — O(n), O(1)
function maxSumKConsecutive(arr, k) {
  if (arr.length < k) return null;
  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += arr[i];
  let maxSum = windowSum;
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k]; // slide: add new, remove old
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}
console.log("Max sum of 3:", maxSumKConsecutive([100, 200, 300, 150, 400, 350, 250, 500], 3));

// Remove Duplicates from Sorted Array — O(n), O(1)
function removeDuplicatesSorted(arr) {
  if (arr.length <= 1) return arr.length;
  let write = 1;
  for (let i = 1; i < arr.length; i++)
    if (arr[i] !== arr[i - 1]) arr[write++] = arr[i];
  return { count: write, unique: arr.slice(0, write) };
}
console.log("Dedup sorted:", removeDuplicatesSorted([1, 1, 2, 2, 2, 3, 4, 4, 5]));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Access by index O(1) — the fundamental array advantage
// 2. push/pop O(1), shift/unshift O(n) — huge difference
// 3. Keep arrays homogeneous for V8 optimization; avoid holes
// 4. Two-pointer: O(n) for sorted array pair problems
// 5. Kadane's: max subarray sum in O(n)
// 6. Prefix sum: O(n) build, O(1) per range query
// 7. Dutch National Flag: 3-way partition in O(n)
// 8. Three reversals: rotate array in O(n) time, O(1) space
// 9. Sliding window: avoid recalculating overlapping sums
// ============================================================
