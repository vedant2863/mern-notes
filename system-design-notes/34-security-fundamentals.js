/** ============================================================
 *  FILE 34: SECURITY FUNDAMENTALS
 *  ============================================================
 *  Topic: Auth vs authz, JWT, OAuth2, encryption, OWASP top 10,
 *         input validation, RBAC, security headers
 *
 *  WHY THIS MATTERS:
 *  DigiLocker serves 150M citizens with gov documents linked to
 *  Aadhaar. A single flaw could expose PII of millions. Security
 *  is not a feature to add later — it must be baked in from day one.
 *  ============================================================ */

// STORY: DigiLocker / Aadhaar Auth
// DigiLocker uses OAuth2 so banks access documents with user consent.
// Each JWT carries Aadhaar-verified claims. When a fintech attempted
// SQL injection, UIDAI's validation blocked 2.3M malicious requests
// in 24 hours.

console.log("=".repeat(70));
console.log("  FILE 34: SECURITY FUNDAMENTALS");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Authentication vs Authorization
// ════════════════════════════════════════════════════════════════

console.log("SECTION 1: Authentication vs Authorization");
console.log("-".repeat(50));

console.log(`
  AUTHENTICATION (WHO are you?)
    Methods: Password, OTP/Aadhaar biometric, MFA
    HTTP: 401 Unauthorized

  AUTHORIZATION (WHAT can you do?)
    Methods: RBAC, ABAC, ACL, Policy-based (IAM)
    HTTP: 403 Forbidden

  COMMON MISTAKE: Checking auth but skipping authz.
    User A logged in but accesses User B's docs = IDOR (OWASP #1).
`);

// ════════════════════════════════════════════════════════════════
// SECTION 2 — JWT Creation and Verification
// ════════════════════════════════════════════════════════════════

// WHY: JWTs are the standard for stateless API authentication.

console.log("SECTION 2: JWT Creation and Verification");
console.log("-".repeat(50));

class JWTSimulator {
  constructor(secret) { this.secret = secret; }
  _b64Encode(obj) { return Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
  _b64Decode(str) { let s = str.replace(/-/g,"+").replace(/_/g,"/"); while (s.length % 4) s += "="; return JSON.parse(Buffer.from(s, "base64").toString()); }
  _hmac(data) { let h = 0; for (const c of data + this.secret) h = ((h << 5) - h) + c.charCodeAt(0) & 0x7fffffff; return h.toString(36); }

  create(payload, expSec = 3600) {
    const header = { alg: "HS256_SIM", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const full = { ...payload, iat: now, exp: now + expSec, iss: "digilocker.gov.in" };
    const h = this._b64Encode(header), p = this._b64Encode(full);
    return `${h}.${p}.${this._hmac(h+"."+p)}`;
  }
  verify(token) {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, error: "Invalid format" };
    const expected = this._hmac(parts[0]+"."+parts[1]);
    if (parts[2] !== expected) return { valid: false, error: "Signature verification failed" };
    const payload = this._b64Decode(parts[1]);
    if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return { valid: false, error: "Token expired" };
    return { valid: true, payload };
  }
}

const jwt = new JWTSimulator("aadhaar-secret-key-2024");
const token = jwt.create({ sub: "AADHAAR-XXXX-1234", name: "Rajesh Kumar", scope: ["profile:read", "documents:read"] });

console.log(`\n  Token: ${token.substring(0, 50)}...`);
console.log(`  Verify valid: ${jwt.verify(token).valid}`);
const tampered = token.replace("Rajesh", "Hacker");
console.log(`  Verify tampered: ${jwt.verify(tampered).valid} (${jwt.verify(tampered).error})`);

console.log("\n  JWT Best Practices:");
["Never store secrets in payload (Base64 != encryption)", "Short expiry (15min access + refresh tokens)",
 "Validate iss, aud, exp on every request", "Use RS256 in production (no shared secret)",
 "Store in httpOnly cookies (not localStorage)"].forEach((p,i) => console.log(`    ${i+1}. ${p}`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — OAuth2 Flow
// ════════════════════════════════════════════════════════════════

// WHY: OAuth2 lets third-party apps access user data without sharing passwords.

console.log("SECTION 3: OAuth2 Flow");
console.log("-".repeat(50));

class OAuth2Server {
  constructor() { this.clients = new Map(); this.codes = new Map(); this.tokens = new Map(); }
  registerClient(id, secret, redirect, name) { this.clients.set(id, { secret, redirect, name }); return { clientId: id }; }
  authorize(clientId, scope, userId) {
    const client = this.clients.get(clientId);
    if (!client) return { error: "invalid_client" };
    const code = `code-${(Math.random()*1e8|0).toString(36)}`;
    this.codes.set(code, { clientId, userId, scope, used: false });
    console.log(`    User ${userId} grants "${client.name}" access to: ${scope.join(", ")}`);
    return { code };
  }
  exchangeCode(clientId, clientSecret, code) {
    const client = this.clients.get(clientId);
    if (!client || client.secret !== clientSecret) return { error: "invalid_client" };
    const auth = this.codes.get(code);
    if (!auth || auth.used || auth.clientId !== clientId) return { error: "invalid_grant" };
    auth.used = true;
    const accessToken = `at-${(Math.random()*1e10|0).toString(36)}`;
    this.tokens.set(accessToken, { userId: auth.userId, scope: auth.scope, exp: Date.now()+3600000 });
    return { access_token: accessToken, expires_in: 3600 };
  }
  validateToken(token) {
    const t = this.tokens.get(token);
    if (!t) return { valid: false }; if (Date.now() > t.exp) return { valid: false, error: "expired" };
    return { valid: true, userId: t.userId, scope: t.scope };
  }
}

const oauth = new OAuth2Server();
oauth.registerClient("hdfc-client", "hdfc-secret", "https://hdfc.com/callback", "HDFC Bank eKYC");

console.log("\n  Step 1: Authorization");
const authRes = oauth.authorize("hdfc-client", ["aadhaar:read", "pan:read"], "user-1234");

console.log("  Step 2: Exchange code for token");
const tokenRes = oauth.exchangeCode("hdfc-client", "hdfc-secret", authRes.code);
console.log(`    Access token: ${tokenRes.access_token}`);

console.log("  Step 3: Validate");
const valRes = oauth.validateToken(tokenRes.access_token);
console.log(`    Valid: ${valRes.valid}, Scope: ${valRes.scope.join(", ")}`);

console.log("  Step 4: Reuse code (should fail)");
console.log(`    Result: ${JSON.stringify(oauth.exchangeCode("hdfc-client", "hdfc-secret", authRes.code))}`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Encryption Basics
// ════════════════════════════════════════════════════════════════

console.log("SECTION 4: Encryption Basics");
console.log("-".repeat(50));

console.log("\n  Comparison:");
[["Speed","Fast (100x)","Slow"],["Key Sharing","Same both sides","Public shared freely"],
 ["Use Case","Data at rest","Key exchange, signatures"],["Algorithms","AES-256","RSA-2048, ECDSA"]].forEach(
  ([a,s,as]) => console.log(`    ${a.padEnd(16)} Symmetric: ${s.padEnd(22)} Asymmetric: ${as}`)
);
console.log("\n  TLS uses BOTH: Asymmetric for handshake, Symmetric for bulk data.");
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — OWASP Top 10
// ════════════════════════════════════════════════════════════════

console.log("SECTION 5: OWASP Top 10");
console.log("-".repeat(50));

[{ r: 1, n: "Broken Access Control", fix: "Server-side authz checks on every endpoint" },
 { r: 2, n: "Cryptographic Failures", fix: "AES-256 at rest, TLS 1.3 in transit" },
 { r: 3, n: "Injection", fix: "Parameterized queries, ORM" },
 { r: 4, n: "Insecure Design", fix: "Threat modeling in design phase" },
 { r: 5, n: "Security Misconfig", fix: "Hardened configs, automated scans" },
 { r: 6, n: "Vulnerable Components", fix: "Snyk/Dependabot, update deps" },
 { r: 7, n: "Auth Failures", fix: "MFA, session timeouts, secure cookies" },
 { r: 8, n: "Integrity Failures", fix: "Code signing, SBOM verification" },
 { r: 9, n: "Logging Failures", fix: "Log auth events, SIEM alerting" },
 { r: 10, n: "SSRF", fix: "Whitelist URLs, block internal IPs" },
].forEach(o => console.log(`  #${o.r}: ${o.n}\n    Fix: ${o.fix}`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Input Validation
// ════════════════════════════════════════════════════════════════

// WHY: 90% of injection attacks succeed due to missing validation.

console.log("SECTION 6: Input Validation");
console.log("-".repeat(50));

class InputValidator {
  constructor() { this.rules = {}; }
  addRule(field, validators) { this.rules[field] = validators; }
  validate(field, value) {
    const errors = [];
    (this.rules[field] || []).forEach(v => { const r = v(value); if (!r.valid) errors.push(r.error); });
    return { valid: errors.length === 0, errors };
  }
  static required() { return v => ({ valid: v !== null && v !== undefined && v !== "", error: "Required" }); }
  static noSQLi() {
    return v => {
      if (typeof v !== "string") return { valid: true };
      const bad = [/('|--|;|\/\*)/i, /(union\s+select|drop\s+table)/i, /(or\s+1\s*=\s*1)/i];
      return { valid: !bad.some(p => p.test(v)), error: "SQL injection detected" };
    };
  }
  static noXSS() {
    return v => {
      if (typeof v !== "string") return { valid: true };
      return { valid: ![/<script/i, /javascript\s*:/i, /on\w+\s*=/i].some(p => p.test(v)), error: "XSS detected" };
    };
  }
  static aadhaar() { return v => ({ valid: typeof v === "string" && /^\d{4}\s?\d{4}\s?\d{4}$/.test(v.trim()), error: "Invalid Aadhaar" }); }
}

const val = new InputValidator();
val.addRule("aadhaar", [InputValidator.required(), InputValidator.aadhaar(), InputValidator.noSQLi()]);
val.addRule("name", [InputValidator.required(), InputValidator.noXSS(), InputValidator.noSQLi()]);

console.log("\n  " + "Input".padEnd(30) + "Field".padEnd(10) + "Valid".padEnd(8) + "Errors");
[{ f: "aadhaar", v: "1234 5678 9012", l: "Valid Aadhaar" },
 { f: "aadhaar", v: "1234' OR '1'='1", l: "SQLi Aadhaar" },
 { f: "name", v: "Rajesh Kumar", l: "Valid name" },
 { f: "name", v: '<script>alert("x")</script>', l: "XSS in name" },
 { f: "name", v: "admin'; DROP TABLE users;--", l: "SQLi in name" },
].forEach(t => {
  const r = val.validate(t.f, t.v);
  console.log(`  ${t.l.padEnd(30)}${t.f.padEnd(10)}${String(r.valid).padEnd(8)}${r.errors.join("; ") || "-"}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 7 — RBAC and Security Headers
// ════════════════════════════════════════════════════════════════

console.log("SECTION 7: RBAC and Security Headers");
console.log("-".repeat(50));

class RBAC {
  constructor() { this.roles = new Map(); this.users = new Map(); }
  createRole(name, perms) { this.roles.set(name, new Set(perms)); }
  assignRole(userId, role) { if (!this.users.has(userId)) this.users.set(userId, new Set()); this.users.get(userId).add(role); }
  check(userId, perm) {
    const userRoles = this.users.get(userId);
    if (!userRoles) return false;
    for (const r of userRoles) { const role = this.roles.get(r); if (role && role.has(perm)) return true; }
    return false;
  }
}

const rbac = new RBAC();
rbac.createRole("citizen", ["doc:read:own", "doc:download:own", "doc:share"]);
rbac.createRole("issuer", ["doc:issue", "doc:revoke", "doc:verify"]);
rbac.createRole("admin", ["doc:read:any", "doc:delete:any", "user:manage"]);

rbac.assignRole("citizen-rajesh", "citizen");
rbac.assignRole("rto-maharashtra", "issuer");
rbac.assignRole("uidai-admin", "admin");

console.log("\n  Access Checks:");
[["citizen-rajesh", "doc:read:own", "Citizen reads own docs"],
 ["citizen-rajesh", "doc:delete:any", "Citizen deletes any doc"],
 ["rto-maharashtra", "doc:issue", "RTO issues license"],
 ["uidai-admin", "doc:read:any", "Admin reads any doc"],
].forEach(([u, p, d]) => console.log(`    [${rbac.check(u, p) ? "GRANTED" : "DENIED "}] ${d}`));

console.log("\n  Essential Security Headers:");
["Content-Security-Policy: default-src 'self'",
 "Strict-Transport-Security: max-age=31536000",
 "X-Content-Type-Options: nosniff",
 "X-Frame-Options: DENY",
].forEach(h => console.log(`    ${h}`));

console.log("\n  Security Checklist:");
["HTTPS everywhere (TLS 1.3)", "bcrypt/argon2 for passwords", "Rate limit auth endpoints",
 "CORS whitelist (never *)", "Secrets in vault (not code)", "Dependency scanning in CI/CD"].forEach((p,i) => console.log(`    ${i+1}. ${p}`));
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Authentication (WHO) and Authorization (WHAT) are separate.");
console.log("  2. JWTs are encoded, NOT encrypted — never put secrets in payload.");
console.log("  3. OAuth2: codes are single-use, access tokens short-lived.");
console.log("  4. TLS uses asymmetric for handshake, symmetric for bulk data.");
console.log("  5. OWASP #1 is Broken Access Control — check authz on every endpoint.");
console.log("  6. Validate ALL input server-side — client validation is UX only.");
console.log("  7. RBAC: minimum permissions per role, check on every API call.");
console.log("  8. Security headers are free: CSP prevents XSS, HSTS enforces HTTPS.");
console.log();
console.log('  "In a country where 1.4 billion identities are digital,');
console.log('   security is not a feature — it is a fundamental right."');
console.log();
