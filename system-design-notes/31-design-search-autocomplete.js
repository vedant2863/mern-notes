/** ============================================================
 *  FILE 31: DESIGN SEARCH AUTOCOMPLETE SYSTEM
 *  ============================================================
 *  Topic: Trie, prefix matching, frequency ranking, top-K,
 *         caching prefixes, debounce, personalized suggestions
 *
 *  WHY THIS MATTERS:
 *  Every keystroke triggers a race to predict intent. A 100ms
 *  delay reduces engagement by 20%. Trie-based systems power
 *  billions of queries daily across Google, Amazon, and Flipkart.
 *  ============================================================ */

// STORY: Flipkart Search Bar
// During Big Billion Days, "sam" yields "Samsung Galaxy S24", "Samsonite
// luggage", "samosa maker" — ranked by frequency, personalized to user
// history. A distributed Trie with caching handles 50K queries/sec.

console.log("=".repeat(70));
console.log("  FILE 31: DESIGN SEARCH AUTOCOMPLETE SYSTEM");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Requirements and Scale
// ════════════════════════════════════════════════════════════════

console.log("SECTION 1: Requirements and Scale");
console.log("-".repeat(50));
console.log("  Functional: Top-K suggestions for prefix, ranked by frequency, personalized, <100ms");
console.log("  Scale: 10M DAU, 50K peak QPS, 50M unique terms, ~2GB trie memory");
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Trie Data Structure
// ════════════════════════════════════════════════════════════════

// WHY: A Trie gives O(L) prefix lookup where L is prefix length.

console.log("SECTION 2: Trie Data Structure");
console.log("-".repeat(50));

class TrieNode {
  constructor() { this.children = {}; this.isEnd = false; this.frequency = 0; this.term = null; }
}

class MinHeap {
  constructor() { this.heap = []; }
  size() { return this.heap.length; }
  peek() { return this.heap[0] || null; }
  push(v) { this.heap.push(v); this._up(this.heap.length - 1); }
  pop() {
    if (!this.heap.length) return null;
    const top = this.heap[0]; const last = this.heap.pop();
    if (this.heap.length) { this.heap[0] = last; this._down(0); }
    return top;
  }
  _up(i) {
    while (i > 0) { const p = (i - 1) >> 1; if (this.heap[i].frequency < this.heap[p].frequency) { [this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]]; i = p; } else break; }
  }
  _down(i) {
    const n = this.heap.length;
    while (true) {
      let s = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.heap[l].frequency < this.heap[s].frequency) s = l;
      if (r < n && this.heap[r].frequency < this.heap[s].frequency) s = r;
      if (s !== i) { [this.heap[i], this.heap[s]] = [this.heap[s], this.heap[i]]; i = s; } else break;
    }
  }
}

class Trie {
  constructor(k = 5) { this.root = new TrieNode(); this.k = k; this.totalTerms = 0; this.totalNodes = 0; }

  insert(term, frequency = 1) {
    if (!term) return;
    let node = this.root;
    const lower = term.toLowerCase().trim();
    for (const ch of lower) {
      if (!node.children[ch]) { node.children[ch] = new TrieNode(); this.totalNodes++; }
      node = node.children[ch];
    }
    if (!node.isEnd) this.totalTerms++;
    node.isEnd = true; node.frequency += frequency; node.term = lower;
  }

  search(term) { const n = this._find(term.toLowerCase().trim()); return n !== null && n.isEnd; }
  startsWith(prefix) { return this._find(prefix.toLowerCase().trim()) !== null; }
  _find(prefix) { let node = this.root; for (const ch of prefix) { if (!node.children[ch]) return null; node = node.children[ch]; } return node; }

  findAllWithPrefix(prefix) {
    const results = [], node = this._find(prefix.toLowerCase().trim());
    if (!node) return results;
    const dfs = (n) => { if (n.isEnd) results.push({ term: n.term, frequency: n.frequency }); for (const ch of Object.keys(n.children).sort()) dfs(n.children[ch]); };
    dfs(node);
    return results;
  }

  getTopK(prefix, k = this.k) {
    const all = this.findAllWithPrefix(prefix);
    const heap = new MinHeap();
    for (const m of all) { if (heap.size() < k) heap.push(m); else if (m.frequency > heap.peek().frequency) { heap.pop(); heap.push(m); } }
    const res = []; while (heap.size() > 0) res.push(heap.pop());
    return res.reverse();
  }
}

const trie = new Trie();
["samsung galaxy s24", "samsonite luggage", "samosa maker"].forEach(t => trie.insert(t));
console.log(`  search("samsung galaxy s24"): ${trie.search("samsung galaxy s24")}`);
console.log(`  startsWith("sam"): ${trie.startsWith("sam")}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Frequency-Based Top-K with MinHeap
// ════════════════════════════════════════════════════════════════

// WHY: Users want 5 best suggestions, not all matches. MinHeap
// gives O(N log K) instead of O(N log N).

console.log("SECTION 3: Frequency-Based Top-K");
console.log("-".repeat(50));

const flipkartData = [
  { term: "samsung galaxy s24", frequency: 95000 }, { term: "samsung galaxy a15", frequency: 72000 },
  { term: "samsung tv 55 inch", frequency: 88000 }, { term: "samsung earbuds", frequency: 45000 },
  { term: "samsung charger", frequency: 52000 }, { term: "samsung m34", frequency: 63000 },
  { term: "samsonite luggage", frequency: 38000 }, { term: "samosa maker", frequency: 15000 },
  { term: "sandisk 64gb pendrive", frequency: 56000 }, { term: "saree silk", frequency: 67000 },
  { term: "sandwich maker", frequency: 35000 }, { term: "safari bags", frequency: 29000 },
];

const searchTrie = new Trie(5);
flipkartData.forEach(({ term, frequency }) => searchTrie.insert(term, frequency));
console.log(`  Loaded ${searchTrie.totalTerms} terms, ${searchTrie.totalNodes} nodes\n`);

console.log('  User types "sam" -> Top 5:');
searchTrie.getTopK("sam", 5).forEach((r, i) => console.log(`    ${i+1}. "${r.term}" (${r.frequency.toLocaleString()})`));
console.log('\n  User types "samsung g" -> Top 3:');
searchTrie.getTopK("samsung g", 3).forEach((r, i) => console.log(`    ${i+1}. "${r.term}" (${r.frequency.toLocaleString()})`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Prefix Caching
// ════════════════════════════════════════════════════════════════

// WHY: Caching common prefixes reduces latency from ~10ms to <1ms.

console.log("SECTION 4: Prefix Caching");
console.log("-".repeat(50));

class PrefixCache {
  constructor(maxSize = 1000, ttlMs = 60000) {
    this.cache = new Map(); this.maxSize = maxSize; this.ttlMs = ttlMs; this.hits = 0; this.misses = 0;
  }
  get(prefix) {
    const e = this.cache.get(prefix);
    if (!e || Date.now() - e.ts > this.ttlMs) { this.misses++; if (e) this.cache.delete(prefix); return null; }
    this.hits++; return e.results;
  }
  set(prefix, results) {
    if (this.cache.size >= this.maxSize) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(prefix, { results, ts: Date.now() });
  }
  warmUp(trie, prefixes) { prefixes.forEach(p => this.set(p, trie.getTopK(p))); return prefixes.length; }
  getStats() {
    const total = this.hits + this.misses;
    return { size: this.cache.size, hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0%" };
  }
}

const cache = new PrefixCache(500, 300000);
console.log(`  Warmed ${cache.warmUp(searchTrie, ["sam","san","sa","samsung"])} prefixes`);
["sam", "sam", "san", "sam", "xyz", "samsung"].forEach(p => {
  const hit = cache.get(p);
  if (!hit) { cache.set(p, searchTrie.getTopK(p)); console.log(`    "${p}" -> MISS (cached)`); }
  else console.log(`    "${p}" -> HIT (${hit.length} results)`);
});
console.log(`  Cache: ${JSON.stringify(cache.getStats())}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Debounce Simulation
// ════════════════════════════════════════════════════════════════

// WHY: Debouncing waits for typing pause, saving 60-80% of API calls.

console.log("SECTION 5: Debounce Simulation");
console.log("-".repeat(50));

class DebounceSimulator {
  constructor(delayMs = 200) { this.delayMs = delayMs; this.total = 0; this.fired = 0; }
  simulate(query, charTimings) {
    console.log(`\n  Typing "${query}" (debounce=${this.delayMs}ms)`);
    const queries = [];
    for (let i = 0; i < query.length; i++) {
      this.total++;
      const gap = (charTimings[i + 1] !== undefined) ? charTimings[i + 1] - charTimings[i] : this.delayMs + 100;
      if (gap >= this.delayMs) { queries.push(query.substring(0, i + 1)); this.fired++; }
    }
    queries.forEach(q => console.log(`    FIRE: "${q}"`));
    console.log(`    Fired: ${queries.length}/${query.length} keystrokes`);
  }
}

const debouncer = new DebounceSimulator(200);
debouncer.simulate("samsung galaxy", [0,90,160,250,320,400,480, 900, 980,1060,1140,1200,1280,1370]);
console.log(`  Savings: ${((1 - debouncer.fired/debouncer.total)*100).toFixed(0)}% fewer API calls`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Personalized Suggestions
// ════════════════════════════════════════════════════════════════

// WHY: Personalization boosts conversion 15-30% on Flipkart.

console.log("SECTION 6: Personalized Suggestions");
console.log("-".repeat(50));

class PersonalizedAutocomplete {
  constructor(trie, k = 5) { this.trie = trie; this.k = k; this.profiles = new Map(); }
  addHistory(userId, history) {
    if (!this.profiles.has(userId)) this.profiles.set(userId, { terms: [] });
    this.profiles.get(userId).terms = history.slice(-20);
  }
  suggest(userId, prefix) {
    const global = this.trie.getTopK(prefix, this.k * 2);
    const p = this.profiles.get(userId);
    if (!p) return global.slice(0, this.k);
    const scored = global.map(r => {
      let score = r.frequency;
      if (p.terms.some(t => r.term.includes(t.split(" ")[0]))) score *= 1.5;
      return { ...r, score: Math.round(score), boosted: score > r.frequency };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.k);
  }
}

const personal = new PersonalizedAutocomplete(searchTrie, 5);
personal.addHistory("mumbai_42", ["samsung galaxy s24", "samsung earbuds"]);

console.log('  Electronics buyer types "sam":');
personal.suggest("mumbai_42", "sam").forEach((r, i) => {
  console.log(`    ${i+1}. "${r.term}" (${r.score.toLocaleString()})${r.boosted ? " [BOOSTED]" : ""}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 7 — Architecture and Scaling
// ════════════════════════════════════════════════════════════════

console.log("SECTION 7: Architecture and Scaling");
console.log("-".repeat(50));

console.log("  Pipeline: Kafka -> Spark -> Aggregator -> Trie Builder (15min cycle)");
console.log("  Sharding: sa* -> Shard 1, sb*-sf* -> Shard 2 (3 replicas each)");
console.log("  Cache: L1 CDN edge (1-2 char), L2 Redis (top 100K), L3 In-process LRU\n");

console.log("  " + "Approach".padEnd(22) + "Latency".padEnd(12) + "Memory".padEnd(12) + "Update");
[{ name: "Trie in Memory", latency: "<1ms", memory: "High", update: "Rebuild" },
 { name: "ElasticSearch", latency: "5-20ms", memory: "Medium", update: "Real-time" },
 { name: "Precomputed Table", latency: "<1ms", memory: "Very High", update: "Batch" },
].forEach(a => console.log(`  ${a.name.padEnd(22)}${a.latency.padEnd(12)}${a.memory.padEnd(12)}${a.update}`));
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Trie provides O(L) prefix lookup — independent of total terms.");
console.log("  2. Top-K with MinHeap is O(N log K) — efficient for 5 from millions.");
console.log("  3. Prefix caching covers 80%+ queries; reduces latency to <1ms.");
console.log("  4. Debounce saves 60-80% of API calls on fast typers.");
console.log("  5. Personalization boosts conversion 15-30%.");
console.log("  6. Shard by prefix chars for horizontal scaling.");
console.log("  7. Multi-layer cache (CDN + Redis + in-process) for sub-10ms p99.");
console.log();
console.log('  "Every millisecond saved is a customer earned. The Trie');
console.log('   predicts intent before the user finishes typing."');
console.log();
