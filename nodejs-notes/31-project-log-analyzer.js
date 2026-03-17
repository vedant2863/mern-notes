/** ============================================================
    FILE 31: Railway Log Analyzer — Streaming Log Analyzer
    ============================================================
    Topic: Stream pipelines for large-file processing
    Combines: streams (Transform, pipeline), fs, zlib, crypto

    USAGE:
      node 31-project-log-analyzer.js <logfile>
      node 31-project-log-analyzer.js <logfile.gz>
    DEMO MODE (no arguments):
      node 31-project-log-analyzer.js
    ============================================================ */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const os = require('os');
const { Transform, pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

// ============================================================
// SECTION 1: Configuration
// ============================================================
const DEMO_MODE = process.argv.length <= 2 || process.argv[2] === '--demo';
const DEMO_DIR = path.join(os.tmpdir(), 'railway-log-demo-' + process.pid);

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';

function banner(text) {
  const rule = '='.repeat(60);
  console.log(`\n${CYAN}${rule}${RESET}`);
  console.log(`${BOLD}  ${text}${RESET}`);
  console.log(`${CYAN}${rule}${RESET}`);
}
function thinRule() { console.log(DIM + '\u2500'.repeat(60) + RESET); }

// ============================================================
// SECTION 2: Log Generator
// ============================================================

const LOG_LEVELS = ['INFO', 'INFO', 'INFO', 'INFO', 'WARN', 'WARN', 'ERROR', 'DEBUG', 'DEBUG', 'INFO'];
const SOURCES = ['pnr-service', 'booking-engine', 'db-pool', 'payment-gateway', 'tatkal-scheduler', 'seat-allocator'];
const MESSAGES = {
  INFO:  ['PNR status checked', 'Ticket booked', 'Seat availability fetched', 'Health check passed'],
  WARN:  ['High load during tatkal', 'Slow query: 2340ms', 'Rate limit approaching'],
  ERROR: ['DB connection timeout', 'Payment gateway timeout', 'Null pointer in seat handler', 'Server overloaded'],
  DEBUG: ['Parsing PNR body', 'Cache lookup for schedule', 'Entering booking middleware']
};

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateLogLine(baseTime, offsetMs) {
  const ts = new Date(baseTime.getTime() + offsetMs).toISOString();
  const level = randomItem(LOG_LEVELS);
  const source = randomItem(SOURCES);
  const reqId = crypto.randomBytes(6).toString('hex');
  return `${ts} [${level.padEnd(5)}] ${source.padEnd(18)} | ${randomItem(MESSAGES[level])} (req:${reqId})`;
}

async function generateLogFile(filePath, lineCount) {
  const baseTime = new Date('2024-06-15T10:00:00Z');
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(generateLogLine(baseTime, i * 1200 + Math.floor(Math.random() * 800)));
  }
  await fsp.writeFile(filePath, lines.join('\n') + '\n', 'utf-8');
  return lines.length;
}

// ============================================================
// SECTION 3: Custom Transform Streams
// ============================================================

// Line Parser: raw text -> structured log objects
class LogParser extends Transform {
  constructor() {
    super({ objectMode: true });
    this._buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = this._parseLine(line);
      if (parsed) this.push(parsed);
    }
    callback();
  }

  _flush(callback) {
    if (this._buffer.trim()) {
      const parsed = this._parseLine(this._buffer);
      if (parsed) this.push(parsed);
    }
    callback();
  }

  _parseLine(line) {
    const match = line.match(/^(\S+)\s+\[(\w+)\s*\]\s+(\S+)\s+\|\s+(.+)$/);
    if (!match) return null;
    return { timestamp: match[1], level: match[2].trim(), source: match[3].trim(), message: match[4].trim() };
  }
}

// Aggregator: collects stats from parsed log objects
class LogAggregator extends Transform {
  constructor() {
    super({ objectMode: true, readableObjectMode: true });
    this.stats = { totalLines: 0, byLevel: {}, bySrc: {}, errorMessages: {}, firstTs: null, lastTs: null };
  }

  _transform(entry, encoding, callback) {
    const s = this.stats;
    s.totalLines++;
    s.byLevel[entry.level] = (s.byLevel[entry.level] || 0) + 1;
    s.bySrc[entry.source] = (s.bySrc[entry.source] || 0) + 1;
    if (entry.level === 'ERROR') {
      const cleanMsg = entry.message.replace(/\s*\(req:\w+\)$/, '');
      s.errorMessages[cleanMsg] = (s.errorMessages[cleanMsg] || 0) + 1;
    }
    if (!s.firstTs) s.firstTs = entry.timestamp;
    s.lastTs = entry.timestamp;
    this.push(entry);
    callback();
  }
}

// ============================================================
// SECTION 4: Analysis Pipeline
// ============================================================
// Pipeline: file -> (gunzip?) -> parser -> aggregator
// pipeline() handles backpressure and error propagation.

async function analyzeLog(filePath) {
  const isGz = filePath.endsWith('.gz');
  const stages = [fs.createReadStream(filePath)];
  if (isGz) stages.push(zlib.createGunzip());
  const parser = new LogParser();
  const aggregator = new LogAggregator();
  stages.push(parser, aggregator);
  stages.push(new Transform({ objectMode: true, transform(chunk, enc, cb) { cb(); } }));
  await pipelineAsync(...stages);
  return aggregator.stats;
}

// ============================================================
// SECTION 5: Stats Formatter
// ============================================================

function printStats(stats, label) {
  thinRule();
  console.log(`${BOLD}  Analysis: ${label}${RESET}`);
  thinRule();

  console.log(`\n  Total lines: ${BOLD}${stats.totalLines}${RESET}`);
  console.log(`  Range: ${DIM}${stats.firstTs} to ${stats.lastTs}${RESET}`);

  console.log(`\n  ${BOLD}By Level:${RESET}`);
  const levelColors = { INFO: GREEN, WARN: YELLOW, ERROR: RED, DEBUG: DIM };
  for (const [level, count] of Object.entries(stats.byLevel).sort((a, b) => b[1] - a[1])) {
    const color = levelColors[level] || RESET;
    const bar = '\u2588'.repeat(Math.round(count / stats.totalLines * 40));
    console.log(`    ${color}${level.padEnd(6)}${RESET} ${String(count).padStart(5)}  ${DIM}${bar}${RESET}`);
  }

  console.log(`\n  ${BOLD}By Service:${RESET}`);
  for (const [src, count] of Object.entries(stats.bySrc).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${CYAN}${src.padEnd(20)}${RESET} ${String(count).padStart(5)}`);
  }

  if (Object.keys(stats.errorMessages).length > 0) {
    console.log(`\n  ${BOLD}Top Errors:${RESET}`);
    for (const [msg, count] of Object.entries(stats.errorMessages).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    ${RED}${String(count).padStart(4)}x${RESET} ${msg}`);
    }
  }
  console.log('');
}

// ============================================================
// SECTION 6: Compression Utility
// ============================================================

async function compressFile(srcPath, destPath) {
  await pipelineAsync(fs.createReadStream(srcPath), zlib.createGzip({ level: 6 }), fs.createWriteStream(destPath));
  const srcStat = await fsp.stat(srcPath);
  const dstStat = await fsp.stat(destPath);
  console.log(`  Compressed: ${srcStat.size} -> ${dstStat.size} bytes (${((1 - dstStat.size / srcStat.size) * 100).toFixed(1)}% reduction)`);
}

// ============================================================
// SECTION 7: Demo Mode
// ============================================================

async function runDemo() {
  banner('Railway Log Analyzer (DEMO)');
  await fsp.mkdir(DEMO_DIR, { recursive: true });
  const logFile = path.join(DEMO_DIR, 'irctc-server.log');
  const gzFile = path.join(DEMO_DIR, 'irctc-server.log.gz');

  thinRule();
  console.log(`${BOLD}  Step 1: Generate sample log (1200 lines)${RESET}`);
  thinRule();
  const lineCount = await generateLogFile(logFile, 1200);
  const stat = await fsp.stat(logFile);
  console.log(`  Created: ${DIM}${logFile}${RESET} (${lineCount} lines, ${stat.size} bytes)`);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 2: Analyze plain .log${RESET}`);
  thinRule();
  const stats1 = await analyzeLog(logFile);
  printStats(stats1, 'irctc-server.log');

  thinRule();
  console.log(`${BOLD}  Step 3: Compress with gzip${RESET}`);
  thinRule();
  await compressFile(logFile, gzFile);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 4: Analyze .gz file${RESET}`);
  thinRule();
  const stats2 = await analyzeLog(gzFile);
  printStats(stats2, 'irctc-server.log.gz');

  thinRule();
  console.log(`${BOLD}  Verification${RESET}`);
  thinRule();
  const match = stats1.totalLines === stats2.totalLines;
  const icon = match ? `${GREEN}\u2713${RESET}` : `${RED}\u2717${RESET}`;
  console.log(`  ${icon}  Plain and gzip match: ${stats1.totalLines} == ${stats2.totalLines} lines`);

  await fsp.rm(DEMO_DIR, { recursive: true, force: true });
  console.log(`  Cleaned up ${DIM}${DEMO_DIR}${RESET}`);

  banner('KEY TAKEAWAYS');
  console.log(`
  1. Transform streams process data chunk-by-chunk with constant memory
  2. pipeline() handles backpressure and error propagation
  3. objectMode lets Transforms pass JS objects, not just buffers
  4. Inserting zlib.createGunzip() for .gz files is seamless
  5. Aggregation in a Transform avoids storing all lines in memory
  6. promisify(pipeline) gives clean async/await handling
  7. Stream composition makes each stage independently testable
`);
}

// ============================================================
// SECTION 8: CLI + Entry Point
// ============================================================

async function runCLI(filePath) {
  const resolved = path.resolve(filePath);
  try { await fsp.access(resolved); }
  catch { console.error(`${RED}File not found: ${resolved}${RESET}`); process.exit(1); }
  banner(`Analyzing ${path.basename(resolved)}`);
  printStats(await analyzeLog(resolved), path.basename(resolved));
}

async function main() {
  if (DEMO_MODE) await runDemo();
  else await runCLI(process.argv[2]);
}

main().catch(err => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
