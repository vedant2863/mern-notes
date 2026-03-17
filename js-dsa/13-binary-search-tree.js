// ============================================================
// FILE 13: BINARY SEARCH TREE (BST)
// Topic: BST Operations, Validation, LCA, and Balancing
// WHY: BST ordering (left < root < right) enables O(log n)
//   search, insert, and delete — when balanced.
// ============================================================

// ============================================================
// STORY: BookMyShow manages seat pricing across 8,000+ screens.
// A BST stores prices so that "find seats between Rs.500 and
// Rs.2000" runs in O(log n + k) instead of O(n).
// ============================================================

class TreeNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

// ============================================================
// SECTION 1 — BST Class
// ============================================================

class BST {
  constructor() { this.root = null; }

  // --- INSERT: O(log n) avg, O(n) worst ---
  insert(value) {
    const newNode = new TreeNode(value);
    if (this.root === null) { this.root = newNode; return this; }

    let current = this.root;
    while (true) {
      if (value === current.value) return this; // Ignore duplicates
      if (value < current.value) {
        if (current.left === null) { current.left = newNode; return this; }
        current = current.left;
      } else {
        if (current.right === null) { current.right = newNode; return this; }
        current = current.right;
      }
    }
  }

  // --- SEARCH: O(log n) avg ---
  search(value) {
    let current = this.root;
    while (current !== null) {
      if (value === current.value) return current;
      current = value < current.value ? current.left : current.right;
    }
    return null;
  }

  // --- FIND MIN/MAX: O(h) ---
  findMin(node = this.root) {
    let current = node;
    while (current && current.left) current = current.left;
    return current;
  }

  findMax(node = this.root) {
    let current = node;
    while (current && current.right) current = current.right;
    return current;
  }

  // --- DELETE: 3 cases ---
  // Case 1: Leaf -> remove. Case 2: One child -> replace.
  // Case 3: Two children -> replace with inorder successor.
  delete(value) { this.root = this._deleteNode(this.root, value); }

  _deleteNode(node, value) {
    if (node === null) return null;
    if (value < node.value) { node.left = this._deleteNode(node.left, value); }
    else if (value > node.value) { node.right = this._deleteNode(node.right, value); }
    else {
      if (!node.left && !node.right) return null;
      if (node.left === null) return node.right;
      if (node.right === null) return node.left;
      const successor = this.findMin(node.right);
      node.value = successor.value;
      node.right = this._deleteNode(node.right, successor.value);
    }
    return node;
  }

  // --- INORDER: gives SORTED output ---
  inorderTraversal(node = this.root, result = []) {
    if (node === null) return result;
    this.inorderTraversal(node.left, result);
    result.push(node.value);
    this.inorderTraversal(node.right, result);
    return result;
  }
}

// --- Demo ---
console.log('=== BST OPERATIONS ===');
const bst = new BST();
[50, 30, 70, 20, 40, 60, 80, 10, 90].forEach(v => bst.insert(v));
console.log('Inorder (sorted):', bst.inorderTraversal());
console.log('Search 40:', bst.search(40)?.value);
console.log('Min:', bst.findMin()?.value, '| Max:', bst.findMax()?.value);

// --- Deletion demo ---
console.log('\n=== BST DELETION ===');
bst.delete(10);
console.log('After deleting 10 (leaf):', bst.inorderTraversal());
bst.delete(20);
console.log('After deleting 20 (one child):', bst.inorderTraversal());
bst.delete(50);
console.log('After deleting 50 (two children):', bst.inorderTraversal());

// ============================================================
// SECTION 2 — Validate BST
// ============================================================

// WHY: Checking only immediate children is WRONG. Must pass
// min/max bounds recursively through the entire subtree.

function isValidBST(node, min = -Infinity, max = Infinity) {
  if (node === null) return true;
  if (node.value <= min || node.value >= max) return false;
  return isValidBST(node.left, min, node.value) && isValidBST(node.right, node.value, max);
}

console.log('\n=== VALIDATE BST ===');
console.log('Our BST valid?', isValidBST(bst.root)); // true

// Invalid example: 8 in left subtree but > grandparent 5
const invalid = new TreeNode(5);
invalid.left = new TreeNode(3);
invalid.left.right = new TreeNode(8); // 8 > 5, violates BST
console.log('Invalid BST?', isValidBST(invalid)); // false

// ============================================================
// SECTION 3 — Successor, Predecessor, Kth Smallest
// ============================================================

function inorderSuccessor(root, target) {
  let successor = null, current = root;
  while (current !== null) {
    if (target < current.value) { successor = current; current = current.left; }
    else current = current.right;
  }
  return successor;
}

function inorderPredecessor(root, target) {
  let predecessor = null, current = root;
  while (current !== null) {
    if (target > current.value) { predecessor = current; current = current.right; }
    else current = current.left;
  }
  return predecessor;
}

// Kth Smallest: iterative inorder, stop at k. O(h + k).
function kthSmallest(root, k) {
  const stack = [];
  let current = root, count = 0;

  while (current !== null || stack.length > 0) {
    while (current !== null) { stack.push(current); current = current.left; }
    current = stack.pop();
    count++;
    if (count === k) return current.value;
    current = current.right;
  }
  return -1;
}

const bst2 = new BST();
[50, 30, 70, 20, 40, 60, 80].forEach(v => bst2.insert(v));

console.log('\n=== SUCCESSOR / PREDECESSOR / KTH SMALLEST ===');
console.log('Successor of 30:', inorderSuccessor(bst2.root, 30)?.value);   // 40
console.log('Predecessor of 40:', inorderPredecessor(bst2.root, 40)?.value); // 30
console.log('3rd smallest:', kthSmallest(bst2.root, 3)); // 40

// ============================================================
// SECTION 4 — Lowest Common Ancestor
// ============================================================

// WHY: BST ordering tells you exactly which direction to go.
// If both < root go left, both > root go right, else split = LCA.
function lowestCommonAncestor(root, p, q) {
  let current = root;
  while (current !== null) {
    if (p < current.value && q < current.value) current = current.left;
    else if (p > current.value && q > current.value) current = current.right;
    else return current;
  }
  return null;
}

console.log('\n=== LCA ===');
console.log('LCA(20, 40):', lowestCommonAncestor(bst2.root, 20, 40)?.value); // 30
console.log('LCA(20, 60):', lowestCommonAncestor(bst2.root, 20, 60)?.value); // 50

// ============================================================
// SECTION 5 — Sorted Array to Balanced BST
// ============================================================

// WHY: Inserting sorted data sequentially creates a linked list (O(n) ops).
// Pick middle as root, recurse on halves -> balanced BST with O(log n) height.

function sortedArrayToBST(arr, left = 0, right = arr.length - 1) {
  if (left > right) return null;
  const mid = left + Math.floor((right - left) / 2);
  const node = new TreeNode(arr[mid]);
  node.left = sortedArrayToBST(arr, left, mid - 1);
  node.right = sortedArrayToBST(arr, mid + 1, right);
  return node;
}

function getHeight(node) {
  if (node === null) return -1;
  return Math.max(getHeight(node.left), getHeight(node.right)) + 1;
}

function inorder(node, result = []) {
  if (node === null) return result;
  inorder(node.left, result);
  result.push(node.value);
  inorder(node.right, result);
  return result;
}

const sortedPrices = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const balancedBST = sortedArrayToBST(sortedPrices);

console.log('\n=== SORTED ARRAY -> BALANCED BST ===');
console.log('Inorder:', inorder(balancedBST));
console.log('Height:', getHeight(balancedBST)); // 3

// --- Floor and Ceil ---
function floor(root, target) {
  let result = null, current = root;
  while (current !== null) {
    if (current.value === target) return current.value;
    if (current.value < target) { result = current.value; current = current.right; }
    else current = current.left;
  }
  return result;
}

function ceil(root, target) {
  let result = null, current = root;
  while (current !== null) {
    if (current.value === target) return current.value;
    if (current.value > target) { result = current.value; current = current.left; }
    else current = current.right;
  }
  return result;
}

console.log('\n=== FLOOR & CEIL ===');
console.log('Floor(350):', floor(balancedBST, 350)); // 300
console.log('Ceil(350):', ceil(balancedBST, 350));    // 400

// --- Range Query ---
function rangeQuery(node, low, high, result = []) {
  if (node === null) return result;
  if (node.value > low) rangeQuery(node.left, low, high, result);
  if (node.value >= low && node.value <= high) result.push(node.value);
  if (node.value < high) rangeQuery(node.right, low, high, result);
  return result;
}

console.log('Range [250, 650]:', rangeQuery(balancedBST, 250, 650));

// ============================================================
// SECTION 6 — Self-Balancing Trees (Concepts)
// ============================================================

console.log('\n=== SELF-BALANCING TREES ===');
console.log('AVL Tree: strict balance (|height diff| <= 1), rotations on insert/delete');
console.log('Red-Black Tree: relaxed balance, used in Java TreeMap, C++ std::map');
console.log('B-Tree/B+ Tree: disk-optimized, used in MongoDB/PostgreSQL indexes');

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. BST Property: left < root < right for ALL subtrees.
// 2. Insert/Search/Delete: O(log n) avg, O(n) worst (skewed).
// 3. Deletion 3 cases: leaf, one child, two children (inorder successor).
// 4. Inorder traversal of BST = SORTED output.
// 5. Validate BST: pass min/max bounds, not just immediate children.
// 6. LCA: exploit ordering — both<root go left, both>root go right.
// 7. Sorted array -> balanced BST: pick middle, recurse.
// 8. Self-balancing trees (AVL, Red-Black) guarantee O(log n) worst case.

console.log('\n=== ALL BST EXAMPLES COMPLETE ===');
