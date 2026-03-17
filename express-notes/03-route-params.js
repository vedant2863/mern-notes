/** ============================================================
 *  FILE 3: Route Parameters — Params, Queries, and Validation
 *  Dynamic segments and query strings are how clients specify
 *  WHICH resource they want and HOW they want it.
 *  ============================================================ */

// ─── Indian Railway PNR Lookup ────────────────────────────────
// Clerk Sharma uses route params for PNR numbers and query
// strings for filtering/pagination. Bad inputs get rejected.

const express = require("express");

// ════════════════════════════════════════════════════════════════
// BLOCK 1 — Route Params and Query Strings
// ════════════════════════════════════════════════════════════════

// ─── Express 5 param changes ──────────────────────────────────
//  1. req.params values are DECODED by default (%20 -> space).
//  2. NO inline regex in route strings — validate in handler.

function block1_paramsAndQuery() {
  return new Promise((resolve) => {
    const app = express();

    const catalog = {
      1: { id: 1, name: "Rajdhani Express", from: "NDLS", to: "BCT", class: "rajdhani" },
      2: { id: 2, name: "Shatabdi Express", from: "NDLS", to: "CDG", class: "shatabdi" },
    };

    // ─── Single route parameter ────────────────────────────────
    app.get("/trains/:id", (req, res) => {
      const train = catalog[req.params.id];
      if (!train) return res.status(404).json({ error: `Train ${req.params.id} not found` });
      res.json(train);
    });

    // ─── Query strings with pagination ─────────────────────────
    app.get("/trains", (req, res) => {
      // All query values are STRINGS — cast numbers yourself.
      const { class: trainClass, page = "1", limit = "10" } = req.query;
      let results = Object.values(catalog);
      if (trainClass) results = results.filter((t) => t.class === trainClass);

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const start = (pageNum - 1) * limitNum;

      res.json({ total: results.length, page: pageNum, limit: limitNum, data: results.slice(start, start + limitNum) });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log("=== BLOCK 1: Route Params and Query Strings ===");
      console.log(`Server running on port ${port}\n`);

      try {
        const train1 = await (await fetch(`${base}/trains/1`)).json();
        console.log("GET /trains/1:", JSON.stringify(train1));

        const nfRes = await fetch(`${base}/trains/999`);
        console.log("GET /trains/999:", nfRes.status, JSON.stringify(await nfRes.json()));
        // Output: GET /trains/999: 404 {"error":"Train 999 not found"}

        const filtered = await (await fetch(`${base}/trains?class=rajdhani`)).json();
        console.log("GET /trains?class=rajdhani:", JSON.stringify(filtered));
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
// BLOCK 2 — Validation, Multiple Params, Combining Both
// ════════════════════════════════════════════════════════════════

function block2_validationAndMultipleParams() {
  return new Promise((resolve) => {
    const app = express();

    const stations = {
      NDLS: {
        name: "New Delhi",
        trains: {
          12301: { code: "12301", name: "Rajdhani Express" },
          12002: { code: "12002", name: "Shatabdi Express" },
        },
      },
    };

    // ─── Multiple route parameters ────────────────────────────
    app.get("/stations/:stationCode/trains/:trainCode", (req, res) => {
      const { stationCode, trainCode } = req.params;
      const station = stations[stationCode];
      if (!station) return res.status(404).json({ error: `Station '${stationCode}' not found` });
      const train = station.trains[trainCode];
      if (!train) return res.status(404).json({ error: `Train '${trainCode}' not at '${stationCode}'` });
      res.json({ station: station.name, train });
    });

    // ─── Parameter validation ─────────────────────────────────
    // Check if string is all digits and represents a positive integer
    function isPositiveInt(str) {
      if (str.length === 0) return false;
      for (let i = 0; i < str.length; i++) {
        if (str[i] < '0' || str[i] > '9') return false;
      }
      return parseInt(str, 10) > 0;
    }

    app.get("/pnr/:pnrNumber", (req, res) => {
      const { pnrNumber } = req.params;
      if (!isPositiveInt(pnrNumber)) {
        return res.status(400).json({ error: "pnrNumber must be a positive integer", received: pnrNumber });
      }
      res.json({ pnrNumber: parseInt(pnrNumber, 10), status: `PNR #${pnrNumber} confirmed` });
    });

    // ─── Combining params + query strings ─────────────────────
    // Params identify the RESOURCE; query strings configure the VIEW.
    app.get("/stations/:stationCode/trains", (req, res) => {
      const { stationCode } = req.params;
      const { sort = "name", order = "asc" } = req.query;
      const station = stations[stationCode];
      if (!station) return res.status(404).json({ error: `Station '${stationCode}' not found` });

      let trains = Object.values(station.trains);
      trains.sort((a, b) => {
        const cmp = a[sort] < b[sort] ? -1 : a[sort] > b[sort] ? 1 : 0;
        return order === "desc" ? -cmp : cmp;
      });
      res.json({ station: station.name, sort, order, trains });
    });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      console.log("=== BLOCK 2: Validation, Multiple Params, Combining ===");
      console.log(`Server running on port ${port}\n`);

      try {
        const multiRes = await (await fetch(`${base}/stations/NDLS/trains/12301`)).json();
        console.log("GET /stations/NDLS/trains/12301:", JSON.stringify(multiRes));

        const validRes = await (await fetch(`${base}/pnr/4521389076`)).json();
        console.log("GET /pnr/4521389076:", JSON.stringify(validRes));

        const invalidRes = await fetch(`${base}/pnr/abc`);
        console.log("GET /pnr/abc:", invalidRes.status, JSON.stringify(await invalidRes.json()));
        // Output: GET /pnr/abc: 400 {"error":"pnrNumber must be a positive integer","received":"abc"}

        const comboRes = await (await fetch(`${base}/stations/NDLS/trains?sort=name&order=desc`)).json();
        console.log("GET /stations/NDLS/trains?sort=name&order=desc:", JSON.stringify(comboRes));
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
  await block1_paramsAndQuery();
  await block2_validationAndMultipleParams();

  console.log("\n=== KEY TAKEAWAYS ===");
  console.log("1. req.params holds :named segments — they identify WHICH resource.");
  console.log("2. req.query holds ?key=value pairs — they configure HOW it's returned.");
  console.log("3. All query values are strings — always parseInt when you need numbers.");
  console.log("4. Express 5 auto-decodes params and removed inline regex from paths.");
  console.log("5. Params = resource identity, Query = presentation. Keep them separate.");

  process.exit(0);
}

main();
