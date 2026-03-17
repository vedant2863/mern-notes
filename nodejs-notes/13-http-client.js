/** ============================================================
 FILE 13: HTTP Client — Making Requests
 ============================================================
 Topic: http.get, http.request, global fetch (Node 18+)
 WHY: Node is also a powerful HTTP client. From calling APIs
   to microservice communication, knowing these methods is
   essential. fetch() makes it much simpler.
 ============================================================ */

// ============================================================
// STORY: HIGHWAY DHABA CLIENT
//   Now we are on the other side of the window — the customer.
//   We place orders (requests) and wait for food (responses).
// ============================================================

const http = require("http");

const PORT = 0;

// ── Test Server — a simple API to request against ───────────

function createTestServer() {
  return http.createServer((req, res) => {
    const { url, method } = req;

    if (method === "GET" && url === "/api/greeting") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Namaste from the dhaba!" }));
      return;
    }

    if (method === "POST" && url === "/api/order") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ confirmed: true, order: body, estimatedMinutes: 15 }));
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });
}

// ── Helper: collect response body ───────────────────────────

function collectBody(res) {
  return new Promise((resolve) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

// ============================================================
// BLOCK 1 — http.get() and http.request()
// ============================================================

async function block1_httpGetAndRequest(port) {
  console.log("=== BLOCK 1: http.get() and http.request() ===\n");

  // ── http.get() — shorthand for GET requests ────────────────
  // WHY: Auto-sets method to GET and calls req.end() for you.

  console.log("  --- http.get() ---\n");

  const getResult = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/api/greeting`, async (res) => {
      const body = await collectBody(res);
      resolve({ statusCode: res.statusCode, body });
    }).on("error", reject);
  });

  console.log(`  Status: ${getResult.statusCode}`);
  const greeting = JSON.parse(getResult.body);
  console.log(`  Message: ${greeting.message}`);
  // Output: Status: 200
  // Output: Message: Namaste from the dhaba!

  // ── http.request() — full control ─────────────────────────
  // WHY: Lets you set method, headers, timeout. Must call req.end() yourself.

  console.log("\n  --- http.request() for GET ---\n");

  const reqResult = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost", port, path: "/api/greeting", method: "GET",
      headers: { Accept: "application/json" },
    }, async (res) => {
      const body = await collectBody(res);
      resolve({ statusCode: res.statusCode, body });
    });
    req.on("error", reject);
    req.end(); // WHY: Must call end() — http.request does NOT auto-call it
  });

  console.log(`  Status: ${reqResult.statusCode}`);
  // Output: Status: 200

  // ── Handling a 404 ─────────────────────────────────────────
  // WHY: http.get/request do NOT throw on 4xx/5xx — check statusCode yourself.

  console.log("\n  --- Handling 404 ---\n");

  const notFound = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/api/nonexistent`, async (res) => {
      const body = await collectBody(res);
      resolve({ statusCode: res.statusCode, body });
    }).on("error", reject);
  });

  console.log(`  Status: ${notFound.statusCode}`);
  // Output: Status: 404
  console.log("");
}

// ============================================================
// BLOCK 2 — POST Requests & Global fetch()
// ============================================================

async function block2_postAndFetch(port) {
  console.log("=== BLOCK 2: POST Requests & Global fetch() ===\n");

  // ── POST with http.request() ──────────────────────────────

  console.log("  --- POST with http.request() ---\n");

  const postBody = JSON.stringify({ item: "Tandoori Chicken", quantity: 3 });

  const postResult = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost", port, path: "/api/order", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postBody) },
    }, async (res) => {
      const body = await collectBody(res);
      resolve({ statusCode: res.statusCode, body });
    });
    req.on("error", reject);
    // WHY: For POST, write the body before calling end()
    req.write(postBody);
    req.end();
  });

  console.log(`  Status: ${postResult.statusCode}`);
  const orderConfirm = JSON.parse(postResult.body);
  console.log(`  Confirmed: ${orderConfirm.confirmed}`);
  // Output: Status: 201

  // ── Global fetch() — GET (Node 18+) ───────────────────────
  // WHY: Built into Node 18+. Promise-based, no chunk wrangling,
  // same API browsers use.

  console.log("\n  --- Global fetch() — GET ---\n");

  const fetchGetRes = await fetch(`http://localhost:${port}/api/greeting`);
  const fetchGetData = await fetchGetRes.json();
  console.log(`  Status: ${fetchGetRes.status}, ok: ${fetchGetRes.ok}`);
  console.log(`  Message: ${fetchGetData.message}`);
  // Output: Status: 200, ok: true

  // ── Global fetch() — POST ─────────────────────────────────

  console.log("\n  --- Global fetch() — POST ---\n");

  const fetchPostRes = await fetch(`http://localhost:${port}/api/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: "Butter Naan", quantity: 4 }),
  });
  const fetchPostData = await fetchPostRes.json();
  console.log(`  Status: ${fetchPostRes.status}`);
  console.log(`  Item: ${fetchPostData.order.item}`);
  // Output: Status: 201
  // Output: Item: Butter Naan

  // ── Ergonomics comparison ─────────────────────────────────
  console.log("\n  --- Ergonomics Comparison ---");
  console.log("  http.request(): callback-based, manual chunks, must call end()");
  console.log("  fetch():        promise-based, res.json()/text(), automatic");
  console.log("  Use fetch() for most needs. Fall back to http.request() for stream control.\n");
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const server = createTestServer();

  const port = await new Promise((resolve) => {
    server.listen(PORT, "localhost", () => {
      const addr = server.address();
      console.log(`  [Test Server] Listening on http://localhost:${addr.port}\n`);
      resolve(addr.port);
    });
  });

  await block1_httpGetAndRequest(port);
  await block2_postAndFetch(port);

  await new Promise((resolve) => {
    server.close(() => { console.log("  [Test Server] Closed.\n"); resolve(); });
  });

  // ============================================================
  // KEY TAKEAWAYS
  // ============================================================
  console.log("============================================================");
  console.log("KEY TAKEAWAYS");
  console.log("============================================================");
  console.log("1. http.get() is shorthand for GET — auto-calls req.end().");
  console.log("2. http.request() gives full control but requires manual req.end().");
  console.log("3. 4xx/5xx do NOT throw — always check res.statusCode.");
  console.log("4. For POST, write the body to the request stream before end().");
  console.log("5. fetch() (Node 18+) is promise-based with res.json()/res.text().");
  console.log("6. Use http.request() when you need stream-level control.");
  console.log("============================================================\n");
}

main();
