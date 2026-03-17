/** ============================================================
 *  FILE 01: CLIENT-SERVER MODEL AND PROTOCOLS
 *  ============================================================
 *  Topics: Client-server, HTTP lifecycle, methods, status codes,
 *          headers, HTTPS/TLS, TCP vs UDP, DNS
 *
 *  WHY THIS MATTERS:
 *  Every internet interaction follows the client-server model.
 *  Understanding DNS, TCP, HTTP, and TLS is the bedrock of
 *  system design — without it, load balancing, caching, and
 *  microservices remain abstract.
 *  ============================================================ */

// STORY: IRCTC Tatkal Ticket Booking
// At 10:00 AM sharp, your browser finds the IRCTC server via DNS,
// establishes a TCP connection, and sends an HTTP request carrying
// your booking details. The server responds with a confirmed ticket
// or a waiting-list status code.

console.log("=".repeat(70));
console.log("  FILE 01: CLIENT-SERVER MODEL AND PROTOCOLS");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — DNS Resolution Simulation
// ================================================================

// WHY: Before any HTTP request, the browser must resolve the
// domain name to an IP address. This is the very first step.

console.log("--- SECTION 1: DNS Resolution Simulation ---\n");

class DNSResolver {
  constructor() {
    this.cache = new Map();
    this.rootServers = { ".in": "198.41.0.4", ".com": "199.7.91.13" };
    this.authoritativeRecords = {
      "www.irctc.co.in": "49.50.68.130",
      "www.swiggy.com": "104.18.10.20",
    };
  }

  resolve(domain) {
    console.log(`  [DNS] Resolving: ${domain}`);

    if (this.cache.has(domain)) {
      const cached = this.cache.get(domain);
      console.log(`  [DNS] Cache HIT -> ${cached.ip} (TTL: ${cached.ttl}s)`);
      return cached.ip;
    }
    console.log("  [DNS] Cache MISS -> querying hierarchy...");

    const tld = "." + domain.split(".").pop();
    console.log(`  [DNS] Root server for '${tld}' -> ${this.rootServers[tld] || "unknown"}`);

    if (this.authoritativeRecords[domain]) {
      const ip = this.authoritativeRecords[domain];
      this.cache.set(domain, { ip, ttl: 300 });
      console.log(`  [DNS] Authoritative answer: ${domain} -> ${ip} (cached TTL=300s)`);
      return ip;
    }

    console.log(`  [DNS] NXDOMAIN -- domain not found`);
    return null;
  }
}

const dns = new DNSResolver();
dns.resolve("www.irctc.co.in");
console.log();
dns.resolve("www.irctc.co.in"); // Cache hit
console.log();
dns.resolve("unknown.example.in"); // NXDOMAIN
console.log();

// ================================================================
// SECTION 2 — HTTP Request/Response Lifecycle
// ================================================================

// WHY: An HTTP transaction is the fundamental unit of web
// communication. Understanding the full lifecycle is essential
// for debugging and optimization.

console.log("--- SECTION 2: HTTP Request/Response Lifecycle ---\n");

class HTTPMock {
  constructor(name) {
    this.name = name;
    this.routes = new Map();
    this.connectionId = 0;
  }

  addRoute(method, path, handler) {
    this.routes.set(`${method}:${path}`, handler);
  }

  request(method, url, headers = {}, body = null) {
    this.connectionId++;
    const steps = [
      `[1] Resolve DNS for ${url}`,
      `[2] TCP 3-way handshake (SYN -> SYN-ACK -> ACK)`,
      `[3] Send: ${method} ${url}`,
      `[4] Server processes request...`,
      `[5] Server sends response`,
      `[6] Connection closed (or kept alive)`,
    ];

    console.log(`  Request #${this.connectionId}:`);
    steps.forEach((s) => console.log(`    ${s}`));

    const key = `${method}:${url}`;
    const handler = this.routes.get(key);
    if (handler) return handler(body);
    return { status: 404, body: { error: "Route not found" } };
  }
}

const irctc = new HTTPMock("IRCTC");
irctc.addRoute("GET", "/api/trains", () => ({
  status: 200,
  body: { trains: ["Rajdhani Express", "Shatabdi Express"] },
}));
irctc.addRoute("POST", "/api/booking", (data) => ({
  status: 201,
  body: { pnr: "PNR" + Math.floor(Math.random() * 9000000000 + 1000000000), ...data },
}));

irctc.request("GET", "/api/trains", { Accept: "application/json" });
console.log();

const trainResponse = irctc.request("GET", "/api/trains");
console.log("  Response:", JSON.stringify(trainResponse, null, 4));
console.log();

const bookingResponse = irctc.request("POST", "/api/booking", {}, {
  train: "Rajdhani Express", from: "New Delhi", to: "Mumbai Central", class: "3A",
});
console.log("  Booking:", JSON.stringify(bookingResponse, null, 4));
console.log();

// ================================================================
// SECTION 3 — HTTP Methods
// ================================================================

// WHY: Each HTTP method has specific semantics. Using the wrong
// method leads to security holes, caching issues, and confusion.

console.log("--- SECTION 3: HTTP Methods ---\n");

const methods = [
  { method: "GET",    safe: true,  idempotent: true,  desc: "Check train availability" },
  { method: "POST",   safe: false, idempotent: false, desc: "Book a new ticket" },
  { method: "PUT",    safe: false, idempotent: true,  desc: "Replace entire passenger list" },
  { method: "PATCH",  safe: false, idempotent: false, desc: "Update meal preference" },
  { method: "DELETE", safe: false, idempotent: true,  desc: "Cancel a ticket" },
];

console.log(`  ${"Method".padEnd(9)} ${"Safe".padEnd(7)} ${"Idempotent".padEnd(12)} IRCTC Example`);
console.log(`  ${"---".repeat(18)}`);
methods.forEach((m) => {
  console.log(`  ${m.method.padEnd(9)} ${String(m.safe).padEnd(7)} ${String(m.idempotent).padEnd(12)} ${m.desc}`);
});
console.log();

// ================================================================
// SECTION 4 — Status Codes (data-driven table)
// ================================================================

// WHY: Status codes are how servers communicate results. Misusing
// them causes poor error handling and broken retries.

console.log("--- SECTION 4: HTTP Status Codes ---\n");

const statusCodes = {
  "1xx Informational": [
    [100, "Continue", "Keep sending passenger details..."],
  ],
  "2xx Success": [
    [200, "OK", "Here is your train availability"],
    [201, "Created", "Ticket booked! PNR: 4521389076"],
    [204, "No Content", "Meal preference updated"],
  ],
  "3xx Redirection": [
    [301, "Moved Permanently", "Use new irctc.co.in URL"],
    [304, "Not Modified", "Schedule unchanged, use cache"],
  ],
  "4xx Client Error": [
    [400, "Bad Request", "Invalid station code"],
    [401, "Unauthorized", "Please login first"],
    [404, "Not Found", "No train with this number"],
    [429, "Too Many Requests", "Tatkal rush, rate-limited"],
  ],
  "5xx Server Error": [
    [500, "Internal Server Error", "Server crashed during Tatkal"],
    [502, "Bad Gateway", "Payment gateway not responding"],
    [503, "Service Unavailable", "Under maintenance"],
  ],
};

Object.entries(statusCodes).forEach(([category, codes]) => {
  console.log(`  [ ${category} ]`);
  codes.forEach(([code, text, analogy]) => {
    console.log(`    ${code} ${text.padEnd(26)} ${analogy}`);
  });
  console.log();
});

// ================================================================
// SECTION 5 — HTTP Headers
// ================================================================

// WHY: Headers carry metadata controlling caching, auth, content
// negotiation, and security. The invisible backbone of HTTP.

console.log("--- SECTION 5: HTTP Headers ---\n");

const requestHeaders = {
  Host: "www.irctc.co.in", "User-Agent": "Chrome/120",
  Accept: "application/json", Authorization: "Bearer eyJhbG...",
  "Content-Type": "application/json",
};
console.log("  Request Headers:");
Object.entries(requestHeaders).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, must-revalidate",
  "Set-Cookie": "session_id=xyz789; HttpOnly; Secure",
  "Strict-Transport-Security": "max-age=31536000",
};
console.log("\n  Response Headers:");
Object.entries(responseHeaders).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

console.log("\n  Cache-Control Strategies:");
const cacheScenarios = [
  { resource: "Train schedule (static)", header: "public, max-age=86400" },
  { resource: "Seat availability (live)", header: "no-cache, must-revalidate" },
  { resource: "Payment page (sensitive)", header: "no-store" },
];
cacheScenarios.forEach((s) => console.log(`    ${s.resource}: ${s.header}`));
console.log();

// ================================================================
// SECTION 6 — HTTPS/TLS Handshake
// ================================================================

// WHY: HTTPS encrypts data in transit. Without it, your Tatkal
// password travels in plain text.

console.log("--- SECTION 6: HTTPS/TLS Handshake ---\n");

const tlsSteps = [
  { step: "1. ClientHello",      detail: "Browser offers TLS 1.3, ciphers: AES-256-GCM" },
  { step: "2. ServerHello",      detail: "Server picks TLS 1.3 + AES-256-GCM" },
  { step: "3. Certificate",      detail: "Server sends SSL cert (signed by DigiCert CA)" },
  { step: "4. Verify",           detail: "Browser verifies cert chain against trusted CAs" },
  { step: "5. Key Exchange",     detail: "Ephemeral keys via Diffie-Hellman (ECDHE)" },
  { step: "6. Finished",         detail: "Symmetric encryption established" },
];

console.log("  TLS Handshake: Chrome <-> irctc.co.in");
console.log(`  ${"---".repeat(20)}`);
tlsSteps.forEach((s) => console.log(`    ${s.step}: ${s.detail}`));
console.log("\n  Result: All booking data (passwords, card numbers) now encrypted.");
console.log();

// ================================================================
// SECTION 7 — TCP vs UDP
// ================================================================

// WHY: TCP guarantees delivery (registered post); UDP is faster
// but unreliable (shouting in a crowd). Wrong choice = slow apps
// or lost data.

console.log("--- SECTION 7: TCP vs UDP ---\n");

const packets = ["Book ticket", "Passenger: Arjun", "Train: 12301", "Payment: Rs 2500"];
console.log("  TCP (Reliable, ordered):");
let seq = 0;
packets.forEach((pkt) => {
  seq += pkt.length;
  console.log(`    [SEQ=${seq}] "${pkt}" -> ACK received`);
});
console.log("    Use: IRCTC booking, bank transactions\n");

console.log("  UDP (Fast, no guarantees):");
["Score: 150/3", "Wicket! Kohli out", "Boundary by Rohit"].forEach((pkt, i) => {
  const lost = Math.random() < 0.2;
  console.log(`    [${i + 1}] "${pkt}" -> ${lost ? "LOST!" : "Received"}`);
});
console.log("    Use: Live cricket scores, video calls, gaming");
console.log();

// ================================================================
// SECTION 8 — Connection Keep-Alive and Pooling
// ================================================================

// WHY: Opening a new TCP connection for every request is expensive.
// Keep-alive reuses connections, cutting latency drastically.

console.log("--- SECTION 8: Connection Keep-Alive ---\n");

class ConnectionPool {
  constructor(max) { this.max = max; this.active = []; this.idle = []; this.created = 0; }
  acquire(host) {
    const idleIdx = this.idle.findIndex((c) => c.host === host);
    if (idleIdx >= 0) {
      const conn = this.idle.splice(idleIdx, 1)[0];
      this.active.push(conn);
      console.log(`    [POOL] Reused #${conn.id} to ${host}`);
      return conn;
    }
    if (this.active.length < this.max) {
      this.created++;
      const conn = { id: this.created, host };
      this.active.push(conn);
      console.log(`    [POOL] New #${conn.id} to ${host} (TCP handshake)`);
      return conn;
    }
    console.log(`    [POOL] Max reached! Queued.`);
    return null;
  }
  release(conn) {
    const idx = this.active.indexOf(conn);
    if (idx >= 0) { this.active.splice(idx, 1); this.idle.push(conn); }
    console.log(`    [POOL] #${conn.id} returned to idle`);
  }
}

const pool = new ConnectionPool(3);
const c1 = pool.acquire("irctc.co.in");
const c2 = pool.acquire("irctc.co.in");
const c3 = pool.acquire("irctc.co.in");
pool.acquire("irctc.co.in"); // queued
console.log();
pool.release(c1);
pool.acquire("irctc.co.in"); // reuses
console.log();
console.log("  WITHOUT keep-alive: 4 handshakes = 4 x 100ms = 400ms");
console.log("  WITH keep-alive:    3 handshakes + 1 reused = 300ms (25% faster)");
console.log();

// ================================================================
// KEY TAKEAWAYS
// ================================================================
console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. DNS translates domains to IPs -- the internet's phone book,");
console.log("     queried before every first connection.");
console.log();
console.log("  2. HTTP is request-response. Each method (GET, POST, PUT, DELETE)");
console.log("     has specific semantics for safety and idempotency.");
console.log();
console.log("  3. Status codes: 2xx = success, 4xx = client error, 5xx = server.");
console.log();
console.log("  4. Headers carry auth, caching rules, content types, and security.");
console.log();
console.log("  5. TLS encrypts all data in transit via certificate trust and");
console.log("     Diffie-Hellman key exchange.");
console.log();
console.log("  6. TCP guarantees delivery (transactions); UDP trades reliability");
console.log("     for speed (live scores).");
console.log();
console.log("  7. Connection pooling avoids repeated TCP handshakes.");
console.log();
