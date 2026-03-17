/** ============================================================
 *  FILE 27: UMANG Dwar — API Gateway Project
 *  ============================================================ */

// STORY: Anuradha ji's UMANG portal had 47 APIs in one file.
// Her architect said: "Build a dwar (gateway) — version routes,
// group into sub-routers, handle cross-cutting concerns once."

const express = require('express');
const crypto = require('crypto');


// ════════════════════════════════════════════════════════════════
// SECTION 1 — Data Stores & Auth
// ════════════════════════════════════════════════════════════════

const dataStores = {
  users: [
    { id: 'u1', name: 'Aarti', email: 'aarti@uidai.gov.in', role: 'admin' },
    { id: 'u2', name: 'Bharat', email: 'bharat@citizen.gov.in', role: 'user' },
  ],
  products: [
    { id: 'p1', name: 'PM Kisan Samman', price: 6000, category: 'agriculture' },
    { id: 'p2', name: 'Ayushman Bharat', price: 500000, category: 'health' },
    { id: 'p3', name: 'Atal Pension Yojana', price: 5000, category: 'finance' },
  ],
  orders: [
    { id: 'o1', userId: 'u2', productId: 'p1', quantity: 1, status: 'shipped', total: 6000 },
  ],
};

const validTokens = new Map();
function generateToken(userId, role) {
  const token = crypto.randomBytes(24).toString('hex');
  validTokens.set(token, { userId, role, createdAt: Date.now() });
  return token;
}


// ════════════════════════════════════════════════════════════════
// SECTION 2 — Cross-Cutting Middleware
// ════════════════════════════════════════════════════════════════

function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

function responseTimeMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = function (statusCode, ...args) {
    res.setHeader('X-Response-Time', `${(Number(process.hrtime.bigint() - start) / 1e6).toFixed(2)}ms`);
    return origWriteHead(statusCode, ...args);
  };
  next();
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Authentication required', requestId: req.requestId });
  const data = validTokens.get(h.slice(7));
  if (!data) return res.status(401).json({ success: false, error: 'Invalid token', requestId: req.requestId });
  req.user = data;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success: false, error: 'Admin access required', requestId: req.requestId });
  next();
}


// ════════════════════════════════════════════════════════════════
// SECTION 3 — Sub-Routers
// ════════════════════════════════════════════════════════════════

// --- Users V1 (public list, admin create) ---
function createUsersRouterV1() {
  const r = express.Router();
  r.get('/', (req, res) => {
    res.json({ success: true, data: dataStores.users.map(u => ({ id: u.id, name: u.name, role: u.role })), requestId: req.requestId });
  });
  r.get('/:id', (req, res) => {
    const user = dataStores.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found', requestId: req.requestId });
    res.json({ success: true, data: user, requestId: req.requestId });
  });
  r.post('/', authMiddleware, requireAdmin, (req, res) => {
    const { name, email, role } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: 'Name and email required', requestId: req.requestId });
    const u = { id: `u${dataStores.users.length + 1}`, name, email, role: role || 'user' };
    dataStores.users.push(u);
    res.status(201).json({ success: true, data: u, requestId: req.requestId });
  });
  return r;
}

// --- Users V2 (pagination + HATEOAS links) ---
function createUsersRouterV2() {
  const r = express.Router();
  r.get('/', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const start = (page - 1) * limit;
    res.json({
      success: true,
      data: dataStores.users.slice(start, start + limit).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      pagination: { page, limit, total: dataStores.users.length, totalPages: Math.ceil(dataStores.users.length / limit) },
      apiVersion: 'v2', requestId: req.requestId,
    });
  });
  r.get('/:id', (req, res) => {
    const user = dataStores.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'Not found', requestId: req.requestId });
    res.json({
      success: true, data: { ...user },
      links: { self: `/api/v2/users/${user.id}`, orders: `/api/v2/orders?userId=${user.id}` },
      apiVersion: 'v2', requestId: req.requestId,
    });
  });
  return r;
}

// --- Products ---
function createProductsRouter() {
  const r = express.Router();
  r.get('/', (req, res) => {
    let result = [...dataStores.products];
    if (req.query.category) result = result.filter(p => p.category.toLowerCase() === req.query.category.toLowerCase());
    res.json({ success: true, data: result, requestId: req.requestId });
  });
  r.get('/:id', (req, res) => {
    const p = dataStores.products.find(p => p.id === req.params.id);
    if (!p) return res.status(404).json({ success: false, error: 'Not found', requestId: req.requestId });
    res.json({ success: true, data: p, requestId: req.requestId });
  });
  return r;
}

// --- Orders (all routes auth-protected) ---
function createOrdersRouter() {
  const r = express.Router();
  r.use(authMiddleware);

  r.get('/', (req, res) => {
    let orders = [...dataStores.orders];
    if (req.user.role !== 'admin') orders = orders.filter(o => o.userId === req.user.userId);
    res.json({ success: true, data: orders, requestId: req.requestId });
  });
  r.post('/', (req, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) return res.status(400).json({ success: false, error: 'productId and quantity required', requestId: req.requestId });
    const product = dataStores.products.find(p => p.id === productId);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found', requestId: req.requestId });
    const o = { id: `o${dataStores.orders.length + 1}`, userId: req.user.userId, productId, quantity, status: 'pending', total: product.price * quantity };
    dataStores.orders.push(o);
    res.status(201).json({ success: true, data: o, requestId: req.requestId });
  });
  return r;
}


// ════════════════════════════════════════════════════════════════
// SECTION 4 — App Assembly
// ════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.locals.startTime = Date.now();
  app.locals.logs = [];

  app.use(requestIdMiddleware);
  app.use(responseTimeMiddleware);
  // Logger
  app.use((req, res, next) => {
    res.on('finish', () => {
      app.locals.logs.push(`[${req.requestId?.slice(0, 8)}] ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
    });
    next();
  });
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'healthy', uptime: `${((Date.now() - app.locals.startTime) / 1000).toFixed(1)}s` }, requestId: req.requestId });
  });

  app.post('/auth/token', (req, res) => {
    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    res.json({ success: true, data: { token: generateToken(userId, role || 'user'), userId, role: role || 'user' }, requestId: req.requestId });
  });

  // WHY: Self-documenting endpoint — developers discover routes without reading source
  app.get('/api', (req, res) => {
    res.json({ success: true, data: { name: 'UMANG Dwar API Gateway', endpoints: {
      v1: { 'GET /api/v1/users': 'List users', 'POST /api/v1/users': 'Create (admin)', 'GET /api/v1/products': 'List schemes', 'GET /api/v1/orders': 'List orders (auth)' },
      v2: { 'GET /api/v2/users': 'Paginated users', 'GET /api/v2/users/:id': 'User with links' },
    }}, requestId: req.requestId });
  });

  // WHY: v1 and v2 coexist — old clients keep working
  app.use('/api/v1/users', createUsersRouterV1());
  app.use('/api/v1/products', createProductsRouter());
  app.use('/api/v1/orders', createOrdersRouter());
  app.use('/api/v2/users', createUsersRouterV2());

  app.use((req, res) => res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found`, hint: 'Visit GET /api', requestId: req.requestId }));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, error: err.message || 'ISE', requestId: req.requestId }));

  return app;
}


// ════════════════════════════════════════════════════════════════
// SECTION 5 — Self-Test Suite
// ════════════════════════════════════════════════════════════════

async function runTests(baseURL, app) {
  let passed = 0, failed = 0;
  async function test(name, fn) {
    try { await fn(); passed++; console.log(`  [PASS] ${name}`); }
    catch (e) { failed++; console.log(`  [FAIL] ${name} — ${e.message}`); }
  }
  function assert(c, m) { if (!c) throw new Error(m); }
  async function req(method, path, body = null, headers = {}) {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${baseURL}${path}`, opts);
    return { status: r.status, body: await r.json(), headers: r.headers };
  }

  let adminToken = '', userToken = '';

  console.log('\n  UMANG Dwar — Tests');
  console.log('  ' + '─'.repeat(40));

  await test('Health check', async () => {
    const { status, body, headers } = await req('GET', '/health');
    assert(status === 200 && body.data.status === 'healthy', 'Health failed');
    assert(headers.get('x-request-id'), 'Missing request ID');
    assert(headers.get('x-response-time'), 'Missing response time');
  });

  await test('Custom X-Request-ID propagated', async () => {
    const { headers } = await req('GET', '/health', null, { 'X-Request-ID': 'custom-123' });
    assert(headers.get('x-request-id') === 'custom-123', 'Not propagated');
  });

  await test('API docs', async () => {
    const { body } = await req('GET', '/api');
    assert(body.data.endpoints.v1 && body.data.endpoints.v2, 'Missing endpoints');
  });

  await test('Generate tokens', async () => {
    adminToken = (await req('POST', '/auth/token', { userId: 'u1', role: 'admin' })).body.data.token;
    userToken = (await req('POST', '/auth/token', { userId: 'u2', role: 'user' })).body.data.token;
    assert(adminToken && userToken, 'Token gen failed');
  });

  await test('V1 users (public, no email)', async () => {
    const { body } = await req('GET', '/api/v1/users');
    assert(body.data.length >= 2 && !body.data[0].email, 'List failed');
  });

  await test('V1 create user (admin only)', async () => {
    const userRes = await req('POST', '/api/v1/users', { name: 'D', email: 'd@e.in' }, { Authorization: `Bearer ${userToken}` });
    assert(userRes.status === 403, 'User should be blocked');
    const adminRes = await req('POST', '/api/v1/users', { name: 'D', email: 'd@e.in' }, { Authorization: `Bearer ${adminToken}` });
    assert(adminRes.status === 201, 'Admin should succeed');
  });

  await test('V1 products filter', async () => {
    const { body } = await req('GET', '/api/v1/products?category=health');
    assert(body.data.length === 1 && body.data[0].category === 'health', 'Filter failed');
  });

  await test('V1 orders require auth', async () => {
    assert((await req('GET', '/api/v1/orders')).status === 401, 'Should require auth');
    const { status } = await req('GET', '/api/v1/orders', null, { Authorization: `Bearer ${adminToken}` });
    assert(status === 200, 'Admin should see orders');
  });

  await test('V1 create order', async () => {
    const { status, body } = await req('POST', '/api/v1/orders', { productId: 'p3', quantity: 10 }, { Authorization: `Bearer ${userToken}` });
    assert(status === 201 && body.data.total === 50000, 'Order calc wrong');
  });

  await test('V2 users pagination', async () => {
    const { body } = await req('GET', '/api/v2/users?page=1&limit=1');
    assert(body.data.length === 1 && body.pagination && body.apiVersion === 'v2', 'Pagination failed');
  });

  await test('V2 user HATEOAS links', async () => {
    const { body } = await req('GET', '/api/v2/users/u1');
    assert(body.links?.self === '/api/v2/users/u1', 'Missing links');
  });

  await test('404 with hint', async () => {
    const { status, body } = await req('GET', '/api/v1/unknown');
    assert(status === 404 && body.hint, '404 hint missing');
  });

  await test('Logs captured', async () => {
    assert(app.locals.logs.length > 0 && app.locals.logs.some(l => l.includes('/health')), 'No logs');
  });

  console.log('  ' + '─'.repeat(40));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
}


// ════════════════════════════════════════════════════════════════
// SECTION 6 — Start, Test, Shutdown
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log('FILE 27 — UMANG Dwar: API Gateway');
  const app = createApp();
  const server = app.listen(0, async () => {
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    try { await runTests(baseURL, app); } catch (e) { console.error(e.message); }
    finally {
      server.close(() => {
        console.log('\n  KEY TAKEAWAYS');
        console.log('  1. API versioning (/api/v1, /api/v2) evolves endpoints without breaking clients.');
        console.log('  2. Sub-routers keep each domain encapsulated and independently testable.');
        console.log('  3. X-Request-ID traces a request through every middleware and log.');
        console.log('  4. X-Response-Time measures server-side latency for monitoring.');
        console.log('  5. GET /api as self-documenting endpoint saves reading source code.');
        console.log('  6. Auth middleware can apply per-router (all orders) or per-route (create user).');
        console.log('  7. Graceful shutdown: stop new connections, finish in-flight, clean up.');
        process.exit(0);
      });
    }
  });
}

main();
