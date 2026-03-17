/** ============================================================
 FILE 5: Buffers — Working with Raw Binary Data
 ============================================================
 Topic: Buffer creation, encoding, binary read/write, slicing
 ============================================================ */

// ============================================================
// STORY: Worker Ravi at India Post Ghaziabad handles raw binary
// dak: converting formats, reading headers, slicing and
// combining parcels.
// ============================================================

// ============================================================
// EXAMPLE BLOCK 1 — Creating Buffers and Encoding Conversions
// ============================================================

// ────────────────────────────────────────────────────
// SECTION 1 — Buffer Creation Methods
// ────────────────────────────────────────────────────

const emptyBuf = Buffer.alloc(10);
console.log('Buffer.alloc(10):', emptyBuf);
// Output: <Buffer 00 00 00 00 00 00 00 00 00 00>

const helloBuf = Buffer.from('Namaste Bharat');
console.log('Buffer.from(string):', helloBuf.toString());

// WHY: allocUnsafe is faster but may contain old memory data.
//      Only use when you will immediately overwrite every byte.
const unsafeBuf = Buffer.allocUnsafe(10);
console.log('allocUnsafe (may have garbage):', unsafeBuf);

// ────────────────────────────────────────────────────
// SECTION 2 — Length: Bytes vs Characters
// ────────────────────────────────────────────────────

// For multi-byte characters, byte length differs from string length.
const emojiBuf = Buffer.from('cafe\u0301');
console.log('\nString length of "cafe\u0301":', 'cafe\u0301'.length); // 5
console.log('Buffer byte length:', emojiBuf.length); // 6

// ────────────────────────────────────────────────────
// SECTION 3 — Encoding Conversions
// ────────────────────────────────────────────────────

const sourceBuf = Buffer.from('Namaste Bharat', 'utf8');
console.log('\n--- Encoding Conversions ---');
console.log('Hex    :', sourceBuf.toString('hex'));
console.log('Base64 :', sourceBuf.toString('base64'));

const fromHex = Buffer.from('48656c6c6f', 'hex');
console.log('From hex:', fromHex.toString()); // Hello

// ============================================================
// EXAMPLE BLOCK 2 — Binary Reading and Writing
// ============================================================

// ────────────────────────────────────────────────────
// SECTION 1 — Reading Integers from Buffers
// ────────────────────────────────────────────────────

const dataBuf = Buffer.from([0xFF, 0x03, 0xE8, 0x00, 0x00, 0x01, 0x00]);
console.log('\n--- Binary Reading ---');
console.log('readUInt8(0):', dataBuf.readUInt8(0));       // 255
console.log('readUInt16BE(1):', dataBuf.readUInt16BE(1)); // 1000
console.log('readInt32LE(3):', dataBuf.readInt32LE(3));   // 256

// ────────────────────────────────────────────────────
// SECTION 2 — Building a Binary Message Protocol
// ────────────────────────────────────────────────────
// Format: [type: 1 byte] [length: 2 bytes BE] [payload: variable]

function createMessage(type, payload) {
  const payloadBuf = Buffer.from(payload, 'utf8');
  const header = Buffer.alloc(3);
  header.writeUInt8(type, 0);
  header.writeUInt16BE(payloadBuf.length, 1);
  return Buffer.concat([header, payloadBuf]);
}

function parseMessage(messageBuf) {
  const type = messageBuf.readUInt8(0);
  const length = messageBuf.readUInt16BE(1);
  const payload = messageBuf.subarray(3, 3 + length).toString('utf8');
  return { type, length, payload };
}

console.log('\n--- Binary Message Protocol ---');
const msg = createMessage(1, 'Dak delivered to Ghaziabad hub');
console.log('Parsed:', parseMessage(msg));
// Output: { type: 1, length: 29, payload: 'Dak delivered to Ghaziabad hub' }

// ============================================================
// EXAMPLE BLOCK 3 — Slicing, Combining, and Searching
// ============================================================

// ────────────────────────────────────────────────────
// SECTION 1 — subarray (Shared Memory!)
// ────────────────────────────────────────────────────
// subarray() returns a VIEW — mutations affect the original.

const original = Buffer.from('ABCDEF');
const slice = original.subarray(2, 5);
slice[0] = 88; // ASCII 'X'
console.log('\n--- subarray (shared memory) ---');
console.log('Original after slice mutation:', original.toString()); // ABXDEF

// ────────────────────────────────────────────────────
// SECTION 2 — concat and compare
// ────────────────────────────────────────────────────

const combined = Buffer.concat([Buffer.from('Namaste '), Buffer.from('Bharat')]);
console.log('\nConcat:', combined.toString());

const bufs = [Buffer.from('chai'), Buffer.from('aam'), Buffer.from('dosa')];
bufs.sort(Buffer.compare);
console.log('Sorted:', bufs.map(b => b.toString())); // [ 'aam', 'chai', 'dosa' ]

// ────────────────────────────────────────────────────
// SECTION 3 — indexOf, includes, fill, copy
// ────────────────────────────────────────────────────

const searchBuf = Buffer.from('Ravi sorts dak parcels at India Post');
console.log('\nindexOf("sorts"):', searchBuf.indexOf('sorts')); // 5
console.log('includes("parcels"):', searchBuf.includes('parcels')); // true

// fill(0) is essential for clearing sensitive data from memory.
const sensitiveBuf = Buffer.from('secret-password');
sensitiveBuf.fill(0);
console.log('After fill(0):', sensitiveBuf);

// copy() copies bytes from one buffer into another at specified offsets.
const src = Buffer.from('NODE');
const dest = Buffer.alloc(10);
dest.fill(0x2D); // '-'
src.copy(dest, 3);
console.log('After copy:', dest.toString()); // ---NODE---

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Buffer.alloc() = safe zero-filled; Buffer.from() for strings/arrays.
//    Avoid allocUnsafe unless overwriting every byte immediately.
// 2. Multiple encodings: utf8, hex, base64. Convert with toString/from.
// 3. Binary read/write (readUInt8, writeUInt16BE) for real protocols.
// 4. subarray() shares memory — mutations affect the parent.
// 5. concat() joins, compare() sorts, indexOf/includes search.
// 6. fill(0) to clear sensitive data before discarding.
// ============================================================
