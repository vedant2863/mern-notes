/** ============================================================
 *  FILE 2: Routing Basics — HTTP Methods, Paths, and Chaining
 *  Routing maps an HTTP method + URL path to handler code.
 *  Master routing and you control the entire request flow.
 *  ============================================================ */

// ─── BEST Bus Driver Raju ─────────────────────────────────────
// Each bus route has a NUMBER (URL path) and a DIRECTION (HTTP
// method). GET /routes differs from POST /routes, just like
// northbound differs from southbound.

const express = require("express");

// ════════════════════════════════════════════════════════════════
// BLOCK 1 — All HTTP Methods (CRUD)
// ════════════════════════════════════════════════════════════════

//  app.get     — Read     app.post   — Create
//  app.put     — Replace  app.patch  — Partial update
//  app.delete  — Remove   app.all    — ANY method

function block1_httpMethods() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());

    const routes = {
      1: { id: 1, name: "Dadar-Andheri Express", direction: "North" },
      2: { id: 2, name: "Bandra-Kurla Shuttle", direction: "East" },
    };
    let nextId = 3;

    app.get("/routes", (req, res) => {
      res.json(Object.values(routes));
    });

    app.post("/routes", (req, res) => {
      const newRoute = { id: nextId++, ...req.body };
      routes[newRoute.id] = newRoute;
      res.status(201).json(newRoute);
    });

    // PUT replaces entirely; PATCH updates only provided fields
    app.put("/routes/:id", (req, res) => {
      const id = req.params.id;
      if (!routes[id]) return res.status(404).json({ error: "Not found" });
      routes[id] = { id: Number(id), ...req.body };
      res.json(routes[id]);
    });

    app.delete("/routes/:id", (req, res) => {
      const id = req.params.id;
      if (!routes[id]) return res.status(404).json({ error: "Not found" });
      delete routes[id];
      res.status(204).end();
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log("=== BLOCK 1: All HTTP Methods ===");
      console.log(`Server running on port ${port}\n`);

      try {
        const listRes = await fetch(`${base}/routes`);
        console.log("GET /routes:", JSON.stringify(await listRes.json()));

        const createRes = await fetch(`${base}/routes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Colaba-Worli Loop", direction: "South" }),
        });
        console.log("POST /routes:", createRes.status, JSON.stringify(await createRes.json()));
        // Output: POST /routes: 201 {"id":3,"name":"Colaba-Worli Loop","direction":"South"}

        const putRes = await fetch(`${base}/routes/1`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Dadar-Andheri Local", direction: "South" }),
        });
        console.log("PUT /routes/1:", JSON.stringify(await putRes.json()));

        const delRes = await fetch(`${base}/routes/3`, { method: "DELETE" });
        console.log("DELETE /routes/3 status:", delRes.status);
        // Output: DELETE /routes/3 status: 204
      } catch (err) {
        console.error("Test error:", err.message);
      }

      server.close(() => {
        console.log("\nBlock 1 server closed.\n");
        resolve();
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// BLOCK 2 — Route Patterns, app.route(), app.all()
// ════════════════════════════════════════════════════════════════

// ─── Express 5 path syntax changes ───────────────────────────
//  1. NO optional `?` — use two separate routes instead.
//  2. NO inline regex like ':id(\\d+)' — validate in handler.
//  3. Wildcards must be named: '/files/*filepath' not '/files/*'.

function block2_routePatterns() {
  return new Promise((resolve) => {
    const app = express();

    // ─── Express 5 wildcard with named splat ──────────────────
    app.get("/files/*filepath", (req, res) => {
      // Matched portions land in req.params.filepath as an array.
      res.json({ filepath: req.params.filepath, type: "wildcard" });
    });

    // ─── Separate routes instead of optional param ────────────
    app.get("/stops", (req, res) => {
      res.json({ stops: ["Dadar", "Andheri"], type: "list" });
    });
    app.get("/stops/:id", (req, res) => {
      res.json({ stop: req.params.id, type: "single" });
    });

    // ─── Parameterized route (instead of regex) ────────────────
    app.get("/bus-:number", (req, res) => {
      // Validate that the number is actually digits
      const num = req.params.number;
      const isDigits = num.length > 0 && !isNaN(num);
      if (!isDigits) return res.status(400).json({ error: "Bus number must be numeric" });
      res.json({ busNumber: num, type: "param" });
    });

    // ─── app.route() — chain methods on one path ──────────────
    app
      .route("/schedule")
      .get((req, res) => res.json({ action: "list schedules", method: "GET" }))
      .post((req, res) => res.json({ action: "create schedule", method: "POST" }));

    // ─── app.all() — matches ANY HTTP method ──────────────────
    app.all("/any-method", (req, res) => {
      res.json({ method: req.method, message: "app.all matched!" });
    });

    // ─── app.use() — prefix matching (not exact) ─────────────
    app.use("/api", (req, res) => {
      // Matches /api, /api/foo, /api/foo/bar — PREFIX match.
      res.json({ originalUrl: req.originalUrl, path: req.path, type: "use-prefix" });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log("=== BLOCK 2: Route Patterns, app.route(), app.all() ===");
      console.log(`Server running on port ${port}\n`);

      try {
        const wildRes = await fetch(`${base}/files/docs/readme.txt`);
        console.log("GET /files/docs/readme.txt:", JSON.stringify(await wildRes.json()));

        const listRes = await fetch(`${base}/stops`);
        console.log("GET /stops:", JSON.stringify(await listRes.json()));

        const regexRes = await fetch(`${base}/bus-42`);
        console.log("GET /bus-42:", JSON.stringify(await regexRes.json()));

        const schedRes = await fetch(`${base}/schedule`);
        console.log("GET /schedule:", JSON.stringify(await schedRes.json()));

        const allRes = await fetch(`${base}/any-method`, { method: "PATCH" });
        console.log("PATCH /any-method:", JSON.stringify(await allRes.json()));

        const useRes = await fetch(`${base}/api/users/123`);
        console.log("GET /api/users/123:", JSON.stringify(await useRes.json()));
      } catch (err) {
        console.error("Test error:", err.message);
      }

      server.close(() => {
        console.log("\nBlock 2 server closed.");
        resolve();
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// Run all blocks sequentially, then exit
// ════════════════════════════════════════════════════════════════

async function main() {
  await block1_httpMethods();
  await block2_routePatterns();

  console.log("\n=== KEY TAKEAWAYS ===");
  console.log("1. GET = read, POST = create, PUT = replace, PATCH = update, DELETE = remove.");
  console.log("2. app.route('/path') chains .get().post().put().delete() on one path.");
  console.log("3. app.all() matches ANY method; app.use() does PREFIX matching.");
  console.log("4. Express 5: no optional `?`, wildcards must be named, no inline regex.");

  process.exit(0);
}

main();
