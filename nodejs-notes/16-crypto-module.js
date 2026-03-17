/** ============================================================
 FILE 16: Crypto Module — Hashing, Passwords & Encryption
 ============================================================
 Topic: The 'crypto' module — cryptographic operations
 WHY: Hashing verifies data integrity, scrypt protects
   passwords, AES encryption guards secrets. Node's crypto
   module covers all three without external deps.
 ============================================================ */

const crypto = require('crypto');

// ============================================================
// STORY: RBI CURRENCY VAULT
// Chief Vault Officer Kavita uses hashing to verify currency
// serial numbers, scrypt to protect vault access codes, and
// AES encryption to secure shipment details between branches.
// ============================================================

// ============================================================
// BLOCK 1 — Hashing & Random Values
// ============================================================

console.log('='.repeat(60));
console.log('  BLOCK 1: Hashing & Random Values');
console.log('='.repeat(60));

// ── SHA-256 Hashing ─────────────────────────────────────────
// WHY: Creates a fixed-size fingerprint — great for integrity checks

const note = 'Serial #9AA-749321 denomination Rs 2000';
const hash1 = crypto.createHash('sha256').update(note).digest('hex');

console.log('\n--- Currency Note Verification (SHA-256) ---');
console.log(`  Note  : "${note}"`);
console.log(`  Hash  : ${hash1}`);

// Same input = same hash (deterministic)
const hash1Again = crypto.createHash('sha256').update(note).digest('hex');
console.log(`  Same? : ${hash1 === hash1Again}`);  // true

// Tiny change = completely different hash (avalanche effect)
const hash2 = crypto.createHash('sha256').update('Serial #9AA-749322 denomination Rs 2000').digest('hex');
console.log(`  Tampered: ${hash1 === hash2}`);  // false

// ── HMAC — hash with a secret key ──────────────────────────
// WHY: Proves both integrity AND authenticity

const hmac = crypto.createHmac('sha256', 'rbi-vault-seal-2024').update(note).digest('hex');
console.log('\n--- HMAC Authentication Seal ---');
console.log(`  HMAC  : ${hmac}`);

// ── Random Values ───────────────────────────────────────────
// WHY: Cryptographically secure randoms for tokens, salts, IDs

console.log('\n--- Random Generation ---');
console.log(`  Hex (16B) : ${crypto.randomBytes(16).toString('hex')}`);
console.log(`  UUID      : ${crypto.randomUUID()}`);
console.log(`  Int [1,100): ${crypto.randomInt(1, 100)}`);

// ============================================================
// BLOCK 2 — Vault Access Code Hashing (scrypt)
// ============================================================

console.log('\n' + '='.repeat(60));
console.log('  BLOCK 2: Vault Access Code Hashing (scrypt)');
console.log('='.repeat(60));

// WHY: Never store plaintext passwords. scrypt is memory-hard,
// making brute-force extremely expensive.

const vaultCode = 'RBI-Kavita-Vault7#2024';
const salt = crypto.randomBytes(16).toString('hex');
const derivedKey = crypto.scryptSync(vaultCode, salt, 64);
const storedValue = `${salt}:${derivedKey.toString('hex')}`;

console.log('\n--- Access Code Storage (salt:hash format) ---');
console.log(`  Stored : ${storedValue.slice(0, 50)}...`);

// ── Verification ────────────────────────────────────────────

function verifyAccessCode(candidate, stored) {
  const [storedSalt, storedHash] = stored.split(':');
  const candidateHash = crypto.scryptSync(candidate, storedSalt, 64).toString('hex');
  // WHY: timingSafeEqual prevents timing attacks
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(candidateHash, 'hex'));
}

console.log('\n--- Verification ---');
console.log(`  Correct: ${verifyAccessCode('RBI-Kavita-Vault7#2024', storedValue)}`);  // true
console.log(`  Wrong:   ${verifyAccessCode('WrongCode!', storedValue)}`);              // false

// ============================================================
// BLOCK 3 — Symmetric Encryption (AES-256-CBC)
// ============================================================

console.log('\n' + '='.repeat(60));
console.log('  BLOCK 3: Encryption (AES-256-CBC)');
console.log('='.repeat(60));

// WHY: Encryption makes data unreadable without the key.

const secretMsg = 'Gold reserves: 200 tonnes moved to Nagpur vault at midnight';

// Derive a 32-byte key (AES-256 requires exactly 32 bytes)
const encSalt = crypto.randomBytes(16);
const encKey = crypto.scryptSync('rbi-master-key-2024', encSalt, 32);

// WHY: IV ensures same plaintext encrypts differently each time
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-cbc', encKey, iv);
let encrypted = cipher.update(secretMsg, 'utf8', 'hex');
encrypted += cipher.final('hex');

console.log('\n--- Encrypt ---');
console.log(`  Plaintext : "${secretMsg}"`);
console.log(`  Encrypted : ${encrypted.slice(0, 40)}...`);

// ── Decrypt ─────────────────────────────────────────────────

const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv);
let decrypted = decipher.update(encrypted, 'hex', 'utf8');
decrypted += decipher.final('utf8');

console.log('\n--- Decrypt ---');
console.log(`  Decrypted : "${decrypted}"`);
console.log(`  Match     : ${decrypted === secretMsg}`);  // true

// WHY: Receiver needs salt + iv + ciphertext to decrypt
console.log('\n--- Encrypted Package (for transmission) ---');
console.log(`  { salt, iv, ciphertext, algorithm: 'aes-256-cbc' }`);

console.log('\n' + '='.repeat(60));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. createHash('sha256') — deterministic fingerprint of data
// 2. createHmac — hash with a secret key (proves authenticity)
// 3. randomBytes/randomUUID/randomInt — crypto-secure randoms
// 4. scryptSync — memory-hard password hashing (always use salt)
// 5. Store passwords as "salt:hash", verify by re-deriving
// 6. AES-256-CBC via createCipheriv/createDecipheriv
// 7. Always use a random IV per encryption operation
// 8. timingSafeEqual prevents timing side-channel attacks
// ============================================================
