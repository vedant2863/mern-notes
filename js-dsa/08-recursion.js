// ============================================================
// FILE 08: RECURSION — DIVIDE, CONQUER, AND SELF-SIMILARITY
// Topic: Recursive thinking, call stack, memoization, and patterns
// WHY: Recursion is the backbone of trees, graphs, backtracking,
//   and divide-and-conquer. Without it, advanced DSA is impenetrable.
// ============================================================

// ============================================================
// STORY — IRCTC Train Route Finder
// Finding all routes from Delhi to Chennai: at each junction,
// the path branches into sub-routes. Each branch recursively
// explores further until reaching the destination (base case).
// ============================================================

// Recursion = a function calling itself. It needs:
// 1. BASE CASE — when to stop
// 2. RECURSIVE CASE — reduce the problem and call self

// ============================================================
// SECTION 1 — Factorial
// n! = n * (n-1)!, base: 0! = 1. O(n) time, O(n) stack space.
// ============================================================

function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log("=== Factorial ===");
console.log("5! =", factorial(5));   // 120
console.log("10! =", factorial(10)); // 3628800

// Iterative version uses O(1) space:
// function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

// ============================================================
// SECTION 2 — Fibonacci and Memoization
// Naive fib is O(2^n) — same sub-problems solved repeatedly.
// Memoization caches results, bringing it to O(n).
// ============================================================

// Naive: O(2^n) time — DO NOT use for n > 30
function fibNaive(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibNaive(n - 1) + fibNaive(n - 2);
}

// Memoized: O(n) time, O(n) space
function fibMemo(n, memo = {}) {
  if (n in memo) return memo[n];
  if (n <= 0) return 0;
  if (n === 1) return 1;
  memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  return memo[n];
}

// Iterative: O(n) time, O(1) space — best when you don't need the memo table
function fibIterative(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

console.log("\n=== Fibonacci ===");
console.log("Naive fib(10):", fibNaive(10)); // 55
console.log("Memo fib(50):", fibMemo(50));   // 12586269025 — instant
console.log("Iterative fib(50):", fibIterative(50));

// ============================================================
// SECTION 3 — The Call Stack and Stack Overflow
// Each recursive call pushes a stack frame. Node.js holds ~10K-15K.
// Exceeding causes: RangeError: Maximum call stack size exceeded
// ============================================================

function testMaxDepth(n = 0) {
  try { return testMaxDepth(n + 1); }
  catch (e) { return n; }
}
console.log("\nMax recursion depth:", testMaxDepth());

// ============================================================
// SECTION 4 — Tail Recursion
// If the recursive call is the LAST operation, the compiler can
// reuse the stack frame. V8 does NOT optimize this, but it is
// conceptually important.
// ============================================================

function factorialTail(n, acc = 1) {
  if (n <= 1) return acc;
  return factorialTail(n - 1, n * acc); // tail position — no work after call
}
console.log("\nTail factorial(5):", factorialTail(5)); // 120

// ============================================================
// SECTION 5 — Power Function: x^n in O(log n)
// Exponentiation by squaring: even -> square half, odd -> reduce.
// ============================================================

function power(x, n) {
  if (n === 0) return 1;
  if (n < 0) return 1 / power(x, -n);
  if (n % 2 === 0) {
    const half = power(x, n / 2);
    return half * half; // ONE recursive call, then square
  }
  return x * power(x, n - 1);
}

console.log("\n=== Power O(log n) ===");
console.log("2^10 =", power(2, 10)); // 1024
console.log("2^-3 =", power(2, -3)); // 0.125

// ============================================================
// SECTION 6 — Flatten Nested Array
// Recursion handles arbitrary nesting depth naturally.
// ============================================================

function flatten(arr) {
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item)) result.push(...flatten(item));
    else result.push(item);
  }
  return result;
}
// Note: JS has built-in Array.prototype.flat(Infinity)

console.log("\n=== Flatten ===");
console.log(flatten([1, [2, [3, 4]], 5])); // [1,2,3,4,5]

// ============================================================
// SECTION 7 — Count Nested Object Keys
// Same recursive pattern as DOM traversal, file system walking.
// ============================================================

function countKeys(obj) {
  let count = 0;
  for (const key in obj) {
    count++;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key]))
      count += countKeys(obj[key]);
  }
  return count;
}

console.log("\n=== Count Keys ===");
console.log("Keys:", countKeys({
  app: { name: "Paytm", features: { upi: { enabled: true } } },
  server: { host: "api.paytm.com" }
})); // 7

// ============================================================
// SECTION 8 — Tower of Hanoi
// Move n-1 to auxiliary, move largest to destination, move n-1 to destination.
// O(2^n) moves — no faster solution exists.
// ============================================================

function towerOfHanoi(n, from, to, aux, moves = []) {
  if (n === 0) return moves;
  towerOfHanoi(n - 1, from, aux, to, moves);
  moves.push(`Disk ${n}: ${from} -> ${to}`);
  towerOfHanoi(n - 1, aux, to, from, moves);
  return moves;
}

console.log("\n=== Tower of Hanoi (3 disks) ===");
towerOfHanoi(3, "A", "C", "B").forEach(m => console.log("  " + m));

// ============================================================
// SECTION 9 — Generate All Subsets (Power Set)
// At each element: include or exclude. 2^n subsets total.
// ============================================================

function generateSubsets(arr) {
  const result = [];
  function backtrack(index, current) {
    if (index === arr.length) { result.push([...current]); return; }
    backtrack(index + 1, current);           // exclude
    current.push(arr[index]);
    backtrack(index + 1, current);           // include
    current.pop();                           // backtrack (undo choice)
  }
  backtrack(0, []);
  return result;
}

console.log("\n=== Power Set ===");
const subsets = generateSubsets(["Phone", "Case", "Charger"]);
console.log(`3 items -> ${subsets.length} subsets`);
subsets.forEach(s => console.log("  {" + s.join(", ") + "}"));

// ============================================================
// SECTION 10 — IRCTC All Routes (Backtracking)
// ============================================================

function findAllRoutes(graph, start, end, path = [], all = []) {
  path.push(start);
  if (start === end) all.push([...path]);
  else for (const nb of (graph[start] || []))
    if (!path.includes(nb)) findAllRoutes(graph, nb, end, path, all);
  path.pop(); // backtrack
  return all;
}

console.log("\n=== All Routes Delhi -> Chennai ===");
const rail = {
  Delhi: ["Agra", "Jaipur"], Agra: ["Bhopal"],
  Jaipur: ["Ahmedabad"], Bhopal: ["Nagpur"],
  Ahmedabad: ["Mumbai"], Nagpur: ["Hyderabad"],
  Mumbai: ["Chennai"], Hyderabad: ["Chennai"], Chennai: []
};
findAllRoutes(rail, "Delhi", "Chennai").forEach((r, i) =>
  console.log(`  Route ${i + 1}: ${r.join(" -> ")}`)
);

// ============================================================
// SECTION 11 — When to Use Recursion
// ============================================================
// USE: tree/graph traversal, divide-and-conquer, backtracking,
//      nested data structures, mathematical recurrences
// AVOID: simple loops, very deep problems (n > 10K — use explicit stack),
//        when stack overhead matters, tail recursion in JS (V8 won't optimize)

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Recursion = function calling itself. Needs BASE CASE + RECURSIVE CASE
// 2. Each call pushes a stack frame. Too many -> stack overflow
// 3. Naive recursion can be O(2^n). Memoization -> O(n)
// 4. Power function: x^n in O(log n) via squaring halves
// 5. Flatten/count keys = recursive tree walking for nested data
// 6. Tower of Hanoi: O(2^n) — no faster solution
// 7. Power Set: 2^n subsets via include/exclude backtracking
// 8. Use recursion for trees, graphs, backtracking. Iteration for simple loops.
// ============================================================
