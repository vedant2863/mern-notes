// ============================================================
// FILE 21: DYNAMIC PROGRAMMING
// Topic: Solving complex problems by breaking them into overlapping sub-problems
// WHY: DP is the most tested interview topic. It turns exponential
//   brute-force into polynomial time by remembering sub-problem results.
//   Two conditions: overlapping subproblems + optimal substructure.
// ============================================================

// ============================================================
// STORY: Razorpay processes refunds. Greedy coin change works for
// Indian denominations but fails for arbitrary ones. DP guarantees
// the optimal split every time, regardless of denominations.
// ============================================================

// ============================================================
// BLOCK 1 -- Two DP Approaches
// TOP-DOWN (Memoization): recursive + cache. Natural to write.
// BOTTOM-UP (Tabulation): iterative, fill table from base cases.
//   No recursion overhead, often allows space optimization.
// ============================================================

// ============================================================
// SECTION 1 -- Fibonacci: The DP Hello World
// ============================================================

// Naive recursion: O(2^n) -- computes same subproblems repeatedly
function fibNaive(n) {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2);
}

// Memoized (Top-Down): O(n) time, O(n) space
function fibMemo(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  return memo[n];
}

// Space-Optimized (Bottom-Up): O(n) time, O(1) space
function fibOptimal(n) {
  if (n <= 1) return n;
  let prev2 = 0, prev1 = 1;
  for (let i = 2; i <= n; i++) {
    const curr = prev1 + prev2;
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}

console.log("=== FIBONACCI ===");
console.log("Naive fib(10):", fibNaive(10));
console.log("Memoized fib(40):", fibMemo(40));
console.log("Optimized fib(50):", fibOptimal(50));
console.log();

// ============================================================
// SECTION 2 -- Climbing Stairs
// dp[i] = dp[i-1] + dp[i-2]. Fibonacci in disguise.
// ============================================================

// O(n) time, O(1) space
function climbStairs(n) {
  if (n <= 1) return 1;
  let prev2 = 1, prev1 = 1;
  for (let i = 2; i <= n; i++) {
    const curr = prev1 + prev2;
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}

console.log("=== CLIMBING STAIRS ===");
console.log("5 steps:", climbStairs(5), "| 10 steps:", climbStairs(10));
console.log();

// ============================================================
// SECTION 3 -- Coin Change (Minimum Coins)
// dp[amount] = min(dp[amount], dp[amount - coin] + 1) for each coin.
// O(amount * coins) time, O(amount) space
// ============================================================

function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  const coinUsed = new Array(amount + 1).fill(-1);
  dp[0] = 0;

  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i && dp[i - coin] + 1 < dp[i]) {
        dp[i] = dp[i - coin] + 1;
        coinUsed[i] = coin;
      }
    }
  }

  const result = { minCoins: dp[amount] === Infinity ? -1 : dp[amount], coins: [] };
  if (result.minCoins !== -1) {
    let remaining = amount;
    while (remaining > 0) { result.coins.push(coinUsed[remaining]); remaining -= coinUsed[remaining]; }
  }
  return result;
}

console.log("=== COIN CHANGE ===");
console.log("Rs.93 Indian:", coinChange([1, 2, 5, 10, 20, 50, 100, 500], 93));
console.log("Rs.6 with [1,3,4]:", coinChange([1, 3, 4], 6));
// Greedy gives [4,1,1]=3 coins. DP gives [3,3]=2 coins!
console.log();

// ============================================================
// SECTION 4 -- 0/1 Knapsack
// dp[i][w] = max(dp[i-1][w], dp[i-1][w-weight[i]] + value[i])
// O(n * W) time, O(n * W) space (or O(W) space-optimized)
// ============================================================

function knapsack(weights, values, capacity) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w]; // Exclude item
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);
      }
    }
  }

  // Backtrack to find selected items
  const selected = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) { selected.push(i - 1); w -= weights[i - 1]; }
  }
  return { maxValue: dp[n][capacity], items: selected.reverse() };
}

// Space-Optimized: O(W) space, traverse right-to-left
function knapsackOptimized(weights, values, capacity) {
  const dp = new Array(capacity + 1).fill(0);
  for (let i = 0; i < weights.length; i++) {
    for (let w = capacity; w >= weights[i]; w--) {
      dp[w] = Math.max(dp[w], dp[w - weights[i]] + values[i]);
    }
  }
  return dp[capacity];
}

console.log("=== 0/1 KNAPSACK ===");
const kResult = knapsack([2, 3, 4, 5], [3, 4, 5, 6], 8);
console.log(`Max value: ${kResult.maxValue}, items: [${kResult.items}]`);
console.log("Space-optimized:", knapsackOptimized([2, 3, 4, 5], [3, 4, 5, 6], 8));
console.log();

// ============================================================
// SECTION 5 -- Longest Common Subsequence (LCS)
// If chars match: dp[i][j] = dp[i-1][j-1] + 1
// Else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])
// O(m * n) time, O(m * n) space
// ============================================================

function longestCommonSubsequence(text1, text2) {
  const m = text1.length, n = text2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (text1[i - 1] === text2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Reconstruct LCS string
  let lcs = "", i = m, j = n;
  while (i > 0 && j > 0) {
    if (text1[i - 1] === text2[j - 1]) { lcs = text1[i - 1] + lcs; i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return { length: dp[m][n], subsequence: lcs };
}

console.log("=== LONGEST COMMON SUBSEQUENCE ===");
console.log('LCS("abcde", "ace"):', longestCommonSubsequence("abcde", "ace"));
console.log();

// ============================================================
// SECTION 6 -- Longest Increasing Subsequence (LIS)
// O(n^2) DP: dp[i] = max(dp[j] + 1) for j < i where arr[j] < arr[i]
// O(n log n): maintain "tails" array, binary search for position
// ============================================================

function lisDP(nums) {
  const n = nums.length;
  if (n === 0) return { length: 0, subsequence: [] };
  const dp = new Array(n).fill(1);
  const parent = new Array(n).fill(-1);
  let maxLen = 1, maxIdx = 0;

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i] && dp[j] + 1 > dp[i]) { dp[i] = dp[j] + 1; parent[i] = j; }
    }
    if (dp[i] > maxLen) { maxLen = dp[i]; maxIdx = i; }
  }

  const subsequence = [];
  let idx = maxIdx;
  while (idx !== -1) { subsequence.unshift(nums[idx]); idx = parent[idx]; }
  return { length: maxLen, subsequence };
}

function lisBinarySearch(nums) {
  if (nums.length === 0) return 0;
  const tails = [];
  for (const num of nums) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < num) lo = mid + 1; else hi = mid; }
    tails[lo] = num;
  }
  return tails.length;
}

console.log("=== LONGEST INCREASING SUBSEQUENCE ===");
console.log("LIS of [10,9,2,5,3,7,101,18]:", lisDP([10, 9, 2, 5, 3, 7, 101, 18]));
console.log("LIS length (O(n log n)):", lisBinarySearch([10, 9, 2, 5, 3, 7, 101, 18]));
console.log();

// ============================================================
// SECTION 7 -- Edit Distance (Levenshtein)
// If chars match: dp[i][j] = dp[i-1][j-1] (no edit)
// Else: 1 + min(delete, insert, replace)
// O(m * n) time, O(m * n) space
// ============================================================

function editDistance(word1, word2) {
  const m = word1.length, n = word2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (word1[i - 1] === word2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

console.log("=== EDIT DISTANCE ===");
console.log('"horse" -> "ros":', editDistance("horse", "ros"), "edits");
console.log('"intention" -> "execution":', editDistance("intention", "execution"), "edits");
console.log();

// ============================================================
// SECTION 8 -- DP vs Greedy vs Backtracking
// ============================================================

console.log("=== HOW TO IDENTIFY DP PROBLEMS ===");
console.log("Keywords: minimum, maximum, count ways, is it possible, longest/shortest");
console.log("DP: guarantees optimal, uses extra space for sub-problem cache");
console.log("Greedy: faster but only works when greedy choice property holds");
console.log("Backtracking: enumerate ALL solutions, not just optimal\n");

// ============================================================
// SECTION 9 -- Tests
// ============================================================

console.log("=== RUNNING TESTS ===");
console.assert(fibOptimal(10) === 55 && fibOptimal(20) === 6765, "Fibonacci");
console.log("Fibonacci: Passed");
console.assert(climbStairs(5) === 8, "Climbing Stairs");
console.log("Climbing Stairs: Passed");
console.assert(coinChange([1, 3, 4], 6).minCoins === 2, "Coin Change");
console.log("Coin Change: Passed");
console.assert(knapsackOptimized([1, 2, 3], [6, 10, 12], 5) === 22, "Knapsack");
console.log("Knapsack: Passed");
console.assert(longestCommonSubsequence("abcde", "ace").length === 3, "LCS");
console.log("LCS: Passed");
console.assert(lisBinarySearch([10, 9, 2, 5, 3, 7, 101, 18]) === 4, "LIS");
console.log("LIS: Passed");
console.assert(editDistance("horse", "ros") === 3, "Edit Distance");
console.log("Edit Distance: Passed");
console.log("\nAll DP tests passed!");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. DP requires OVERLAPPING SUBPROBLEMS + OPTIMAL SUBSTRUCTURE.
// 2. Top-down (memo) is easier to write; bottom-up (tabulation)
//    avoids recursion and often allows space optimization.
// 3. Fibonacci pattern (dp[i] = dp[i-1] + dp[i-2]) appears in
//    Climbing Stairs, House Robber, and many others.
// 4. Coin Change: "try every option" pattern. dp[i] = min(dp[i-something] + cost).
// 5. 0/1 Knapsack: 2D DP with include/exclude choice.
// 6. LCS and Edit Distance: 2D string DP classics.
// 7. LIS: O(n^2) DP improvable to O(n log n) with binary search.
// ============================================================

console.log("\n=== BIG-O SUMMARY ===");
console.log("+-----------------------+------------------+----------+");
console.log("| Problem               | Time             | Space    |");
console.log("+-----------------------+------------------+----------+");
console.log("| Fibonacci (optimal)   | O(n)             | O(1)     |");
console.log("| Climbing Stairs       | O(n)             | O(1)     |");
console.log("| Coin Change           | O(amount * coins)| O(amount)|");
console.log("| 0/1 Knapsack          | O(n * W)         | O(W)*    |");
console.log("| LCS                   | O(m * n)         | O(m * n) |");
console.log("| LIS (Binary Search)   | O(n log n)       | O(n)     |");
console.log("| Edit Distance         | O(m * n)         | O(m * n) |");
console.log("+-----------------------+------------------+----------+");
