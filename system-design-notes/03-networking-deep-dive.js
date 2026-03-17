/** ============================================================
 *  FILE 03: NETWORKING DEEP DIVE
 *  ============================================================
 *  Topics: TCP handshake, connection pooling, WebSockets,
 *          long polling, SSE, HTTP/2, gRPC basics
 *
 *  WHY THIS MATTERS:
 *  Modern apps demand real-time communication -- live scores,
 *  chat, stock tickers. Choosing the wrong protocol costs
 *  bandwidth, battery, and users.
 *  ============================================================ */

// STORY: Hotstar Live Cricket Streaming
// During India vs Australia, 25 million concurrent users watch.
// WebSocket delivers live scores instantly. SSE pushes one-way
// notifications. HTTP/2 loads UI assets in parallel. Hotstar uses
// all three depending on the feature.

console.log("=".repeat(70));
console.log("  FILE 03: NETWORKING DEEP DIVE");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — TCP 3-Way Handshake
// ================================================================

// WHY: Every HTTP request and WebSocket starts with this handshake.
// Understanding it explains connection latency and keep-alive.

console.log("--- SECTION 1: TCP 3-Way Handshake ---\n");

function simulateTCPHandshake(client, server) {
  const clientISN = Math.floor(Math.random() * 10000);
  const serverISN = Math.floor(Math.random() * 10000);
  console.log(`  ${client} <-> ${server}`);
  console.log(`  Step 1: SYN    ${client} -> ${server}  Seq: ${clientISN}`);
  console.log(`  Step 2: SYN-ACK ${server} -> ${client}  Seq: ${serverISN}, Ack: ${clientISN + 1}`);
  console.log(`  Step 3: ACK    ${client} -> ${server}  Seq: ${clientISN + 1}, Ack: ${serverISN + 1}`);
  console.log(`  Connection ESTABLISHED. ~1.5 RTT. If RTT=50ms -> ~75ms\n`);
}

simulateTCPHandshake("Hotstar App", "Hotstar CDN");

// ================================================================
// SECTION 2 — Connection Pooling
// ================================================================

// WHY: New TCP connection per request = handshake + TLS = ~150ms.
// Pooling reuses connections, dramatically improving throughput.

console.log("--- SECTION 2: Connection Pooling ---\n");

class ConnectionPool {
  constructor(name, maxSize) {
    this.name = name; this.maxSize = maxSize;
    this.connections = []; this.stats = { created: 0, reused: 0, rejected: 0 };
  }
  acquire(reqId) {
    const idle = this.connections.find((c) => c.state === "idle");
    if (idle) { idle.state = "active"; this.stats.reused++; console.log(`    Req#${reqId}: Reused #${idle.id}`); return idle; }
    if (this.connections.length < this.maxSize) {
      const conn = { id: this.connections.length + 1, state: "active" };
      this.connections.push(conn); this.stats.created++;
      console.log(`    Req#${reqId}: New #${conn.id} (${this.connections.length}/${this.maxSize})`);
      return conn;
    }
    this.stats.rejected++; console.log(`    Req#${reqId}: Pool full! Queued.`); return null;
  }
  release(conn) { conn.state = "idle"; }
}

const pool = new ConnectionPool("Hotstar-API", 4);
const acquired = [];
for (let i = 1; i <= 5; i++) { const c = pool.acquire(i); if (c) acquired.push(c); }
console.log();
acquired.slice(0, 2).forEach((c) => pool.release(c));
for (let i = 6; i <= 7; i++) pool.acquire(i);
console.log(`  Stats: ${JSON.stringify(pool.stats)}\n`);

// ================================================================
// SECTION 3 — WebSocket Lifecycle
// ================================================================

// WHY: WebSocket provides full-duplex, persistent communication
// over a single TCP connection -- perfect for live cricket scores.

console.log("--- SECTION 3: WebSocket Lifecycle ---\n");

class WebSocketSim {
  constructor(url) { this.url = url; this.state = "CLOSED"; }
  connect() {
    console.log(`  [WS] Upgrade: GET ${this.url}`);
    console.log(`    Upgrade: websocket | Sec-WebSocket-Version: 13`);
    console.log(`  [WS] 101 Switching Protocols`);
    this.state = "OPEN";
    console.log(`  [WS] State: ${this.state} -- full-duplex ready!\n`);
  }
  send(msg) { console.log(`  [WS] CLIENT -> SERVER: ${JSON.stringify(msg)}`); }
  receive(msg) { console.log(`  [WS] SERVER -> CLIENT: ${JSON.stringify(msg)}`); }
  close(code, reason) {
    console.log(`\n  [WS] Close: code=${code}, reason="${reason}"`);
    this.state = "CLOSED";
  }
}

const ws = new WebSocketSim("wss://ws.hotstar.com/live-score");
ws.connect();
ws.send({ type: "subscribe", match: "IND-vs-AUS", channels: ["score"] });
console.log();

[
  { over: "45.1", event: "FOUR", score: "156/3" },
  { over: "45.3", event: "SIX", score: "162/3" },
  { over: "45.4", event: "WICKET", score: "162/4", detail: "Kohli caught at slip" },
].forEach((u) => ws.receive(u));
console.log();
ws.close(1000, "Match ended");
console.log();

// ================================================================
// SECTION 4 — Long Polling vs Short Polling
// ================================================================

// WHY: Before WebSockets, polling was the only way to get "live"
// updates. Understanding both helps choose the right tool.

console.log("--- SECTION 4: Long Polling vs Short Polling ---\n");

// Short polling
console.log("  Short Polling (every 2s): client asks repeatedly\n");
let shortHits = 0;
for (let i = 1; i <= 8; i++) {
  const hasUpdate = Math.random() < 0.3;
  if (hasUpdate) shortHits++;
  console.log(`    Poll #${i}: ${hasUpdate ? "200 OK -- new score" : "304 Not Modified (wasted)"}`);
}
console.log(`\n    Useful: ${shortHits}/8 (${(((8 - shortHits) / 8) * 100).toFixed(0)}% wasted)\n`);

// Long polling
console.log("  Long Polling: server HOLDS connection until update\n");
for (let i = 1; i <= 4; i++) {
  const wait = Math.floor(Math.random() * 8) + 2;
  console.log(`    Req #${i}: server held ~${wait}s -> new score`);
}
console.log(`\n    0% waste, but server holds connections (resource cost)\n`);

// ================================================================
// SECTION 5 — Server-Sent Events (SSE)
// ================================================================

// WHY: SSE is a standard server-to-client push over HTTP. Simpler
// than WebSocket, auto-reconnects, works with HTTP/2.

console.log("--- SECTION 5: Server-Sent Events (SSE) ---\n");

class SSESim {
  constructor() { this.eventId = 0; }
  push(type, data) {
    this.eventId++;
    console.log(`  id: ${this.eventId}\n  event: ${type}\n  data: ${JSON.stringify(data)}\n`);
  }
}

const sse = new SSESim();
console.log("  GET /api/match/stream -> 200 OK (text/event-stream)\n");
sse.push("score-update", { over: "46.2", runs: 169, event: "FOUR!" });
sse.push("wicket", { over: "46.3", batsman: "Rahul", bowler: "Starc" });

console.log("  Auto-reconnect on disconnect: sends Last-Event-ID header.\n");
console.log("  SSE: Server->Client only, HTTP, auto-reconnect, text only");
console.log("  WS:  Bidirectional, upgrade protocol, manual reconnect, binary OK");
console.log();

// ================================================================
// SECTION 6 — HTTP/2 Multiplexing
// ================================================================

// WHY: HTTP/1.1 allows only one request per connection at a time.
// HTTP/2 multiplexes many requests over a single connection.

console.log("--- SECTION 6: HTTP/2 Multiplexing ---\n");

const resources = [
  { name: "index.html", size: 50 }, { name: "styles.css", size: 30 },
  { name: "app.js", size: 80 }, { name: "hero.jpg", size: 120 },
  { name: "data.json", size: 35 },
];

console.log("  HTTP/1.1 (6 connections max, sequential per conn):");
const connCount = Math.min(6, resources.length);
resources.forEach((r, i) => {
  console.log(`    Conn#${(i % connCount) + 1}: ${r.name.padEnd(15)} ${r.size}ms`);
});
const h1Time = Math.ceil(resources.length / connCount) * Math.max(...resources.map((r) => r.size));
console.log(`    Effective time: ~${h1Time}ms\n`);

console.log("  HTTP/2 (ONE connection, all streams parallel):");
resources.forEach((r, i) => {
  console.log(`    Stream#${i + 1}: ${r.name.padEnd(15)} ${r.size}ms (concurrent)`);
});
const h2Time = Math.max(...resources.map((r) => r.size));
console.log(`    Effective time: ~${h2Time}ms + HPACK header compression`);
console.log(`\n  HTTP/2 is ~${((1 - h2Time / h1Time) * 100).toFixed(0)}% faster for this page load.`);
console.log();

// ================================================================
// SECTION 7 — gRPC Concepts
// ================================================================

// WHY: gRPC uses HTTP/2 + Protobuf for internal microservice
// communication where performance matters over readability.

console.log("--- SECTION 7: gRPC Concepts ---\n");

console.log("  service MatchService {");
console.log("    rpc GetMatchDetails(MatchRequest) returns (MatchResponse);");
console.log("    rpc StreamScoreUpdates(ScoreRequest) returns (stream ScoreUpdate);");
console.log("  }\n");

console.log("  Unary call: GetMatchDetails");
console.log("    Request: { matchId: 'IND-AUS-2024' }");
console.log("    Response: { teams: 'IND vs AUS', venue: 'Wankhede', status: 'LIVE' }\n");

console.log("  Server streaming: StreamScoreUpdates");
["{ over: '47.1', event: 'Single', score: '170/4' }",
 "{ over: '47.2', event: 'FOUR', score: '174/4' }",
].forEach((r, i) => console.log(`    [chunk ${i + 1}] ${r}`));

console.log("\n  gRPC Patterns:");
console.log("    1. Unary:            1 request -> 1 response");
console.log("    2. Server Streaming: 1 request -> many responses");
console.log("    3. Client Streaming: many requests -> 1 response");
console.log("    4. Bidirectional:    both stream simultaneously");
console.log();

// ================================================================
// SECTION 8 — Choosing the Right Protocol
// ================================================================

console.log("--- SECTION 8: Protocol Decision Guide ---\n");

const decisions = [
  ["Live cricket score",      "Server push, real-time",    "WebSocket or SSE"],
  ["Swiggy order tracking",   "Bidirectional location",    "WebSocket"],
  ["IRCTC train search",      "One-time request-response", "REST over HTTP/2"],
  ["Hotstar microservices",   "High throughput, internal",  "gRPC"],
  ["PhonePe payment status",  "Wait for bank confirmation", "Long Polling or WS"],
  ["Flipkart price alerts",   "Infrequent server push",    "SSE"],
];

console.log(`  ${"Scenario".padEnd(26)} ${"Requirement".padEnd(28)} Best Choice`);
console.log(`  ${"---".repeat(26)}`);
decisions.forEach(([s, r, c]) => console.log(`  ${s.padEnd(26)} ${r.padEnd(28)} ${c}`));
console.log();

// ================================================================
// KEY TAKEAWAYS
// ================================================================
console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. TCP 3-way handshake (SYN, SYN-ACK, ACK) is the cost of every");
console.log("     reliable connection.");
console.log();
console.log("  2. Connection pooling avoids repeated handshakes.");
console.log();
console.log("  3. WebSocket: full-duplex, persistent -- live scores, chat.");
console.log();
console.log("  4. Short polling wastes bandwidth; long polling is better but");
console.log("     holds server resources.");
console.log();
console.log("  5. SSE: simpler HTTP-native alternative for server-to-client push.");
console.log();
console.log("  6. HTTP/2 multiplexing eliminates head-of-line blocking.");
console.log();
console.log("  7. gRPC (HTTP/2 + Protobuf) for internal high-throughput services.");
console.log();
