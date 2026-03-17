/** ============================================================
 *  FILE 07: CDN AND EDGE COMPUTING
 *  ============================================================
 *  Topic: CDN architecture, PoP, origin pull/push, cache-control,
 *         edge computing, geo-routing, anycast
 *
 *  WHY THIS MATTERS:
 *  CDNs serve over 50% of all internet traffic. Without them,
 *  every request travels to a distant origin. Understanding CDN
 *  architecture is essential for globally performant apps.
 *  ============================================================ */

// STORY: Hotstar IPL Streaming
// During the IPL final, Hotstar served 59 million concurrent
// viewers. The origin in Mumbai fed PoPs in Delhi, Chennai,
// Kolkata -- so a viewer in Kolkata got data from 5km away,
// not 2000km away.

console.log("=".repeat(70));
console.log("  FILE 07: CDN AND EDGE COMPUTING");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — CDN Architecture
// ================================================================

console.log("--- SECTION 1: CDN Architecture ---\n");

const CITIES = {
  mumbai:    { lat: 19.07, lng: 72.87, name: "Mumbai (Origin)" },
  delhi:     { lat: 28.61, lng: 77.20, name: "Delhi PoP" },
  chennai:   { lat: 13.08, lng: 80.27, name: "Chennai PoP" },
  kolkata:   { lat: 22.57, lng: 88.36, name: "Kolkata PoP" },
  bengaluru: { lat: 12.97, lng: 77.59, name: "Bengaluru PoP" },
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const origin = CITIES.mumbai;
for (const [k, city] of Object.entries(CITIES)) {
  if (k === "mumbai") continue;
  const dist = haversine(origin.lat, origin.lng, city.lat, city.lng);
  console.log(`  ${origin.name} -> ${city.name}: ${dist.toFixed(0)}km, ~${(dist / 200).toFixed(0)}ms`);
}
console.log();

// ================================================================
// SECTION 2 — PoP Simulation
// ================================================================

console.log("--- SECTION 2: PoP Simulation ---\n");

class PoP {
  constructor(name) { this.name = name; this.cache = new Map(); this.hits = 0; this.misses = 0; }
  get(key) { if (this.cache.has(key)) { this.hits++; return "HIT"; } this.misses++; return "MISS"; }
  set(key, data) { this.cache.set(key, data); }
  ratio() { const t = this.hits + this.misses; return t ? ((this.hits / t) * 100).toFixed(1) + "%" : "N/A"; }
}

class OriginServer {
  constructor() { this.content = new Map(); this.reqs = 0; }
  add(k, d) { this.content.set(k, d); }
  fetch(k) { this.reqs++; return this.content.get(k); }
}

const originSrv = new OriginServer();
const pops = { delhi: new PoP("Delhi"), chennai: new PoP("Chennai"), kolkata: new PoP("Kolkata") };
for (let i = 1; i <= 10; i++) originSrv.add(`seg-${i}`, { segment: i, quality: "1080p" });

function requestPoP(popName, key) {
  const pop = pops[popName];
  if (pop.get(key) === "HIT") { console.log(`  [${pop.name}] ${key}: HIT ~5ms`); return; }
  console.log(`  [${pop.name}] ${key}: MISS -> origin ~80ms`);
  pop.set(key, originSrv.fetch(key));
}

requestPoP("delhi", "seg-1"); requestPoP("delhi", "seg-1");
requestPoP("chennai", "seg-1");
requestPoP("kolkata", "seg-2"); requestPoP("kolkata", "seg-2");

console.log("\n  PoP Stats:");
for (const [, pop] of Object.entries(pops)) {
  if (pop.hits + pop.misses > 0) console.log(`    ${pop.name}: ${pop.ratio()} hit ratio`);
}
console.log(`  Origin fetches: ${originSrv.reqs}\n`);

// ================================================================
// SECTION 3 — Origin Pull vs Push
// ================================================================

console.log("--- SECTION 3: Pull vs Push CDN ---\n");

console.log("  PULL: Fetch on first request. First viewer waits for origin.");
console.log("  PUSH: Pre-distribute before viewers arrive. All viewers fast.\n");
console.log("  Hotstar: PUSH for live IPL (guaranteed demand),");
console.log("  PULL for old replays (uncertain demand).\n");

// ================================================================
// SECTION 4 — Cache-Control Headers
// ================================================================

console.log("--- SECTION 4: Cache-Control Headers ---\n");

const resources = [
  ["Live score (API)",    "no-cache, no-store",          "Never cache"],
  ["Video segment (.ts)", "public, max-age=86400",        "CDN+browser, 24h"],
  ["User profile (JSON)", "private, max-age=300",         "Browser only, 5min"],
  ["Team logo (PNG)",     "public, max-age=604800",       "CDN+browser, 7d"],
  ["Login token",         "no-store",                     "Never cache"],
];

console.log(`  ${"Resource".padEnd(22)} ${"Header".padEnd(28)} Effect`);
console.log(`  ${"---".repeat(24)}`);
resources.forEach(([res, hdr, effect]) => {
  console.log(`  ${res.padEnd(22)} ${hdr.padEnd(28)} ${effect}`);
});
console.log();

// ================================================================
// SECTION 5 — CDN Invalidation
// ================================================================

console.log("--- SECTION 5: CDN Invalidation ---\n");

class CDN {
  constructor() { this.pops = new Map(); }
  addPoP(name) { this.pops.set(name, new PoP(name)); }
  invalidatePath(path) {
    let n = 0;
    for (const [, pop] of this.pops) { if (pop.cache.has(path)) { pop.cache.delete(path); n++; } }
    console.log(`  [INVALIDATE] "${path}" cleared from ${n}/${this.pops.size} PoPs`);
  }
  purgeAll() { for (const [, pop] of this.pops) pop.cache.clear(); console.log("  [PURGE ALL] All caches cleared"); }
}

const cdn = new CDN();
["Delhi", "Chennai", "Kolkata"].forEach((n) => cdn.addPoP(n));
for (const [, pop] of cdn.pops) { pop.set("ipl/live-score", {}); pop.set("ipl/highlights/1", {}); }

cdn.invalidatePath("ipl/live-score");
cdn.purgeAll();
console.log("  Best practice: Use versioned URLs (/v2/asset.js) to avoid purges.\n");

// ================================================================
// SECTION 6 — Edge Computing
// ================================================================

console.log("--- SECTION 6: Edge Computing ---\n");

console.log("  Language routing:");
for (const lang of ["hi", "ta", "en"]) console.log(`    User (${lang}) -> /${lang}/ipl/live`);

console.log("\n  A/B testing at edge:");
for (const uid of [1001, 1050]) console.log(`    User ${uid} -> Variant ${uid % 100 < 50 ? "A" : "B"}`);

console.log("\n  Bot detection:");
[["Chrome/120", false], ["Googlebot/2.1", true], ["Python-Scraper", true]].forEach(([ua, isBot]) => {
  console.log(`    "${ua}" -> ${isBot ? "BLOCK" : "ALLOW"}`);
});
console.log();

// ================================================================
// SECTION 7 — Geo-Routing and Anycast
// ================================================================

console.log("--- SECTION 7: Geo-Routing ---\n");

const popLocs = {
  Delhi: { lat: 28.61, lng: 77.20 }, Chennai: { lat: 13.08, lng: 80.27 },
  Kolkata: { lat: 22.57, lng: 88.36 }, Bengaluru: { lat: 12.97, lng: 77.59 },
};
const viewers = [{ city: "Lucknow", lat: 26.85, lng: 80.95 }, { city: "Coimbatore", lat: 11.02, lng: 76.96 }];

for (const v of viewers) {
  const nearest = Object.entries(popLocs)
    .map(([name, p]) => ({ name, dist: haversine(v.lat, v.lng, p.lat, p.lng) }))
    .sort((a, b) => a.dist - b.dist)[0];
  console.log(`  ${v.city} -> ${nearest.name} (${nearest.dist.toFixed(0)}km)`);
}
console.log("\n  Anycast: All PoPs share one IP -- BGP routes to nearest PoP.\n");

// ================================================================
// SECTION 8 — CDN Metrics
// ================================================================

console.log("--- SECTION 8: CDN Metrics ---\n");

const hitRate = 0.92; let totalReqs = 1000, hits = 0;
const latencies = [];
for (let i = 0; i < totalReqs; i++) {
  if (Math.random() < hitRate) { hits++; latencies.push(2 + Math.random() * 8); }
  else { latencies.push(50 + Math.random() * 100); }
}
latencies.sort((a, b) => a - b);

console.log(`  IPL Traffic (${totalReqs} requests):`);
console.log(`    Hit Ratio: ${((hits / totalReqs) * 100).toFixed(1)}%`);
console.log(`    P50: ${latencies[Math.floor(totalReqs * 0.5)].toFixed(1)}ms`);
console.log(`    P95: ${latencies[Math.floor(totalReqs * 0.95)].toFixed(1)}ms`);
console.log(`    P99: ${latencies[Math.floor(totalReqs * 0.99)].toFixed(1)}ms`);
console.log("\n  Targets: Hit ratio >90%, P99 <100ms.\n");

// ================================================================
// KEY TAKEAWAYS
// ================================================================

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log(`
  1. CDN distributes content to edge PoPs -- 100+ms to under 10ms.
  2. PoPs cache independently -- each is a mini data center.
  3. Pull CDN: fetch on demand. Push CDN: pre-distribute.
  4. Cache-Control headers: public/private, max-age, no-store.
  5. Use versioned URLs to avoid CDN purges.
  6. Edge computing runs A/B tests, routing, bot detection at PoPs.
  7. Geo-routing + Anycast send users to nearest healthy PoP.
  8. Key metrics: hit ratio >90%, P99 TTFB, bandwidth savings.
`);
