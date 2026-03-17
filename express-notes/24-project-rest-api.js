/** ============================================================
 *  FILE 24: PustakBhandar API — Full CRUD REST API Project
 *  ============================================================ */

// STORY: Sharma ji's Sahitya Akademi library goes digital.
// A well-designed REST API gives predictable URLs, query filters,
// middleware guardrails, and structured error responses.

const express = require('express');
const crypto = require('crypto');


// ════════════════════════════════════════════════════════════════
// SECTION 1 — Custom AppError
// ════════════════════════════════════════════════════════════════

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}


// ════════════════════════════════════════════════════════════════
// SECTION 2 — In-Memory Store + Seed Data
// ════════════════════════════════════════════════════════════════

const books = [];

function seedBooks() {
  const seedData = [
    { title: 'Godan', author: 'Munshi Premchand', genre: 'upanyas', year: 1936, pages: 312 },
    { title: 'Gitanjali', author: 'Rabindranath Tagore', genre: 'kavita', year: 1910, pages: 103 },
    { title: 'Malgudi Days', author: 'R.K. Narayan', genre: 'katha', year: 1943, pages: 256 },
    { title: 'Train to Pakistan', author: 'Khushwant Singh', genre: 'sahitya', year: 1956, pages: 181 },
    { title: 'Tamas', author: 'Bhisham Sahni', genre: 'sahitya', year: 1974, pages: 328 },
    { title: 'The Guide', author: 'R.K. Narayan', genre: 'upanyas', year: 1958, pages: 220 },
  ];
  books.length = 0;
  seedData.forEach(b => books.push({ id: crypto.randomUUID(), ...b, createdAt: new Date().toISOString() }));
}


// ════════════════════════════════════════════════════════════════
// SECTION 3 — Middleware
// ════════════════════════════════════════════════════════════════

function validateBook(req, res, next) {
  const { title, year } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0)
    return next(new AppError('Title is required and must be a non-empty string', 400));
  if (year !== undefined) {
    const numYear = Number(year);
    if (isNaN(numYear) || numYear < -3000 || numYear > new Date().getFullYear() + 1)
      return next(new AppError('Year must be a valid number between -3000 and next year', 400));
    req.body.year = numYear;
  }
  next();
}

function validateBookId(req, res, next) {
  const book = books.find(b => b.id === req.params.id);
  if (!book) return next(new AppError(`Book with id '${req.params.id}' not found`, 404));
  req.book = book;
  next();
}

function envelope(res, data, statusCode = 200, pagination = null) {
  const response = { success: true, data };
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
}


// ════════════════════════════════════════════════════════════════
// SECTION 4 — Book Router (CRUD + Pagination + Filter + Sort)
// ════════════════════════════════════════════════════════════════

function createBookRouter() {
  const router = express.Router();

  // GET /api/books — list with pagination, filter, sort
  router.get('/', (req, res) => {
    let result = [...books];

    if (req.query.author) {
      const q = req.query.author.toLowerCase();
      result = result.filter(b => b.author.toLowerCase().includes(q));
    }
    if (req.query.genre) {
      result = result.filter(b => b.genre.toLowerCase() === req.query.genre.toLowerCase());
    }

    // WHY: ?sort=-year means descending (minus prefix convention)
    if (req.query.sort) {
      const field = req.query.sort.replace(/^-/, '');
      const order = req.query.sort.startsWith('-') ? -1 : 1;
      result.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * order);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const totalItems = result.length;
    const totalPages = Math.ceil(totalItems / limit);
    const start = (page - 1) * limit;

    envelope(res, result.slice(start, start + limit), 200, {
      page, limit, totalItems, totalPages,
      hasNextPage: page < totalPages, hasPrevPage: page > 1,
    });
  });

  router.get('/:id', validateBookId, (req, res) => envelope(res, req.book));

  router.post('/', validateBook, (req, res) => {
    const { title, author, genre, year, pages } = req.body;
    const newBook = {
      id: crypto.randomUUID(), title: title.trim(),
      author: author || 'Unknown', genre: genre || 'uncategorized',
      year: year || null, pages: pages || null, createdAt: new Date().toISOString(),
    };
    books.push(newBook);
    envelope(res, newBook, 201);
  });

  router.put('/:id', validateBookId, validateBook, (req, res) => {
    const i = books.findIndex(b => b.id === req.params.id);
    const { title, author, genre, year, pages } = req.body;
    books[i] = {
      ...books[i], title: title.trim(),
      author: author || books[i].author, genre: genre || books[i].genre,
      year: year !== undefined ? year : books[i].year,
      pages: pages !== undefined ? pages : books[i].pages,
      updatedAt: new Date().toISOString(),
    };
    envelope(res, books[i]);
  });

  router.patch('/:id', validateBookId, (req, res) => {
    const i = books.findIndex(b => b.id === req.params.id);
    const updates = {};
    ['title', 'author', 'genre', 'year', 'pages'].forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (!Object.keys(updates).length)
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    books[i] = { ...books[i], ...updates, updatedAt: new Date().toISOString() };
    envelope(res, books[i]);
  });

  router.delete('/:id', validateBookId, (req, res) => {
    const i = books.findIndex(b => b.id === req.params.id);
    const [deleted] = books.splice(i, 1);
    envelope(res, { message: 'Book deleted', book: deleted });
  });

  return router;
}


// ════════════════════════════════════════════════════════════════
// SECTION 5 — App Assembly
// ════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/books', createBookRouter());
  app.use((req, res) => res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` }));
  app.use((err, req, res, next) => {
    const sc = err.statusCode || 500;
    res.status(sc).json({ success: false, error: err.isOperational ? err.message : 'Internal Server Error' });
  });
  return app;
}


// ════════════════════════════════════════════════════════════════
// SECTION 6 — Self-Test Suite
// ════════════════════════════════════════════════════════════════

async function runTests(baseURL) {
  let passed = 0, failed = 0;

  async function test(name, fn) {
    try { await fn(); passed++; console.log(`  [PASS] ${name}`); }
    catch (e) { failed++; console.log(`  [FAIL] ${name} — ${e.message}`); }
  }
  function assert(c, m) { if (!c) throw new Error(m); }
  async function req(method, path, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${baseURL}${path}`, opts);
    return { status: r.status, body: await r.json() };
  }

  console.log('\n  PustakBhandar API — Tests');
  console.log('  ' + '─'.repeat(40));

  await test('GET /api/books returns seeded books', async () => {
    const { status, body } = await req('GET', '/api/books');
    assert(status === 200 && body.data.length === 6, `Got ${body.data.length}`);
  });

  await test('Pagination: page=1&limit=2', async () => {
    const { body } = await req('GET', '/api/books?page=1&limit=2');
    assert(body.data.length === 2 && body.pagination.totalPages === 3, 'Pagination wrong');
  });

  await test('Filter: ?author=narayan', async () => {
    const { body } = await req('GET', '/api/books?author=narayan');
    assert(body.data.length === 2, `Expected 2, got ${body.data.length}`);
  });

  await test('Sort: ?sort=-year', async () => {
    const { body } = await req('GET', '/api/books?sort=-year');
    const years = body.data.map(b => b.year);
    for (let i = 1; i < years.length; i++) assert(years[i] <= years[i - 1], 'Not sorted desc');
  });

  await test('POST creates book', async () => {
    const { status, body } = await req('POST', '/api/books', { title: 'Sea of Poppies', author: 'Amitav Ghosh' });
    assert(status === 201 && body.data.id, 'Create failed');
  });

  await test('PUT updates book', async () => {
    const all = (await req('GET', '/api/books')).body.data;
    const { status, body } = await req('PUT', `/api/books/${all[0].id}`, { title: 'Updated', author: 'Auth' });
    assert(status === 200 && body.data.title === 'Updated', 'Update failed');
  });

  await test('DELETE removes book', async () => {
    const all = (await req('GET', '/api/books?limit=100')).body;
    const count = all.pagination.totalItems;
    const id = all.data[all.data.length - 1].id;
    await req('DELETE', `/api/books/${id}`);
    const after = (await req('GET', '/api/books?limit=100')).body;
    assert(after.pagination.totalItems === count - 1, 'Delete failed');
  });

  await test('Validation: missing title returns 400', async () => {
    const { status } = await req('POST', '/api/books', { author: 'Nobody' });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test('GET /api/books/bad-id returns 404', async () => {
    const { status } = await req('GET', '/api/books/nonexistent');
    assert(status === 404, `Expected 404`);
  });

  console.log('  ' + '─'.repeat(40));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
}


// ════════════════════════════════════════════════════════════════
// SECTION 7 — Start, Test, Shutdown
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log('FILE 24 — PustakBhandar API: Full CRUD REST Project');
  seedBooks();
  const app = createApp();

  const server = app.listen(0, async () => {
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    try { await runTests(baseURL); } catch (e) { console.error(e.message); }
    finally {
      server.close(() => {
        console.log('\n  KEY TAKEAWAYS');
        console.log('  1. Express.Router groups related routes into modular sub-apps.');
        console.log('  2. Validation middleware keeps handlers clean — runs only when input is valid.');
        console.log('  3. Pagination with ?page and ?limit prevents huge responses.');
        console.log('  4. ?sort=-field (minus = desc) is a widely-adopted REST convention.');
        console.log('  5. Custom AppError with statusCode lets one handler format all errors.');
        console.log('  6. { success, data, pagination } envelope gives consumers a predictable shape.');
        process.exit(0);
      });
    }
  });
}

main();
