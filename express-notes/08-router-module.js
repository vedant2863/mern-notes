/** ============================================================
 *  FILE 08 — The Router Module in Express 5
 *  express.Router() lets you split routes into logical modules,
 *  each with their own middleware, params, and sub-routes.
 *  ============================================================ */

// ─── STORY: DMart Sections ────────────────────────────────────
// Store manager Gupta organizes DMart so each section runs
// independently with its own staff (middleware) and billing
// (routes). That's express.Router().

const express = require('express');
const http = require('http');

// ─── Helper — HTTP request
function request(port, method, urlPath, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port, path: urlPath, method, headers: { ...(headers || {}) } };
    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
      if (typeof body === 'object' && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// =============================================================
// BLOCK 1 — Basic Router with CRUD, Mounted on App
// =============================================================

async function block1() {
  console.log('=== BLOCK 1: Basic Router with CRUD Routes ===\n');
  const app = express();
  app.use(express.json());

  const groceryRouter = express.Router();

  // Router-level middleware — only runs for this router
  groceryRouter.use((req, res, next) => {
    req.section = 'Grocery';
    next();
  });

  const products = [
    { id: 1, name: 'Toor Dal', price: 189 },
    { id: 2, name: 'Basmati Rice', price: 299 },
  ];

  // Paths inside the router are relative to the mount point
  groceryRouter.get('/', (req, res) => {
    res.json({ section: req.section, products });
  });

  groceryRouter.get('/:id', (req, res) => {
    const product = products.find((p) => p.id === parseInt(req.params.id, 10));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ section: req.section, product });
  });

  groceryRouter.post('/', (req, res) => {
    const newProduct = { id: products.length + 1, ...req.body };
    products.push(newProduct);
    res.status(201).json({ section: req.section, created: newProduct });
  });

  // Mount at prefix — router doesn't know or care what prefix
  app.use('/api/products', groceryRouter);

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  DMart on port ${port}\n`);

  const r1 = await request(port, 'GET', '/api/products');
  console.log('  list:', r1.body.products.length, 'products, section:', r1.body.section);

  const r2 = await request(port, 'POST', '/api/products', { body: { name: 'Ghee', price: 549 } });
  console.log('  create:', r2.status, r2.body.created);

  const r3 = await request(port, 'GET', '/api/products/999');
  console.log('  404:', r3.status, r3.body.error);
  console.log();
  server.close();
}

// =============================================================
// BLOCK 2 — Nested Routers, router.param(), mergeParams
// =============================================================

async function block2() {
  console.log('=== BLOCK 2: Nested Routers, router.param() ===\n');
  const app = express();
  app.use(express.json());

  const customers = {
    1: { id: 1, name: 'Priya', role: 'premium' },
    2: { id: 2, name: 'Rahul', role: 'regular' },
  };
  const orders = {
    1: [{ id: 101, title: 'Weekly grocery', items: 'Dal, Rice' }],
    2: [{ id: 201, title: 'Snacks haul', items: 'Chips, Biscuits' }],
  };

  const customersRouter = express.Router();

  // router.param() — pre-process :customerId on every request
  customersRouter.param('customerId', (req, res, next, value) => {
    const customer = customers[value];
    if (!customer) return res.status(404).json({ error: `Customer ${value} not found` });
    req.customer = customer;
    next();
  });

  customersRouter.get('/', (req, res) => {
    res.json({ customers: Object.values(customers) });
  });

  customersRouter.get('/:customerId', (req, res) => {
    res.json({ customer: req.customer });
  });

  // Nested router — mergeParams: true accesses parent's :customerId
  const ordersRouter = express.Router({ mergeParams: true });

  ordersRouter.get('/', (req, res) => {
    res.json({ customer: req.customer.name, orders: orders[req.params.customerId] || [] });
  });

  ordersRouter.get('/:orderId', (req, res) => {
    const list = orders[req.params.customerId] || [];
    const order = list.find((o) => o.id === parseInt(req.params.orderId, 10));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ customer: req.customer.name, order });
  });

  customersRouter.use('/:customerId/orders', ordersRouter);
  app.use('/api/customers', customersRouter);

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`  Nested sections on port ${port}\n`);

  const r1 = await request(port, 'GET', '/api/customers/1');
  console.log('  customer:', r1.body.customer);

  const r2 = await request(port, 'GET', '/api/customers/1/orders');
  console.log('  orders:', r2.body.customer, r2.body.orders.length, 'orders');

  const r3 = await request(port, 'GET', '/api/customers/1/orders/101');
  console.log('  order:', r3.body.order);

  const r4 = await request(port, 'GET', '/api/customers/99');
  console.log('  param 404:', r4.status, r4.body.error);
  console.log();
  server.close();
}

// =============================================================
// RUN ALL BLOCKS
// =============================================================
async function main() {
  await block1();
  await block2();

  console.log('=== KEY TAKEAWAYS ===\n');
  console.log('  1. express.Router() creates a mini-app with its own middleware and routes.');
  console.log('  2. Mount with app.use(\'/prefix\', router) — routes inside are relative.');
  console.log('  3. router.param(name, handler) pre-loads resources for named params.');
  console.log('  4. Nest routers with mergeParams: true to access parent params.');
  console.log('  5. router.route(\'/path\') chains .get().post() — reduces repetition.');
  console.log('  6. One file per resource, each exporting a router — clean modular code.\n');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
