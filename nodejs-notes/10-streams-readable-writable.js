/** ============================================================
 FILE 10: Streams — Readable and Writable
 ============================================================
 Topic: fs.createReadStream, fs.createWriteStream, custom
        Readable and Writable streams, backpressure
 ============================================================ */

// ============================================================
// STORY: The Ganga flows from Gangotri chunk by chunk. Tehri Dam
// controls the flow (backpressure). Engineers build custom rivers
// (Readable) and irrigation canals (Writable).
// ============================================================

const fs = require("fs");
const path = require("path");
const { Readable, Writable } = require("stream");

const TEMP_DIR = path.join(__dirname, "_temp_streams");
const TEMP_READ_FILE = path.join(TEMP_DIR, "gangotri-source.txt");
const TEMP_WRITE_FILE = path.join(TEMP_DIR, "irrigation-canal.txt");

// ──────────────────────────────────────────────────────────────
// Setup and Cleanup
// ──────────────────────────────────────────────────────────────

function setup() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const lines = Array.from({ length: 200 }, (_, i) =>
    `Line ${i + 1}: The Ganga flows from Gangotri carrying data...`
  );
  fs.writeFileSync(TEMP_READ_FILE, lines.join("\n"), "utf8");
  console.log(`  [Setup] File size: ${fs.statSync(TEMP_READ_FILE).size} bytes\n`);
}

function cleanup() {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log("  [Cleanup] Temp files removed.\n");
}

// ============================================================
// EXAMPLE BLOCK 1 — fs.createReadStream
// ============================================================

function block1_readStream() {
  return new Promise((resolve) => {
    console.log("=== BLOCK 1: fs.createReadStream ===\n");

    // highWaterMark controls chunk size (default 64KB). Using 1KB to demo.
    const reader = fs.createReadStream(TEMP_READ_FILE, {
      encoding: "utf8",
      highWaterMark: 1024,
    });

    let chunkCount = 0;
    let totalBytes = 0;

    reader.on("data", (chunk) => {
      chunkCount++;
      totalBytes += Buffer.byteLength(chunk, "utf8");
    });

    reader.on("end", () => {
      console.log(`  Chunks: ${chunkCount} | Total bytes: ${totalBytes}`);
    });

    // Always handle 'error' on streams.
    reader.on("error", (err) => console.log("  Error:", err.message));

    reader.on("close", () => {
      // Error demo
      const bad = fs.createReadStream("/nonexistent/file.txt");
      bad.on("error", (err) => {
        console.log("  Error demo (nonexistent file):", err.code);
        console.log("");
        resolve();
      });
    });
  });
}

// ============================================================
// EXAMPLE BLOCK 2 — fs.createWriteStream and Backpressure
// ============================================================

function block2_writeStream() {
  return new Promise((resolve) => {
    console.log("=== BLOCK 2: fs.createWriteStream & Backpressure ===\n");

    // Small highWaterMark to trigger backpressure.
    const writer = fs.createWriteStream(TEMP_WRITE_FILE, {
      encoding: "utf8",
      highWaterMark: 256,
    });

    // write() returns false when buffer is full — wait for 'drain'.
    let writeCount = 0;
    let drainCount = 0;

    function writeMore() {
      let ok = true;
      while (writeCount < 100 && ok) {
        writeCount++;
        ok = writer.write(`Tehri Dam log entry #${writeCount}\n`);
        if (!ok && drainCount === 0) {
          console.log(`  Backpressure hit at write #${writeCount}`);
        }
      }
      if (writeCount < 100) {
        writer.once("drain", () => { drainCount++; writeMore(); });
      } else {
        writer.end();
      }
    }

    writeMore();

    writer.on("finish", () => {
      console.log(`  Writes: ${writeCount} | Drain events: ${drainCount}`);
      console.log(`  Output size: ${fs.statSync(TEMP_WRITE_FILE).size} bytes\n`);
      resolve();
    });

    writer.on("error", (err) => { console.log("  Error:", err.message); resolve(); });
  });
}

// ============================================================
// EXAMPLE BLOCK 3 — Custom Readable and Writable Streams
// ============================================================

function block3_customStreams() {
  return new Promise((resolve) => {
    console.log("=== BLOCK 3: Custom Readable & Writable Streams ===\n");

    // ── Custom Readable: implement _read(), push data, push(null) to end ──

    class GangotriSource extends Readable {
      constructor(options) {
        super(options);
        this.flowCount = 0;
        this.maxFlows = 5;
      }
      _read() {
        this.flowCount++;
        if (this.flowCount > this.maxFlows) { this.push(null); return; }
        this.push(`[Ganga flow #${this.flowCount}]\n`);
      }
    }

    console.log("  --- Custom Readable: GangotriSource ---");
    const ganga = new GangotriSource({ highWaterMark: 64 });
    const chunks = [];
    ganga.on("data", (chunk) => chunks.push(chunk.toString().trim()));
    ganga.on("end", () => {
      console.log(`  Emitted ${chunks.length} chunks:`, chunks.join(", "));

      // ── Custom Writable: implement _write(), call callback() when done ──

      class IrrigationCanal extends Writable {
        constructor(options) {
          super(options);
          this.storage = [];
        }
        _write(chunk, encoding, callback) {
          this.storage.push(chunk.toString().trim().toUpperCase());
          callback();
        }
      }

      console.log("\n  --- Pipe: GangotriSource -> IrrigationCanal ---");
      const ganga2 = new GangotriSource({ highWaterMark: 64 });
      const canal = new IrrigationCanal();
      ganga2.pipe(canal);

      canal.on("finish", () => {
        console.log(`  Canal received ${canal.storage.length} items`);
        console.log("");
        resolve();
      });
    });
  });
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

async function main() {
  setup();
  await block1_readStream();
  await block2_writeStream();
  await block3_customStreams();
  cleanup();

  // ============================================================
  // KEY TAKEAWAYS
  // ============================================================
  // 1. ReadStream emits 'data' chunks — never loads the whole file.
  // 2. highWaterMark controls chunk size (default 64KB for files).
  // 3. Always handle 'error' events on streams.
  // 4. write() returning false = backpressure — wait for 'drain'.
  // 5. Custom Readable: _read() + push(data) + push(null) to end.
  // 6. Custom Writable: _write(chunk, enc, cb) — call cb() when done.
  // 7. pipe() handles backpressure automatically.
  // ============================================================
}

main();
