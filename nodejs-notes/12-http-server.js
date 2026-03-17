/** ============================================================
 FILE 12: HTTP Server — Building from Scratch
 ============================================================
 Topic: http.createServer, routing, POST body handling,
        static file serving with streams
 WHY: Every Express/Koa app is built on Node's http module.
   Understanding it raw helps you debug and optimize.
 ============================================================ */

// ============================================================
// STORY: HIGHWAY DHABA ORDER WINDOW
//   Amma runs a highway dhaba with a single order window.
//   She reads slips (requests), routes them to the right
//   station, and sends plates (responses) back out.
// ============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 0; // Port 0 lets the OS pick an available port — no conflicts
const TEMP_DIR = path.join(__dirname, "_temp_http_server");
const TEMP_HTML = path.join(TEMP_DIR, "menu.html");

// ── Setup & cleanup helpers ─────────────────────────────────

function setup() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(TEMP_HTML, `<!DOCTYPE html>
<html><head><title>Amma's Dhaba Menu</title></head>
<body><h1>Welcome to Amma's Highway Dhaba</h1>
<ul><li>Dal Makhani — Rs 180</li><li>Butter Naan — Rs 60</li></ul>
</body></html>`, "utf8");
  console.log("  [Setup] Created temp HTML menu file.\n");
}

function cleanup() {
  if (fs.existsSync(TEMP_HTML)) fs.unlinkSync(TEMP_HTML);
  if (fs.existsSync(TEMP_DIR)) fs.rmdirSync(TEMP_DIR);
  console.log("  [Cleanup] Temp files removed.\n");
}

// ── Helper: make an HTTP request and collect response ───────

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ============================================================
// THE SERVER
// ============================================================

function createDhabaServer() {
  const server = http.createServer((req, res) => {
    const { url, method } = req;

    // ── BLOCK 1 routes — Basic GET routing ──────────────────

    if (method === "GET" && url === "/") {
      // WHY: writeHead sets status code AND headers in one call
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Welcome to Amma's Highway Dhaba!</h1>");
      return;
    }

    if (method === "GET" && url === "/api/menu") {
      const menu = {
        dhaba: "Amma's Highway Dhaba",
        items: [
          { name: "Dal Makhani", price: 180 },
          { name: "Butter Naan", price: 60 },
        ],
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(menu, null, 2));
      return;
    }

    // ── BLOCK 2 route — POST body handling ──────────────────

    if (method === "POST" && url === "/api/order") {
      // WHY: Request body arrives as stream chunks.
      // Collect them all before parsing — this is what body-parser does.
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const response = {
            message: `Order received: ${body.item} x${body.quantity}`,
            total: body.quantity * (body.price || 10),
          };
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
        }
      });
      return;
    }

    // ── BLOCK 3 route — Serve static file via streams ───────

    if (method === "GET" && url === "/menu.html") {
      // WHY: Piping a ReadStream to res is memory efficient —
      // the file is never fully loaded into RAM.
      if (!fs.existsSync(TEMP_HTML)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Menu file not found");
        return;
      }
      const stat = fs.statSync(TEMP_HTML);
      res.writeHead(200, { "Content-Type": "text/html", "Content-Length": stat.size });
      fs.createReadStream(TEMP_HTML).pipe(res);
      // WHY: pipe() auto-calls res.end() when the read stream finishes
      return;
    }

    // ── 404 catch-all ───────────────────────────────────────
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found", path: url }));
  });

  return server;
}

// ============================================================
// TEST RUNNER
// ============================================================

async function runTests(server) {
  const address = server.address();
  const base = { hostname: "localhost", port: address.port };

  // ============================================================
  // SECTION 1 — Basic GET Routing
  // ============================================================

  console.log("=== BLOCK 1: Basic GET Routing ===\n");

  console.log("  --- GET / ---");
  const homeRes = await makeRequest({ ...base, path: "/", method: "GET" });
  console.log(`  Status: ${homeRes.statusCode}`);
  // Output: Status: 200

  console.log("\n  --- GET /api/menu ---");
  const menuRes = await makeRequest({ ...base, path: "/api/menu", method: "GET" });
  console.log(`  Status: ${menuRes.statusCode}`);
  console.log(`  Content-Type: ${menuRes.headers["content-type"]}`);
  // Output: Content-Type: application/json

  // ============================================================
  // SECTION 2 — POST Body Handling
  // ============================================================

  console.log("\n=== BLOCK 2: POST Body Handling ===\n");

  const orderBody = JSON.stringify({ item: "Dal Makhani", quantity: 2, price: 180 });
  const orderRes = await makeRequest(
    {
      ...base, path: "/api/order", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(orderBody) },
    },
    orderBody
  );
  console.log(`  Status: ${orderRes.statusCode}`);
  const order = JSON.parse(orderRes.body);
  console.log(`  Message: ${order.message}`);
  // Output: Status: 201
  // Output: Message: Order received: Dal Makhani x2

  // ============================================================
  // SECTION 3 — Static File Serving via Streams
  // ============================================================

  console.log("\n=== BLOCK 3: Static File Serving via Streams ===\n");

  const htmlRes = await makeRequest({ ...base, path: "/menu.html", method: "GET" });
  console.log(`  Status: ${htmlRes.statusCode}`);
  console.log(`  Content-Type: ${htmlRes.headers["content-type"]}`);
  console.log(`  Body preview: ${htmlRes.body.slice(0, 50)}...`);
  // Output: Status: 200
  console.log("");
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  setup();

  const server = createDhabaServer();

  await new Promise((resolve) => {
    server.listen(PORT, "localhost", () => {
      console.log(`  Server listening on http://localhost:${server.address().port}\n`);
      resolve();
    });
  });

  await runTests(server);

  await new Promise((resolve) => {
    server.close(() => { console.log("  Server closed.\n"); resolve(); });
  });

  cleanup();

  // ============================================================
  // KEY TAKEAWAYS
  // ============================================================
  console.log("============================================================");
  console.log("KEY TAKEAWAYS");
  console.log("============================================================");
  console.log("1. http.createServer(callback) gives raw (req, res) access.");
  console.log("2. req.url and req.method drive routing — frameworks add sugar.");
  console.log("3. POST bodies arrive as streamed chunks — collect, concat, parse.");
  console.log("4. Pipe a ReadStream to res for efficient static file serving.");
  console.log("5. Content-Type headers tell the client how to interpret the body.");
  console.log("6. Always server.close() when done to prevent hanging processes.");
  console.log("============================================================\n");
}

main();
