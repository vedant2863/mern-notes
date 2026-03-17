// ============================================================
// FILE 22: GREEDY ALGORITHMS
// Topic: Making locally optimal choices at each step to find the global optimum
// WHY: Greedy algorithms are simpler and faster than DP when they work.
//   They power scheduling, compression (Huffman), and graph algorithms
//   (Dijkstra, Prim, Kruskal). Knowing WHEN greedy works is the key skill.
// ============================================================

// ============================================================
// STORY: Indian Railways schedules maximum trains on a single platform
// at New Delhi station. Greedy: pick earliest departure, repeat.
// Works when: Greedy Choice Property + Optimal Substructure.
// ============================================================

console.log("=== GREEDY ALGORITHMS ===\n");

// ============================================================
// SECTION 1 -- Activity / Meeting Selection
// Sort by end time, always pick earliest finish. O(n log n).
// ============================================================

function activitySelection(activities) {
  const sorted = [...activities].sort((a, b) => a.end - b.end);
  const selected = [sorted[0]];
  let lastEnd = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start >= lastEnd) {
      selected.push(sorted[i]);
      lastEnd = sorted[i].end;
    }
  }
  return selected;
}

console.log("=== ACTIVITY SELECTION ===");
const meetings = [
  { name: "Razorpay", start: 1, end: 3 }, { name: "Zerodha", start: 2, end: 5 },
  { name: "CRED", start: 4, end: 7 },     { name: "PhonePe", start: 1, end: 8 },
  { name: "Swiggy", start: 5, end: 9 },   { name: "Flipkart", start: 8, end: 10 },
];
const selected = activitySelection(meetings);
console.log("Selected:", selected.map(m => `${m.name}(${m.start}-${m.end})`));
console.log("Count:", selected.length, "\n");

// ============================================================
// SECTION 2 -- Fractional Knapsack
// Sort by value/weight ratio descending. Take full items first,
// then fraction of the last. Greedy works for fractions, NOT 0/1.
// ============================================================

// O(n log n)
function fractionalKnapsack(items, capacity) {
  const sorted = [...items]
    .map(item => ({ ...item, ratio: item.value / item.weight }))
    .sort((a, b) => b.ratio - a.ratio);

  let totalValue = 0, remaining = capacity;
  const taken = [];

  for (const item of sorted) {
    if (remaining <= 0) break;
    if (item.weight <= remaining) {
      taken.push({ name: item.name, fraction: 1, value: item.value });
      totalValue += item.value;
      remaining -= item.weight;
    } else {
      const fraction = remaining / item.weight;
      taken.push({ name: item.name, fraction: +fraction.toFixed(2), value: +(item.value * fraction).toFixed(2) });
      totalValue += item.value * fraction;
      remaining = 0;
    }
  }
  return { totalValue: +totalValue.toFixed(2), taken };
}

console.log("=== FRACTIONAL KNAPSACK ===");
const fkResult = fractionalKnapsack([
  { name: "Saffron", weight: 10, value: 600 },
  { name: "Cardamom", weight: 20, value: 500 },
  { name: "Turmeric", weight: 30, value: 400 },
], 50);
console.log("Max value:", fkResult.totalValue);
console.log("Taken:", fkResult.taken, "\n");

// ============================================================
// SECTION 3 -- Coin Change: Greedy vs DP
// Greedy works for standard denominations, FAILS for arbitrary ones.
// ============================================================

function greedyCoinChange(coins, amount) {
  const sorted = [...coins].sort((a, b) => b - a);
  const result = [];
  let remaining = amount;
  for (const coin of sorted) {
    while (remaining >= coin) { result.push(coin); remaining -= coin; }
  }
  return remaining === 0 ? result : null;
}

function dpCoinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  const coinUsed = new Array(amount + 1).fill(-1);
  dp[0] = 0;
  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i && dp[i - coin] + 1 < dp[i]) { dp[i] = dp[i - coin] + 1; coinUsed[i] = coin; }
    }
  }
  if (dp[amount] === Infinity) return null;
  const result = [];
  let rem = amount;
  while (rem > 0) { result.push(coinUsed[rem]); rem -= coinUsed[rem]; }
  return result;
}

console.log("=== COIN CHANGE: GREEDY vs DP ===");
console.log("Indian Rs.93 Greedy:", greedyCoinChange([1, 2, 5, 10, 20, 50, 100, 500], 93));
console.log("[1,3,4] amount=6 Greedy:", greedyCoinChange([1, 3, 4], 6)); // [4,1,1] = 3 WRONG
console.log("[1,3,4] amount=6 DP:    ", dpCoinChange([1, 3, 4], 6));     // [3,3] = 2 CORRECT
console.log();

// ============================================================
// SECTION 4 -- Jump Game
// Track farthest reachable index. If i > farthest, stuck.
// ============================================================

// O(n) time, O(1) space
function canJump(nums) {
  let farthest = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > farthest) return false;
    farthest = Math.max(farthest, i + nums[i]);
    if (farthest >= nums.length - 1) return true;
  }
  return true;
}

function minJumps(nums) {
  if (nums.length <= 1) return 0;
  let jumps = 0, currentEnd = 0, farthest = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    farthest = Math.max(farthest, i + nums[i]);
    if (i === currentEnd) { jumps++; currentEnd = farthest; if (currentEnd >= nums.length - 1) break; }
  }
  return jumps;
}

console.log("=== JUMP GAME ===");
console.log("Can reach [2,3,1,1,4]?", canJump([2, 3, 1, 1, 4]));
console.log("Can reach [3,2,1,0,4]?", canJump([3, 2, 1, 0, 4]));
console.log("Min jumps [2,3,1,1,4]:", minJumps([2, 3, 1, 1, 4]), "\n");

// ============================================================
// SECTION 5 -- Huffman Coding
// Assign shorter codes to frequent chars, longer to rare ones.
// Greedy: always merge the two lowest-frequency nodes.
// ============================================================

class HuffmanNode {
  constructor(char, freq) { this.char = char; this.freq = freq; this.left = null; this.right = null; }
}

function huffmanEncode(text) {
  if (text.length === 0) return { codes: {}, ratio: 0 };
  const freq = {};
  for (const ch of text) freq[ch] = (freq[ch] || 0) + 1;

  let nodes = Object.entries(freq).map(([ch, f]) => new HuffmanNode(ch, f));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift(), right = nodes.shift();
    const merged = new HuffmanNode(null, left.freq + right.freq);
    merged.left = left; merged.right = right;
    nodes.push(merged);
  }

  const codes = {};
  (function gen(node, prefix) {
    if (!node) return;
    if (node.char !== null) { codes[node.char] = prefix || "0"; return; }
    gen(node.left, prefix + "0"); gen(node.right, prefix + "1");
  })(nodes[0], "");

  const encoded = [...text].map(ch => codes[ch]).join("");
  const ratio = ((1 - encoded.length / (text.length * 8)) * 100).toFixed(1);
  return { codes, originalBits: text.length * 8, compressedBits: encoded.length, ratio };
}

console.log("=== HUFFMAN CODING ===");
const hResult = huffmanEncode("aaaaabbbccdd");
console.log("Codes:", hResult.codes);
console.log(`${hResult.originalBits} bits -> ${hResult.compressedBits} bits (${hResult.ratio}% smaller)\n`);

// ============================================================
// SECTION 6 -- Merge Overlapping Intervals
// Sort by start, extend end if overlapping. O(n log n).
// ============================================================

function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) last[1] = Math.max(last[1], sorted[i][1]);
    else merged.push(sorted[i]);
  }
  return merged;
}

console.log("=== MERGE INTERVALS ===");
console.log("Merged:", JSON.stringify(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]])));
console.log();

// ============================================================
// SECTION 7 -- Gas Station Circuit
// If total gas >= total cost, solution exists. Track cumulative
// surplus; if it goes negative, restart from next station.
// ============================================================

// O(n) time, O(1) space
function canCompleteCircuit(gas, cost) {
  let totalSurplus = 0, currentSurplus = 0, start = 0;
  for (let i = 0; i < gas.length; i++) {
    const net = gas[i] - cost[i];
    totalSurplus += net;
    currentSurplus += net;
    if (currentSurplus < 0) { start = i + 1; currentSurplus = 0; }
  }
  return totalSurplus >= 0 ? start : -1;
}

console.log("=== GAS STATION ===");
console.log("Start at:", canCompleteCircuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]));
console.log("Start at:", canCompleteCircuit([2, 3, 4], [3, 4, 3]), "(impossible)\n");

// ============================================================
// SECTION 8 -- Tests
// ============================================================

console.log("=== RUNNING TESTS ===");
console.assert(activitySelection([
  { name: "A", start: 0, end: 6 }, { name: "B", start: 1, end: 4 },
  { name: "C", start: 3, end: 5 }, { name: "D", start: 5, end: 7 },
  { name: "E", start: 3, end: 9 }, { name: "F", start: 5, end: 9 },
  { name: "G", start: 6, end: 10 }, { name: "H", start: 8, end: 11 },
]).length === 3, "Activity Selection");
console.log("Activity Selection: Passed");

console.assert(canJump([2, 3, 1, 1, 4]) === true, "Jump Game");
console.assert(canJump([3, 2, 1, 0, 4]) === false, "Jump Game blocked");
console.assert(minJumps([2, 3, 1, 1, 4]) === 2, "Min Jumps");
console.log("Jump Game: Passed");

console.assert(mergeIntervals([[1, 3], [2, 6], [8, 10]]).length === 2, "Merge Intervals");
console.log("Merge Intervals: Passed");

console.assert(canCompleteCircuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]) === 3, "Gas Station");
console.log("Gas Station: Passed");
console.log("\nAll Greedy tests passed!");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Greedy makes the locally optimal choice. Simpler and faster
//    than DP, but only works with the greedy choice property.
// 2. Activity Selection: sort by end time. Mathematical proof of optimality.
// 3. Fractional Knapsack: greedy by ratio. 0/1 Knapsack needs DP.
// 4. Coin Change: greedy for standard denominations, DP for arbitrary.
// 5. Jump Game: "track farthest reachable" greedy pattern.
// 6. Huffman Coding: real-world greedy used in gzip, JPEG, MP3.
// 7. Interval problems: almost always start with sorting by start/end time.
// 8. Decision rule: try greedy. If counterexample exists, switch to DP.
// ============================================================

console.log("\n=== BIG-O SUMMARY ===");
console.log("+------------------------+-----------+-------+");
console.log("| Problem                | Time      | Space |");
console.log("+------------------------+-----------+-------+");
console.log("| Activity Selection     | O(n log n)| O(n)  |");
console.log("| Fractional Knapsack    | O(n log n)| O(n)  |");
console.log("| Jump Game              | O(n)      | O(1)  |");
console.log("| Huffman Coding         | O(n log n)| O(n)  |");
console.log("| Merge Intervals        | O(n log n)| O(n)  |");
console.log("| Gas Station            | O(n)      | O(1)  |");
console.log("+------------------------+-----------+-------+");
