/** ============================================================
 *  FILE 04: SERIALIZATION AND API PATTERNS
 *  ============================================================
 *  Topics: JSON vs Protobuf, GraphQL vs REST, request batching,
 *          API gateway, BFF pattern
 *
 *  WHY THIS MATTERS:
 *  Serialization format determines bandwidth and parsing speed.
 *  API access patterns (gateway, BFF, batching) determine
 *  developer productivity. At PhonePe's scale (10B+ UPI
 *  transactions/month), every byte matters.
 *  ============================================================ */

// STORY: PhonePe UPI Payments
// A JSON request leaves your phone for chai payment -- readable
// like a handwritten receipt. Between NPCI and banks, data flies
// as compact binary (Protobuf) -- saving terabytes monthly. The
// API gateway is like NPCI itself: a central switch routing
// payments, handling auth, rate-limiting, and logging.

console.log("=".repeat(70));
console.log("  FILE 04: SERIALIZATION AND API PATTERNS");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — JSON Serialization
// ================================================================

// WHY: JSON is the lingua franca of web APIs. Understanding
// edge cases (dates, BigInt, undefined) prevents production bugs.

console.log("--- SECTION 1: JSON Serialization ---\n");

const upiTransaction = {
  transactionId: "TXN202401150001",
  from: { vpa: "arjun@phonepe", bank: "ICICI" },
  to: { vpa: "chaiwala@paytm", bank: "SBI" },
  amount: 30, currency: "INR", status: "SUCCESS",
};

const jsonString = JSON.stringify(upiTransaction);
console.log(`  JSON size: ${jsonString.length} bytes`);
console.log(`  Compact: ${jsonString.substring(0, 80)}...\n`);

console.log("  JSON Edge Cases:");
console.log(`    {a:1, b:undefined, c:null} -> ${JSON.stringify({ a: 1, b: undefined, c: null })}`);
console.log("    undefined is dropped, null is preserved");
const dateObj = { created: new Date("2024-01-15") };
console.log(`    Date -> "${JSON.parse(JSON.stringify(dateObj)).created}" (string, not Date!)`);
try { JSON.stringify({ amount: BigInt(999999999999) }); }
catch (e) { console.log(`    BigInt -> TypeError (convert to string first)`); }
console.log();

// ================================================================
// SECTION 2 — Protobuf-Style Binary Encoding
// ================================================================

// WHY: Protobuf uses field numbers instead of names, saving 30-80%
// over JSON. At PhonePe scale, this saves petabytes.

console.log("--- SECTION 2: Protobuf Binary Encoding ---\n");

class SimpleBinaryEncoder {
  constructor() { this.buffer = []; }
  encodeVarint(value) {
    const bytes = [];
    while (value > 127) { bytes.push((value & 0x7f) | 0x80); value = value >>> 7; }
    bytes.push(value & 0x7f); return bytes;
  }
  encodeString(fieldNumber, value) {
    const tag = (fieldNumber << 3) | 2;
    const encoded = Buffer.from(value, "utf-8");
    this.buffer.push(...this.encodeVarint(tag), ...this.encodeVarint(encoded.length), ...encoded);
  }
  encodeInt(fieldNumber, value) {
    this.buffer.push(...this.encodeVarint((fieldNumber << 3) | 0), ...this.encodeVarint(value));
  }
  getSize() { return this.buffer.length; }
}

console.log("  Protobuf schema:");
console.log("    message UPITransaction {");
console.log("      string transaction_id = 1; string from_vpa = 2;");
console.log("      string to_vpa = 3; int32 amount = 4; string status = 5;");
console.log("    }\n");

const encoder = new SimpleBinaryEncoder();
encoder.encodeString(1, "TXN202401150001");
encoder.encodeString(2, "arjun@phonepe");
encoder.encodeString(3, "chaiwala@paytm");
encoder.encodeInt(4, 30);
encoder.encodeString(5, "SUCCESS");

const binarySize = encoder.getSize();
console.log(`  Binary: ${binarySize} bytes vs JSON: ${jsonString.length} bytes`);
console.log(`  Savings: ${((1 - binarySize / jsonString.length) * 100).toFixed(1)}% smaller`);
console.log("  No field names, varint encoding, no quotes/commas/braces\n");

// Scale calculation
const daily = 300000000;
const jsonGB = (daily * jsonString.length) / (1024 ** 3);
const binGB = (daily * binarySize) / (1024 ** 3);
console.log(`  At 300M daily transactions: JSON ~${jsonGB.toFixed(1)} GB, Binary ~${binGB.toFixed(1)} GB`);
console.log(`  Savings: ~${(jsonGB - binGB).toFixed(1)} GB/day`);
console.log();

// ================================================================
// SECTION 3 — GraphQL Concepts
// ================================================================

// WHY: GraphQL lets the client ask for exactly the data it needs,
// solving REST's over-fetching and under-fetching problems.

console.log("--- SECTION 3: GraphQL ---\n");

console.log("  Over-fetching: REST GET /users/1 returns ALL fields");
console.log("    Mobile only needs name+vpa. GraphQL: query { user(id:1) { name, vpa } }");
console.log(`    Response: ${JSON.stringify({ name: "Arjun", vpa: "arjun@phonepe" })}\n`);

console.log("  Under-fetching (N+1): REST needs 4 calls (user + 3 transactions)");
console.log("    GraphQL: 1 query { user(id:1) { name, transactions { amount, to } } }");
console.log("    1 round trip instead of 4!");
console.log();

// ================================================================
// SECTION 4 — Request Batching
// ================================================================

// WHY: Multiple small calls create overhead. Batching combines
// them into one request, critical for mobile on slow networks.

console.log("--- SECTION 4: Request Batching ---\n");

const endpoints = ["/api/user/balance", "/api/user/recent-txns", "/api/offers", "/api/bills/pending"];
console.log("  Without batching: 4 separate calls (~100ms each = ~400ms)\n");
endpoints.forEach((e, i) => console.log(`    ${i + 1}. GET ${e}`));
console.log("\n  With batching: POST /api/batch (single call ~120ms)");
console.log("  Fewer TCP/TLS handshakes, reduced headers, mobile-friendly\n");

// ================================================================
// SECTION 5 — API Gateway Pattern
// ================================================================

// WHY: Single entry point handling auth, rate-limiting, routing,
// and logging so microservices stay focused on business logic.

console.log("--- SECTION 5: API Gateway ---\n");

class APIGateway {
  constructor() { this.services = new Map(); this.rateLimits = new Map(); this.reqCount = 0; }
  register(path, service) { this.services.set(path, service); }
  setRateLimit(clientId, max) { this.rateLimits.set(clientId, { max, current: 0 }); }

  handle(clientId, method, path, headers, body) {
    this.reqCount++;
    console.log(`  [GW] ${method} ${path}`);

    if (!headers?.Authorization) { console.log(`    [AUTH] 401 Unauthorized`); return; }
    console.log(`    [AUTH] Token verified`);

    const limit = this.rateLimits.get(clientId);
    if (limit) {
      limit.current++;
      if (limit.current > limit.max) { console.log(`    [RATE] 429 (${limit.current}/${limit.max})`); return; }
      console.log(`    [RATE] ${limit.current}/${limit.max}`);
    }

    const prefix = "/" + path.split("/").filter(Boolean).slice(0, 2).join("/");
    const service = this.services.get(prefix);
    if (!service) { console.log(`    [ROUTE] 404`); return; }
    console.log(`    [ROUTE] -> ${service.name}`);

    const response = service.handle(method, path, body);
    console.log(`    [RESPONSE] ${response.status}`);
  }
}

const gateway = new APIGateway();
gateway.register("/api/users", { name: "UserService", handle: () => ({ status: 200 }) });
gateway.register("/api/payments", { name: "PaymentService", handle: () => ({ status: 201 }) });
gateway.setRateLimit("app", 5);

console.log("  Gateway processing:\n");
gateway.handle("app", "GET", "/api/users/1", { Authorization: "Bearer tok" });
console.log();
gateway.handle("app", "POST", "/api/payments/init", { Authorization: "Bearer tok" }, { amount: 30 });
console.log();
gateway.handle("anon", "GET", "/api/users/1", {});
console.log();

// ================================================================
// SECTION 6 — BFF (Backend for Frontend)
// ================================================================

// WHY: Mobile needs compact data; web needs rich data. BFF creates
// specialized backends for each frontend.

console.log("--- SECTION 6: BFF Pattern ---\n");

const mobileResp = {
  greeting: "Hi Arjun", balance: "Rs 15,000",
  recentTxns: [{ amount: "Rs 30", to: "Chai" }, { amount: "Rs 500", to: "Flipkart" }],
};
const webResp = {
  user: { id: 1, name: "Arjun", email: "arjun@email.com", vpa: "arjun@phonepe" },
  balance: { amount: 15000, currency: "INR" },
  transactions: [{ id: 101, amount: 30, to: "Chai" }, { id: 102, amount: 500, to: "Flipkart" }],
  analytics: { totalSpent: 530, count: 2 },
};

console.log(`  Mobile BFF: ${JSON.stringify(mobileResp).length} bytes (compact)`);
console.log(`  Web BFF:    ${JSON.stringify(webResp).length} bytes (rich)`);
console.log(`  Mobile saves ${((1 - JSON.stringify(mobileResp).length / JSON.stringify(webResp).length) * 100).toFixed(0)}% bandwidth.\n`);

// ================================================================
// SECTION 7 — Choosing Serialization Format
// ================================================================

console.log("--- SECTION 7: Serialization Decision Matrix ---\n");

const formats = [
  ["JSON",     "Yes", "Large",  "Moderate", "Mobile <-> Gateway"],
  ["Protobuf", "No",  "Small",  "Fast",     "PhonePe <-> NPCI"],
  ["MsgPack",  "No",  "Medium", "Fast",     "Redis cache values"],
  ["Avro",     "No",  "Small",  "Fast",     "Kafka event streams"],
];
console.log(`  ${"Format".padEnd(10)} ${"Readable".padEnd(10)} ${"Size".padEnd(8)} ${"Speed".padEnd(10)} Use Case`);
console.log(`  ${"---".repeat(18)}`);
formats.forEach(([f, r, s, sp, u]) => {
  console.log(`  ${f.padEnd(10)} ${r.padEnd(10)} ${s.padEnd(8)} ${sp.padEnd(10)} ${u}`);
});
console.log();

// ================================================================
// KEY TAKEAWAYS
// ================================================================
console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. JSON is universal but verbose. Watch for undefined/Date/BigInt.");
console.log();
console.log("  2. Protobuf is 30-80% smaller -- critical at billions of TXNs.");
console.log();
console.log("  3. GraphQL solves over-fetching and N+1 under-fetching.");
console.log();
console.log("  4. Request batching reduces round trips -- big win on mobile.");
console.log();
console.log("  5. API Gateway handles auth, rate limiting, routing centrally.");
console.log();
console.log("  6. BFF tailors API responses per client type.");
console.log();
console.log("  7. Choose by context: JSON external, Protobuf internal, Avro Kafka.");
console.log();
