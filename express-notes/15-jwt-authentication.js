/** ============================================================
 *  FILE 15 — JWT Authentication from Scratch
 *  Topic: Build JWT sign/verify, auth middleware, RBAC
 *  ============================================================ */

// ── THE STORY ──────────────────────────────────────────────
// DigiLocker Authentication
// Officer Meena issues digitally signed access passes (tokens).
// Each has three parts: cover (header), pages with holder info
// and expiry (payload), and an official stamp (signature).
// Service counters verify the stamp locally — no HQ call needed.
// Tampered pages won't match the stamp. Expired passes require
// renewal (refresh token).
// ───────────────────────────────────────────────────────────

const express = require('express');
const crypto = require('crypto');

const JWT_SECRET = 'digilocker-seal-ultra-secret-key-2025';
const REFRESH_SECRET = 'digilocker-refresh-seal-even-more-secret';

// ============================================================
// BLOCK 1 — JWT Sign & Verify from Scratch
// ============================================================
// JWT = header.payload.signature (base64url-encoded, dot-separated)
// Signature = HMAC-SHA256(header + "." + payload, secret)
// Anyone can DECODE a JWT. Only the server can VERIFY it.

function base64UrlEncode(data) {
  const str = typeof data === 'string'
    ? Buffer.from(data, 'utf8').toString('base64')
    : Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
}

function createSignature(headerB64, payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function jwtSign(payload, secret, options = {}) {
  const { expiresIn = 3600 } = options;
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };
  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(fullPayload);
  return `${headerB64}.${payloadB64}.${createSignature(headerB64, payloadB64, secret)}`;
}

function jwtVerify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, error: 'Token must have 3 parts' };
  const [headerB64, payloadB64, providedSig] = parts;

  let header;
  try { header = JSON.parse(base64UrlDecode(headerB64)); } catch { return { valid: false, error: 'Invalid header' }; }
  if (header.alg !== 'HS256') return { valid: false, error: `Unsupported algorithm: ${header.alg}` };

  const expectedSig = createSignature(headerB64, payloadB64, secret);
  const sigBuf = Buffer.from(providedSig), expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid signature — token may have been tampered with' };
  }

  let payload;
  try { payload = JSON.parse(base64UrlDecode(payloadB64)); } catch { return { valid: false, error: 'Invalid payload' }; }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, error: 'Token has expired', expired: true };

  return { valid: true, payload };
}

function jwtDecode(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try { return { header: JSON.parse(base64UrlDecode(parts[0])), payload: JSON.parse(base64UrlDecode(parts[1])) }; }
  catch { return null; }
}

// ============================================================
// BLOCK 2 — Auth Middleware + Protected Routes
// ============================================================
// Flow: POST /login → get JWT → Authorization: Bearer <token>

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, error: { message: 'No Authorization header' } });
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, error: { message: 'Must use Bearer scheme' } });

  const result = jwtVerify(authHeader.slice(7), JWT_SECRET);
  if (!result.valid) return res.status(result.expired ? 401 : 403).json({
    success: false, error: { message: result.error, ...(result.expired && { code: 'TOKEN_EXPIRED' }) }
  });

  req.user = result.payload;
  next();
}

// ============================================================
// BLOCK 3 — Refresh Tokens + RBAC
// ============================================================
// Access token: short-lived (15 min). Refresh token: long-lived (7 days).
// RBAC: requireRole('admin') checks req.user.role.

const refreshTokenStore = new Map();

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: { message: 'Auth required' } });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { message: `Access denied. Required: ${allowedRoles.join(' or ')}. Yours: ${req.user.role}` } });
    }
    next();
  };
}

// ============================================================
// BUILD THE APP
// ============================================================
function buildApp() {
  const app = express();
  app.use(express.json());

  const users = {
    meena:  { password: 'digilocker123', role: 'admin',  fullName: 'Officer Meena' },
    anand:  { password: 'aadhaar456',    role: 'editor', fullName: 'Anand Verma' },
    suresh: { password: 'citizen789',    role: 'viewer', fullName: 'Suresh Kumar' }
  };

  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: { message: 'Credentials required' } });
    const user = users[username];
    if (!user || user.password !== password) return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });

    const accessToken = jwtSign({ sub: username, role: user.role, name: user.fullName }, JWT_SECRET, { expiresIn: 900 });
    const refreshToken = jwtSign({ sub: username, type: 'refresh' }, REFRESH_SECRET, { expiresIn: 604800 });
    refreshTokenStore.set(refreshToken, { username, createdAt: Date.now() });

    res.json({ success: true, data: { accessToken, refreshToken, expiresIn: 900, tokenType: 'Bearer' } });
  });

  app.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: { message: 'refreshToken required' } });
    if (!refreshTokenStore.has(refreshToken)) return res.status(401).json({ success: false, error: { message: 'Token not found or revoked' } });

    const result = jwtVerify(refreshToken, REFRESH_SECRET);
    if (!result.valid) { refreshTokenStore.delete(refreshToken); return res.status(401).json({ success: false, error: { message: result.error } }); }

    const user = users[result.payload.sub];
    if (!user) return res.status(401).json({ success: false, error: { message: 'User no longer exists' } });

    const newToken = jwtSign({ sub: result.payload.sub, role: user.role, name: user.fullName }, JWT_SECRET, { expiresIn: 900 });
    res.json({ success: true, data: { accessToken: newToken, expiresIn: 900, tokenType: 'Bearer' } });
  });

  app.post('/logout', authMiddleware, (req, res) => {
    if (req.body.refreshToken) refreshTokenStore.delete(req.body.refreshToken);
    res.json({ success: true, data: { message: `${req.user.name} logged out` } });
  });

  app.get('/profile', authMiddleware, (req, res) => {
    res.json({ success: true, data: { user: req.user, message: `Welcome, ${req.user.name}!` } });
  });

  app.get('/admin/dashboard', authMiddleware, requireRole('admin'), (req, res) => {
    res.json({ success: true, data: { message: 'Admin dashboard', sessions: refreshTokenStore.size } });
  });

  app.post('/documents', authMiddleware, requireRole('admin', 'editor'), (req, res) => {
    res.json({ success: true, data: { message: `Created by ${req.user.name} (${req.user.role})` } });
  });

  app.get('/documents', authMiddleware, requireRole('admin', 'editor', 'viewer'), (req, res) => {
    res.json({ success: true, data: { documents: [{ id: 1, title: 'Marksheet' }, { id: 2, title: 'PAN Card' }] } });
  });

  return app;
}

// ============================================================
// SELF-TEST
// ============================================================
async function runTests() {
  const app = buildApp();

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    console.log(`[15-jwt-authentication] Server on port ${port}\n`);

    try {
      // ── Block 1: Sign & Verify ─────────────────────────────
      console.log('=== Block 1 — JWT Sign & Verify ===\n');

      const testToken = jwtSign({ sub: 'test', role: 'admin' }, JWT_SECRET, { expiresIn: 3600 });
      console.log('Token parts:', testToken.split('.').length); // Output: 3

      const decoded = jwtDecode(testToken);
      console.log('Header alg:', decoded.header.alg);           // Output: HS256
      console.log('Payload sub:', decoded.payload.sub);          // Output: test

      console.log('Correct secret — valid:', jwtVerify(testToken, JWT_SECRET).valid);    // Output: true
      console.log('Wrong secret — valid:', jwtVerify(testToken, 'wrong').valid);          // Output: false

      const expired = jwtSign({ sub: 'x' }, JWT_SECRET, { expiresIn: -10 });
      console.log('Expired — valid:', jwtVerify(expired, JWT_SECRET).valid);              // Output: false
      console.log('');

      // ── Block 2: Login & Protected Routes ──────────────────
      console.log('=== Block 2 — Login & Protected Routes ===\n');

      const r1 = await fetch(`${base}/profile`);
      console.log('No token — Status:', r1.status); // Output: 401

      const r2 = await fetch(`${base}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'meena', password: 'digilocker123' })
      });
      const j2 = await r2.json();
      console.log('Login admin — Status:', r2.status); // Output: 200
      const adminToken = j2.data.accessToken;
      const adminRefresh = j2.data.refreshToken;

      const r3 = await fetch(`${base}/profile`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const j3 = await r3.json();
      console.log('Profile — User:', j3.data.user.name); // Output: Officer Meena
      console.log('');

      // ── Block 3: RBAC & Refresh ────────────────────────────
      console.log('=== Block 3 — RBAC & Refresh ===\n');

      const r6 = await fetch(`${base}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'suresh', password: 'citizen789' })
      });
      const viewerToken = (await r6.json()).data.accessToken;

      const r7 = await fetch(`${base}/admin/dashboard`, { headers: { Authorization: `Bearer ${viewerToken}` } });
      console.log('Viewer → admin route — Status:', r7.status); // Output: 403

      const r8 = await fetch(`${base}/admin/dashboard`, { headers: { Authorization: `Bearer ${adminToken}` } });
      console.log('Admin → admin route — Status:', r8.status);  // Output: 200

      // Refresh token flow
      await new Promise(r => setTimeout(r, 1100));
      const r13 = await fetch(`${base}/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: adminRefresh })
      });
      const j13 = await r13.json();
      console.log('Refresh — New token received:', !!j13.data.accessToken);
      console.log('Token different:', j13.data.accessToken !== adminToken);

      // Logout revokes refresh token
      const r15 = await fetch(`${base}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${j13.data.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: adminRefresh })
      });
      const j15 = await r15.json();
      console.log('Logout:', j15.data.message);

      const r16 = await fetch(`${base}/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: adminRefresh })
      });
      console.log('Revoked refresh — Status:', r16.status); // Output: 401

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close(() => {
        console.log('\n── Server closed ──');

        // ── KEY TAKEAWAYS ─────────────────────────────────────
        // 1. JWT = base64url header.payload.signature. No magic.
        // 2. Signature is HMAC-SHA256. Tampering invalidates it.
        // 3. Always check the alg header — "alg: none" is an attack.
        // 4. Use crypto.timingSafeEqual to prevent timing attacks.
        // 5. Access tokens: short (15 min), stateless. Refresh
        //    tokens: long (7 days), stored server-side for revocation.
        // 6. RBAC: authMiddleware first (identity), then
        //    requireRole (permissions).
        // 7. Anyone can DECODE a JWT. Only the server can VERIFY.
      });
    }
  });
}

runTests();
