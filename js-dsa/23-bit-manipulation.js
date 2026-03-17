// ============================================================
// FILE 23: BIT MANIPULATION
// Topic: Using bitwise operators for ultra-fast low-level computation
// WHY: Bit manipulation performs O(1) operations that would otherwise
//   need loops. Used in permissions systems, compression, cryptography,
//   and competitive programming.
// ============================================================

// ============================================================
// STORY: Zerodha stores 8 boolean account properties (is_active,
// has_margin, is_verified, etc.) in a SINGLE byte using bit flags.
// At 10M accounts, this saves 70MB vs separate booleans.
// ============================================================

console.log("=== BIT MANIPULATION ===\n");

// ============================================================
// SECTION 1 -- Bitwise Operators
// ============================================================

function toBin(n, bits = 8) { return (n >>> 0).toString(2).padStart(bits, "0"); }

console.log("=== BITWISE OPERATORS ===");
console.log("AND (&): 10 & 12 =", 10 & 12, " ->", toBin(10), "&", toBin(12), "=", toBin(10 & 12));
console.log("OR  (|): 10 | 12 =", (10 | 12), "->", toBin(10), "|", toBin(12), "=", toBin(10 | 12));
console.log("XOR (^): 10 ^ 12 =", (10 ^ 12), " ->", toBin(10), "^", toBin(12), "=", toBin(10 ^ 12));
console.log("NOT (~): ~10 =", ~10, "  (two's complement: ~n = -(n+1))");
console.log("Left Shift:  10 << 2 =", 10 << 2, " (multiply by 2^k)");
console.log("Right Shift: 10 >> 1 =", 10 >> 1, "  (divide by 2^k)");
console.log();

// ============================================================
// SECTION 2 -- Essential Bit Tricks
// ============================================================

console.log("=== BIT TRICKS ===");

function isOdd(n) { return (n & 1) === 1; }
function isPowerOf2(n) { return n > 0 && (n & (n - 1)) === 0; }
function setBit(n, p) { return n | (1 << p); }
function clearBit(n, p) { return n & ~(1 << p); }
function toggleBit(n, p) { return n ^ (1 << p); }
function checkBit(n, p) { return (n >> p) & 1; }

console.log("7 is odd:", isOdd(7), "| 8 is odd:", isOdd(8));
console.log("16 is power of 2:", isPowerOf2(16), "| 18:", isPowerOf2(18));
console.log("Set bit 3 of 5:", toBin(5), "->", toBin(setBit(5, 3)));
console.log("Clear bit 2 of 5:", toBin(5), "->", toBin(clearBit(5, 2)));
console.log("Toggle bit 1 of 5:", toBin(5), "->", toBin(toggleBit(5, 1)));

// XOR swap: a^=b; b^=a; a^=b
let sa = 42, sb = 99;
sa ^= sb; sb ^= sa; sa ^= sb;
console.log("XOR swap: 42,99 -> " + sa + "," + sb);
console.log();

// ============================================================
// SECTION 3 -- Single Number (XOR Trick)
// XOR all nums: duplicates cancel (a^a=0), unique survives (a^0=a).
// ============================================================

// O(n) time, O(1) space
function singleNumber(nums) {
  let result = 0;
  for (const num of nums) result ^= num;
  return result;
}

console.log("=== SINGLE NUMBER ===");
console.log("Single in [2,2,1]:", singleNumber([2, 2, 1]));
console.log("Single in [4,1,2,1,2]:", singleNumber([4, 1, 2, 1, 2]));
console.log();

// ============================================================
// SECTION 4 -- Count Set Bits (Brian Kernighan's Trick)
// n & (n-1) clears the lowest set bit. Count iterations. O(k) where k = set bits.
// ============================================================

function countBitsKernighan(n) {
  let count = 0;
  while (n) { n &= (n - 1); count++; }
  return count;
}

// DP version for range 0..n: dp[i] = dp[i>>1] + (i&1). O(n).
function countBitsRange(n) {
  const dp = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) dp[i] = dp[i >> 1] + (i & 1);
  return dp;
}

console.log("=== COUNT SET BITS ===");
console.log("Bits in 11 (1011):", countBitsKernighan(11));
console.log("Bits 0-7:", countBitsRange(7));
console.log();

// ============================================================
// SECTION 5 -- Bit Flag Permission System
// Each permission = power of 2. Combine with OR, check with AND.
// Same pattern as Unix file permissions (rwx = 421).
// ============================================================

const PERMISSIONS = {
  READ: 1, WRITE: 2, EXECUTE: 4, DELETE: 8, ADMIN: 16, SUPERADMIN: 32,
};

class PermissionManager {
  constructor() { this.userPerms = {}; }
  grant(userId, perm) { this.userPerms[userId] = (this.userPerms[userId] || 0) | perm; }
  revoke(userId, perm) { if (this.userPerms[userId] !== undefined) this.userPerms[userId] &= ~perm; }
  has(userId, perm) { return (this.userPerms[userId] & perm) === perm; }
  toggle(userId, perm) { this.userPerms[userId] = (this.userPerms[userId] || 0) ^ perm; }
  list(userId) {
    const p = this.userPerms[userId] || 0;
    return Object.entries(PERMISSIONS).filter(([, bit]) => p & bit).map(([name]) => name);
  }
}

console.log("=== BIT FLAG PERMISSIONS ===");
const pm = new PermissionManager();
pm.grant("user1", PERMISSIONS.READ | PERMISSIONS.WRITE);
console.log("user1:", pm.list("user1"));
console.log("has READ?", pm.has("user1", PERMISSIONS.READ));
pm.revoke("user1", PERMISSIONS.WRITE);
console.log("After revoke WRITE:", pm.list("user1"));
console.log();

// ============================================================
// SECTION 6 -- Subsets Using Bitmask
// Iterate 0 to 2^n-1. Each bit = include/exclude that item.
// ============================================================

// O(2^n * n) time
function subsets(items) {
  const n = items.length, total = 1 << n, result = [];
  for (let mask = 0; mask < total; mask++) {
    const subset = [];
    for (let bit = 0; bit < n; bit++) if (mask & (1 << bit)) subset.push(items[bit]);
    result.push(subset);
  }
  return result;
}

console.log("=== BITMASK SUBSETS ===");
const allSub = subsets(["Phone", "Case", "Charger"]);
allSub.forEach((s, i) => console.log(`  ${toBin(i, 3)} -> [${s.join(", ")}]`));
console.log();

// ============================================================
// SECTION 7 -- Find Missing Number (XOR)
// XOR 0..n with array elements. Only the missing number survives.
// ============================================================

function findMissing(nums, n) {
  let xor = 0;
  for (let i = 0; i <= n; i++) xor ^= i;
  for (const num of nums) xor ^= num;
  return xor;
}

console.log("=== FIND MISSING NUMBER ===");
console.log("Missing from [0,1,3,4] (n=4):", findMissing([0, 1, 3, 4], 4));
console.log();

// ============================================================
// SECTION 8 -- JS 32-Bit Caveat
// ============================================================

console.log("=== JS 32-BIT LIMIT ===");
console.log("2^31 - 1 =", (2 ** 31 - 1), "(max signed 32-bit)");
console.log("2^31 | 0 =", (2 ** 31) | 0, "(overflow!)");
console.log("For larger values, use BigInt.\n");

// ============================================================
// SECTION 9 -- Tests
// ============================================================

console.log("=== RUNNING TESTS ===");
console.assert(isOdd(7) && !isOdd(8), "Odd/Even");
console.assert(isPowerOf2(16) && !isPowerOf2(18), "Power of 2");
console.assert(setBit(5, 3) === 13 && clearBit(5, 2) === 1, "Set/Clear bit");
console.assert(singleNumber([4, 1, 2, 1, 2]) === 4, "Single Number");
console.assert(countBitsKernighan(11) === 3, "Count bits");
console.assert(subsets(["a", "b"]).length === 4, "Subsets");
console.assert(findMissing([0, 1, 3, 4], 4) === 2, "Missing number");
console.log("All Bit Manipulation tests passed!");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. &, |, ^, ~, <<, >> are single-cycle CPU operations.
// 2. n & 1 checks odd/even. n & (n-1) clears lowest set bit.
// 3. XOR magic: a^a=0, a^0=a. Finds unique elements in O(n)/O(1).
// 4. Bit flags store multiple booleans in one integer (Unix perms, feature flags).
// 5. Bitmask subsets: iterate 0..2^n-1, each bit = include/exclude.
// 6. Kernighan's trick counts set bits in O(k). DP formula: dp[i]=dp[i>>1]+(i&1).
// 7. JS bitwise ops use 32-bit signed ints. Use BigInt for larger values.
// ============================================================

console.log("\n=== BIG-O SUMMARY ===");
console.log("+---------------------------+--------+--------+");
console.log("| Operation                 | Time   | Space  |");
console.log("+---------------------------+--------+--------+");
console.log("| Check even/odd (n & 1)    | O(1)   | O(1)   |");
console.log("| Set/Clear/Toggle bit      | O(1)   | O(1)   |");
console.log("| Single Number (XOR)       | O(n)   | O(1)   |");
console.log("| Count set bits (Kernighan)| O(k)   | O(1)   |");
console.log("| Count bits 0..n (DP)      | O(n)   | O(n)   |");
console.log("| Generate all subsets      | O(2^n) | O(2^n) |");
console.log("| Find missing number       | O(n)   | O(1)   |");
console.log("+---------------------------+--------+--------+");
