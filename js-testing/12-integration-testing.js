// ============================================================
// FILE 12: INTEGRATION TESTING
// Topic: Testing multiple units working together as a system
// WHY: Unit tests verify individual functions, but real bugs
//   hide in the CONNECTIONS between components. Integration tests
//   catch timing issues, data mismatches, and ordering problems.
// ============================================================

// ============================================================
// STORY — BookMyShow Booking Flow
// Every unit test passed. But in production, the seat lock expired
// (2 min) before payment completed (3+ min during peak load).
// Integration tests running the FULL pipeline would have caught
// this timing bug immediately.
// ============================================================

// ============================================================
// BLOCK 1 — Unit vs Integration
// SECTION: The core difference
// ============================================================

console.log("--- Unit vs Integration ---");
console.log("Unit:        Test ONE function, mock everything else");
console.log("Integration: Test MULTIPLE functions working together");
console.log("E2E:         Test the entire app as a real user\n");

console.log("What to integration test:");
console.log("  1. API endpoints (request -> middleware -> handler -> response)");
console.log("  2. Database operations (CRUD with real database)");
console.log("  3. Service interactions (service A calls service B)");
console.log("  4. Middleware chains (auth -> validation -> handler)\n");


// ============================================================
// BLOCK 2 — Testing API Endpoints with Supertest
// SECTION: Full request cycle without a running server
// ============================================================

// supertest makes real HTTP requests to your Express app WITHOUT
// starting a server. Tests the entire middleware chain.

// describe('BookMyShow API', () => {
//   test('GET /api/shows without token returns 401', async () => {
//     const response = await request(app).get('/api/shows');
//     expect(response.status).toBe(401);
//   });
//   test('POST /api/bookings creates a booking', async () => {
//     const response = await request(app)
//       .post('/api/bookings')
//       .set('Authorization', 'Bearer valid-token')
//       .send({ showId: 1, seatNumber: 'A12' });
//     expect(response.status).toBe(201);
//     expect(response.body.booking.status).toBe('confirmed');
//   });
// });

function simulateAPI(method, path, token, body) {
  if (!token && path.startsWith('/api')) {
    return { status: 401, body: { error: 'No token provided' } };
  }
  if (method === 'GET' && path === '/api/shows') {
    return { status: 200, body: { shows: [
      { id: 1, movie: 'Jawan', theater: 'PVR Phoenix' },
      { id: 2, movie: 'Pathaan', theater: 'INOX Nariman Point' }
    ]}};
  }
  if (method === 'POST' && path === '/api/bookings') {
    if (!body.showId || !body.seatNumber) {
      return { status: 400, body: { error: 'showId and seatNumber required' } };
    }
    return { status: 201, body: { booking: { id: 'BMS-' + Date.now(), ...body, status: 'confirmed' } } };
  }
}

console.log("--- Supertest API Tests ---");
const t1 = simulateAPI('GET', '/api/shows', null, {});
console.log("No auth:", t1.status === 401 ? 'PASS' : 'FAIL');

const t2 = simulateAPI('POST', '/api/bookings', 'token', { showId: 1, seatNumber: 'A12' });
console.log("Booking:", t2.status === 201 ? 'PASS' : 'FAIL', "Status:", t2.body.booking.status);
console.log("");


// ============================================================
// BLOCK 3 — Database Integration Tests
// SECTION: Using real constraints, not mocked databases
// ============================================================

// Mocking the database tells you nothing about whether your SQL
// queries work, indexes are used, or constraints are enforced.

class InMemoryDB {
  constructor() { this.shows = []; this.bookings = []; }

  addShow(show) { this.shows.push(show); }

  createBooking(showId, userId, seatNumber) {
    const show = this.shows.find(s => s.id === showId);
    if (!show) throw new Error('FOREIGN KEY: Show does not exist');
    const dup = this.bookings.find(b => b.showId === showId && b.seatNumber === seatNumber);
    if (dup) throw new Error('UNIQUE constraint: Seat already booked');
    const booking = { id: this.bookings.length + 1, showId, userId, seatNumber, status: 'confirmed' };
    this.bookings.push(booking);
    return booking;
  }

  getAvailableSeats(showId) {
    const show = this.shows.find(s => s.id === showId);
    const booked = this.bookings.filter(b => b.showId === showId).length;
    return show.totalSeats - booked;
  }
}

const db = new InMemoryDB();
db.addShow({ id: 1, movie: 'Jawan', totalSeats: 100 });

console.log("--- Database Integration Tests ---");
console.log("Create booking:", db.createBooking(1, 101, 'A12'));

try { db.createBooking(1, 102, 'A12'); }
catch (e) { console.log("Double booking prevented:", e.message); }

try { db.createBooking(999, 103, 'B1'); }
catch (e) { console.log("Foreign key enforced:", e.message); }

db.createBooking(1, 104, 'A2');
console.log("Available seats:", db.getAvailableSeats(1), "(expected 98)");
console.log("");


// ============================================================
// BLOCK 4 — Service-to-Service Interactions
// SECTION: Mock EXTERNAL, let INTERNAL run for real
// ============================================================

class SeatService {
  constructor(db) { this.db = db; }
  lockSeat(showId, seatNumber) {
    const existing = this.db.bookings.find(b => b.showId === showId && b.seatNumber === seatNumber);
    if (existing) return { locked: false, reason: 'Seat already taken' };
    return { locked: true, showId, seatNumber, expiresAt: Date.now() + 120000 };
  }
}

class BookingService {
  constructor(seatService, paymentGateway) {
    this.seatService = seatService;
    this.paymentGateway = paymentGateway;
  }

  async createBooking(showId, seatNumber, userId, paymentDetails) {
    const lock = this.seatService.lockSeat(showId, seatNumber);
    if (!lock.locked) return { success: false, error: lock.reason };

    const payment = await this.paymentGateway.charge(paymentDetails);
    if (!payment.success) return { success: false, error: 'Payment failed: ' + payment.error };

    return { success: true, booking: { showId, seatNumber, userId, paymentId: payment.transactionId } };
  }
}

// Mock ONLY the external payment gateway
const mockPayment = {
  async charge(details) {
    if (details.amount <= 0) return { success: false, error: 'Invalid amount' };
    return { success: true, transactionId: 'PAY_' + Date.now(), amount: details.amount };
  }
};

const integrationDb = new InMemoryDB();
integrationDb.addShow({ id: 1, movie: 'Jawan', totalSeats: 100 });
const seatService = new SeatService(integrationDb);
const bookingService = new BookingService(seatService, mockPayment);

(async () => {
  console.log("--- Service Integration Tests ---");
  const good = await bookingService.createBooking(1, 'C7', 101, { amount: 350 });
  console.log("Booking:", good.success ? 'PASS' : 'FAIL');

  const dup = await bookingService.createBooking(1, 'C7', 102, { amount: 350 });
  console.log("Duplicate seat:", !dup.success ? 'PASS' : 'FAIL');

  const bad = await bookingService.createBooking(1, 'D1', 103, { amount: -100 });
  console.log("Bad payment:", !bad.success ? 'PASS' : 'FAIL');
})();


// ============================================================
// BLOCK 5 — Middleware Chain Testing
// SECTION: Verifying the full chain runs in order
// ============================================================

function runMiddlewareChain(middlewares, req) {
  let response = null;
  const res = {
    status(code) { this._code = code; return this; },
    json(data) { response = { status: this._code || 200, ...data }; }
  };
  let i = 0;
  function next() { if (i < middlewares.length) middlewares[i++](req, res, next); }
  next();
  return response || { status: 200, message: 'OK' };
}

const chain = [
  (req, res, next) => {
    if (!req.headers.authorization) { res.status(401).json({ error: 'No token' }); return; }
    req.userId = 'user1'; next();
  },
  (req, res, next) => {
    if (!req.body.showId) { res.status(400).json({ error: 'showId required' }); return; }
    next();
  },
  (req, res, next) => {
    res.status(200).json({ message: 'Booking confirmed', user: req.userId });
  }
];

console.log("\n--- Middleware Chain Tests ---");
console.log("No auth:", runMiddlewareChain(chain, { headers: {}, body: {} }));
console.log("No body:", runMiddlewareChain(chain, { headers: { authorization: 'Bearer x' }, body: {} }));
console.log("Valid:", runMiddlewareChain(chain, { headers: { authorization: 'Bearer x' }, body: { showId: 1 } }));


// ============================================================
// BLOCK 6 — Test Patterns & Isolation
// SECTION: What to test and how to keep tests independent
// ============================================================

console.log("\n--- Integration Test Patterns ---");
console.log("1. HAPPY PATH: Full flow succeeds end-to-end");
console.log("2. PARTIAL FAILURE: One step fails, verify cleanup/rollback");
console.log("3. CONCURRENCY: Two users booking same seat simultaneously");
console.log("4. TIMEOUT: Downstream service is slow, booking fails gracefully");

console.log("\n--- Test Isolation ---");
console.log("1. SEPARATE DATABASE: Dedicated test DB, never share with dev/prod");
console.log("2. TRANSACTION ROLLBACK: Wrap each test in BEGIN/ROLLBACK");
console.log("3. UNIQUE IDS: Prefix test data with unique run ID, clean up after\n");


// ============================================================
// BLOCK 7 — Full Booking API Integration Test
// SECTION: Complete flow with all verifications
// ============================================================

class BookingAPI {
  constructor() { this.users = new Map(); this.shows = new Map(); this.bookings = new Map(); }

  createUser(name, email) {
    const id = 'user_' + (this.users.size + 1);
    const user = { id, name, email, verified: true };
    this.users.set(id, user);
    return { status: 201, body: user };
  }

  listShows(city) {
    const shows = Array.from(this.shows.values()).filter(s => !city || s.city === city);
    return { status: 200, body: { shows, count: shows.length } };
  }

  createBooking(userId, showId, seatId) {
    if (!this.users.has(userId)) return { status: 404, body: { error: 'User not found' } };
    if (!this.shows.has(showId)) return { status: 404, body: { error: 'Show not found' } };
    const taken = Array.from(this.bookings.values()).find(b => b.showId === showId && b.seatId === seatId);
    if (taken) return { status: 409, body: { error: 'Seat already booked' } };
    const bookingId = 'BK_' + (this.bookings.size + 1);
    const booking = { id: bookingId, userId, showId, seatId, status: 'confirmed' };
    this.bookings.set(bookingId, booking);
    return { status: 201, body: booking };
  }

  seedShows() {
    [{ id: 'show_1', title: 'Pushpa 2', city: 'Mumbai', seats: ['A1','A2','A3','B1','B2'] },
     { id: 'show_2', title: 'Jawan', city: 'Delhi', seats: ['A1','A2','A3'] }]
    .forEach(s => this.shows.set(s.id, s));
  }
}

console.log("--- Full Booking API Integration Test ---");
const api = new BookingAPI();
api.seedShows();

const user = api.createUser('Arjun Kapoor', 'arjun@test.com');
console.log("1. Create user:", user.status === 201 ? 'PASS' : 'FAIL');

const shows = api.listShows('Mumbai');
console.log("2. List Mumbai shows:", shows.body.count === 1 ? 'PASS' : 'FAIL');

const booking = api.createBooking(user.body.id, 'show_1', 'A1');
console.log("3. Book seat A1:", booking.status === 201 ? 'PASS' : 'FAIL');

const duplicate = api.createBooking(user.body.id, 'show_1', 'A1');
console.log("4. Duplicate blocked:", duplicate.status === 409 ? 'PASS' : 'FAIL');

const badShow = api.createBooking(user.body.id, 'show_999', 'A1');
console.log("5. Bad show:", badShow.status === 404 ? 'PASS' : 'FAIL');


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Integration tests verify MULTIPLE units working together.
//    They catch bugs in the gaps between components.
// 2. Use supertest to test Express/Fastify APIs without a server.
// 3. Use a REAL test database (SQLite in-memory or dedicated DB).
// 4. Mock EXTERNAL services (payment gateways), let INTERNAL
//    services communicate for real.
// 5. Four patterns: happy path, partial failure, concurrency, timeout.
// 6. Isolate tests: separate DB, transaction rollback, unique IDs.
// 7. Integration tests are slower — run them separately and
//    focus on critical paths, not exhaustive coverage.
// ============================================================
