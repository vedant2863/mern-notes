/** ============================================================
 *  FILE 26: DESIGN A URL SHORTENER
 *  ============================================================
 *  Topic: Base62 encoding, hash collisions, redirects, analytics,
 *         caching, TTL, counter-based ID generation
 *
 *  WHY THIS MATTERS:
 *  URL shorteners handle billions of redirects daily. They involve
 *  distributed ID generation, hash collision resolution, analytics
 *  at scale, and aggressive caching for read-heavy workloads.
 *  ============================================================ */

// STORY: Government Scheme Short URLs
// The PM office shares short links for Ayushman Bharat and PM-KISAN.
// A scheme announcement can generate 50M clicks in hours. The system
// must never collide, track analytics by state, and redirect fast
// for rural 2G users.

console.log("=".repeat(70));
console.log("  FILE 26: DESIGN A URL SHORTENER");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Requirements Analysis
// ════════════════════════════════════════════════════════════════

console.log("SECTION 1 — Requirements Analysis");
console.log("-".repeat(50));

const requirements = {
  functional: ["Generate short unique URL from long URL", "Redirect short URL to original", "Custom short links (optional)", "TTL-based expiration", "Analytics: click count, geo"],
  nonFunctional: ["100:1 read-to-write ratio", "Low latency redirects (<10ms with cache)", "99.99% availability", "Unpredictable short URLs"],
  capacity: { newUrlsPerDay: 1_000_000, readsPerDay: 100_000_000, urlLength: 7, possibleCombinations: Math.pow(62, 7) }
};

console.log("Functional:", requirements.functional.join("; "));
console.log("\nCapacity:");
console.log(`  New URLs/day: ${requirements.capacity.newUrlsPerDay.toLocaleString()}`);
console.log(`  Reads/day: ${requirements.capacity.readsPerDay.toLocaleString()}`);
console.log(`  7-char Base62: ~${(requirements.capacity.possibleCombinations / 1e12).toFixed(1)} trillion combinations`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Base62 Encoding and Decoding
// ════════════════════════════════════════════════════════════════

// WHY: Base62 (a-z, A-Z, 0-9) creates URL-safe short strings from numeric IDs.

console.log("SECTION 2 — Base62 Encoding and Decoding");
console.log("-".repeat(50));

class Base62 {
  constructor() {
    this.chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    this.base = 62;
  }
  encode(num) {
    if (num === 0) return this.chars[0];
    let result = "";
    let n = num;
    while (n > 0) { result = this.chars[n % this.base] + result; n = Math.floor(n / this.base); }
    return result;
  }
  decode(str) {
    let result = 0;
    for (const char of str) result = result * this.base + this.chars.indexOf(char);
    return result;
  }
  encodePadded(num, length = 7) {
    let encoded = this.encode(num);
    while (encoded.length < length) encoded = this.chars[0] + encoded;
    return encoded;
  }
}

const base62 = new Base62();
console.log("Base62 Encoding Examples:");
[1, 10000, 3500000000].forEach(n => {
  const encoded = base62.encode(n);
  const padded = base62.encodePadded(n);
  console.log(`  ${n.toLocaleString().padStart(15)} -> ${encoded.padEnd(8)} (padded: ${padded}) -> decoded: ${base62.decode(encoded)}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Counter-Based URL Shortening
// ════════════════════════════════════════════════════════════════

// WHY: Counter-based guarantees zero collisions — each URL gets a unique ID.

console.log("SECTION 3 — Counter-Based URL Shortening");
console.log("-".repeat(50));

class CounterBasedShortener {
  constructor() {
    this.counter = 100000;
    this.urlMap = new Map();
    this.reverseMap = new Map();
    this.base62 = new Base62();
  }
  shorten(longUrl) {
    if (this.reverseMap.has(longUrl)) return this.reverseMap.get(longUrl);
    this.counter++;
    const shortCode = this.base62.encodePadded(this.counter);
    this.urlMap.set(shortCode, longUrl);
    this.reverseMap.set(longUrl, shortCode);
    return shortCode;
  }
  resolve(shortCode) { return this.urlMap.get(shortCode) || null; }
}

const counterShortener = new CounterBasedShortener();
const govUrls = [
  "https://www.pmjay.gov.in/ayushman-bharat-scheme-registration-2024",
  "https://www.pmkisan.gov.in/beneficiary-status-check",
  "https://www.pmjay.gov.in/ayushman-bharat-scheme-registration-2024" // duplicate
];

console.log("Counter-based shortening:");
govUrls.forEach(url => {
  const code = counterShortener.shorten(url);
  const domain = new URL(url).hostname;
  console.log(`  pmgo.in/${code} -> ${domain}...`);
});
console.log(`\n  Advantage: Zero collisions. Disadvantage: Predictable (use range-based counters across servers).`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Hash-Based Shortening with Collision Handling
// ════════════════════════════════════════════════════════════════

// WHY: Hashing produces unpredictable codes but may collide.

console.log("SECTION 4 — Hash-Based Shortening with Collision Handling");
console.log("-".repeat(50));

const crypto = require("crypto");

class HashBasedShortener {
  constructor() { this.urlMap = new Map(); this.reverseMap = new Map(); this.collisionCount = 0; }
  _hash(input) { return crypto.createHash("md5").update(input).digest("hex"); }
  _hashToBase62(hash, length = 7) {
    const num = parseInt(hash.substring(0, 12), 16);
    return new Base62().encodePadded(num, length);
  }
  shorten(longUrl) {
    if (this.reverseMap.has(longUrl)) return this.reverseMap.get(longUrl);
    let shortCode, attempt = 0, input = longUrl;
    while (true) {
      shortCode = this._hashToBase62(this._hash(input));
      if (!this.urlMap.has(shortCode)) break;
      if (this.urlMap.get(shortCode) === longUrl) return shortCode;
      this.collisionCount++; attempt++; input = longUrl + attempt;
      console.log(`    [COLLISION] Attempt ${attempt} for ${shortCode}, rehashing...`);
    }
    this.urlMap.set(shortCode, longUrl);
    this.reverseMap.set(longUrl, shortCode);
    return shortCode;
  }
  resolve(shortCode) { return this.urlMap.get(shortCode) || null; }
}

const hashShortener = new HashBasedShortener();
console.log("Hash-based shortening:");
["https://www.pmjay.gov.in/registration", "https://www.pmkisan.gov.in/status", "https://aadhaar.uidai.gov.in/verify"].forEach(url => {
  const code = hashShortener.shorten(url);
  console.log(`  pmgo.in/${code} -> ${new URL(url).hostname}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Redirect Service (301 vs 302)
// ════════════════════════════════════════════════════════════════

// WHY: 301 (permanent) caches in browser vs 302 (temporary) hits server every time.

console.log("SECTION 5 — Redirect Service (301 vs 302)");
console.log("-".repeat(50));

console.log("  301 (Permanent): Browser caches, better SEO, worse for analytics");
console.log("  302 (Temporary): Every click tracked, slightly higher latency\n");

console.log("  Use 302 for campaign/tracking links. Use 301 for permanent pages.");

const sampleCode = hashShortener.shorten("https://www.pmjay.gov.in/registration");
console.log(`\n  Simulated 302 redirect for /${sampleCode}:`);
console.log(`  Status: 302, Location: ${hashShortener.resolve(sampleCode)}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Analytics and Caching
// ════════════════════════════════════════════════════════════════

// WHY: Government needs state-level analytics; PM tweet = millions of hits needing cache.

console.log("SECTION 6 — Analytics and Caching");
console.log("-".repeat(50));

class URLCache {
  constructor(maxSize = 1000, ttlMs = 60000) {
    this.cache = new Map(); this.maxSize = maxSize; this.ttlMs = ttlMs; this.hits = 0; this.misses = 0;
  }
  get(shortCode) {
    const entry = this.cache.get(shortCode);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) { this.cache.delete(shortCode); this.misses++; return null; }
    this.cache.delete(shortCode);
    this.cache.set(shortCode, { ...entry, lastAccess: Date.now() });
    this.hits++;
    return entry.longUrl;
  }
  set(shortCode, longUrl) {
    if (this.cache.size >= this.maxSize) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(shortCode, { longUrl, expiresAt: Date.now() + this.ttlMs, lastAccess: Date.now() });
  }
  getStats() {
    const total = this.hits + this.misses;
    return { size: this.cache.size, hits: this.hits, misses: this.misses, hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "N/A" };
  }
}

const urlCache = new URLCache(100, 30000);
const pmkisanCode = "pmKsn01";
urlCache.set(pmkisanCode, "https://www.pmkisan.gov.in/beneficiary-status-check");

console.log("Cache simulation (PM-KISAN link after PM tweet):");
for (let i = 0; i < 50; i++) {
  const result = urlCache.get(pmkisanCode);
  if (i < 2 || i === 49) console.log(`  Request ${(i + 1).toString().padStart(2)}: ${result ? "CACHE HIT" : "CACHE MISS"}`);
  else if (i === 2) console.log(`  ... (47 more requests) ...`);
}
urlCache.get("nonExistentCode");
const cacheStats = urlCache.getStats();
console.log(`\n  Cache Stats: Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}, Hit Rate: ${cacheStats.hitRate}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 7 — TTL, Expiration, and Full System
// ════════════════════════════════════════════════════════════════

// WHY: Campaign URLs should expire; permanent government URLs should not.

console.log("SECTION 7 — TTL, Expiration, and Full System");
console.log("-".repeat(50));

class URLStore {
  constructor() { this.urls = new Map(); this.base62 = new Base62(); this.counter = 1000000; }
  create(longUrl, options = {}) {
    this.counter++;
    const shortCode = options.customCode || this.base62.encodePadded(this.counter);
    this.urls.set(shortCode, {
      longUrl, shortCode, createdAt: Date.now(),
      expiresAt: options.ttlMs ? Date.now() + options.ttlMs : null,
      isActive: true, clickCount: 0
    });
    return shortCode;
  }
  resolve(shortCode) {
    const entry = this.urls.get(shortCode);
    if (!entry) return { found: false, reason: "not_found" };
    if (!entry.isActive) return { found: false, reason: "deactivated" };
    if (entry.expiresAt && Date.now() > entry.expiresAt) { entry.isActive = false; return { found: false, reason: "expired" }; }
    entry.clickCount++;
    return { found: true, longUrl: entry.longUrl, clickCount: entry.clickCount };
  }
}

const store = new URLStore();
const permanentCode = store.create("https://www.pmjay.gov.in/ayushman-bharat", { customCode: "AyshBrt" });
const campaignCode = store.create("https://www.pmjay.gov.in/special-camp-2024", { ttlMs: 100 }); // 100ms for demo

console.log("Permanent URL (Ayushman Bharat):");
let resolveResult = store.resolve(permanentCode);
console.log(`  Code: ${permanentCode}, Active: ${resolveResult.found}`);

console.log("\nCampaign URL (100ms TTL):");
resolveResult = store.resolve(campaignCode);
console.log(`  Immediately: Active = ${resolveResult.found}`);
const waitStart = Date.now();
while (Date.now() - waitStart < 150) { /* busy wait for demo */ }
resolveResult = store.resolve(campaignCode);
console.log(`  After 150ms: Active = ${resolveResult.found}, Reason = ${resolveResult.reason}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 8 — Scalability Considerations
// ════════════════════════════════════════════════════════════════

console.log("SECTION 8 — Scalability Considerations");
console.log("-".repeat(50));

class RangeAllocator {
  constructor(rangeSize = 1000000) { this.rangeSize = rangeSize; this.nextStart = 0; this.allocations = []; }
  allocateRange(serverId) {
    const start = this.nextStart; const end = start + this.rangeSize - 1;
    this.nextStart = end + 1;
    this.allocations.push({ serverId, start, end });
    return { start, end };
  }
}

const allocator = new RangeAllocator(1000000);
for (let i = 1; i <= 3; i++) allocator.allocateRange(`app-server-${i}`);

console.log("  Range Allocations (distributed counter):");
allocator.allocations.forEach(a => {
  console.log(`    Server ${a.serverId}: ${a.start.toLocaleString()} - ${a.end.toLocaleString()}`);
});

console.log("\n  Caching Layer: L1 App LRU -> L2 Redis cluster -> L3 DB");
console.log("  Read Path: Client -> CDN -> LB -> Cache -> DB (99% from cache)");
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Base62 converts numeric IDs to URL-safe short strings.");
console.log("  2. Counter-based: zero collisions but predictable. Hash-based: unpredictable but may collide.");
console.log("  3. Use 302 redirects for analytics, 301 for permanent pages.");
console.log("  4. Cache hot URLs aggressively — viral links cause thundering herd.");
console.log("  5. TTL enables campaign URLs that auto-expire.");
console.log("  6. Range-based counter allocation eliminates server coordination.");
console.log("  7. 7-char Base62 = 3.5 trillion URLs — enough for decades.");
console.log();
console.log('  "A short URL is a promise — it must redirect correctly,');
console.log('   track honestly, and expire gracefully."');
console.log();
