/** ============================================================
    FILE 25: Environment and Configuration
    ============================================================
    Topic: process.env, dotenv pattern, config hierarchy
    WHY THIS MATTERS:
    Every real app behaves differently per environment. Mastering
    env vars prevents secrets in code and avoids "works on my
    machine" disasters.
    ============================================================ */

// ============================================================
// STORY: Government Office Config
// The Sarkari Office reads department circulars (env vars)
// to change behavior — verbose in district office, streamlined
// in head office. Different posting, different config.
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// EXAMPLE BLOCK 1 — process.env and Its Gotchas
// ============================================================

console.log('=== The Sarkari Office checks the posting order ===\n');

// ──────────────────────────────────────────────────────────
// process.env — all values are ALWAYS strings
// ──────────────────────────────────────────────────────────
console.log(`HOME: ${process.env.HOME || process.env.USERPROFILE}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);

// Set test env vars
process.env.PORT = '8080';
process.env.ENABLED = 'true';
process.env.TIMEOUT = '0';

// ──────────────────────────────────────────────────────────
// GOTCHA: Everything is a string!
// ──────────────────────────────────────────────────────────
console.log('\n--- The "everything is a string" gotcha ---');

console.log(`typeof PORT: ${typeof process.env.PORT}`);       // "string"
console.log(`PORT === 8080: ${process.env.PORT === 8080}`);    // false!
console.log(`PORT === '8080': ${process.env.PORT === '8080'}`); // true

// || vs ?? for defaults
const timeout = process.env.TIMEOUT || 30;
console.log(`\ntimeout (|| default): ${timeout}`);
// Output: 30 — BUG! "0" is falsy, so || gives 30 instead of 0.

const timeoutFixed = process.env.TIMEOUT ?? 30;
console.log(`timeout (?? default): ${timeoutFixed}`);
// Output: 0 — ?? only triggers on null/undefined.

// ──────────────────────────────────────────────────────────
// The boolean gotcha — "true" !== true
// ──────────────────────────────────────────────────────────
console.log('\n--- The boolean gotcha ---');
console.log(`ENABLED === true: ${process.env.ENABLED === true}`);    // false!
console.log(`ENABLED === 'true': ${process.env.ENABLED === 'true'}`); // true

function envBool(name, defaultVal = false) {
  const val = process.env[name];
  if (val === undefined) return defaultVal;
  return val === 'true' || val === '1' || val === 'yes';
}
console.log(`envBool('ENABLED'): ${envBool('ENABLED')}`); // true

// ──────────────────────────────────────────────────────────
// NODE_ENV conventions
// ──────────────────────────────────────────────────────────
console.log('\n--- NODE_ENV ---');
// 'development' — verbose, detailed errors
// 'production'  — minified, no stack traces, caching
// 'test'        — test database, mocked services
// Express perf improves ~3x with NODE_ENV=production.

const env = process.env.NODE_ENV || 'development';
const config = {
  development: { logLevel: 'debug', showErrors: true },
  production:  { logLevel: 'error', showErrors: false },
  test:        { logLevel: 'warn',  showErrors: true },
};
console.log(`Current env: ${env}`);
console.log('Config:', config[env] || config.development);

// Useful Node env vars (reference):
// NODE_DEBUG=http,net    — verbose core module logging
// NODE_OPTIONS=--max-old-space-size=4096
// UV_THREADPOOL_SIZE=16  — increase libuv pool (default 4)

// Clean up test vars
delete process.env.PORT;
delete process.env.ENABLED;
delete process.env.TIMEOUT;

// ============================================================
// EXAMPLE BLOCK 2 — Build a Dotenv Reader from Scratch
// ============================================================

console.log('\n=== Building a .env reader from scratch ===\n');

const tmpDir = os.tmpdir();
const envFilePath = path.join(tmpDir, `.env-demo-${process.pid}`);

const envFileContent = `
# Department configuration
DEPT_HOST=localhost
DEPT_PORT=5432
DEPT_NAME=sarkari_office_dev
ENABLE_AUDIT=true
OFFICE_NAME="Sarkari Karyalaya"
MAX_BABUS=100
DATABASE_URL=postgres://clerk:pass@host:5432/db?ssl=true
CIRCULAR_KEY=secret123   # this is a comment
`.trim();

fs.writeFileSync(envFilePath, envFileContent, 'utf8');

function parseDotenv(filePath) {
  const result = {};
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch (err) {
    if (err.code === 'ENOENT') return result;
    throw err;
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove inline comments (not inside quotes)
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const commentIndex = value.indexOf('#');
      if (commentIndex > 0) value = value.slice(0, commentIndex).trim();
    }

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }
  return result;
}

const parsed = parseDotenv(envFilePath);
console.log('Parsed .env:');
for (const [key, value] of Object.entries(parsed)) {
  console.log(`  ${key} = ${value}`);
}

// ──────────────────────────────────────────────────────────
// Config hierarchy: env var > .env file > default
// ──────────────────────────────────────────────────────────
console.log('\n--- Config hierarchy ---');

function getConfig(envVars) {
  const defaults = { DEPT_HOST: 'localhost', DEPT_PORT: '5432',
    DEPT_NAME: 'sarkari_office', MAX_BABUS: '10' };
  const cfg = {};
  for (const key of Object.keys(defaults)) {
    cfg[key] = process.env[key] || envVars[key] || defaults[key];
  }
  return cfg;
}

const finalConfig = getConfig(parsed);
console.log('Final config (env > .env > defaults):');
for (const [key, value] of Object.entries(finalConfig)) {
  console.log(`  ${key}: ${value}`);
}

fs.unlinkSync(envFilePath);
console.log('\nCleaned up temp .env file');

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. process.env values are ALWAYS strings — convert explicitly.
// 2. Use ?? instead of || when 0, "", or "false" are valid.
// 3. process.env.ENABLED === true is ALWAYS false. Compare
//    to 'true' or use a helper.
// 4. NODE_ENV is the standard for environment mode.
// 5. A dotenv reader: read file, split lines, parse key=value,
//    skip comments, strip quotes.
// 6. Config hierarchy: env var > .env file > defaults.
// 7. Never commit .env files with secrets. Use .env.example.
// ============================================================

console.log('\nThe Sarkari Office rests, perfectly configured.');
