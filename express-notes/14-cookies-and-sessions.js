/** ============================================================
 *  FILE 14 — Cookies & Sessions from Scratch
 *  Topic: res.cookie(), manual cookie parsing, session system
 *  ============================================================ */

// ── THE STORY ──────────────────────────────────────────────
// IRCTC Login Session
// Each passenger gets a booking reference at login (cookie).
// They show it at every interaction. The server looks it up
// in the booking ledger (session store) to find their data.
// The cookie holds no secrets — just a reference number.
// All real data lives on the server.
// ───────────────────────────────────────────────────────────

const express = require('express');
const crypto = require('crypto');

// ============================================================
// BLOCK 1 — Manual Cookie Parser
// ============================================================
// Cookie header: "name=value; other=value2"
// This is exactly what the cookie-parser package does.

function cookieParser() {
  return (req, res, next) => {
    req.cookies = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return next();

    cookieHeader.split(';').forEach(pair => {
      const trimmed = pair.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      try { value = decodeURIComponent(value); } catch (e) {}
      req.cookies[key] = value;
    });
    next();
  };
}

// ============================================================
// BLOCK 2 — Session Middleware from Scratch
// ============================================================
// 1. Generate unique session IDs (crypto.randomUUID)
// 2. Store session data server-side (Map — use Redis in prod)
// 3. Read cookie → load data → attach req.session → auto-save

class SessionStore {
  constructor() { this.sessions = new Map(); }
  create(id) { const s = { id, data: {}, createdAt: Date.now(), lastAccessed: Date.now() }; this.sessions.set(id, s); return s; }
  get(id) { const s = this.sessions.get(id); if (s) s.lastAccessed = Date.now(); return s || null; }
  save(id, data) { const s = this.sessions.get(id); if (s) { s.data = data; s.lastAccessed = Date.now(); } }
  destroy(id) { this.sessions.delete(id); }
  cleanup(maxAgeMs) {
    const now = Date.now(); let cleaned = 0;
    for (const [id, s] of this.sessions) { if (now - s.lastAccessed > maxAgeMs) { this.sessions.delete(id); cleaned++; } }
    return cleaned;
  }
  get size() { return this.sessions.size; }
}

function sessionMiddleware(options = {}) {
  const { cookieName = 'sid', maxAge = 3600000, httpOnly = true, secure = false, sameSite = 'lax', store = new SessionStore() } = options;

  const middleware = (req, res, next) => {
    let sessionId = req.cookies?.[cookieName];
    let session = sessionId ? store.get(sessionId) : null;

    if (!session) {
      sessionId = crypto.randomUUID();
      session = store.create(sessionId);
      res.cookie(cookieName, sessionId, { httpOnly, secure, sameSite, maxAge, path: '/' });
    }

    req.session = {
      id: sessionId,
      data: session.data,
      save() { store.save(sessionId, this.data); },
      destroy(cb) { store.destroy(sessionId); res.clearCookie(cookieName, { path: '/' }); if (cb) cb(); },
      // Flash messages: stored in session, consumed on first read
      flash(key, msg) {
        if (!this.data._flash) this.data._flash = {};
        if (!this.data._flash[key]) this.data._flash[key] = [];
        this.data._flash[key].push(msg);
        store.save(sessionId, this.data);
      },
      getFlash(key) {
        if (!this.data._flash || !this.data._flash[key]) return [];
        const msgs = this.data._flash[key];
        delete this.data._flash[key];
        store.save(sessionId, this.data);
        return msgs;
      }
    };

    // Auto-save after response
    res.on('finish', () => { if (store.get(sessionId)) store.save(sessionId, req.session.data); });
    next();
  };

  middleware.store = store;
  return middleware;
}

// ============================================================
// BUILD THE APP
// ============================================================
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const sessionStore = new SessionStore();
  app.use(sessionMiddleware({ cookieName: 'irctc_sid', maxAge: 5000, store: sessionStore }));

  // Block 1: Set cookies with different options
  app.get('/set-cookies', (req, res) => {
    res.cookie('passenger_name', 'Rajesh Sharma', { maxAge: 86400000, httpOnly: true, sameSite: 'lax' });
    res.cookie('preference', 'dark-mode', { maxAge: 31536000000, httpOnly: false });
    res.json({ message: 'Cookies set!' });
  });

  app.get('/read-cookies', (req, res) => {
    res.json({ parsedCookies: req.cookies, cookieCount: Object.keys(req.cookies).length });
  });

  // Block 2: Login/Logout with sessions
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = {
      rajesh: { password: 'tatkal123', role: 'admin', fullName: 'Rajesh Sharma' },
      priya:  { password: 'sleeper456', role: 'passenger', fullName: 'Priya Patel' }
    };
    const user = users[username];
    if (!user || user.password !== password) return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });

    req.session.data.user = { username, role: user.role, fullName: user.fullName, loggedInAt: new Date().toISOString() };
    req.session.save();
    req.session.flash('info', `Welcome back, ${user.fullName}!`);
    res.json({ success: true, data: { message: 'Login successful', sessionId: req.session.id, user: req.session.data.user } });
  });

  app.get('/profile', (req, res) => {
    if (!req.session.data.user) return res.status(401).json({ success: false, error: { message: 'Not logged in' } });
    res.json({ success: true, data: { user: req.session.data.user, flashMessages: req.session.getFlash('info') } });
  });

  app.post('/logout', (req, res) => {
    const username = req.session.data.user?.username || 'unknown';
    req.session.destroy(() => res.json({ success: true, data: { message: `${username} logged out` } }));
  });

  // Block 3: Session stats and cleanup
  app.get('/sessions/stats', (req, res) => {
    res.json({ activeSessions: sessionStore.size, currentSessionId: req.session.id });
  });

  app.post('/sessions/cleanup', (req, res) => {
    const cleaned = sessionStore.cleanup(5000);
    res.json({ cleaned, remaining: sessionStore.size });
  });

  return { app, sessionStore };
}

// ============================================================
// SELF-TEST
// ============================================================
async function runTests() {
  const { app, sessionStore } = buildApp();

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    console.log(`[14-cookies-and-sessions] Server on port ${port}\n`);

    let savedCookies = '';
    function extractCookies(response) {
      const setCookies = response.headers.getSetCookie?.() || [];
      const cookieMap = {};
      if (savedCookies) savedCookies.split('; ').forEach(c => { const [k, v] = c.split('='); if (k && v) cookieMap[k] = v; });
      setCookies.forEach(sc => {
        const nv = sc.split(';')[0].trim(); const eq = nv.indexOf('=');
        if (eq !== -1) {
          const key = nv.substring(0, eq), val = nv.substring(eq + 1);
          if (sc.includes('Max-Age=0')) delete cookieMap[key]; else cookieMap[key] = val;
        }
      });
      savedCookies = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    function fetchC(url, opts = {}) {
      const h = { ...(opts.headers || {}) }; if (savedCookies) h['Cookie'] = savedCookies;
      return fetch(url, { ...opts, headers: h, redirect: 'manual' });
    }

    try {
      // ── Block 1: Cookies ───────────────────────────────────
      console.log('=== Block 1 — Cookies ===\n');
      const r1 = await fetchC(`${base}/set-cookies`); extractCookies(r1);
      console.log('Set-Cookie headers:', (r1.headers.getSetCookie?.() || []).length); // Output: 2+

      const r2 = await fetchC(`${base}/read-cookies`); extractCookies(r2);
      const j2 = await r2.json();
      console.log('Cookie count:', j2.cookieCount);
      console.log('');

      // ── Block 2: Login/Logout ──────────────────────────────
      console.log('=== Block 2 — Session Login/Logout ===\n');

      const r5 = await fetchC(`${base}/profile`); extractCookies(r5);
      console.log('Profile without login — Status:', r5.status); // Output: 401

      const r6 = await fetchC(`${base}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'rajesh', password: 'tatkal123' })
      });
      extractCookies(r6);
      const j6 = await r6.json();
      console.log('Login — User:', j6.data.user.fullName); // Output: Rajesh Sharma

      const r7 = await fetchC(`${base}/profile`); extractCookies(r7);
      const j7 = await r7.json();
      console.log('Profile — Flash:', j7.data.flashMessages); // Output: ['Welcome back, Rajesh Sharma!']

      const r8 = await fetchC(`${base}/profile`); extractCookies(r8);
      const j8 = await r8.json();
      console.log('Profile again — Flash consumed:', j8.data.flashMessages); // Output: []

      const r11 = await fetchC(`${base}/logout`, { method: 'POST' }); extractCookies(r11);
      const j11 = await r11.json();
      console.log('Logout:', j11.data.message);

      const r12 = await fetchC(`${base}/profile`); extractCookies(r12);
      console.log('After logout — Status:', r12.status); // Output: 401
      console.log('');

      // ── Block 3: Expiry & Cleanup ──────────────────────────
      console.log('=== Block 3 — Expiry & Cleanup ===\n');
      console.log('Sessions before wait:', sessionStore.size);
      await new Promise(r => setTimeout(r, 6000));

      const r16 = await fetchC(`${base}/sessions/cleanup`, { method: 'POST' }); extractCookies(r16);
      const j16 = await r16.json();
      console.log('Cleaned:', j16.cleaned, '| Remaining:', j16.remaining);

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close(() => {
        console.log('\n── Server closed ──');

        // ── KEY TAKEAWAYS ─────────────────────────────────────
        // 1. Cookies = key=value pairs in HTTP headers. httpOnly
        //    prevents JS access (XSS). sameSite prevents CSRF.
        // 2. Sessions store data SERVER-side, identified by a
        //    cookie holding a random session ID.
        // 3. crypto.randomUUID() makes IDs impossible to guess.
        // 4. Flash messages = session data consumed on first read.
        // 5. Sessions must be cleaned up — use Redis TTL in prod.
        // 6. The pattern: read cookie → load data → attach
        //    req.session → auto-save is exactly express-session.
      });
    }
  });
}

runTests();
