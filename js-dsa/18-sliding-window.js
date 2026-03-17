// ============================================================
// FILE 18: SLIDING WINDOW TECHNIQUE
// Topic: Optimizing subarray/substring problems from O(n*k) to O(n)
// WHY: One of the most common interview patterns. Powers real-time
//   analytics, streaming data, and rate limiting.
// ============================================================

// ============================================================
// STORY: Hotstar streams IPL to 25M concurrent viewers. Finding
// max viewers in any 5-minute window across 17,280 data points:
// brute force O(n*k) crashes servers, sliding window O(n) enables
// real-time dashboards.
// ============================================================

// Two types:
// FIXED-SIZE: window size k given, slide one step at a time.
// VARIABLE-SIZE: window grows/shrinks based on a condition.

// ============================================================
// SECTION 1 — Max Sum Subarray of Size K (Fixed Window)
// ============================================================

// WHY: Instead of re-summing k elements each time, add the new
// element entering and subtract the one leaving.

function maxSumSlidingWindow(arr, k) {
  if (arr.length < k) return null;

  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += arr[i];
  let maxSum = windowSum;

  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k]; // Add right, remove left
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}

// Big-O: O(n) vs brute force O(n*k)

console.log("=== MAX SUM SUBARRAY OF SIZE K ===");
const orders = [100, 200, 300, 400, 500, 200, 100, 600, 700];
console.log(`Window k=3: ${maxSumSlidingWindow(orders, 3)}`);

// ============================================================
// SECTION 2 — Max of All Subarrays of Size K (Monotonic Deque)
// ============================================================

// WHY: Deque stores indices in decreasing value order. Front = max.
// Each element enters/exits deque at most once -> O(n).

function maxOfSubarrays(arr, k) {
  const result = [], deque = []; // deque stores indices

  for (let i = 0; i < arr.length; i++) {
    while (deque.length > 0 && deque[0] < i - k + 1) deque.shift(); // Remove outside window
    while (deque.length > 0 && arr[deque[deque.length - 1]] <= arr[i]) deque.pop(); // Remove smaller
    deque.push(i);
    if (i >= k - 1) result.push(arr[deque[0]]);
  }
  return result;
}

console.log("\n=== MAX OF SUBARRAYS (Monotonic Deque) ===");
console.log(`[1,3,-1,-3,5,3,6,7] k=3:`, maxOfSubarrays([1, 3, -1, -3, 5, 3, 6, 7], 3));
// [3, 3, 5, 5, 6, 7]

// ============================================================
// SECTION 3 — Smallest Subarray with Sum >= Target (Variable)
// ============================================================

// WHY: Expand right until sum >= target, then shrink left to minimize.
// Each pointer traverses array once -> O(n).

function minSubarrayWithSum(arr, target) {
  let left = 0, windowSum = 0, minLength = Infinity;

  for (let right = 0; right < arr.length; right++) {
    windowSum += arr[right];

    while (windowSum >= target) {
      minLength = Math.min(minLength, right - left + 1);
      windowSum -= arr[left];
      left++;
    }
  }
  return minLength === Infinity ? 0 : minLength;
}

// Big-O: O(n)

console.log("\n=== SMALLEST SUBARRAY WITH SUM >= TARGET ===");
console.log(`[2,3,1,2,4,3] target=7: length ${minSubarrayWithSum([2, 3, 1, 2, 4, 3], 7)}`); // 2

// ============================================================
// SECTION 4 — Longest Substring Without Repeating Characters
// ============================================================

// WHY: LeetCode #3. Variable window with a Map tracking last seen index.
// When duplicate found, shrink left past the previous occurrence.

function longestSubstringWithoutRepeats(s) {
  const charIndex = new Map();
  let left = 0, maxLength = 0, bestStart = 0;

  for (let right = 0; right < s.length; right++) {
    const char = s[right];
    if (charIndex.has(char) && charIndex.get(char) >= left) {
      left = charIndex.get(char) + 1;
    }
    charIndex.set(char, right);
    if (right - left + 1 > maxLength) {
      maxLength = right - left + 1;
      bestStart = left;
    }
  }
  return { length: maxLength, substring: s.slice(bestStart, bestStart + maxLength) };
}

// Big-O: O(n) time, O(min(n, charset)) space

console.log("\n=== LONGEST SUBSTRING NO REPEATS ===");
for (const s of ["abcabcbb", "bbbbb", "pwwkew"]) {
  const r = longestSubstringWithoutRepeats(s);
  console.log(`  "${s}" -> "${r.substring}" (length ${r.length})`);
}

// ============================================================
// SECTION 5 — Longest Substring with At Most K Distinct Chars
// ============================================================

// WHY: Expand right, track frequencies. When distinct > k, shrink left.

function longestSubstringKDistinct(s, k) {
  if (k === 0) return 0;
  const freq = new Map();
  let left = 0, maxLength = 0;

  for (let right = 0; right < s.length; right++) {
    freq.set(s[right], (freq.get(s[right]) || 0) + 1);

    while (freq.size > k) {
      const lc = s[left];
      freq.set(lc, freq.get(lc) - 1);
      if (freq.get(lc) === 0) freq.delete(lc);
      left++;
    }

    maxLength = Math.max(maxLength, right - left + 1);
  }
  return maxLength;
}

// Big-O: O(n)

console.log("\n=== LONGEST SUBSTRING K DISTINCT ===");
console.log(`"eceba" k=2: ${longestSubstringKDistinct("eceba", 2)}`);   // 3 ("ece")
console.log(`"aabbcc" k=2: ${longestSubstringKDistinct("aabbcc", 2)}`); // 4 ("aabb")

// ============================================================
// SECTION 6 — Minimum Window Substring
// ============================================================

// WHY: Hardest sliding window (LeetCode #76). Track needed chars
// with frequency maps and a "formed" counter.

function minWindowSubstring(s, t) {
  if (t.length > s.length) return "";

  const need = new Map();
  for (const c of t) need.set(c, (need.get(c) || 0) + 1);

  const windowFreq = new Map();
  let formed = 0, required = need.size;
  let left = 0, minLen = Infinity, minStart = 0;

  for (let right = 0; right < s.length; right++) {
    const c = s[right];
    windowFreq.set(c, (windowFreq.get(c) || 0) + 1);
    if (need.has(c) && windowFreq.get(c) === need.get(c)) formed++;

    while (formed === required) {
      if (right - left + 1 < minLen) { minLen = right - left + 1; minStart = left; }
      const lc = s[left];
      windowFreq.set(lc, windowFreq.get(lc) - 1);
      if (need.has(lc) && windowFreq.get(lc) < need.get(lc)) formed--;
      left++;
    }
  }

  return minLen === Infinity ? "" : s.slice(minStart, minStart + minLen);
}

// Big-O: O(n + m) time, O(m) space

console.log("\n=== MINIMUM WINDOW SUBSTRING ===");
console.log(`s="ADOBECODEBANC" t="ABC": "${minWindowSubstring("ADOBECODEBANC", "ABC")}"`); // "BANC"

// ============================================================
// SECTION 7 — When to Use Sliding Window
// ============================================================

console.log("\n=== WHEN TO USE SLIDING WINDOW ===");
console.log("Keywords: contiguous, subarray, substring, window, consecutive");
console.log("Fixed size? -> Fixed window. Variable? -> Two-pointer window.");
console.log("Need max per window? -> Monotonic deque. Track frequencies? -> Map.");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Sliding window: O(n*k) brute force -> O(n) by updating incrementally.
// 2. FIXED: size k given. Init first k, slide (add right, remove left).
// 3. VARIABLE: expand right until condition met, shrink left to optimize.
// 4. Monotonic Deque: max/min of each window in O(n).
// 5. Min Window Substring: need map + window freq + formed counter.
// 6. Key question: "Can I avoid recomputing by adjusting the previous window?"
