// ============================================================
// FILE 25: REAL-WORLD DSA APPLICATIONS
// Topic: Combining data structures to solve practical engineering problems
// WHY: Top companies don't test isolated structures -- they test your
//   ability to COMBINE them. This file builds 5 runnable systems that
//   mirror real interview scenarios at Google, Amazon, and Flipkart.
// ============================================================

console.log("=== REAL-WORLD DSA APPLICATIONS ===\n");

// ============================================================
// SCENARIO 1 -- Autocomplete System (Trie + Sorting)
// As you type "flip", suggest "flipkart", "flipkart sale", etc.
// Trie stores queries with frequencies, sorted by popularity.
// ============================================================

class TrieNode {
  constructor() { this.children = {}; this.isEnd = false; this.frequency = 0; }
}

class AutocompleteSystem {
  constructor() { this.root = new TrieNode(); }

  insert(query, frequency = 1) {
    let node = this.root;
    for (const ch of query.toLowerCase()) {
      if (!node.children[ch]) node.children[ch] = new TrieNode();
      node = node.children[ch];
    }
    node.isEnd = true;
    node.frequency += frequency;
  }

  _findAll(node, prefix) {
    const results = [];
    const dfs = (cur, word) => {
      if (cur.isEnd) results.push({ query: word, frequency: cur.frequency });
      for (const [ch, child] of Object.entries(cur.children)) dfs(child, word + ch);
    };
    dfs(node, prefix);
    return results;
  }

  autocomplete(prefix, k = 3) {
    let node = this.root;
    const lp = prefix.toLowerCase();
    for (const ch of lp) { if (!node.children[ch]) return []; node = node.children[ch]; }
    return this._findAll(node, lp).sort((a, b) => b.frequency - a.frequency).slice(0, k);
  }

  recordSearch(query) { this.insert(query, 1); }
}

console.log("=== SCENARIO 1: AUTOCOMPLETE ===");
const ac = new AutocompleteSystem();
[["flipkart", 100], ["flipkart sale", 80], ["flutter", 40], ["flight booking", 90]].forEach(
  ([q, f]) => ac.insert(q, f)
);
console.log('Typing "flip":', ac.autocomplete("flip"));
console.log('Typing "fl":', ac.autocomplete("fl"));
console.log();

// ============================================================
// SCENARIO 2 -- Social Network (Graph + BFS)
// Friend suggestions via depth-2 BFS, degrees of separation
// via shortest-path BFS. Both O(V + E).
// ============================================================

class SocialNetwork {
  constructor() { this.adj = new Map(); }

  addUser(u) { if (!this.adj.has(u)) this.adj.set(u, new Set()); }

  addFriendship(u1, u2) {
    this.addUser(u1); this.addUser(u2);
    this.adj.get(u1).add(u2); this.adj.get(u2).add(u1);
  }

  suggestFriends(user) {
    if (!this.adj.has(user)) return [];
    const direct = this.adj.get(user);
    const mutuals = new Map();
    for (const friend of direct) {
      for (const fof of this.adj.get(friend)) {
        if (fof !== user && !direct.has(fof))
          mutuals.set(fof, (mutuals.get(fof) || 0) + 1);
      }
    }
    return [...mutuals.entries()].sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ user: name, mutualFriends: count }));
  }

  degreesOfSeparation(u1, u2) {
    if (!this.adj.has(u1) || !this.adj.has(u2)) return -1;
    if (u1 === u2) return 0;
    const visited = new Set([u1]);
    const queue = [[u1, 0]];
    while (queue.length > 0) {
      const [cur, dist] = queue.shift();
      for (const friend of this.adj.get(cur)) {
        if (friend === u2) return dist + 1;
        if (!visited.has(friend)) { visited.add(friend); queue.push([friend, dist + 1]); }
      }
    }
    return -1;
  }
}

console.log("=== SCENARIO 2: SOCIAL NETWORK ===");
const net = new SocialNetwork();
net.addFriendship("Ravi", "Priya"); net.addFriendship("Ravi", "Amit");
net.addFriendship("Priya", "Deepak"); net.addFriendship("Amit", "Deepak");
net.addFriendship("Deepak", "Vikram");
console.log("Suggestions for Ravi:", net.suggestFriends("Ravi"));
console.log("Ravi <-> Vikram:", net.degreesOfSeparation("Ravi", "Vikram"), "degrees\n");

// ============================================================
// SCENARIO 3 -- Task Scheduler (Heap + Greedy)
// Schedule most frequent task first. Cooldown between same-type tasks.
// O(n) time since at most 26 task types.
// ============================================================

class MaxHeap {
  constructor() { this.heap = []; }
  push(v) { this.heap.push(v); this._up(this.heap.length - 1); }
  pop() { const m = this.heap[0]; const l = this.heap.pop(); if (this.heap.length > 0) { this.heap[0] = l; this._down(0); } return m; }
  size() { return this.heap.length; }
  _up(i) { while (i > 0) { const p = (i-1) >> 1; if (this.heap[p] >= this.heap[i]) break; [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]]; i = p; } }
  _down(i) { const n = this.heap.length; while (true) { let lg = i, l = 2*i+1, r = 2*i+2; if (l < n && this.heap[l] > this.heap[lg]) lg = l; if (r < n && this.heap[r] > this.heap[lg]) lg = r; if (lg === i) break; [this.heap[i], this.heap[lg]] = [this.heap[lg], this.heap[i]]; i = lg; } }
}

function taskScheduler(tasks, cooldown) {
  const freq = {};
  for (const t of tasks) freq[t] = (freq[t] || 0) + 1;
  const heap = new MaxHeap();
  for (const count of Object.values(freq)) heap.push(count);

  let totalTime = 0;
  while (heap.size() > 0) {
    const cycle = [], temp = [];
    for (let i = 0; i <= cooldown; i++) {
      if (heap.size() > 0) { const c = heap.pop(); cycle.push(c); if (c > 1) temp.push(c - 1); }
    }
    for (const c of temp) heap.push(c);
    totalTime += heap.size() > 0 ? cooldown + 1 : cycle.length;
  }
  return totalTime;
}

console.log("=== SCENARIO 3: TASK SCHEDULER ===");
console.log("[A,A,A,B,B,B] cooldown=2:", taskScheduler(["A","A","A","B","B","B"], 2));
console.log("[A,A,A,B,B,B] cooldown=0:", taskScheduler(["A","A","A","B","B","B"], 0), "\n");

// ============================================================
// SCENARIO 4 -- Rate Limiter (Sliding Window Queue)
// Track request timestamps, expire old ones, block excess. O(1) amortized.
// ============================================================

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests; this.windowMs = windowMs; this.requests = new Map();
  }

  allow(clientId, timestamp = Date.now()) {
    if (!this.requests.has(clientId)) this.requests.set(clientId, []);
    const ts = this.requests.get(clientId);
    const start = timestamp - this.windowMs;
    while (ts.length > 0 && ts[0] <= start) ts.shift();
    if (ts.length < this.maxRequests) { ts.push(timestamp); return true; }
    return false;
  }
}

console.log("=== SCENARIO 4: RATE LIMITER ===");
const limiter = new RateLimiter(3, 10000);
const now = Date.now();
for (let i = 0; i < 5; i++) {
  console.log(`  Request ${i + 1}: ${limiter.allow("m1", now + i * 1000) ? "ALLOWED" : "BLOCKED"}`);
}
console.log();

// ============================================================
// SCENARIO 5 -- Text Editor Undo/Redo (Two Stacks)
// Undo stack records actions, redo stores undone actions.
// New action clears redo. All O(1).
// ============================================================

class TextEditor {
  constructor() { this.text = ""; this.undoStack = []; this.redoStack = []; }

  type(str) {
    this.undoStack.push({ action: "type", text: str, position: this.text.length });
    this.text += str; this.redoStack = []; return this;
  }

  deleteChars(n) {
    const actualN = Math.min(n, this.text.length);
    const deleted = this.text.slice(-actualN);
    this.undoStack.push({ action: "delete", text: deleted, position: this.text.length - actualN });
    this.text = this.text.slice(0, -actualN); this.redoStack = []; return this;
  }

  undo() {
    if (!this.undoStack.length) return this;
    const a = this.undoStack.pop(); this.redoStack.push(a);
    if (a.action === "type") this.text = this.text.slice(0, a.position);
    else this.text = this.text.slice(0, a.position) + a.text + this.text.slice(a.position);
    return this;
  }

  redo() {
    if (!this.redoStack.length) return this;
    const a = this.redoStack.pop(); this.undoStack.push(a);
    if (a.action === "type") this.text = this.text.slice(0, a.position) + a.text + this.text.slice(a.position);
    else this.text = this.text.slice(0, a.position) + this.text.slice(a.position + a.text.length);
    return this;
  }

  getText() { return this.text; }
}

console.log("=== SCENARIO 5: TEXT EDITOR ===");
const ed = new TextEditor();
ed.type("Hello").type(" World");
console.log("Typed:", ed.getText());
ed.deleteChars(5);
console.log("Delete 5:", ed.getText());
ed.undo();
console.log("Undo:", ed.getText());
ed.undo();
console.log("Undo:", ed.getText());
ed.redo();
console.log("Redo:", ed.getText());
console.log();

// ============================================================
// SECTION 6 -- Pattern Recognition Cheat Sheet
// ============================================================

console.log("=== PATTERN RECOGNITION ===");
console.log('"Top K"         -> Heap      | "Shortest path"  -> BFS/Dijkstra');
console.log('"Count ways"    -> DP        | "Min/Max optimal" -> DP');
console.log('"Prefix match"  -> Trie      | "Subarray sum"    -> Sliding Window');
console.log('"All paths"     -> DFS/BT    | "Sorted + search" -> Binary Search');
console.log('"LRU/Cache"     -> Map+DLL   | "Intervals"       -> Sort + Greedy');
console.log();

// ============================================================
// SECTION 7 -- Tests
// ============================================================

console.log("=== RUNNING TESTS ===");

const testAc = new AutocompleteSystem();
testAc.insert("hello", 10); testAc.insert("help", 5); testAc.insert("hero", 3);
console.assert(testAc.autocomplete("hel").length === 2, "Autocomplete");
console.log("Autocomplete: Passed");

const testSn = new SocialNetwork();
testSn.addFriendship("A", "B"); testSn.addFriendship("B", "C"); testSn.addFriendship("A", "D"); testSn.addFriendship("D", "C");
console.assert(testSn.degreesOfSeparation("A", "C") === 2, "Degrees");
console.assert(testSn.suggestFriends("A")[0].mutualFriends === 2, "Mutual friends");
console.log("Social Network: Passed");

console.assert(taskScheduler(["A","A","A","B","B","B"], 2) === 8, "Scheduler");
console.log("Task Scheduler: Passed");

const rl = new RateLimiter(3, 10000);
const t = Date.now();
console.assert(rl.allow("c1", t) && rl.allow("c1", t+1000) && rl.allow("c1", t+2000), "Allowed");
console.assert(!rl.allow("c1", t+3000), "Blocked");
console.log("Rate Limiter: Passed");

const te = new TextEditor();
te.type("abc").type("def");
console.assert(te.getText() === "abcdef", "Type");
te.undo();
console.assert(te.getText() === "abc", "Undo");
te.redo();
console.assert(te.getText() === "abcdef", "Redo");
console.log("Text Editor: Passed");

console.log("\nAll Real-World DSA tests passed!");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Real problems COMBINE structures. Autocomplete = Trie + sort.
//    LRU = HashMap + DLL. Social networks = Graph + BFS.
// 2. Autocomplete: insert O(m), search O(p + n*m). Store frequencies.
// 3. Social Network: friend suggestions via depth-2 BFS. O(V + E).
// 4. Task Scheduler: greedy -- always schedule most frequent first.
// 5. Rate Limiter: sliding window queue. O(1) amortized per check.
// 6. Text Editor: two stacks for undo/redo. New action clears redo.
// 7. Pattern recognition is the #1 interview skill. Practice until
//    "Top K" -> Heap becomes automatic.
// ============================================================
