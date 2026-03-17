/** ============================================================
 *  FILE 25: DigiLocker Dwar — Authentication Server Project
 *  ============================================================ */

// STORY: Kavita's document vault needs a gateway (dwar) that
// checks WHO you are (auth), WHAT you can do (roles), and
// remembers you (JWT). Built from scratch with Node crypto.

const express = require('express');
const crypto = require('crypto');


// ════════════════════════════════════════════════════════════════
// SECTION 1 — Config & Stores
// ════════════════════════════════════════════════════════════════

const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = 60;
const REFRESH_EXPIRES_IN = 300;

const users = [];
const refreshTokens = new Map();
const blacklistedTokens = new Set();


// ════════════════════════════════════════════════════════════════
// SECTION 2 — Password Hashing (crypto.scrypt)
// ════════════════════════════════════════════════════════════════
// WHY: scrypt is memory-hard — resistant to GPU brute-force.

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve({ hash: key.toString('hex'), salt });
    });
  });
}

function verifyPassword(password, hash, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      // WHY: timingSafeEqual prevents timing attacks
      resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key));
    });
  });
}


// ════════════════════════════════════════════════════════════════
// SECTION 3 — JWT from Scratch
// ════════════════════════════════════════════════════════════════
// JWT = base64url(header).base64url(payload).HMAC-SHA256-signature

function base64urlEncode(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  const padded = str + '='.repeat((4 - str.length % 4) % 4);
  return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
}

function createJWT(payload, expiresIn = JWT_EXPIRES_IN) {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + expiresIn, jti: crypto.randomUUID() };
  const header = base64urlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64urlEncode(full);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`)
    .digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return { token: `${header}.${body}.${sig}`, payload: full };
}

function verifyJWT(token) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return { valid: false, error: 'Malformed token' };
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`)
      .digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (expected !== s) return { valid: false, error: 'Invalid signature' };
    const payload = base64urlDecode(p);
    if (payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, error: 'Token expired' };
    if (blacklistedTokens.has(payload.jti)) return { valid: false, error: 'Token has been revoked' };
    return { valid: true, payload };
  } catch { return { valid: false, error: 'Token verification failed' }; }
}


// ════════════════════════════════════════════════════════════════
// SECTION 4 — Refresh Tokens
// ════════════════════════════════════════════════════════════════

function createRefreshToken(userId) {
  const id = crypto.randomUUID();
  refreshTokens.set(id, { userId, expiresAt: Date.now() + REFRESH_EXPIRES_IN * 1000 });
  return id;
}

function verifyRefreshToken(id) {
  const stored = refreshTokens.get(id);
  if (!stored) return { valid: false, error: 'Refresh token not found' };
  if (stored.expiresAt < Date.now()) { refreshTokens.delete(id); return { valid: false, error: 'Expired' }; }
  return { valid: true, userId: stored.userId };
}


// ════════════════════════════════════════════════════════════════
// SECTION 5 — Auth Middleware
// ════════════════════════════════════════════════════════════════

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Bearer token required' });
  const result = verifyJWT(h.slice(7));
  if (!result.valid) return res.status(401).json({ success: false, error: result.error });
  req.user = result.payload;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ success: false, error: `Required: ${roles.join(' or ')}` });
    next();
  };
}


// ════════════════════════════════════════════════════════════════
// SECTION 6 — Routes
// ════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  const r = express.Router();

  r.post('/register', async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
      if (password.length < 6) return res.status(400).json({ success: false, error: 'Password min 6 chars' });
      if (users.find(u => u.username === username)) return res.status(409).json({ success: false, error: 'Username exists' });
      const { hash, salt } = await hashPassword(password);
      const user = { id: crypto.randomUUID(), username, passwordHash: hash, salt, role: role === 'admin' ? 'admin' : 'user', createdAt: new Date().toISOString() };
      users.push(user);
      res.status(201).json({ success: true, data: { id: user.id, username: user.username, role: user.role } });
    } catch { res.status(500).json({ success: false, error: 'Registration failed' }); }
  });

  r.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ success: false, error: 'Credentials required' });
      const user = users.find(u => u.username === username);
      // WHY: Generic message prevents username enumeration
      if (!user || !(await verifyPassword(password, user.passwordHash, user.salt)))
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      const { token } = createJWT({ sub: user.id, username: user.username, role: user.role });
      res.json({ success: true, data: { accessToken: token, refreshToken: createRefreshToken(user.id), user: { id: user.id, username: user.username, role: user.role } } });
    } catch { res.status(500).json({ success: false, error: 'Login failed' }); }
  });

  r.get('/profile', authMiddleware, (req, res) => {
    const user = users.find(u => u.id === req.user.sub);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { id: user.id, username: user.username, role: user.role } });
  });

  r.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token required' });
    const result = verifyRefreshToken(refreshToken);
    if (!result.valid) return res.status(401).json({ success: false, error: result.error });
    refreshTokens.delete(refreshToken); // WHY: Rotation — old token invalidated
    const user = users.find(u => u.id === result.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const { token } = createJWT({ sub: user.id, username: user.username, role: user.role });
    res.json({ success: true, data: { accessToken: token, refreshToken: createRefreshToken(user.id) } });
  });

  r.post('/logout', authMiddleware, (req, res) => {
    blacklistedTokens.add(req.user.jti);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  });

  r.get('/admin', authMiddleware, requireRole('admin'), (req, res) => {
    res.json({ success: true, data: { message: 'Welcome to the admin panel', userCount: users.length } });
  });

  r.get('/users', authMiddleware, requireRole('admin'), (req, res) => {
    res.json({ success: true, data: users.map(u => ({ id: u.id, username: u.username, role: u.role })) });
  });

  app.use('/auth', r);
  app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));
  return app;
}


// ════════════════════════════════════════════════════════════════
// SECTION 7 — Self-Test Suite
// ════════════════════════════════════════════════════════════════

async function runTests(baseURL) {
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
    return { status: r.status, body: await r.json() };
  }

  let accessToken = '', refreshTokenVal = '', adminToken = '';

  console.log('\n  DigiLocker Dwar — Tests');
  console.log('  ' + '─'.repeat(40));

  await test('Register user', async () => {
    const { status, body } = await req('POST', '/auth/register', { username: 'ananya', password: 'aadhaar123' });
    assert(status === 201 && body.data.role === 'user', 'Register failed');
  });

  await test('Register admin', async () => {
    const { status } = await req('POST', '/auth/register', { username: 'vikash', password: 'admin_pass1', role: 'admin' });
    assert(status === 201, 'Admin register failed');
  });

  await test('Duplicate username 409', async () => {
    assert((await req('POST', '/auth/register', { username: 'ananya', password: 'other' })).status === 409, '');
  });

  await test('Login returns tokens', async () => {
    const { status, body } = await req('POST', '/auth/login', { username: 'ananya', password: 'aadhaar123' });
    assert(status === 200 && body.data.accessToken, 'Login failed');
    accessToken = body.data.accessToken;
    refreshTokenVal = body.data.refreshToken;
  });

  await test('Wrong password 401', async () => {
    assert((await req('POST', '/auth/login', { username: 'ananya', password: 'wrong' })).status === 401, '');
  });

  await test('Profile with token', async () => {
    const { status, body } = await req('GET', '/auth/profile', null, { Authorization: `Bearer ${accessToken}` });
    assert(status === 200 && body.data.username === 'ananya', 'Profile failed');
  });

  await test('Profile without token 401', async () => {
    assert((await req('GET', '/auth/profile')).status === 401, '');
  });

  await test('Refresh rotates tokens', async () => {
    const { body } = await req('POST', '/auth/refresh', { refreshToken: refreshTokenVal });
    assert(body.data.refreshToken !== refreshTokenVal, 'Not rotated');
    accessToken = body.data.accessToken;
    refreshTokenVal = body.data.refreshToken;
  });

  await test('Admin route — admin allowed', async () => {
    const login = await req('POST', '/auth/login', { username: 'vikash', password: 'admin_pass1' });
    adminToken = login.body.data.accessToken;
    const { status } = await req('GET', '/auth/admin', null, { Authorization: `Bearer ${adminToken}` });
    assert(status === 200, 'Admin blocked');
  });

  await test('Admin route — user blocked 403', async () => {
    assert((await req('GET', '/auth/admin', null, { Authorization: `Bearer ${accessToken}` })).status === 403, '');
  });

  await test('Logout invalidates token', async () => {
    await req('POST', '/auth/logout', null, { Authorization: `Bearer ${accessToken}` });
    const { status, body } = await req('GET', '/auth/profile', null, { Authorization: `Bearer ${accessToken}` });
    assert(status === 401 && body.error.includes('revoked'), 'Token not revoked');
  });

  console.log('  ' + '─'.repeat(40));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
}


// ════════════════════════════════════════════════════════════════
// SECTION 8 — Start, Test, Shutdown
// ════════════════════════════════════════════════════════════════

async function main() {
  console.log('FILE 25 — DigiLocker Dwar: Auth Server');
  const app = createApp();
  const server = app.listen(0, async () => {
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    try { await runTests(baseURL); } catch (e) { console.error(e.message); }
    finally {
      server.close(() => {
        console.log('\n  KEY TAKEAWAYS');
        console.log('  1. crypto.scrypt is memory-hard hashing built into Node.');
        console.log('  2. JWT = header.payload.HMAC-SHA256 — three dot-separated parts.');
        console.log('  3. Short-lived access + refresh token rotation balances security/usability.');
        console.log('  4. Token blacklisting (by jti) enables logout for stateless JWTs.');
        console.log('  5. requireRole("admin") is a factory returning middleware.');
        console.log('  6. timingSafeEqual prevents timing attacks on hash comparisons.');
        console.log('  7. Generic "Invalid credentials" prevents username enumeration.');
        process.exit(0);
      });
    }
  });
}

main();
