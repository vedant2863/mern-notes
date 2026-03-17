/** ============================================================
 *  FILE 12 — RESTful API Design Patterns
 *  Topic: CRUD, status codes, pagination, filtering, PATCH
 *  ============================================================ */

// ── THE STORY ──────────────────────────────────────────────
// The Tehsildar's Office
// Tehsildar Sharma ji maintains the citizen ledger. Every
// interaction follows protocol: register (POST), look up (GET),
// full replace (PUT), partial correction (PATCH), remove
// (DELETE). Every response carries a status seal (HTTP code).
// Pagination handles the flood: "records 1-10 of 847."
// ───────────────────────────────────────────────────────────

const express = require('express');

// ============================================================
// BLOCK 1 — Full CRUD with In-Memory Store
// ============================================================
// GET  /citizens     → 200         POST   /citizens   → 201
// GET  /citizens/:id → 200 | 404   PUT    /citizens/:id → 200 | 404
// DELETE /citizens/:id → 204 | 404

let citizens = [];
let nextId = 1;

function resetStore() {
  citizens = [
    { id: 1, name: 'Aarti Verma', age: 34, status: 'active', occupation: 'teacher', registeredAt: '2025-01-15T10:00:00Z' },
    { id: 2, name: 'Bharat Chauhan', age: 28, status: 'active', occupation: 'farmer', registeredAt: '2025-02-20T14:30:00Z' },
    { id: 3, name: 'Chitra Deshpande', age: 45, status: 'inactive', occupation: 'shopkeeper', registeredAt: '2025-03-10T09:00:00Z' },
    { id: 4, name: 'Dinesh Faujdar', age: 22, status: 'active', occupation: 'clerk', registeredAt: '2025-04-05T11:15:00Z' },
    { id: 5, name: 'Ekta Malhotra', age: 31, status: 'inactive', occupation: 'doctor', registeredAt: '2025-05-12T16:45:00Z' },
  ];
  nextId = 6;
}

// Envelope helpers — consistent { success, data } or { success, error }
function successResponse(data, meta = {}) { return { success: true, data, ...meta }; }
function errorResponse(message, details = null) {
  const err = { success: false, error: { message } };
  if (details) err.error.details = details;
  return err;
}

function buildApp() {
  const app = express();
  app.use(express.json());

  // ── GET /citizens — List all ───────────────────────────────
  app.get('/citizens', (req, res) => {
    res.status(200).json(successResponse(citizens));
  });

  // ============================================================
  // BLOCK 2 — Pagination, Filtering, Sorting
  // ============================================================
  // Filter → Sort → Paginate. Defined BEFORE /:id so "search"
  // isn't captured as an id param.

  app.get('/citizens/search', (req, res) => {
    let results = [...citizens];

    // Filtering
    const { status, occupation, minAge, maxAge } = req.query;
    if (status) results = results.filter(c => c.status === status);
    if (occupation) results = results.filter(c => c.occupation === occupation);
    if (minAge) { const min = parseInt(minAge, 10); if (!isNaN(min)) results = results.filter(c => c.age >= min); }
    if (maxAge) { const max = parseInt(maxAge, 10); if (!isNaN(max)) results = results.filter(c => c.age <= max); }

    // Sorting
    const sortField = req.query.sort || 'id';
    const sortOrder = req.query.order === 'desc' ? -1 : 1;
    results.sort((a, b) => {
      if (a[sortField] < b[sortField]) return -1 * sortOrder;
      if (a[sortField] > b[sortField]) return 1 * sortOrder;
      return 0;
    });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;

    res.status(200).json({
      success: true,
      data: results.slice(start, start + limit),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
    });
  });

  // ── GET /citizens/:id ──────────────────────────────────────
  app.get('/citizens/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json(errorResponse('ID must be a number'));
    const citizen = citizens.find(c => c.id === id);
    if (!citizen) return res.status(404).json(errorResponse(`Citizen ${id} not found`));
    res.status(200).json(successResponse(citizen));
  });

  // ── POST /citizens — 201 Created ──────────────────────────
  app.post('/citizens', (req, res) => {
    const { name, age, status, occupation } = req.body;
    if (!name || !age) return res.status(422).json(errorResponse('name and age are required'));
    if (citizens.some(c => c.name === name)) return res.status(409).json(errorResponse(`Citizen "${name}" already exists`));

    const newCitizen = { id: nextId++, name, age, status: status || 'pending', occupation: occupation || 'unspecified', registeredAt: new Date().toISOString() };
    citizens.push(newCitizen);
    res.status(201).json(successResponse(newCitizen));
  });

  // ── PUT /citizens/:id — Full replace (all fields required) ─
  app.put('/citizens/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json(errorResponse('ID must be a number'));
    const index = citizens.findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json(errorResponse(`Citizen ${id} not found`));

    const { name, age, status, occupation } = req.body;
    if (!name || !age || !status || !occupation) {
      return res.status(422).json(errorResponse('PUT requires all fields: name, age, status, occupation'));
    }
    citizens[index] = { id, name, age, status, occupation, registeredAt: citizens[index].registeredAt };
    res.status(200).json(successResponse(citizens[index]));
  });

  // ── DELETE /citizens/:id — 204 No Content ──────────────────
  app.delete('/citizens/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json(errorResponse('ID must be a number'));
    const index = citizens.findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json(errorResponse(`Citizen ${id} not found`));
    citizens.splice(index, 1);
    res.status(204).end();
  });

  // ============================================================
  // BLOCK 3 — PATCH Partial Updates, 409 Conflict
  // ============================================================
  // PATCH sends only the fields to change. PUT sends everything.
  // Idempotency: GET/PUT/DELETE are idempotent. POST is not.
  // PATCH is idempotent when using absolute values.

  app.patch('/citizens/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json(errorResponse('ID must be a number'));
    const index = citizens.findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json(errorResponse(`Citizen ${id} not found`));

    const allowedFields = ['name', 'age', 'status', 'occupation'];
    const updates = {};
    const unknownFields = [];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key)) updates[key] = value;
      else if (key !== 'id' && key !== 'registeredAt') unknownFields.push(key);
    }

    if (unknownFields.length > 0) return res.status(400).json(errorResponse(`Unknown fields: ${unknownFields.join(', ')}`, { allowedFields }));
    if (Object.keys(updates).length === 0) return res.status(400).json(errorResponse('No valid fields to update'));

    // 409 Conflict — name uniqueness
    if (updates.name) {
      const conflict = citizens.find(c => c.name === updates.name && c.id !== id);
      if (conflict) return res.status(409).json(errorResponse(`Name "${updates.name}" is already taken by citizen ${conflict.id}`));
    }

    Object.assign(citizens[index], updates);
    res.status(200).json(successResponse(citizens[index]));
  });

  return app;
}

// ============================================================
// SELF-TEST
// ============================================================
async function runTests() {
  resetStore();
  const app = buildApp();

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    console.log(`[12-rest-api-design] Server on port ${port}\n`);

    try {
      // ── Block 1: CRUD ──────────────────────────────────────
      console.log('=== Block 1 — CRUD Operations ===\n');

      const r1 = await fetch(`${base}/citizens`);
      const j1 = await r1.json();
      console.log('GET /citizens — Count:', j1.data.length); // Output: 5

      const r2 = await fetch(`${base}/citizens/1`);
      const j2 = await r2.json();
      console.log('GET /citizens/1 — Name:', j2.data.name);  // Output: Aarti Verma

      const r3 = await fetch(`${base}/citizens/999`);
      console.log('GET /citizens/999 — Status:', r3.status);  // Output: 404

      const r4 = await fetch(`${base}/citizens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Isha Qureshi', age: 29, status: 'active', occupation: 'engineer' })
      });
      console.log('POST /citizens — Status:', r4.status);     // Output: 201

      const r9 = await fetch(`${base}/citizens/3`, { method: 'DELETE' });
      console.log('DELETE /citizens/3 — Status:', r9.status);  // Output: 204
      console.log('');

      // ── Block 2: Pagination, Filtering ─────────────────────
      console.log('=== Block 2 — Pagination, Filtering, Sorting ===\n');

      const r11 = await fetch(`${base}/citizens/search?page=1&limit=2`);
      const j11 = await r11.json();
      console.log('Page 1 items:', j11.data.length, '| Total:', j11.pagination.total);

      const r13 = await fetch(`${base}/citizens/search?status=active`);
      const j13 = await r13.json();
      console.log('Active citizens:', j13.data.length);

      const r15 = await fetch(`${base}/citizens/search?sort=name&order=asc&limit=3`);
      const j15 = await r15.json();
      console.log('Sorted by name:', j15.data.map(c => c.name).join(', '));
      console.log('');

      // ── Block 3: PATCH ─────────────────────────────────────
      console.log('=== Block 3 — PATCH, Conflict ===\n');

      const r18 = await fetch(`${base}/citizens/4`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' })
      });
      const j18 = await r18.json();
      console.log('PATCH status update — Name unchanged:', j18.data.name, '| Status:', j18.data.status);

      const r19 = await fetch(`${base}/citizens/4`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Aarti Verma' })
      });
      console.log('PATCH name conflict — Status:', r19.status); // Output: 409

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close(() => {
        console.log('\n── Server closed ──');

        // ── KEY TAKEAWAYS ─────────────────────────────────────
        // 1. RESTful URLs are nouns (citizens), not verbs. The
        //    HTTP method IS the verb.
        // 2. Status codes: 200 OK, 201 Created, 204 No Content,
        //    400 Bad Request, 404 Not Found, 409 Conflict, 422 Invalid.
        // 3. PUT = full replace. PATCH = partial update.
        // 4. Envelope { success, data, error } gives clients a
        //    consistent structure.
        // 5. Order: filter → sort → paginate.
        // 6. GET/PUT/DELETE are idempotent. POST is not.
        // 7. 409 Conflict is perfect for uniqueness violations.
      });
    }
  });
}

runTests();
