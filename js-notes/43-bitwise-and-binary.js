/**
 * ============================================================
 * FILE 43: Bitwise Operators & Binary Data
 * ============================================================
 * Binary representation, bitwise operators, permission flags,
 * color manipulation, and TypedArrays.
 *
 * STORY — Signal Master Pandey ji (Railway Junction, Allahabad)
 * Each bit in a signal byte represents a specific track signal.
 * Flipping a bit sets or clears a signal in one CPU cycle.
 * ============================================================
 */


// ============================================================
// SECTION 1 — BINARY REPRESENTATION
// ============================================================
// Bitwise ops treat numbers as 32-bit integers.

function toBin(num, bits = 8) {
  return (num >>> 0).toString(2).padStart(bits, "0");
}

console.log("5 binary:", (5).toString(2));         // 101
console.log("parseInt('1010',2):", parseInt("1010", 2)); // 10
console.log("42 as 8-bit:", toBin(42));            // 00101010
// 42 = 32 + 8 + 2


// ============================================================
// SECTION 2 — THE SEVEN BITWISE OPERATORS
// ============================================================

console.log("\n& (AND):", 12 & 10);          // 8
console.log("| (OR):", 12 | 10);             // 14
console.log("^ (XOR):", 12 ^ 10);           // 6
console.log("~ (NOT 5):", ~5);               // -6  (~n = -(n+1))
console.log("<< (5<<1):", 5 << 1);           // 10  (multiply by 2)
console.log(">> (40>>3):", 40 >> 3);         // 5   (divide by 8)
console.log(">>> (-1>>>0):", -1 >>> 0);      // 4294967295


// ============================================================
// SECTION 3 — PERMISSION FLAGS (RAILWAY SIGNALS)
// ============================================================
// Powers of 2: each occupies one bit.
// Grant |, Check &, Revoke & ~, Toggle ^.

console.log("\n=== Signal Flags ===");

const SIG = {
  RED:     0b00000001,
  GREEN:   0b00000010,
  YELLOW:  0b00000100,
  DISTANT: 0b00001000,
  SHUNT:   0b00010000,
  ROUTE:   0b00100000,
};

let signals = 0;
signals |= SIG.RED | SIG.GREEN | SIG.ROUTE;          // grant
console.log("Signals:", toBin(signals));               // 00100011

const hasSignal = (state, s) => (state & s) !== 0;
console.log("RED:", hasSignal(signals, SIG.RED));      // true
console.log("DISTANT:", hasSignal(signals, SIG.DISTANT)); // false

signals &= ~SIG.ROUTE;                                // revoke
console.log("After clear ROUTE:", toBin(signals));     // 00000011

signals ^= SIG.YELLOW;                                // toggle on
signals ^= SIG.YELLOW;                                // toggle off

function listActive(state) {
  return Object.entries(SIG).filter(([, b]) => (state & b) !== 0).map(([n]) => n);
}
console.log("Active:", listActive(signals));


// ============================================================
// SECTION 4 — COLOR MANIPULATION
// ============================================================
// 0xRRGGBB stores 3 channels. Extract with >>, combine with <<.

console.log("\n=== Colors ===");

const color = 0xff3322;
const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
console.log(`0x${color.toString(16)}: R=${r}, G=${g}, B=${b}`);

function rgbToHex(r, g, b) {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}
console.log("Signal green:", "0x" + rgbToHex(0, 255, 65).toString(16).padStart(6, "0"));

function invertColor(c) { return (~c) & 0xffffff; }
console.log("Inverted:", "0x" + invertColor(color).toString(16).padStart(6, "0"));


// ============================================================
// SECTION 5 — BIT TRICKS & CONVERSIONS
// ============================================================

// Count set bits (popcount)
function countBits(n) { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; }
console.log("\nBits in 255:", countBits(255));  // 8

// Power of 2 check
const isPow2 = n => n > 0 && (n & (n - 1)) === 0;
console.log("64 isPow2:", isPow2(64));         // true

// XOR swap
let a = 42, b2 = 99;
a ^= b2; b2 ^= a; a ^= b2;
console.log(`Swapped: a=${a}, b=${b2}`);        // 99, 42

// Floor with |0
console.log("7.9|0:", 7.9 | 0);               // 7


// ============================================================
// SECTION 6 — TYPED ARRAYS & ARRAYBUFFER
// ============================================================
// Fixed-type, contiguous-memory arrays for binary data.

console.log("\n=== TypedArrays ===");

const buf = new ArrayBuffer(16);
const bytes = new Uint8Array(buf);
bytes[0] = 0x52; bytes[1] = 0x61; bytes[2] = 0x69; bytes[3] = 0x6c;
console.log("Decoded:", String.fromCharCode(...bytes.slice(0, 4))); // Rail

const int32 = new Int32Array(buf);
console.log("Same bytes as Int32[0]:", int32[0]);

// DataView: endianness-aware access
const dv = new DataView(buf);
dv.setUint16(0, 0xCAFE, false);
console.log("DataView:", "0x" + dv.getUint16(0, false).toString(16));

// Common types: Uint8Array (1B), Int16Array (2B), Int32Array (4B),
// Float32Array (4B), Float64Array (8B), BigInt64Array (8B).


// ============================================================
// SECTION 7 — FULL TRACK ACCESS CONTROL DEMO
// ============================================================

console.log("\n=== Track Access Control ===");

class TrackAccess {
  static F = {
    READ: 1<<0, WRITE: 1<<1, EXECUTE: 1<<2,
    DELETE: 1<<3, CREATE: 1<<4, ADMIN: 1<<5, SUPER: 1<<6,
  };

  constructor(name, access = 0) { this.name = name; this.access = access; }
  grant(...p) { p.forEach(f => this.access |= f); return this; }
  revoke(...p) { p.forEach(f => this.access &= ~f); return this; }
  has(p) { return (this.access & p) === p; }

  toString() {
    const flags = Object.entries(TrackAccess.F)
      .filter(([, b]) => this.access & b).map(([n]) => n);
    return `${this.name} [${toBin(this.access)}] => ${flags.join(", ") || "NONE"}`;
  }
}

const F = TrackAccess.F;
const pandey = new TrackAccess("Pandey ji", 0b01111111);
const trainee = new TrackAccess("Trainee", F.READ);

console.log(pandey.toString());
console.log(trainee.toString());

trainee.grant(F.WRITE, F.CREATE);
console.log("Promoted:", trainee.toString());

console.log(pandey.has(F.DELETE) ? "[ALLOWED] Cancel route" : "[DENIED]");
console.log(trainee.has(F.DELETE) ? "[ALLOWED]" : "[DENIED] Trainee cannot cancel");


/**
 * ============================================================
 * KEY TAKEAWAYS
 * ============================================================
 * 1. Bitwise ops treat numbers as 32-bit integers.
 * 2. Seven operators: & | ^ ~ << >> >>>
 * 3. Flags: powers of 2. Grant |, check &, revoke & ~, toggle ^.
 * 4. Colors: 0xRRGGBB. Extract with >> & 0xff, combine with <<|.
 * 5. Tricks: isPowerOf2 with (n&(n-1))===0, popcount, XOR swap.
 * 6. TypedArrays: fixed-type binary access via ArrayBuffer.
 * 7. DataView: byte-level, endianness-aware buffer access.
 * ============================================================
 */
