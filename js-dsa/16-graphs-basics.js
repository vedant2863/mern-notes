// ============================================================
// FILE 16: GRAPHS — BASICS, BFS & DFS
// Topic: Graph data structures and fundamental traversal algorithms
// WHY: Graphs model relationships — social networks, maps, routing,
//   dependencies. Nearly every system at scale relies on graphs.
// ============================================================

// ============================================================
// STORY: The Delhi Metro network — each station is a node, each
// line connecting stations is an edge. BFS finds fewest stops,
// DFS explores every branch before backtracking.
// ============================================================

// ============================================================
// SECTION 1 — Graph Types & Representations
// ============================================================

// Graph G = (V, E): vertices + edges.
// Directed vs Undirected | Weighted vs Unweighted | Cyclic vs Acyclic

// --- Adjacency Matrix: O(V^2) space, O(1) edge lookup ---
// Best for dense graphs.
console.log("=== ADJACENCY MATRIX ===");
const matrixGraph = [
  [0, 1, 1, 1], // Rajiv Chowk -> Mandi House, Barakhamba, Patel Chowk
  [1, 0, 1, 0],
  [1, 1, 0, 0],
  [1, 0, 0, 0],
];
console.log("Edge 0-1?", matrixGraph[0][1] === 1); // O(1)

// --- Adjacency List: O(V+E) space, O(1) neighbor access ---
// Best for sparse graphs (most real-world graphs).
console.log("\n=== ADJACENCY LIST ===");
const listGraph = {
  "Rajiv Chowk": ["Mandi House", "Barakhamba", "Patel Chowk"],
  "Mandi House": ["Rajiv Chowk", "Barakhamba"],
  "Patel Chowk": ["Rajiv Chowk"],
};
Object.entries(listGraph).forEach(([s, n]) => console.log(`  ${s} -> [${n.join(", ")}]`));

// ============================================================
// SECTION 2 — Graph Class (Adjacency List)
// ============================================================

class Graph {
  constructor(isDirected = false) {
    this.adjacencyList = new Map();
    this.isDirected = isDirected;
  }

  addVertex(vertex) {
    if (!this.adjacencyList.has(vertex)) this.adjacencyList.set(vertex, []);
    return this;
  }

  addEdge(v1, v2, weight = 1) {
    this.addVertex(v1); this.addVertex(v2);
    this.adjacencyList.get(v1).push({ node: v2, weight });
    if (!this.isDirected) this.adjacencyList.get(v2).push({ node: v1, weight });
    return this;
  }

  removeEdge(v1, v2) {
    if (this.adjacencyList.has(v1))
      this.adjacencyList.set(v1, this.adjacencyList.get(v1).filter(e => e.node !== v2));
    if (!this.isDirected && this.adjacencyList.has(v2))
      this.adjacencyList.set(v2, this.adjacencyList.get(v2).filter(e => e.node !== v1));
    return this;
  }

  removeVertex(vertex) {
    if (!this.adjacencyList.has(vertex)) return this;
    for (const [v, edges] of this.adjacencyList)
      this.adjacencyList.set(v, edges.filter(e => e.node !== vertex));
    this.adjacencyList.delete(vertex);
    return this;
  }

  getNeighbors(vertex) { return this.adjacencyList.get(vertex) || []; }
  hasEdge(v1, v2) { return this.adjacencyList.has(v1) && this.adjacencyList.get(v1).some(e => e.node === v2); }
  getVertices() { return [...this.adjacencyList.keys()]; }

  display() {
    for (const [v, edges] of this.adjacencyList)
      console.log(`  ${v} -> [${edges.map(e => `${e.node}(w:${e.weight})`).join(", ")}]`);
  }
}

// Build Delhi Metro graph
console.log("\n=== DELHI METRO GRAPH ===");
const metro = new Graph(false);
metro.addEdge("Rajiv Chowk", "Mandi House");
metro.addEdge("Rajiv Chowk", "Barakhamba");
metro.addEdge("Rajiv Chowk", "Patel Chowk");
metro.addEdge("Mandi House", "Pragati Maidan");
metro.addEdge("Patel Chowk", "Central Secretariat");
metro.addEdge("Central Secretariat", "Udyog Bhawan");
metro.addEdge("Udyog Bhawan", "Race Course");
metro.addEdge("Race Course", "Jor Bagh");
metro.addEdge("Jor Bagh", "INA");
metro.addEdge("INA", "AIIMS");
metro.addEdge("AIIMS", "Green Park");
metro.addEdge("Green Park", "Hauz Khas");
metro.display();

// ============================================================
// SECTION 3 — BFS (Breadth-First Search)
// ============================================================

// WHY: Explores level-by-level. Guarantees shortest path in
// unweighted graphs. Time O(V+E), Space O(V).

function bfsTraversal(graph, start) {
  const visited = new Set(), queue = [start], order = [];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current);
    for (const edge of graph.getNeighbors(current)) {
      if (!visited.has(edge.node)) {
        visited.add(edge.node);
        queue.push(edge.node);
      }
    }
  }
  return order;
}

// --- BFS Shortest Path (unweighted) ---
function bfsShortestPath(graph, start, end) {
  const visited = new Set(), queue = [start], previous = new Map();
  visited.add(start);
  previous.set(start, null);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === end) {
      const path = [];
      let node = end;
      while (node !== null) { path.unshift(node); node = previous.get(node); }
      return { path, distance: path.length - 1 };
    }
    for (const edge of graph.getNeighbors(current)) {
      if (!visited.has(edge.node)) {
        visited.add(edge.node);
        previous.set(edge.node, current);
        queue.push(edge.node);
      }
    }
  }
  return { path: [], distance: -1 };
}

console.log("\n=== BFS SHORTEST PATH ===");
const result1 = bfsShortestPath(metro, "Rajiv Chowk", "Hauz Khas");
console.log(`Rajiv Chowk -> Hauz Khas: ${result1.path.join(" -> ")} (${result1.distance} stops)`);

// ============================================================
// SECTION 4 — DFS (Depth-First Search)
// ============================================================

// WHY: Goes deep before backtracking. Ideal for paths, cycles,
// connected components, topological sort. Time O(V+E).

function dfsRecursive(graph, start) {
  const visited = new Set(), order = [];
  function dfs(node) {
    visited.add(node); order.push(node);
    for (const edge of graph.getNeighbors(node))
      if (!visited.has(edge.node)) dfs(edge.node);
  }
  dfs(start);
  return order;
}

function dfsIterative(graph, start) {
  const visited = new Set(), stack = [start], order = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current); order.push(current);
    const neighbors = graph.getNeighbors(current);
    for (let i = neighbors.length - 1; i >= 0; i--)
      if (!visited.has(neighbors[i].node)) stack.push(neighbors[i].node);
  }
  return order;
}

console.log("\n=== DFS TRAVERSAL ===");
console.log("Recursive:", dfsRecursive(metro, "Rajiv Chowk").slice(0, 5).join(" -> "), "...");

// ============================================================
// SECTION 5 — Path Existence & Connected Components
// ============================================================

function hasPath(graph, start, end) {
  if (start === end) return true;
  const visited = new Set(), queue = [start];
  visited.add(start);
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of graph.getNeighbors(current)) {
      if (edge.node === end) return true;
      if (!visited.has(edge.node)) { visited.add(edge.node); queue.push(edge.node); }
    }
  }
  return false;
}

function countConnectedComponents(graph) {
  const visited = new Set();
  let count = 0;
  for (const vertex of graph.getVertices()) {
    if (!visited.has(vertex)) {
      count++;
      const queue = [vertex];
      visited.add(vertex);
      while (queue.length > 0) {
        const current = queue.shift();
        for (const edge of graph.getNeighbors(current)) {
          if (!visited.has(edge.node)) { visited.add(edge.node); queue.push(edge.node); }
        }
      }
    }
  }
  return count;
}

console.log("\n=== PATH & COMPONENTS ===");
console.log("Rajiv Chowk -> Hauz Khas?", hasPath(metro, "Rajiv Chowk", "Hauz Khas"));
metro.addVertex("Noida City Centre");
console.log("Rajiv Chowk -> Noida?", hasPath(metro, "Rajiv Chowk", "Noida City Centre"));

const network = new Graph(false);
network.addEdge("Delhi-S1", "Delhi-S2");
network.addEdge("Mumbai-S1", "Mumbai-S2");
network.addVertex("Chennai-S1");
console.log("Components:", countConnectedComponents(network)); // 3

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Graph = (V, E). Adjacency List for sparse, Matrix for dense.
// 2. BFS: Queue, level-by-level, shortest unweighted path. O(V+E).
// 3. DFS: Stack/recursion, goes deep first. O(V+E).
// 4. ALWAYS mark visited BEFORE adding to queue/stack.
// 5. BFS = shortest path (unweighted). DFS = cycles, topo sort.
// 6. Clarify directed/undirected, weighted/unweighted before coding.
