// ============================================================
// FILE 19: TWO POINTERS TECHNIQUE
// Topic: Solving array/string problems with two-pointer patterns
// WHY: Two pointers turn O(n^2) nested loops into O(n) by moving
//   two indices strategically through data. Essential for sorted
//   array problems, pair finding, and in-place modifications.
// ============================================================

// ============================================================
// STORY: Paytm matches buyers (sorted ascending) and sellers
// (sorted descending) using converging pointers. When buyer
// price >= seller price, it's a match -- O(n) instead of O(n^2).
// ============================================================

// ============================================================
// BLOCK 1 -- Two Pointer Patterns Overview
// ============================================================

console.log("=== TWO POINTER PATTERNS ===");
console.log("1. CONVERGING (opposite dir): sorted pair finding, palindrome");
console.log("2. SAME DIRECTION (fast/slow): remove duplicates, move zeros");
console.log("3. TWO ARRAYS: merge sorted arrays, intersection\n");

// ============================================================
// SECTION 1 -- Two Sum in Sorted Array (Converging Pointers)
// Sorted data + two pointers = O(n) instead of O(n^2) brute force.
// ============================================================

// Big-O: Time O(n), Space O(1)
function twoSumSorted(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left < right) {
    const sum = arr[left] + arr[right];
    if (sum === target) return [left, right];
    else if (sum < target) left++;   // Need bigger, move left right
    else right--;                     // Need smaller, move right left
  }
  return [-1, -1];
}

console.log("=== TWO SUM (SORTED ARRAY) ===");
const amounts = [100, 200, 300, 400, 500, 600, 700, 800];
const [i1, i2] = twoSumSorted(amounts, 900);
console.log(`Pair at [${i1}, ${i2}]: ${amounts[i1]} + ${amounts[i2]} = 900`);
console.log("O(n) time, O(1) space\n");

// ============================================================
// SECTION 2 -- Three Sum (Fix One + Two Pointer)
// Sort array, fix one element, two-pointer on rest. O(n^2).
// ============================================================

// Big-O: Time O(n^2), Space O(1) excluding output
function threeSum(arr, target) {
  arr.sort((a, b) => a - b);
  const results = [];

  for (let i = 0; i < arr.length - 2; i++) {
    if (i > 0 && arr[i] === arr[i - 1]) continue; // Skip duplicates

    let left = i + 1;
    let right = arr.length - 1;

    while (left < right) {
      const sum = arr[i] + arr[left] + arr[right];
      if (sum === target) {
        results.push([arr[i], arr[left], arr[right]]);
        while (left < right && arr[left] === arr[left + 1]) left++;
        while (left < right && arr[right] === arr[right - 1]) right--;
        left++;
        right--;
      } else if (sum < target) left++;
      else right--;
    }
  }
  return results;
}

console.log("=== THREE SUM ===");
const triplets = threeSum([-1, 0, 1, 2, -1, -4], 0);
triplets.forEach((t) => console.log(`  [${t}] -> sum = ${t.reduce((a, b) => a + b)}`));
console.log("O(n^2) time\n");

// ============================================================
// SECTION 3 -- Container With Most Water (Converging + Greedy)
// Move the shorter side inward -- only way to potentially increase area.
// ============================================================

// Big-O: Time O(n), Space O(1)
function containerWithMostWater(heights) {
  let left = 0, right = heights.length - 1, maxArea = 0;

  while (left < right) {
    const area = (right - left) * Math.min(heights[left], heights[right]);
    maxArea = Math.max(maxArea, area);
    if (heights[left] < heights[right]) left++;
    else right--;
  }
  return maxArea;
}

console.log("=== CONTAINER WITH MOST WATER ===");
console.log("Max water:", containerWithMostWater([1, 8, 6, 2, 5, 4, 8, 3, 7]));
console.log("O(n) time, O(1) space\n");

// ============================================================
// SECTION 4 -- Same Direction: Remove Duplicates (Fast/Slow)
// Slow pointer = write position, fast pointer = scanner.
// ============================================================

// Big-O: Time O(n), Space O(1)
function removeDuplicates(arr) {
  if (arr.length <= 1) return arr.length;
  let slow = 0;
  for (let fast = 1; fast < arr.length; fast++) {
    if (arr[fast] !== arr[slow]) {
      slow++;
      arr[slow] = arr[fast];
    }
  }
  return slow + 1;
}

console.log("=== REMOVE DUPLICATES (SORTED) ===");
const productIds = [1, 1, 2, 2, 2, 3, 4, 4, 5];
const uniqueLen = removeDuplicates(productIds);
console.log(`Unique: [${productIds.slice(0, uniqueLen)}], count: ${uniqueLen}\n`);

// ============================================================
// SECTION 5 -- Same Direction: Move Zeros
// ============================================================

// Big-O: Time O(n), Space O(1)
function moveZeros(arr) {
  let slow = 0;
  for (let fast = 0; fast < arr.length; fast++) {
    if (arr[fast] !== 0) {
      [arr[slow], arr[fast]] = [arr[fast], arr[slow]];
      slow++;
    }
  }
  return arr;
}

console.log("=== MOVE ZEROS ===");
const withZeros = [0, 1, 0, 3, 12, 0, 5];
console.log(`Before: [${[...withZeros]}]`);
moveZeros(withZeros);
console.log(`After:  [${withZeros}]\n`);

// ============================================================
// SECTION 6 -- Two Arrays: Merge + Intersection
// One pointer per array, both move forward.
// ============================================================

// Big-O: Time O(n + m), Space O(n + m)
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

console.log("=== MERGE SORTED ARRAYS ===");
console.log("Merged:", mergeSortedArrays([1, 3, 5, 7], [2, 4, 6, 8]));
console.log("O(n+m) time\n");

// ============================================================
// SECTION 7 -- Valid Palindrome (Converging + Skip)
// ============================================================

// Big-O: Time O(n), Space O(1)
function isValidPalindrome(s) {
  let left = 0, right = s.length - 1;
  const isAlphaNum = (c) => /[a-zA-Z0-9]/.test(c);

  while (left < right) {
    while (left < right && !isAlphaNum(s[left])) left++;
    while (left < right && !isAlphaNum(s[right])) right--;
    if (s[left].toLowerCase() !== s[right].toLowerCase()) return false;
    left++;
    right--;
  }
  return true;
}

console.log("=== VALID PALINDROME ===");
["A man, a plan, a canal: Panama", "race a car"].forEach((s) => {
  console.log(`  "${s}" -> ${isValidPalindrome(s)}`);
});
console.log();

// ============================================================
// SECTION 8 -- Sort Colors / Dutch National Flag (3 Pointers)
// Three pointers partition array into 0s, 1s, 2s in one pass.
// ============================================================

// Big-O: Time O(n), Space O(1)
function sortColors(arr) {
  let low = 0, mid = 0, high = arr.length - 1;
  //  [0..low-1]=0s  [low..mid-1]=1s  [mid..high]=unknown  [high+1..n-1]=2s

  while (mid <= high) {
    if (arr[mid] === 0) {
      [arr[low], arr[mid]] = [arr[mid], arr[low]];
      low++; mid++;
    } else if (arr[mid] === 1) {
      mid++;
    } else {
      [arr[mid], arr[high]] = [arr[high], arr[mid]];
      high--; // Don't advance mid -- check swapped value
    }
  }
  return arr;
}

console.log("=== SORT COLORS (DUTCH NATIONAL FLAG) ===");
const colors = [2, 0, 2, 1, 1, 0, 1, 2, 0];
console.log(`Before: [${[...colors]}]`);
sortColors(colors);
console.log(`After:  [${colors}]\n`);

// ============================================================
// SECTION 9 -- Trapping Rain Water (Converging + Running Max)
// Water at position = min(leftMax, rightMax) - height.
// Process from the shorter side -- it bounds the water level.
// ============================================================

// Big-O: Time O(n), Space O(1)
function trapRainWater(heights) {
  let left = 0, right = heights.length - 1;
  let leftMax = 0, rightMax = 0, total = 0;

  while (left < right) {
    if (heights[left] < heights[right]) {
      if (heights[left] >= leftMax) leftMax = heights[left];
      else total += leftMax - heights[left];
      left++;
    } else {
      if (heights[right] >= rightMax) rightMax = heights[right];
      else total += rightMax - heights[right];
      right--;
    }
  }
  return total;
}

console.log("=== TRAPPING RAIN WATER ===");
console.log("Total water:", trapRainWater([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]));
console.log("O(n) time, O(1) space\n");

// ============================================================
// SECTION 10 -- Decision Guide
// ============================================================

console.log("=== WHEN TO USE TWO POINTERS ===");
console.log("Sorted + pair finding   -> Converging");
console.log("Palindrome check        -> Converging");
console.log("Remove duplicates       -> Fast/Slow");
console.log("Partition array         -> Same direction or 3-way");
console.log("Merge sorted arrays     -> Two arrays");
console.log("Container/Trap water    -> Converging + greedy/max");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. CONVERGING: sorted arrays, pair finding, palindrome.
//    Start from both ends, move toward each other.
// 2. SAME DIRECTION (fast/slow): in-place modification.
//    Slow = write position, fast = scanner.
// 3. TWO ARRAYS: merge, intersection. One pointer per array.
// 4. THREE POINTERS (Dutch Flag): partition into 3 groups O(n).
// 5. Trapping Rain Water: converging + running max from both sides.
// 6. Three Sum: fix one + two-pointer = O(n^2). Sort first, skip dupes.
// ============================================================

console.log("\n=== BIG-O SUMMARY ===");
console.log("+----------------------------+---------+---------+");
console.log("| Problem                    | Time    | Space   |");
console.log("+----------------------------+---------+---------+");
console.log("| Two Sum (sorted)           | O(n)    | O(1)    |");
console.log("| Three Sum                  | O(n^2)  | O(1)*   |");
console.log("| Container With Most Water  | O(n)    | O(1)    |");
console.log("| Remove Duplicates          | O(n)    | O(1)    |");
console.log("| Move Zeros                 | O(n)    | O(1)    |");
console.log("| Sort Colors (Dutch Flag)   | O(n)    | O(1)    |");
console.log("| Trapping Rain Water        | O(n)    | O(1)    |");
console.log("+----------------------------+---------+---------+");
