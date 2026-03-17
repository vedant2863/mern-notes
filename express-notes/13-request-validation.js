/** ============================================================
 *  FILE 13 — Request Validation from Scratch
 *  Topic: Body, param, and query validation middleware
 *  ============================================================ */

// ── THE STORY ──────────────────────────────────────────────
// Aadhaar Enrollment Validation
// Operator Priya validates every form before it enters the
// system. If it fails, she writes a rejection slip listing
// ALL defects so the applicant fixes them in one pass. Our
// validation middleware works the same way: define a schema,
// inspect the request, return all errors at once.
// ───────────────────────────────────────────────────────────

const express = require('express');

// ============================================================
// BLOCK 1 — Body Validation Middleware Factory
// ============================================================
// Schema-based: { name: { required, type, minLength } }
// Returns ALL errors, not just the first.

function validateValue(field, value, rules) {
  const errors = [];

  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push({ field, message: `${field} is required` });
    return errors;
  }
  if (value === undefined || value === null) return errors;

  // Type check
  if (rules.type) {
    const actualType = typeof value;
    if (rules.type === 'number' && actualType !== 'number') { errors.push({ field, message: `${field} must be a number (got ${actualType})` }); return errors; }
    if (rules.type === 'string' && actualType !== 'string') { errors.push({ field, message: `${field} must be a string (got ${actualType})` }); return errors; }
    if (rules.type === 'array' && !Array.isArray(value)) { errors.push({ field, message: `${field} must be an array` }); return errors; }
  }

  // String rules
  if (typeof value === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) errors.push({ field, message: `${field} must be at least ${rules.minLength} characters (got ${value.length})` });
    if (rules.maxLength !== undefined && value.length > rules.maxLength) errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters (got ${value.length})` });
    if (rules.customCheck && !rules.customCheck(value)) errors.push({ field, message: rules.customMessage || `${field} is invalid` });
  }

  // Number rules
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) errors.push({ field, message: `${field} must be at least ${rules.min} (got ${value})` });
    if (rules.max !== undefined && value > rules.max) errors.push({ field, message: `${field} must be at most ${rules.max} (got ${value})` });
  }

  // Enum check
  if (rules.enum && !rules.enum.includes(value)) errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')} (got "${value}")` });

  return errors;
}

// Factory: validateBody(schema) returns middleware
function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      errors.push(...validateValue(field, req.body[field], rules));
    }
    if (errors.length > 0) return res.status(422).json({ success: false, error: { message: 'Validation failed', errors } });
    next();
  };
}

// ============================================================
// BLOCK 2 — Param + Query Validation, Sanitization, Compose
// ============================================================

function validateParams(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [param, rules] of Object.entries(schema)) {
      const value = req.params[param];
      if (rules.isNumeric) {
        // Check every character is a digit — no regex needed
        let allDigits = value.length > 0;
        for (let i = 0; i < value.length; i++) {
          if (value[i] < '0' || value[i] > '9') { allDigits = false; break; }
        }
        if (!allDigits) { errors.push({ field: `params.${param}`, message: `${param} must be a numeric value` }); continue; }
        req.params[param] = parseInt(value, 10);
      }
      if (rules.isId) {
        // Simple ID format: must be non-empty and contain only letters, digits, or dashes
        let valid = value.length > 0;
        for (let i = 0; i < value.length; i++) {
          const ch = value[i];
          const isLetterOrDigit = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '-';
          if (!isLetterOrDigit) { valid = false; break; }
        }
        if (!valid) {
          errors.push({ field: `params.${param}`, message: `${param} must be a valid ID (letters, digits, dashes only)` });
        }
      }
    }
    if (errors.length > 0) return res.status(400).json({ success: false, error: { message: 'Invalid URL parameters', errors } });
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [param, rules] of Object.entries(schema)) {
      let value = req.query[param];
      if (value === undefined) { if (rules.required) errors.push({ field: `query.${param}`, message: `${param} query parameter is required` }); continue; }

      // Sanitize before validating
      if (rules.sanitize) {
        if (rules.sanitize.includes('trim')) value = value.trim();
        if (rules.sanitize.includes('toLowerCase')) value = value.toLowerCase();
        if (rules.sanitize.includes('toNumber')) { value = Number(value); if (isNaN(value)) { errors.push({ field: `query.${param}`, message: `${param} must be a valid number` }); continue; } }
        req.query[param] = value;
      }
      if (rules.enum && !rules.enum.includes(value)) errors.push({ field: `query.${param}`, message: `${param} must be one of: ${rules.enum.join(', ')} (got "${value}")` });
      if (rules.min !== undefined && Number(value) < rules.min) errors.push({ field: `query.${param}`, message: `${param} must be at least ${rules.min}` });
      if (rules.max !== undefined && Number(value) > rules.max) errors.push({ field: `query.${param}`, message: `${param} must be at most ${rules.max}` });
    }
    if (errors.length > 0) return res.status(400).json({ success: false, error: { message: 'Invalid query parameters', errors } });
    next();
  };
}

// Sanitize body fields (trim, lowercase, escape HTML)
function sanitizeBody(fieldRules) {
  return (req, res, next) => {
    for (const [field, transforms] of Object.entries(fieldRules)) {
      if (req.body[field] === undefined) continue;
      let value = req.body[field];
      if (typeof value === 'string') {
        if (transforms.includes('trim')) value = value.trim();
        if (transforms.includes('toLowerCase')) value = value.toLowerCase();
        if (transforms.includes('escape')) value = value.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
      }
      req.body[field] = value;
    }
    next();
  };
}

// Chain validators — first failure short-circuits
function compose(...middlewares) {
  return (req, res, next) => {
    let index = 0;
    function run() {
      if (index >= middlewares.length) return next();
      middlewares[index++](req, res, (err) => {
        if (err) return next(err);
        if (res.headersSent) return;
        run();
      });
    }
    run();
  };
}

// ============================================================
// BUILD THE APP
// ============================================================
function buildApp() {
  const app = express();
  app.use(express.json());

  const enrollments = [
    { id: 1, name: 'Rajesh Kumar', fee: 25.99, category: 'general' },
    { id: 2, name: 'Sunita Devi', fee: 15.50, category: 'general' },
  ];

  const createSchema = {
    name: { required: true, type: 'string', minLength: 2, maxLength: 50 },
    fee: { required: true, type: 'number', min: 0.01, max: 99999.99 },
    category: { required: true, type: 'string', enum: ['general', 'senior-citizen', 'child', 'nri'] },
    email: {
      required: true, type: 'string',
      customCheck: function(value) {
        // Simple email check: must have exactly one @, something before and after, and a dot after @
        var atIndex = value.indexOf('@');
        if (atIndex < 1) return false;                        // need at least 1 char before @
        if (value.indexOf('@', atIndex + 1) !== -1) return false; // only one @
        var afterAt = value.substring(atIndex + 1);
        var dotIndex = afterAt.indexOf('.');
        if (dotIndex < 1) return false;                       // need something before the dot
        if (dotIndex === afterAt.length - 1) return false;    // need something after the dot
        if (value.indexOf(' ') !== -1) return false;          // no spaces allowed
        return true;
      },
      customMessage: 'email must be a valid email address'
    }
  };

  // POST with sanitize → validate chain
  app.post('/enrollments',
    sanitizeBody({ name: ['trim'], email: ['trim', 'toLowerCase'], address: ['trim', 'escape'] }),
    validateBody(createSchema),
    (req, res) => {
      const newEnrollment = { id: enrollments.length + 1, ...req.body };
      enrollments.push(newEnrollment);
      res.status(201).json({ success: true, data: newEnrollment });
    }
  );

  // GET with param validation
  app.get('/enrollments/:id', validateParams({ id: { isNumeric: true } }), (req, res) => {
    const enrollment = enrollments.find(p => p.id === req.params.id);
    if (!enrollment) return res.status(404).json({ success: false, error: { message: 'Not found' } });
    res.json({ success: true, data: enrollment });
  });

  // GET with query validation
  app.get('/enrollments', validateQuery({
    category: { enum: ['general', 'senior-citizen', 'child', 'nri'] },
    sort: { enum: ['name', 'fee', 'category'] }
  }), (req, res) => {
    let results = [...enrollments];
    if (req.query.category) results = results.filter(p => p.category === req.query.category);
    res.json({ success: true, data: results });
  });

  // PUT with composed validators
  app.put('/enrollments/:id',
    compose(validateParams({ id: { isNumeric: true } }), sanitizeBody({ name: ['trim'], email: ['trim', 'toLowerCase'] }), validateBody(createSchema)),
    (req, res) => {
      const index = enrollments.findIndex(p => p.id === req.params.id);
      if (index === -1) return res.status(404).json({ success: false, error: { message: 'Not found' } });
      enrollments[index] = { id: req.params.id, ...req.body };
      res.json({ success: true, data: enrollments[index] });
    }
  );

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
    console.log(`[13-request-validation] Server on port ${port}\n`);

    try {
      // ── Block 1: Body Validation ─────────────────────────────
      console.log('=== Block 1 — Body Validation ===\n');

      const r1 = await fetch(`${base}/enrollments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '  Vikram Sarabhai  ', fee: 42.99, category: 'general', email: '  VIKRAM@Example.COM  ' })
      });
      const j1 = await r1.json();
      console.log('Valid POST — Status:', r1.status);               // Output: 201
      console.log('Name trimmed:', JSON.stringify(j1.data.name));   // Output: "Vikram Sarabhai"
      console.log('Email sanitized:', j1.data.email);               // Output: vikram@example.com

      const r2 = await fetch(`${base}/enrollments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const j2 = await r2.json();
      console.log('Empty body — Errors:', j2.error.errors.length);  // Output: 4

      const r3 = await fetch(`${base}/enrollments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 123, fee: 'nan', category: 'vip', email: 'bad' })
      });
      const j3 = await r3.json();
      console.log('Wrong types — Errors:', j3.error.errors.map(e => e.field).join(', '));
      console.log('');

      // ── Block 2: Param + Query ─────────────────────────────
      console.log('=== Block 2 — Param & Query Validation ===\n');

      const r5 = await fetch(`${base}/enrollments/1`);
      console.log('GET /enrollments/1 — Status:', r5.status);       // Output: 200

      const r6 = await fetch(`${base}/enrollments/abc`);
      console.log('GET /enrollments/abc — Status:', r6.status);     // Output: 400

      const r10 = await fetch(`${base}/enrollments?category=vip`);
      console.log('Invalid query enum — Status:', r10.status);      // Output: 400

      const r13 = await fetch(`${base}/enrollments/abc`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X' })
      });
      console.log('Composed: invalid param — Status:', r13.status); // Output: 400
      console.log('(Body validation never ran — compose stopped at params)');

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close(() => {
        console.log('\n── Server closed ──');

        // ── KEY TAKEAWAYS ─────────────────────────────────────
        // 1. Return ALL errors at once — no whack-a-mole.
        // 2. Sanitize BEFORE validating: trim, lowercase, escape.
        // 3. Schema-based { field: { rules } } is declarative and reusable.
        // 4. Validate ALL input: body, params, and query strings.
        // 5. compose() chains validators; first failure short-circuits.
        // 6. The factory pattern (validateBody(schema) → middleware)
        //    is how Joi, Zod, and express-validator work internally.
      });
    }
  });
}

runTests();
