// ============================================================
// FILE 15: TRIES (PREFIX TREES)
// Topic: Trie Data Structure, Autocomplete, and Prefix Operations
// WHY: Tries power autocomplete and prefix searches in O(m) time
//   where m = prefix length. No other structure matches this.
// ============================================================

// ============================================================
// STORY: Google processes 8.5B searches daily. As you type "best
// res", the Trie finds all matching queries from millions of
// stored searches in O(m) — vs O(n*m) scanning a HashMap.
// ============================================================

// ============================================================
// SECTION 1 — Trie Implementation
// ============================================================

class TrieNode {
  constructor() {
    this.children = new Map(); // char -> TrieNode
    this.isEndOfWord = false;
  }
}

class Trie {
  constructor() { this.root = new TrieNode(); }

  // --- INSERT: O(m) ---
  insert(word) {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) current.children.set(char, new TrieNode());
      current = current.children.get(char);
    }
    current.isEndOfWord = true;
  }

  // --- SEARCH: O(m) — exact match ---
  search(word) {
    const node = this._findNode(word);
    return node !== null && node.isEndOfWord;
  }

  // --- STARTS WITH: O(m) — prefix exists? ---
  startsWith(prefix) { return this._findNode(prefix) !== null; }

  _findNode(str) {
    let current = this.root;
    for (const char of str) {
      if (!current.children.has(char)) return null;
      current = current.children.get(char);
    }
    return current;
  }

  // --- DELETE: O(m) — unmark end, clean up unused nodes ---
  delete(word) { this._deleteHelper(this.root, word, 0); }

  _deleteHelper(node, word, depth) {
    if (node === null) return false;
    if (depth === word.length) {
      if (!node.isEndOfWord) return false;
      node.isEndOfWord = false;
      return node.children.size === 0;
    }
    const char = word[depth];
    const child = node.children.get(char);
    if (!child) return false;
    if (this._deleteHelper(child, word, depth + 1)) {
      node.children.delete(char);
      return node.children.size === 0 && !node.isEndOfWord;
    }
    return false;
  }

  // --- GET ALL WORDS WITH PREFIX: O(m + k) ---
  getWordsWithPrefix(prefix) {
    const node = this._findNode(prefix);
    if (node === null) return [];
    const results = [];
    this._collectWords(node, prefix, results);
    return results;
  }

  _collectWords(node, currentWord, results) {
    if (node.isEndOfWord) results.push(currentWord);
    for (const [char, child] of node.children) {
      this._collectWords(child, currentWord + char, results);
    }
  }

  autocomplete(prefix, limit = 5) {
    return this.getWordsWithPrefix(prefix).slice(0, limit);
  }
}

// --- Demo ---
console.log('=== TRIE OPERATIONS ===');
const trie = new Trie();
['best restaurants in mumbai', 'best restaurants in delhi',
 'best restaurants near me', 'best resort in goa',
 'best mobile under 20000', 'best laptop for coding'
].forEach(q => trie.insert(q));

console.log('Search "best resort in goa":', trie.search('best resort in goa')); // true
console.log('Search "best resort":', trie.search('best resort'));               // false
console.log('StartsWith "best res":', trie.startsWith('best res'));            // true

console.log('\nAutocomplete "best res":');
trie.autocomplete('best res').forEach(s => console.log('  ', s));

// ============================================================
// SECTION 2 — Count Words with Prefix
// ============================================================

function countWordsWithPrefix(trie, prefix) {
  const node = trie._findNode(prefix);
  if (node === null) return 0;
  return countEndOfWords(node);
}

function countEndOfWords(node) {
  let count = node.isEndOfWord ? 1 : 0;
  for (const [, child] of node.children) count += countEndOfWords(child);
  return count;
}

console.log('\n=== COUNT BY PREFIX ===');
console.log('"best res":', countWordsWithPrefix(trie, 'best res'));
console.log('"best":', countWordsWithPrefix(trie, 'best'));

// ============================================================
// SECTION 3 — Longest Common Prefix
// ============================================================

function longestCommonPrefix(words) {
  if (words.length === 0) return '';
  const lcpTrie = new Trie();
  words.forEach(w => lcpTrie.insert(w));

  let current = lcpTrie.root, prefix = '';
  while (current.children.size === 1 && !current.isEndOfWord) {
    const [char, child] = current.children.entries().next().value;
    prefix += char;
    current = child;
  }
  return prefix;
}

console.log('\n=== LONGEST COMMON PREFIX ===');
console.log('["flower","flow","flight"]:', longestCommonPrefix(['flower', 'flow', 'flight'])); // "fl"

// ============================================================
// SECTION 4 — Practical Problems
// ============================================================

// --- Word Break (DP + Trie) ---
function wordBreak(s, wordDict) {
  const dictTrie = new Trie();
  wordDict.forEach(w => dictTrie.insert(w));
  const dp = new Array(s.length + 1).fill(false);
  dp[0] = true;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 0; j < i; j++) {
      if (dp[j] && dictTrie.search(s.substring(j, i))) { dp[i] = true; break; }
    }
  }
  return dp[s.length];
}

console.log('\n=== WORD BREAK ===');
console.log('"ilikecoding":', wordBreak('ilikecoding', ['i', 'like', 'coding'])); // true
console.log('"catsandog":', wordBreak('catsandog', ['cats', 'dog', 'sand', 'and', 'cat'])); // false

// --- Replace Words (shortest root prefix) ---
function replaceWords(roots, sentence) {
  const rootTrie = new Trie();
  roots.forEach(r => rootTrie.insert(r));

  return sentence.split(' ').map(word => {
    let current = rootTrie.root, prefix = '';
    for (const char of word) {
      if (current.isEndOfWord) return prefix;
      if (!current.children.has(char)) return word;
      current = current.children.get(char);
      prefix += char;
    }
    return current.isEndOfWord ? prefix : word;
  }).join(' ');
}

console.log('\n=== REPLACE WORDS ===');
console.log(replaceWords(['cat', 'bat', 'rat'], 'the cattle was rattled by the battery'));
// "the cat was rat by the bat"

// --- Search Suggestions (Amazon-style) ---
function searchSuggestions(products, searchWord) {
  const sugTrie = new Trie();
  products.forEach(p => sugTrie.insert(p));
  const results = [];
  let prefix = '';
  for (const char of searchWord) {
    prefix += char;
    const matches = sugTrie.getWordsWithPrefix(prefix);
    matches.sort();
    results.push(matches.slice(0, 3));
  }
  return results;
}

console.log('\n=== SEARCH SUGGESTIONS ===');
const suggestions = searchSuggestions(['mobile', 'mouse', 'moneypot', 'monitor', 'mousepad'], 'mouse');
suggestions.forEach((sugg, i) => console.log(`  "${'mouse'.substring(0, i + 1)}":`, sugg));

// ============================================================
// SECTION 5 — Trie vs HashMap
// ============================================================

console.log('\n=== TRIE vs HASHMAP ===');
console.log('Trie:    prefix search O(m+k) — excellent for autocomplete');
console.log('HashMap: prefix search O(n*m) — must scan all keys');
console.log('HashMap: exact lookup O(1) — better for non-prefix ops');

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Trie stores strings char-by-char. Shared prefixes share paths.
// 2. TrieNode: children (Map), isEndOfWord (boolean).
// 3. All core ops O(m): insert, search, startsWith, delete.
// 4. getWordsWithPrefix: O(m + k), traverse to prefix then DFS.
// 5. Use Map for children to save space (vs fixed-size array).
// 6. Trie beats HashMap for prefix operations; HashMap beats
//    Trie for exact-only lookups.
// 7. Common patterns: Word Break (DP+Trie), Replace Words,
//    Search Suggestions, Longest Common Prefix.

console.log('\n=== ALL TRIE EXAMPLES COMPLETE ===');
