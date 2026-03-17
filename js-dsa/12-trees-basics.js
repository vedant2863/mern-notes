// ============================================================
// FILE 12: TREES — BASICS & TRAVERSALS
// Topic: Binary Trees, Traversals, and Core Tree Operations
// WHY: Trees model hierarchical data — file systems, DOM, org charts.
//   Understanding traversals unlocks 30%+ of coding interviews.
// ============================================================

// ============================================================
// STORY: Flipkart organizes 150M+ products in a category tree.
// Clicking "Electronics" traverses the tree to show subcategories.
// ============================================================

// ============================================================
// SECTION 1 — Binary Tree Basics
// ============================================================

// Tree terminology: Root (top), Leaf (no children), Height (to deepest leaf)
// Binary tree: each node has at most 2 children (left, right).

class TreeNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

//         1
//        / \
//       2   3
//      / \   \
//     4   5   6
//    /       / \
//   7       8   9

const root = new TreeNode(1);
root.left = new TreeNode(2);
root.right = new TreeNode(3);
root.left.left = new TreeNode(4);
root.left.right = new TreeNode(5);
root.right.right = new TreeNode(6);
root.left.left.left = new TreeNode(7);
root.right.right.left = new TreeNode(8);
root.right.right.right = new TreeNode(9);

console.log('=== BINARY TREE CREATED ===');
console.log('Root:', root.value, '| Left:', root.left.value, '| Right:', root.right.value);

// ============================================================
// SECTION 2 — Four Traversals
// ============================================================

// All traversals: Time O(n), Space O(h) where h = height.

// --- INORDER (Left -> Root -> Right) ---
// For a BST, gives SORTED order.
function inorderRecursive(node, result = []) {
  if (node === null) return result;
  inorderRecursive(node.left, result);
  result.push(node.value);
  inorderRecursive(node.right, result);
  return result;
}

function inorderIterative(root) {
  const result = [], stack = [];
  let current = root;
  while (current !== null || stack.length > 0) {
    while (current !== null) { stack.push(current); current = current.left; }
    current = stack.pop();
    result.push(current.value);
    current = current.right;
  }
  return result;
}

console.log('\n=== INORDER (L -> Root -> R) ===');
console.log('Recursive:', inorderRecursive(root));
console.log('Iterative:', inorderIterative(root));

// --- PREORDER (Root -> Left -> Right) ---
// Useful for copying/serializing trees.
function preorderRecursive(node, result = []) {
  if (node === null) return result;
  result.push(node.value);
  preorderRecursive(node.left, result);
  preorderRecursive(node.right, result);
  return result;
}

function preorderIterative(root) {
  if (root === null) return [];
  const result = [], stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    result.push(node.value);
    if (node.right) stack.push(node.right); // Push right first (LIFO)
    if (node.left) stack.push(node.left);
  }
  return result;
}

console.log('\n=== PREORDER (Root -> L -> R) ===');
console.log('Recursive:', preorderRecursive(root));

// --- POSTORDER (Left -> Right -> Root) ---
// Useful for deletion and expression evaluation.
function postorderRecursive(node, result = []) {
  if (node === null) return result;
  postorderRecursive(node.left, result);
  postorderRecursive(node.right, result);
  result.push(node.value);
  return result;
}

console.log('\n=== POSTORDER (L -> R -> Root) ===');
console.log('Recursive:', postorderRecursive(root));

// --- LEVEL-ORDER (BFS) ---
// Process nodes level by level using a queue.
function levelOrder(root) {
  if (root === null) return [];
  const result = [], queue = [root];

  while (queue.length > 0) {
    const levelSize = queue.length;
    const currentLevel = [];
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      currentLevel.push(node.value);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(currentLevel);
  }
  return result;
}

console.log('\n=== LEVEL-ORDER (BFS) ===');
console.log('By levels:', levelOrder(root));

// ============================================================
// SECTION 3 — Tree Properties
// ============================================================

function treeHeight(node) {
  if (node === null) return -1;
  return Math.max(treeHeight(node.left), treeHeight(node.right)) + 1;
}

function countNodes(node) {
  if (node === null) return 0;
  return 1 + countNodes(node.left) + countNodes(node.right);
}

function countLeaves(node) {
  if (node === null) return 0;
  if (!node.left && !node.right) return 1;
  return countLeaves(node.left) + countLeaves(node.right);
}

// Balanced check: O(n) single pass — returns -1 if unbalanced.
function isBalanced(node) { return checkBalance(node) !== -1; }

function checkBalance(node) {
  if (node === null) return 0;
  const lh = checkBalance(node.left);
  if (lh === -1) return -1;
  const rh = checkBalance(node.right);
  if (rh === -1) return -1;
  if (Math.abs(lh - rh) > 1) return -1;
  return Math.max(lh, rh) + 1;
}

console.log('\n=== TREE PROPERTIES ===');
console.log('Height:', treeHeight(root));      // 3
console.log('Total nodes:', countNodes(root)); // 9
console.log('Leaves:', countLeaves(root));     // 4
console.log('Balanced?', isBalanced(root));    // false

// ============================================================
// SECTION 4 — Classic Tree Problems
// ============================================================

// --- Invert Binary Tree ---
function invertTree(node) {
  if (node === null) return null;
  [node.left, node.right] = [node.right, node.left];
  invertTree(node.left);
  invertTree(node.right);
  return node;
}

const invertDemo = new TreeNode(1);
invertDemo.left = new TreeNode(2);
invertDemo.right = new TreeNode(3);
invertDemo.left.left = new TreeNode(4);
invertDemo.left.right = new TreeNode(5);

console.log('\n=== INVERT BINARY TREE ===');
console.log('Before:', inorderRecursive(invertDemo)); // [4,2,5,1,3]
invertTree(invertDemo);
console.log('After:', inorderRecursive(invertDemo));   // [3,1,5,2,4]

// --- Check if Two Trees are Identical ---
function areIdentical(n1, n2) {
  if (n1 === null && n2 === null) return true;
  if (n1 === null || n2 === null) return false;
  return n1.value === n2.value && areIdentical(n1.left, n2.left) && areIdentical(n1.right, n2.right);
}

// --- Path Sum ---
function hasPathSum(node, targetSum) {
  if (node === null) return false;
  if (!node.left && !node.right) return node.value === targetSum;
  return hasPathSum(node.left, targetSum - node.value) || hasPathSum(node.right, targetSum - node.value);
}

// --- Diameter of Binary Tree ---
function diameterOfBinaryTree(root) {
  let maxDiameter = 0;
  function height(node) {
    if (node === null) return 0;
    const lh = height(node.left), rh = height(node.right);
    maxDiameter = Math.max(maxDiameter, lh + rh);
    return Math.max(lh, rh) + 1;
  }
  height(root);
  return maxDiameter;
}

//        10
//       /  \
//      5    15
//     / \   / \
//    3   7 12  20
const balancedRoot = new TreeNode(10);
balancedRoot.left = new TreeNode(5);
balancedRoot.right = new TreeNode(15);
balancedRoot.left.left = new TreeNode(3);
balancedRoot.left.right = new TreeNode(7);
balancedRoot.right.left = new TreeNode(12);
balancedRoot.right.right = new TreeNode(20);

console.log('\n=== PATH SUM & DIAMETER ===');
console.log('Path sum 18?', hasPathSum(balancedRoot, 18)); // true (10->5->3)
console.log('Diameter:', diameterOfBinaryTree(balancedRoot)); // 4

// --- Build Tree from Level-Order Array ---
function buildTreeFromArray(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = new TreeNode(arr[0]);
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length && arr[i] !== null) { node.left = new TreeNode(arr[i]); queue.push(node.left); }
    i++;
    if (i < arr.length && arr[i] !== null) { node.right = new TreeNode(arr[i]); queue.push(node.right); }
    i++;
  }
  return root;
}

console.log('\n=== BUILD FROM ARRAY ===');
const builtTree = buildTreeFromArray([1, 2, 3, 4, 5, null, 6]);
console.log('Level-order:', levelOrder(builtTree));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Binary Tree: each node has value, left, right.
// 2. Four traversals:
//    - Inorder (L->Root->R): sorted for BST
//    - Preorder (Root->L->R): copy/serialize
//    - Postorder (L->R->Root): delete/evaluate
//    - Level-order: BFS with queue
// 3. Implement both recursive and iterative versions.
// 4. Properties (height, count, balance) are solved with
//    recursion: solve left, solve right, combine.
// 5. Invert tree: swap left/right recursively. O(n).
// 6. Build from array: use a queue (level-order). O(n).

console.log('\n=== ALL TREE BASICS EXAMPLES COMPLETE ===');
