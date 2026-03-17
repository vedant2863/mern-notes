// ============================================================
// FILE 11: SEARCHING ALGORITHMS
// Topic: Linear Search, Binary Search, and Powerful Variations
// WHY: Choosing O(log n) over O(n) is the difference between
//   milliseconds and minutes at scale.
// ============================================================

// ============================================================
// STORY: Amazon searches 200M+ product listings every second.
// Binary search needs only ~27 comparisons for 200M items.
// ============================================================

// ============================================================
// SECTION 1 — Linear Search
// ============================================================

// WHY: Simplest search. Works on unsorted data. But O(n) — checks
// every element in the worst case.

function linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}

// Big-O: Time O(n), Space O(1)

console.log('=== LINEAR SEARCH ===');
const products = ['Laptop', 'Phone', 'Tablet', 'Headphones', 'Charger'];
console.log('Search "Tablet":', linearSearch(products, 'Tablet'));    // 2
console.log('Search "Keyboard":', linearSearch(products, 'Keyboard')); // -1

// ============================================================
// SECTION 2 — Binary Search (Iterative)
// ============================================================

// WHY: Halves the search space each step. O(log n).
// Prerequisite: data MUST be sorted.

function binarySearch(arr, target) {
  let left = 0, right = arr.length - 1;

  while (left <= right) {
    // Overflow-safe midpoint (universal best practice)
    const mid = left + Math.floor((right - left) / 2);

    if (arr[mid] === target) return mid;
    else if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }

  return -1;
}

// Big-O: Time O(log n), Space O(1). For n=1,000,000 -> ~20 comparisons.

const sortedPrices = [99, 199, 299, 499, 599, 799, 999, 1299, 1499, 1999, 2499];
console.log('\n=== BINARY SEARCH ===');
console.log('Search 799:', binarySearch(sortedPrices, 799));    // 5
console.log('Search 1000:', binarySearch(sortedPrices, 1000));  // -1

// ============================================================
// SECTION 3 — Binary Search Variations
// ============================================================

// --- Variation 1: Find First Occurrence (Leftmost) ---
// WHY: Standard binary search returns ANY occurrence. This finds the FIRST.
function findFirstOccurrence(arr, target) {
  let left = 0, right = arr.length - 1, result = -1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] === target) { result = mid; right = mid - 1; }
    else if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return result;
}

// --- Variation 2: Find Last Occurrence (Rightmost) ---
function findLastOccurrence(arr, target) {
  let left = 0, right = arr.length - 1, result = -1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] === target) { result = mid; left = mid + 1; }
    else if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return result;
}

const ratings = [1, 2, 3, 3, 3, 3, 4, 5, 5, 5];
console.log('\n=== FIRST / LAST OCCURRENCE ===');
console.log('First 3:', findFirstOccurrence(ratings, 3)); // 2
console.log('Last 3:', findLastOccurrence(ratings, 3));   // 5

// --- Variation 3: Search in Rotated Sorted Array ---
// WHY: Sorted array rotated at unknown pivot. Determine which half
// is sorted, then decide which side the target is in.
function searchRotated(arr, target) {
  let left = 0, right = arr.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] === target) return mid;

    if (arr[left] <= arr[mid]) {
      if (arr[left] <= target && target < arr[mid]) right = mid - 1;
      else left = mid + 1;
    } else {
      if (arr[mid] < target && target <= arr[right]) left = mid + 1;
      else right = mid - 1;
    }
  }
  return -1;
}

const rotated = [15, 18, 22, 30, 2, 5, 8, 10, 12];
console.log('\n=== ROTATED ARRAY SEARCH ===');
console.log('Search 5:', searchRotated(rotated, 5));   // 5
console.log('Search 20:', searchRotated(rotated, 20)); // -1

// --- Variation 4: Find Peak Element ---
// WHY: Compare mid with mid+1 to determine ascending/descending side.
function findPeakElement(arr) {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] < arr[mid + 1]) left = mid + 1;
    else right = mid;
  }
  return left;
}

const mountain = [1, 3, 7, 12, 18, 15, 9, 6, 2];
console.log('\n=== PEAK ELEMENT ===');
console.log('Peak index:', findPeakElement(mountain), '-> value:', mountain[findPeakElement(mountain)]); // 4 -> 18

// --- Variation 5: Search in 2D Sorted Matrix ---
// WHY: Start top-right. Each comparison eliminates a row OR column. O(m + n).
function searchMatrix(matrix, target) {
  if (matrix.length === 0) return [-1, -1];
  let row = 0, col = matrix[0].length - 1;

  while (row < matrix.length && col >= 0) {
    if (matrix[row][col] === target) return [row, col];
    else if (matrix[row][col] > target) col--;
    else row++;
  }
  return [-1, -1];
}

const priceMatrix = [
  [100, 200, 300, 400],
  [500, 600, 700, 800],
  [900, 1000, 1100, 1200],
];
console.log('\n=== 2D MATRIX SEARCH ===');
console.log('Search 700:', searchMatrix(priceMatrix, 700)); // [1, 2]

// ============================================================
// SECTION 4 — Binary Search on Answer
// ============================================================

// WHY: When the answer space is monotonic, binary search for the
// optimal value. Pattern: "find minimum X such that condition holds."

function shipWithinDays(weights, days) {
  let left = Math.max(...weights);
  let right = weights.reduce((sum, w) => sum + w, 0);

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (canShip(weights, days, mid)) right = mid;
    else left = mid + 1;
  }
  return left;
}

function canShip(weights, days, capacity) {
  let daysNeeded = 1, currentLoad = 0;
  for (const weight of weights) {
    if (currentLoad + weight > capacity) { daysNeeded++; currentLoad = 0; }
    currentLoad += weight;
  }
  return daysNeeded <= days;
}

// Big-O: O(n * log(sum - max))

console.log('\n=== BINARY SEARCH ON ANSWER: SHIP PACKAGES ===');
const packages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
console.log('Min capacity for 5 days:', shipWithinDays(packages, 5)); // 15

// ============================================================
// SECTION 5 — Built-in Search & Hash-Based Lookups
// ============================================================

// WHY: Array.indexOf/includes are O(n). Set.has/Map.has are O(1).
// For frequent lookups, convert to Set/Map.

const pincodes = [110001, 400001, 560001, 600001, 500001];
const pincodeSet = new Set(pincodes);

console.log('\n=== BUILT-IN vs SET ===');
console.log('indexOf 560001:', pincodes.indexOf(560001));     // O(n)
console.log('Set.has(560001):', pincodeSet.has(560001));       // O(1)

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Linear Search: O(n), works on unsorted data.
// 2. Binary Search: O(log n), requires sorted data.
//    Always use mid = left + Math.floor((right - left) / 2).
// 3. Variations are the real interview skill:
//    - First/last occurrence: keep searching after finding target
//    - Rotated array: determine which half is sorted
//    - Peak element: compare mid with mid+1
//    - 2D matrix: start top-right, O(m + n)
// 4. Binary Search on Answer: monotonic answer space ->
//    binary search for optimal value.
// 5. Use Set/Map for O(1) lookups when searching frequently.

console.log('\n=== ALL SEARCHING EXAMPLES COMPLETE ===');
