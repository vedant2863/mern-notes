// ============================================================
// FILE 17: GRAPH ALGORITHMS — DIJKSTRA, TOPOLOGICAL SORT & CYCLE DETECTION
// Topic: Weighted shortest paths, dependency ordering, cycle detection
// WHY: Dijkstra finds cheapest routes. Topo sort orders dependencies.
//   Cycle detection prevents deadlocks. Powers GPS, build systems, compilers.
// ============================================================

// ============================================================
// STORY: When you book an Ola in Bangalore, Dijkstra finds the
// fastest route. The build system that deploys Ola's code uses
// topological sort. Cycle detection prevents dependency deadlocks.
// ============================================================

// --- Helper: Priority Queue (Min-Heap) ---
class MinPriorityQueue {
  constructor() { this.heap = []; }

  enqueue(element, priority) {
    this.heap.push({ element, priority });
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.heap[p].priority <= this.heap[i].priority) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  dequeue() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      while (true) {
        let s = i, l = 2 * i + 1, r = 2 * i + 2;
        if (l < this.heap.length && this.heap[l].priority < this.heap[s].priority) s = l;
        if (r < this.heap.length && this.heap[r].priority < this.heap[s].priority) s = r;
        if (s === i) break;
        [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
        i = s;
      }
    }
    return min;
  }

  isEmpty() { return this.heap.length === 0; }
}

// --- Helper: Graph class (from File 16) ---
class Graph {
  constructor(isDirected = false) {
    this.adjacencyList = new Map();
    this.isDirected = isDirected;
  }
  addVertex(v) { if (!this.adjacencyList.has(v)) this.adjacencyList.set(v, []); return this; }
  addEdge(v1, v2, weight = 1) {
    this.addVertex(v1); this.addVertex(v2);
    this.adjacencyList.get(v1).push({ node: v2, weight });
    if (!this.isDirected) this.adjacencyList.get(v2).push({ node: v1, weight });
    return this;
  }
  getNeighbors(v) { return this.adjacencyList.get(v) || []; }
  getVertices() { return [...this.adjacencyList.keys()]; }
  display() {
    for (const [v, edges] of this.adjacencyList)
      console.log(`  ${v} -> [${edges.map(e => `${e.node}(${e.weight})`).join(", ")}]`);
  }
}

// ============================================================
// SECTION 1 — Dijkstra's Algorithm
// ============================================================

// WHY: Shortest path in weighted graphs (non-negative weights).
// Greedy: always process closest unvisited node, relax neighbors.
// Time: O((V+E) log V) with min-heap. DOES NOT work with negative weights.

function dijkstra(graph, source) {
  const distances = new Map(), previous = new Map(), visited = new Set();
  const pq = new MinPriorityQueue();

  for (const v of graph.getVertices()) { distances.set(v, Infinity); previous.set(v, null); }
  distances.set(source, 0);
  pq.enqueue(source, 0);

  while (!pq.isEmpty()) {
    const { element: current, priority: currentDist } = pq.dequeue();
    if (visited.has(current)) continue;
    visited.add(current);
    if (currentDist > distances.get(current)) continue;

    for (const edge of graph.getNeighbors(current)) {
      if (visited.has(edge.node)) continue;
      const newDist = distances.get(current) + edge.weight;
      if (newDist < distances.get(edge.node)) {
        distances.set(edge.node, newDist);
        previous.set(edge.node, current);
        pq.enqueue(edge.node, newDist);
      }
    }
  }
  return { distances, previous };
}

function getPath(previous, target) {
  const path = [];
  let current = target;
  while (current !== null) { path.unshift(current); current = previous.get(current); }
  return path;
}

console.log("=== DIJKSTRA'S ALGORITHM ===");
const bangalore = new Graph(false);
bangalore.addEdge("Koramangala", "HSR Layout", 10);
bangalore.addEdge("Koramangala", "Indiranagar", 15);
bangalore.addEdge("HSR Layout", "BTM Layout", 8);
bangalore.addEdge("HSR Layout", "Silk Board", 12);
bangalore.addEdge("BTM Layout", "Jayanagar", 7);
bangalore.addEdge("Indiranagar", "MG Road", 10);
bangalore.addEdge("Silk Board", "Electronic City", 25);
bangalore.addEdge("Silk Board", "Marathahalli", 15);
bangalore.addEdge("Marathahalli", "Whitefield", 20);
bangalore.addEdge("Indiranagar", "Marathahalli", 12);

const { distances, previous } = dijkstra(bangalore, "Koramangala");
console.log("\nShortest distances from Koramangala:");
for (const [city, dist] of distances) {
  console.log(`  ${city}: ${dist} min | ${getPath(previous, city).join(" -> ")}`);
}

// ============================================================
// SECTION 2 — Topological Sort
// ============================================================

// WHY: Orders DAG vertices so every edge u->v has u before v.
// Used in: build systems, task scheduling, course prerequisites.

// --- Kahn's Algorithm (BFS-based): O(V+E) ---
function topologicalSortKahns(graph) {
  const inDegree = new Map(), result = [];

  for (const v of graph.getVertices()) inDegree.set(v, 0);
  for (const v of graph.getVertices())
    for (const edge of graph.getNeighbors(v))
      inDegree.set(edge.node, (inDegree.get(edge.node) || 0) + 1);

  const queue = [];
  for (const [v, deg] of inDegree) if (deg === 0) queue.push(v);

  while (queue.length > 0) {
    const current = queue.shift();
    result.push(current);
    for (const edge of graph.getNeighbors(current)) {
      inDegree.set(edge.node, inDegree.get(edge.node) - 1);
      if (inDegree.get(edge.node) === 0) queue.push(edge.node);
    }
  }

  if (result.length !== graph.getVertices().length) return null; // Cycle detected
  return result;
}

console.log("\n=== TOPOLOGICAL SORT ===");
const courses = new Graph(true);
courses.addEdge("Math Basics", "Algebra");
courses.addEdge("Math Basics", "Geometry");
courses.addEdge("Algebra", "Calculus");
courses.addEdge("Algebra", "Linear Algebra");
courses.addEdge("Calculus", "Machine Learning");
courses.addEdge("Linear Algebra", "Machine Learning");
courses.addEdge("Geometry", "Trigonometry");

console.log("Kahn's order:", topologicalSortKahns(courses)?.join(" -> "));

// ============================================================
// SECTION 3 — Cycle Detection
// ============================================================

// --- Undirected: DFS + parent tracking ---
// If we visit a node already visited and it's NOT our parent = cycle.
function hasCycleUndirected(graph) {
  const visited = new Set();
  function dfs(node, parent) {
    visited.add(node);
    for (const edge of graph.getNeighbors(node)) {
      if (!visited.has(edge.node)) { if (dfs(edge.node, node)) return true; }
      else if (edge.node !== parent) return true;
    }
    return false;
  }
  for (const v of graph.getVertices()) if (!visited.has(v) && dfs(v, null)) return true;
  return false;
}

// --- Directed: 3-color DFS (WHITE -> GRAY -> BLACK) ---
// Back edge to GRAY node = cycle.
function hasCycleDirected(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const v of graph.getVertices()) color.set(v, WHITE);

  function dfs(node) {
    color.set(node, GRAY);
    for (const edge of graph.getNeighbors(node)) {
      if (color.get(edge.node) === GRAY) return true;
      if (color.get(edge.node) === WHITE && dfs(edge.node)) return true;
    }
    color.set(node, BLACK);
    return false;
  }
  for (const v of graph.getVertices()) if (color.get(v) === WHITE && dfs(v)) return true;
  return false;
}

console.log("\n=== CYCLE DETECTION ===");
const cyclic = new Graph(false);
cyclic.addEdge("A", "B"); cyclic.addEdge("B", "C"); cyclic.addEdge("C", "A");
console.log("Undirected A-B-C-A has cycle?", hasCycleUndirected(cyclic));

const dirCyclic = new Graph(true);
dirCyclic.addEdge("Login", "Dashboard");
dirCyclic.addEdge("Dashboard", "Settings");
dirCyclic.addEdge("Settings", "Login");
console.log("Directed cycle?", hasCycleDirected(dirCyclic));

// ============================================================
// SECTION 4 — Course Schedule (Topo Sort + Cycle Detection)
// ============================================================

// LeetCode #207: Can all courses be finished given prerequisites?
function canFinishCourses(numCourses, prerequisites) {
  const graph = new Map(), inDegree = new Map();
  for (let i = 0; i < numCourses; i++) { graph.set(i, []); inDegree.set(i, 0); }

  for (const [course, prereq] of prerequisites) {
    graph.get(prereq).push(course);
    inDegree.set(course, inDegree.get(course) + 1);
  }

  const queue = [];
  for (const [c, deg] of inDegree) if (deg === 0) queue.push(c);

  let processed = 0;
  const order = [];
  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current); processed++;
    for (const next of graph.get(current)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }
  return { canFinish: processed === numCourses, order: processed === numCourses ? order : null };
}

console.log("\n=== COURSE SCHEDULE ===");
const r1 = canFinishCourses(4, [[1,0],[2,0],[3,1],[3,2]]);
console.log("Valid:", r1.canFinish, "| Order:", r1.order?.join(" -> "));
const r2 = canFinishCourses(2, [[1,0],[0,1]]);
console.log("Circular:", r2.canFinish); // false

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Dijkstra: shortest path, non-negative weights. O((V+E) log V).
//    Core idea: relaxation — if dist[u]+w < dist[v], update.
// 2. Topological Sort: DAG ordering. Kahn's (BFS, in-degree) or DFS post-order.
//    Also detects cycles (result.length !== V). O(V+E).
// 3. Cycle Detection:
//    - Undirected: DFS + parent tracking.
//    - Directed: 3-color DFS (GRAY back edge = cycle).
// 4. Course Schedule = topo sort + cycle detection combined.
// 5. For negative weights: Bellman-Ford O(V*E).
//    For all-pairs: Floyd-Warshall O(V^3).
