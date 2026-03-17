// ============================================================
// FILE 03: STRINGS AND PATTERNS
// Topic: String manipulation, pattern matching, and classic algorithms
// WHY: Strings are everywhere — search, autocomplete, resume matching.
//   Understanding immutability and efficient patterns is essential.
// ============================================================

// ============================================================
// STORY — Naukri.com Resume Keyword Matching
// 10+ million resumes searched against keywords. Naive matching
// is O(n*m) per doc. Optimized algorithms achieve sub-second results.
// ============================================================

// ============================================================
// SECTION 1 — String Immutability
// Every string operation creates a NEW string. The original never changes.
// ============================================================

let greeting = "Namaste";
const modified = "n" + greeting.slice(1); // New string "namaste"
console.log("Original:", greeting);  // "Namaste" — unchanged
console.log("Modified:", modified);  // "namaste"

// ============================================================
// SECTION 2 — String Operations Big-O
// Key pitfall: concat in a loop is O(n^2). Use array.join() for O(n).
// ============================================================

// BAD: O(n^2) — each concat copies all previous chars
function buildStringBad(n) {
  let result = "";
  for (let i = 0; i < n; i++) result += "a";
  return result;
}

// GOOD: O(n) — array.join() does a single allocation
function buildStringGood(n) {
  const parts = [];
  for (let i = 0; i < n; i++) parts.push("a");
  return parts.join("");
}

console.log("\nBad O(n^2):", buildStringBad(10).length, "chars");
console.log("Good O(n):", buildStringGood(10).length, "chars");

console.log(`
| Operation        | Big-O   | Why                     |
|------------------|---------|-------------------------|
| Access char [i]  | O(1)    | Direct index            |
| Concat a+b       | O(n+m)  | Creates new string      |
| Concat in loop   | O(n^2)  | Copies grow: 1+2+...+n  |
| array.join()     | O(n)    | Single allocation       |
| indexOf/includes | O(n*m)  | Naive search            |
| split            | O(n)    | Scans entire string     |
`);

// ============================================================
// SECTION 3 — Reverse a String
// ============================================================

// split-reverse-join is cleanest. Two-pointer on char array also works.
function reverseString(str) {
  return str.split("").reverse().join(""); // O(n)
}
console.log("Reverse:", reverseString("Bangalore")); // "erolagnaB"

// ============================================================
// SECTION 4 — Palindrome Check (Two-Pointer)
// O(n) time. Clean alphanumeric, compare from both ends.
// ============================================================

function isPalindrome(str) {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  let left = 0, right = cleaned.length - 1;
  while (left < right) {
    if (cleaned[left] !== cleaned[right]) return false;
    left++; right--;
  }
  return true;
}

console.log("\n'madam':", isPalindrome("madam"));
console.log("'A man a plan a canal Panama':", isPalindrome("A man a plan a canal Panama"));

// ============================================================
// SECTION 5 — Anagram Check (Frequency Counter)
// O(n) with Map. Alternative: sort both strings O(n log n).
// ============================================================

function areAnagrams(str1, str2) {
  if (str1.length !== str2.length) return false;
  const freq = new Map();
  for (const c of str1) freq.set(c, (freq.get(c) || 0) + 1);
  for (const c of str2) {
    if (!freq.has(c) || freq.get(c) === 0) return false;
    freq.set(c, freq.get(c) - 1);
  }
  return true;
}

console.log("\n'listen' & 'silent':", areAnagrams("listen", "silent"));
console.log("'triangle' & 'integral':", areAnagrams("triangle", "integral"));

// ============================================================
// SECTION 6 — Longest Substring Without Repeating Characters
// Sliding window: O(n) instead of checking O(n^2) substrings.
// ============================================================

function longestUniqueSubstring(str) {
  const charIndex = new Map();
  let maxLen = 0, start = 0;
  for (let end = 0; end < str.length; end++) {
    const char = str[end];
    if (charIndex.has(char) && charIndex.get(char) >= start)
      start = charIndex.get(char) + 1;
    charIndex.set(char, end);
    maxLen = Math.max(maxLen, end - start + 1);
  }
  return maxLen;
}

console.log("\nLongest unique 'abcabcbb':", longestUniqueSubstring("abcabcbb")); // 3
console.log("Longest unique 'pwwkew':", longestUniqueSubstring("pwwkew")); // 3

// ============================================================
// SECTION 7 — String Compression (Run-Length Encoding)
// "aaabbbcc" -> "a3b3c2". Return original if not shorter. O(n).
// ============================================================

function compressString(str) {
  if (str.length <= 1) return str;
  const parts = [];
  let count = 1;
  for (let i = 1; i <= str.length; i++) {
    if (i < str.length && str[i] === str[i - 1]) {
      count++;
    } else {
      parts.push(str[i - 1] + count);
      count = 1;
    }
  }
  const compressed = parts.join("");
  return compressed.length < str.length ? compressed : str;
}

console.log("\nCompress 'aaabbbcc':", compressString("aaabbbcc")); // "a3b3c2"
console.log("Compress 'abc':", compressString("abc")); // "abc" (not shorter)

// ============================================================
// SECTION 8 — First Non-Repeating Character
// Two passes: count frequencies, then find first with count 1.
// ============================================================

function firstNonRepeating(str) {
  const freq = new Map();
  for (const c of str) freq.set(c, (freq.get(c) || 0) + 1);
  for (let i = 0; i < str.length; i++)
    if (freq.get(str[i]) === 1) return { char: str[i], index: i };
  return null;
}

console.log("\nFirst non-repeating 'aabccbd':", firstNonRepeating("aabccbd"));

// ============================================================
// SECTION 9 — String Rotation Check
// If s2 is a rotation of s1, then s2 is inside (s1 + s1). O(n).
// ============================================================

function isRotation(s1, s2) {
  if (s1.length !== s2.length) return false;
  return (s1 + s1).includes(s2);
}

console.log("\n'waterbottle' & 'erbottlewat':", isRotation("waterbottle", "erbottlewat"));

// ============================================================
// SECTION 10 — KMP Pattern Matching
// O(n + m) using prefix table (LPS). Avoids backtracking.
// ============================================================

function buildPrefixTable(pattern) {
  const lps = new Array(pattern.length).fill(0);
  let length = 0, i = 1;
  while (i < pattern.length) {
    if (pattern[i] === pattern[length]) { length++; lps[i] = length; i++; }
    else { if (length !== 0) length = lps[length - 1]; else { lps[i] = 0; i++; } }
  }
  return lps;
}

function kmpSearch(text, pattern) {
  if (pattern.length === 0) return [];
  const lps = buildPrefixTable(pattern);
  const matches = [];
  let i = 0, j = 0;
  while (i < text.length) {
    if (text[i] === pattern[j]) { i++; j++; }
    if (j === pattern.length) { matches.push(i - j); j = lps[j - 1]; }
    else if (i < text.length && text[i] !== pattern[j]) {
      if (j !== 0) j = lps[j - 1]; else i++;
    }
  }
  return matches;
}

const resumeText = "javascript developer with javascript and react javascript skills";
console.log("\nKMP 'javascript' at:", kmpSearch(resumeText, "javascript")); // [0, 27, 47]

// ============================================================
// SECTION 11 — Practical Problems
// ============================================================

// One Edit Away — O(n), O(1) space
function oneEditAway(s1, s2) {
  if (Math.abs(s1.length - s2.length) > 1) return false;
  let edits = 0, i = 0, j = 0;
  while (i < s1.length && j < s2.length) {
    if (s1[i] !== s2[j]) {
      edits++;
      if (edits > 1) return false;
      if (s1.length > s2.length) i++;
      else if (s1.length < s2.length) j++;
      else { i++; j++; }
    } else { i++; j++; }
  }
  return edits + (s1.length - i) + (s2.length - j) <= 1;
}
console.log("\nOne edit 'pale'->'ple':", oneEditAway("pale", "ple"));

// Longest Palindromic Substring — expand around center, O(n^2), O(1)
function longestPalindromicSubstring(str) {
  if (str.length < 2) return str;
  let start = 0, maxLen = 1;
  function expand(left, right) {
    while (left >= 0 && right < str.length && str[left] === str[right]) {
      if (right - left + 1 > maxLen) { start = left; maxLen = right - left + 1; }
      left--; right++;
    }
  }
  for (let i = 0; i < str.length; i++) {
    expand(i, i);     // odd-length
    expand(i, i + 1); // even-length
  }
  return str.substring(start, start + maxLen);
}
console.log("Longest palindrome 'racecarxyz':", longestPalindromicSubstring("racecarxyz"));

// Group Anagrams — sort each word as key, O(n * k log k)
function groupAnagrams(words) {
  const groups = new Map();
  for (const word of words) {
    const key = word.split("").sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  return [...groups.values()];
}
console.log("Group anagrams:", groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Strings are IMMUTABLE — every operation creates a new string
// 2. NEVER concat in a loop — use array.join(): O(n) vs O(n^2)
// 3. Frequency counter (Map) solves anagram, unique char, duplicate problems
// 4. Two-pointer: palindrome check in O(n)
// 5. Sliding window: longest unique substring in O(n)
// 6. String rotation trick: (s1 + s1).includes(s2)
// 7. KMP: pattern matching in O(n + m), avoids naive O(n * m)
// ============================================================
