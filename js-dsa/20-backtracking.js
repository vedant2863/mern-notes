// ============================================================
// FILE 20: BACKTRACKING
// Topic: Solving constraint-satisfaction problems by trying choices and undoing them
// WHY: Backtracking explores all possible combinations/permutations by
//   systematic "try, fail, undo, try again." It powers puzzle solvers,
//   route planners, and constraint satisfaction engines.
// ============================================================

// ============================================================
// STORY: MakeMyTrip searches Delhi to NYC by exploring all flight
// combos. Dead end? Backtrack to last fork, try next option. This
// is DFS on a decision tree with pruning to skip hopeless branches.
// ============================================================

// ============================================================
// BLOCK 1 -- The Backtracking Template
// ============================================================

console.log("=== BACKTRACKING TEMPLATE ===");
console.log(`
function backtrack(state, choices) {
  if (isGoal(state)) { results.push(copy(state)); return; }
  for (const choice of choices) {
    if (!isValid(choice)) continue;   // PRUNE
    makeChoice(state, choice);         // CHOOSE
    backtrack(state, remainingChoices); // EXPLORE
    undoChoice(state, choice);         // UNDO (BACKTRACK)
  }
}
`);
console.log("Key idea: CHOOSE -> EXPLORE -> UNDO\n");

// ============================================================
// SECTION 1 -- Generate All Subsets (Power Set)
// Include or exclude each element. 2^n subsets total.
// ============================================================

// Big-O: Time O(2^n * n), Space O(n) recursion depth
function generateSubsets(nums) {
  const results = [];
  function backtrack(index, current) {
    if (index === nums.length) { results.push([...current]); return; }
    backtrack(index + 1, current);           // Exclude
    current.push(nums[index]);               // CHOOSE
    backtrack(index + 1, current);           // EXPLORE
    current.pop();                           // UNDO
  }
  backtrack(0, []);
  return results;
}

console.log("=== SUBSETS (POWER SET) ===");
const subsets = generateSubsets([1, 2, 3]);
console.log(`All subsets (2^3 = ${subsets.length}):`);
subsets.forEach((s) => console.log(`  [${s}]`));
console.log("O(2^n * n) time\n");

// ============================================================
// SECTION 2 -- Generate All Permutations
// All orderings of elements. n! permutations total.
// ============================================================

// Big-O: Time O(n! * n), Space O(n)
function permuteSwap(nums) {
  const results = [];
  function backtrack(start) {
    if (start === nums.length) { results.push([...nums]); return; }
    for (let i = start; i < nums.length; i++) {
      [nums[start], nums[i]] = [nums[i], nums[start]]; // CHOOSE (swap)
      backtrack(start + 1);                              // EXPLORE
      [nums[start], nums[i]] = [nums[i], nums[start]]; // UNDO (swap back)
    }
  }
  backtrack(0);
  return results;
}

console.log("=== PERMUTATIONS ===");
const perms = permuteSwap([1, 2, 3]);
console.log(`All permutations (3! = ${perms.length}):`);
perms.forEach((p) => console.log(`  [${p}]`));
console.log("O(n! * n) time\n");

// ============================================================
// SECTION 3 -- Combination Sum
// Elements can be reused. Sort for pruning: break when candidate > remaining.
// ============================================================

// Big-O: Time O(n^(t/min)), Space O(t/min) recursion depth
function combinationSum(candidates, target) {
  const results = [];
  candidates.sort((a, b) => a - b);

  function backtrack(start, current, remaining) {
    if (remaining === 0) { results.push([...current]); return; }
    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > remaining) break;              // PRUNE
      current.push(candidates[i]);                        // CHOOSE
      backtrack(i, current, remaining - candidates[i]);   // EXPLORE (i, not i+1: reuse)
      current.pop();                                      // UNDO
    }
  }
  backtrack(0, [], target);
  return results;
}

console.log("=== COMBINATION SUM ===");
const combos = combinationSum([2, 3, 6, 7], 7);
combos.forEach((c) => console.log(`  [${c}] = ${c.reduce((a, b) => a + b, 0)}`));
console.log("O(n^(t/min)) time\n");

// ============================================================
// SECTION 4 -- N-Queens
// Place N queens row by row. Use Sets for O(1) conflict checks.
// ============================================================

// Big-O: Time O(N!), Space O(N)
function solveNQueens(n) {
  const results = [];
  const board = Array.from({ length: n }, () => Array(n).fill("."));
  const cols = new Set(), diag1 = new Set(), diag2 = new Set();

  function backtrack(row) {
    if (row === n) { results.push(board.map((r) => r.join(""))); return; }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) continue;
      board[row][col] = "Q";
      cols.add(col); diag1.add(row - col); diag2.add(row + col);
      backtrack(row + 1);
      board[row][col] = ".";
      cols.delete(col); diag1.delete(row - col); diag2.delete(row + col);
    }
  }
  backtrack(0);
  return results;
}

function printBoard(board) {
  const n = board.length;
  const border = "  +" + "---+".repeat(n);
  console.log(border);
  for (let r = 0; r < n; r++) {
    let row = "  |";
    for (let c = 0; c < n; c++) row += (board[r][c] === "Q" ? " Q " : " . ") + "|";
    console.log(row);
    console.log(border);
  }
}

console.log("=== N-QUEENS ===");
const solutions4 = solveNQueens(4);
console.log(`4-Queens: ${solutions4.length} solutions\n`);
solutions4.forEach((sol, i) => { console.log(`Solution ${i + 1}:`); printBoard(sol); console.log(); });

const solutions8 = solveNQueens(8);
console.log(`8-Queens: ${solutions8.length} solutions\n`);

// ============================================================
// SECTION 5 -- Sudoku Solver
// Find empty cell, try 1-9, validate row/col/box, recurse.
// ============================================================

// Big-O: Time O(9^m) where m = empty cells, much less with pruning
function solveSudoku(board) {
  function isValid(board, row, col, num) {
    const char = String(num);
    for (let c = 0; c < 9; c++) if (board[row][c] === char) return false;
    for (let r = 0; r < 9; r++) if (board[r][col] === char) return false;
    const boxRow = Math.floor(row / 3) * 3, boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++)
      for (let c = boxCol; c < boxCol + 3; c++)
        if (board[r][c] === char) return false;
    return true;
  }

  function solve(board) {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (board[r][c] === ".") {
          for (let num = 1; num <= 9; num++) {
            if (isValid(board, r, c, num)) {
              board[r][c] = String(num);        // CHOOSE
              if (solve(board)) return true;     // EXPLORE
              board[r][c] = ".";                 // UNDO
            }
          }
          return false; // No valid number -- backtrack
        }
    return true; // All cells filled
  }
  solve(board);
  return board;
}

console.log("=== SUDOKU SOLVER ===");
const sudokuBoard = [
  ["5","3",".",".","7",".",".",".","."],
  ["6",".",".","1","9","5",".",".","."],
  [".","9","8",".",".",".",".","6","."],
  ["8",".",".",".","6",".",".",".","3"],
  ["4",".",".","8",".","3",".",".","1"],
  ["7",".",".",".","2",".",".",".","6"],
  [".","6",".",".",".",".","2","8","."],
  [".",".",".","4","1","9",".",".","5"],
  [".",".",".",".","8",".",".","7","9"],
];
solveSudoku(sudokuBoard);
sudokuBoard.forEach((r) => console.log("  " + r.join(" ")));
console.log();

// ============================================================
// SECTION 6 -- Generate Valid Parentheses
// Two pruning rules: add '(' if open < n, add ')' if close < open.
// ============================================================

// Big-O: Time O(4^n / sqrt(n)) -- Catalan number
function generateParentheses(n) {
  const results = [];
  function backtrack(current, openCount, closeCount) {
    if (current.length === 2 * n) { results.push(current); return; }
    if (openCount < n) backtrack(current + "(", openCount + 1, closeCount);
    if (closeCount < openCount) backtrack(current + ")", openCount, closeCount + 1);
  }
  backtrack("", 0, 0);
  return results;
}

console.log("=== VALID PARENTHESES ===");
for (let n = 1; n <= 4; n++) {
  const parens = generateParentheses(n);
  console.log(`n=${n}: ${parens.length} -> ${parens.join(", ")}`);
}
console.log();

// ============================================================
// SECTION 7 -- Backtracking vs Dynamic Programming
// ============================================================

console.log("=== BACKTRACKING vs DP ===");
console.log("Need ALL solutions?        -> Backtracking");
console.log("Need COUNT or OPTIMAL?     -> DP");
console.log("Has overlapping subproblems? -> DP");
console.log("Need to enumerate/generate? -> Backtracking\n");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Template: CHOOSE -> EXPLORE (recurse) -> UNDO (backtrack).
// 2. Subsets: include/exclude each element. 2^n possibilities.
// 3. Permutations: swap, recurse, swap back. n! possibilities.
// 4. Combination Sum: reuse allowed (start from i not i+1). Sort for pruning.
// 5. N-Queens: row-by-row + Sets for O(1) column/diagonal checks.
// 6. Sudoku: try 1-9, validate row/col/box, recurse. No valid? Backtrack.
// 7. PRUNING is the key to performance. Without it, backtracking is brute force.
// ============================================================

console.log("=== BIG-O SUMMARY ===");
console.log("+---------------------+------------------+--------+");
console.log("| Problem             | Time             | Space  |");
console.log("+---------------------+------------------+--------+");
console.log("| Subsets             | O(2^n * n)       | O(n)   |");
console.log("| Permutations        | O(n! * n)        | O(n)   |");
console.log("| Combination Sum     | O(n^(t/min))     | O(t/m) |");
console.log("| N-Queens            | O(N!)            | O(N)   |");
console.log("| Sudoku              | O(9^m)           | O(m)   |");
console.log("| Valid Parentheses   | O(4^n / sqrt(n)) | O(n)   |");
console.log("+---------------------+------------------+--------+");
