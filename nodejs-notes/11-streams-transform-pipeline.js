/** ============================================================
 FILE 11: Streams — Transform and Pipeline
 ============================================================
 Topic: Transform streams, pipeline, stream/promises,
        Readable.from(), stream.finished()
 ============================================================ */

// ============================================================
// STORY: The Ganga flows through water treatment plants along
// the canal. Each plant transforms the water — one filters,
// another purifies. Pipeline carries it safely to the fields.
// ============================================================

const fs = require("fs");
const path = require("path");
const { Transform, Readable, Writable, pipeline, finished } = require("stream");
const { pipeline: pipelinePromise } = require("stream/promises");

const TEMP_DIR = path.join(__dirname, "_temp_transform");
const TEMP_INPUT = path.join(TEMP_DIR, "raw-ganga-water.txt");
const TEMP_OUTPUT = path.join(TEMP_DIR, "treated-water.txt");
const TEMP_PIPELINE_OUT = path.join(TEMP_DIR, "pipeline-out.txt");
const TEMP_ASYNC_OUT = path.join(TEMP_DIR, "async-pipeline-out.txt");

// ──────────────────────────────────────────────────────────────
// Setup and Cleanup
// ──────────────────────────────────────────────────────────────

function setup() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const lines = [
    "the ganga starts at gangotri glacier",
    "water flows through rishikesh and haridwar",
    "tehri dam controls the water level",
    "treatment plants purify the supply",
    "clean water reaches the fields",
  ];
  fs.writeFileSync(TEMP_INPUT, lines.join("\n"), "utf8");
  console.log("  [Setup] Created input file.\n");
}

function cleanup() {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log("  [Cleanup] Temp files removed.\n");
}

// ============================================================
// EXAMPLE BLOCK 1 — Transform Streams
// ============================================================

function block1_transformStreams() {
  return new Promise((resolve) => {
    console.log("=== BLOCK 1: Transform Streams ===\n");

    // ── Transform: both Readable and Writable. Data in, transformed out. ──

    class UppercaseTransform extends Transform {
      _transform(chunk, encoding, callback) {
        this.push(chunk.toString().toUpperCase());
        callback();
      }
    }

    // ── Line-Numbering Transform (with _flush for leftover data) ──

    class LineNumberTransform extends Transform {
      constructor(options) {
        super(options);
        this.lineNumber = 0;
        this.buffer = "";
      }
      _transform(chunk, encoding, callback) {
        this.buffer += chunk.toString();
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop(); // keep incomplete last line
        for (const line of lines) {
          this.lineNumber++;
          this.push(`${String(this.lineNumber).padStart(3, " ")} | ${line}\n`);
        }
        callback();
      }
      _flush(callback) {
        if (this.buffer.length > 0) {
          this.lineNumber++;
          this.push(`${String(this.lineNumber).padStart(3, " ")} | ${this.buffer}\n`);
        }
        callback();
      }
    }

    // Chain: file -> uppercase -> line-numbers -> file
    console.log("  Piping: file -> uppercase -> line-numbers -> file\n");
    const reader = fs.createReadStream(TEMP_INPUT, { encoding: "utf8" });
    reader
      .pipe(new UppercaseTransform())
      .pipe(new LineNumberTransform())
      .pipe(fs.createWriteStream(TEMP_OUTPUT));

    reader.on("close", () => {
      // Small delay for write to flush
      setTimeout(() => {
        const result = fs.readFileSync(TEMP_OUTPUT, "utf8");
        result.split("\n").filter(Boolean).forEach((line) => console.log(`    ${line}`));
        console.log("");
        resolve();
      }, 50);
    });
  });
}

// ============================================================
// EXAMPLE BLOCK 2 — stream.pipeline() (safe error handling)
// ============================================================

function block2_pipeline() {
  return new Promise((resolve) => {
    console.log("=== BLOCK 2: stream.pipeline() ===\n");

    // WHY: .pipe() does NOT forward errors. pipeline() destroys
    // all streams on error and calls a final callback.

    class ExclamationTransform extends Transform {
      _transform(chunk, encoding, callback) {
        const lines = chunk.toString().split("\n").filter(Boolean);
        this.push(lines.map((l) => `${l.trim()}!!!`).join("\n") + "\n");
        callback();
      }
    }

    pipeline(
      fs.createReadStream(TEMP_INPUT, { encoding: "utf8" }),
      new ExclamationTransform(),
      fs.createWriteStream(TEMP_PIPELINE_OUT),
      (err) => {
        if (err) { console.log("  Pipeline failed:", err.message); }
        else {
          const result = fs.readFileSync(TEMP_PIPELINE_OUT, "utf8");
          console.log("  Pipeline succeeded! Preview:");
          result.split("\n").filter(Boolean).slice(0, 2).forEach((l) => console.log(`    ${l}`));
        }

        // Error handling demo
        console.log("\n  --- Pipeline error handling ---");
        class FailingTransform extends Transform {
          constructor() { super(); this.count = 0; }
          _transform(chunk, encoding, callback) {
            this.count++;
            if (this.count > 1) return callback(new Error("Treatment plant malfunction!"));
            this.push(chunk);
            callback();
          }
        }

        const errorSource = Readable.from(["chunk one\n", "chunk two\n"]);
        const devNull = new Writable({ write(chunk, enc, cb) { cb(); } });

        pipeline(errorSource, new FailingTransform(), devNull, (err) => {
          if (err) console.log("  Pipeline caught error:", err.message);
          console.log("");
          resolve();
        });
      }
    );
  });
}

// ============================================================
// EXAMPLE BLOCK 3 — Async Streams: Promises & Generators
// ============================================================

async function block3_asyncStreams() {
  console.log("=== BLOCK 3: Async Streams ===\n");

  // ── stream/promises pipeline with async/await ──

  class StarTransform extends Transform {
    _transform(chunk, encoding, callback) {
      const lines = chunk.toString().split("\n").filter(Boolean);
      this.push(lines.map((l) => `* ${l.trim()}`).join("\n") + "\n");
      callback();
    }
  }

  try {
    await pipelinePromise(
      fs.createReadStream(TEMP_INPUT, { encoding: "utf8" }),
      new StarTransform(),
      fs.createWriteStream(TEMP_ASYNC_OUT)
    );
    const result = fs.readFileSync(TEMP_ASYNC_OUT, "utf8");
    console.log("  Async pipeline output (first 2 lines):");
    result.split("\n").filter(Boolean).slice(0, 2).forEach((l) => console.log(`    ${l}`));
  } catch (err) {
    console.log("  Async pipeline error:", err.message);
  }

  // ── Readable.from() with async generator ──

  console.log("\n  --- Readable.from() with async generator ---");

  async function* gangaFlow() {
    const readings = ["pH=7.4", "temp=22C", "clarity=high"];
    for (const reading of readings) {
      await new Promise((r) => setTimeout(r, 20));
      yield `[Sensor] ${reading}\n`;
    }
  }

  const sensorData = [];
  for await (const chunk of Readable.from(gangaFlow())) {
    sensorData.push(chunk.toString().trim());
  }
  sensorData.forEach((d) => console.log(`    ${d}`));

  // ── stream.finished() ──

  console.log("\n  --- stream.finished() ---");
  const shortStream = Readable.from(["done\n"]);
  await new Promise((resolve, reject) => {
    shortStream.resume();
    finished(shortStream, (err) => {
      if (err) reject(err);
      else { console.log("  finished() detected clean end"); resolve(); }
    });
  });

  console.log("");
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

async function main() {
  setup();
  await block1_transformStreams();
  await block2_pipeline();
  await block3_asyncStreams();
  cleanup();

  // ============================================================
  // KEY TAKEAWAYS
  // ============================================================
  // 1. Transform = Readable + Writable. Implement _transform() and optionally _flush().
  // 2. .pipe() chains are simple but do NOT propagate errors.
  // 3. stream.pipeline() destroys all streams on error — always prefer it.
  // 4. stream/promises pipeline works with async/await and try/catch.
  // 5. Readable.from() creates streams from arrays, strings, or async generators.
  // 6. stream.finished() reliably detects when any stream is done or errored.
  // ============================================================
}

main();
