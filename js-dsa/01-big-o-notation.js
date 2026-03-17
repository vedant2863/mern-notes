// ============================================================
// FILE 01: BIG-O NOTATION
// Topic: How algorithm performance scales with input size
// WHY: Every engineering decision — from sort algorithms to
//   database queries — depends on Big-O. It predicts and prevents disasters.
// ============================================================

// ============================================================
// STORY — The IRCTC Tatkal Booking Meltdown
// 10 million users hit IRCTC simultaneously at 10 AM. An O(n^2)
// search crashes the servers. O(n log n) handles the surge smoothly.
// ============================================================

// Big-O describes the RATE OF GROWTH, not exact time.
// It is about WORST CASE (upper bound), independent of hardware.

// ============================================================
// SECTION 1 — O(1) Constant Time
// PNR lookup in a hash table: same speed whether 1K or 100M records.
// ============================================================

function getFirstElement(arr) {
  return arr[0]; // O(1) — direct memory offset
}

function getPNRStatus(pnrMap, pnrNumber) {
  return pnrMap.get(pnrNumber); // O(1) average
}

const pnrDatabase = new Map();
pnrDatabase.set("4512789034", "CONFIRMED");
pnrDatabase.set("4512789035", "RAC 12");
console.log("O(1) — Array access:", getFirstElement([10, 20, 30]));
console.log("O(1) — PNR Lookup:", getPNRStatus(pnrDatabase, "4512789035"));

// Other O(1) ops: push/pop at end of array, arithmetic, variable assignment

// ============================================================
// SECTION 2 — O(log n) Logarithmic: Binary Search
// 12,000 sorted trains -> ~14 comparisons. Doubling data adds ONE step.
// ============================================================

function binarySearchTrain(sortedTrains, targetNumber) {
  let left = 0, right = sortedTrains.length - 1, steps = 0;
  while (left <= right) {
    steps++;
    const mid = Math.floor((left + right) / 2);
    if (sortedTrains[mid] === targetNumber) {
      console.log(`  Found in ${steps} steps (out of ${sortedTrains.length} trains)`);
      return mid;
    } else if (sortedTrains[mid] < targetNumber) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return -1;
}

const trainNumbers = Array.from({ length: 1000 }, (_, i) => 10001 + i * 3);
console.log("\nO(log n) — Binary Search:");
binarySearchTrain(trainNumbers, 10001 + 500 * 3);

// ============================================================
// SECTION 3 — O(n) Linear Time
// TTE scans the full passenger list. 500 passengers = 500 checks.
// ============================================================

function findPassenger(passengers, name) {
  for (let i = 0; i < passengers.length; i++) {
    if (passengers[i] === name) return i;
  }
  return -1;
}
console.log("\nO(n) — Linear search:", findPassenger(["Arjun", "Priya", "Rahul", "Vikram"], "Vikram"));

// ============================================================
// SECTION 4 — O(n log n) Linearithmic: Merge Sort
// Optimal comparison sort. "Sort by departure time" for 500 trains.
// ============================================================

function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right); // T(n) = 2T(n/2) + O(n) = O(n log n)
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  return [...result, ...left.slice(i), ...right.slice(j)];
}

console.log("\nO(n log n) — Merge Sort:", mergeSort([1430, 600, 2200, 830, 1100, 500]));

// ============================================================
// SECTION 5 — O(n^2) Quadratic: Nested Loop Disaster
// Checking every passenger against every other = 10K passengers
// means 100 million comparisons. Use a Set for O(n) instead.
// ============================================================

// BAD: O(n^2) nested loop
function findDuplicatesBrute(bookings) {
  const dupes = [];
  for (let i = 0; i < bookings.length; i++)
    for (let j = i + 1; j < bookings.length; j++)
      if (bookings[i] === bookings[j]) dupes.push(bookings[i]);
  return dupes;
}

// GOOD: O(n) with Set
function findDuplicatesOptimal(bookings) {
  const seen = new Set(), dupes = [];
  for (const b of bookings) {
    if (seen.has(b)) dupes.push(b);
    else seen.add(b);
  }
  return dupes;
}

const bookings = ["PNR001", "PNR002", "PNR003", "PNR001", "PNR002"];
console.log("\nO(n^2) — Brute duplicates:", findDuplicatesBrute(bookings));
console.log("O(n)   — Optimal duplicates:", findDuplicatesOptimal(bookings));

// ============================================================
// SECTION 6 — O(2^n) Exponential and O(n!) Factorial
// Naive fib is O(2^n). Memoization rescues it to O(n).
// Permutations are O(n!) — even n=15 is 1.3 trillion.
// ============================================================

function fibNaive(n) {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2); // O(2^n)
}

function fibMemo(n, memo = {}) {
  if (n in memo) return memo[n];
  if (n <= 1) return n;
  memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  return memo[n]; // O(n) with memoization
}

console.log("\nO(2^n) — Naive fib(10):", fibNaive(10));
console.log("O(n)   — Memo fib(45):", fibMemo(45));

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest))
      result.push([arr[i], ...perm]);
  }
  return result;
}
console.log("O(n!) — Permutations [1,2,3]:", permutations([1, 2, 3]).length, "= 3!");

// ============================================================
// SECTION 7 — Complexity Ranking & Practical Limits
// ============================================================

console.log(`
RANKING: O(1) > O(log n) > O(n) > O(n log n) > O(n^2) > O(2^n) > O(n!)

PRACTICAL LIMITS (10^8 ops/sec):
O(n) -> n ~ 10^8 | O(n log n) -> n ~ 10^7 | O(n^2) -> n ~ 10^4
O(2^n) -> n ~ 25 | O(n!) -> n ~ 12
`);

// ============================================================
// SECTION 8 — Analysis Rules: How to Count Big-O
// ============================================================

// Rule 1: Drop constants — O(2n) = O(n)
// Rule 2: Drop non-dominant terms — O(n^2 + n) = O(n^2)
// Rule 3: Nested loops multiply — O(n) * O(n) = O(n^2)
// Rule 4: Sequential loops add — O(n) + O(m) = O(n + m)
// Rule 5: Different inputs stay separate — O(a * b), NOT O(n^2)

// Two separate loops = O(n) + O(n) = O(n), NOT O(n^2)
// Constant inner loop = O(n) * O(5) = O(n), NOT O(n^2)

// ============================================================
// SECTION 9 — Space Complexity: Time vs Space Tradeoff
// ============================================================

// O(n^2) time, O(1) space
function hasDuplicatesBrute(arr) {
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      if (arr[i] === arr[j]) return true;
  return false;
}

// O(n) time, O(n) space — trading space for speed
function hasDuplicatesSet(arr) {
  const seen = new Set();
  for (const item of arr) {
    if (seen.has(item)) return true;
    seen.add(item);
  }
  return false;
}

console.log("Has dupes (brute O(n^2)/O(1)):", hasDuplicatesBrute([12, 45, 23, 12]));
console.log("Has dupes (set   O(n)/O(n)):", hasDuplicatesSet([12, 45, 23, 12]));

// Space complexity = EXTRA memory. Recursive calls use O(n) stack frames.
// Amortized: push() is O(1) amortized — occasional O(n) resize averaged over many O(1)s.

// ============================================================
// SECTION 10 — Quick-Fire Snippets: Identify the Big-O
// ============================================================

// O(1) — formula, no loops
function snippet1(n) { return n * (n + 1) / 2; }
console.log("\nSnippet O(1):", snippet1(100));

// O(log n) — halving each iteration
function snippet5(n) { let c = 0, i = n; while (i > 1) { i = Math.floor(i / 2); c++; } return c; }
console.log("Snippet O(log n):", snippet5(1024));

// O(sqrt(n)) — prime check
function snippet7(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
console.log("Snippet O(sqrt(n)):", snippet7(97));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Big-O = GROWTH RATE of time/space as input grows
// 2. Ranking: O(1) > O(log n) > O(n) > O(n log n) > O(n^2) > O(2^n) > O(n!)
// 3. Always analyze WORST CASE
// 4. Drop constants and non-dominant terms
// 5. Space complexity = extra memory, including call stack
// 6. Nested loops multiply, sequential loops add
// 7. Different inputs stay separate: O(a * b), not O(n^2)
// ============================================================
