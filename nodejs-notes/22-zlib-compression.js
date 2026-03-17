/** ============================================================
 FILE 22: Zlib Compression — Gzip, Brotli & Streams
 ============================================================
 Topic: The 'zlib' module — compressing and decompressing data
 WHY: Compression reduces bandwidth, shrinks storage, and
   speeds up transfers. Node's zlib supports gzip (universal),
   deflate, and brotli (modern, better ratios).
 ============================================================ */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream/promises');

// ============================================================
// STORY: Mumbai Dabba Compression
// The Dabbawala packs maximum dabbas (tiffin boxes) into
// minimum train space. Block 1: packs individual dabbas
// (buffers) with gzip and brotli. Block 2: sets up an
// assembly line (streams) for packing entire crates (files).
// ============================================================

(async function main() {
  // ============================================================
  // BLOCK 1 — Buffer-Based Compression
  // ============================================================

  console.log('='.repeat(60));
  console.log('  BLOCK 1: Buffer-Based Compression');
  console.log('='.repeat(60));

  const originalText = `DABBAWALA MANIFEST
${'='.repeat(40)}
${Array.from({ length: 20 }, (_, i) =>
  `Dabba ${String(i + 1).padStart(3, '0')}: Route-${['Churchgate', 'Dadar', 'Andheri', 'Borivali'][i % 4]}`
).join('\n')}
${'='.repeat(40)}
Total dabbas: 20 | Status: READY`;

  const originalBuffer = Buffer.from(originalText, 'utf8');
  console.log(`\n  Original size : ${originalBuffer.length} bytes`);

  // ── Gzip ──────────────────────────────────────────────────
  // WHY: Most widely supported compression format.

  console.log('\n--- Gzip ---');
  const gzipped = zlib.gzipSync(originalBuffer);
  const gzipRatio = ((1 - gzipped.length / originalBuffer.length) * 100).toFixed(1);
  console.log(`  Compressed  : ${gzipped.length} bytes (${gzipRatio}% smaller)`);

  const gunzipped = zlib.gunzipSync(gzipped);
  console.log(`  Data intact : ${gunzipped.toString('utf8') === originalText}`);

  // ── Brotli ────────────────────────────────────────────────
  // WHY: Better ratios than gzip, especially for text.

  console.log('\n--- Brotli ---');
  const brotlied = zlib.brotliCompressSync(originalBuffer);
  const brotliRatio = ((1 - brotlied.length / originalBuffer.length) * 100).toFixed(1);
  console.log(`  Compressed  : ${brotlied.length} bytes (${brotliRatio}% smaller)`);
  console.log(`  Data intact : ${zlib.brotliDecompressSync(brotlied).toString('utf8') === originalText}`);

  // ── Comparison ────────────────────────────────────────────
  console.log('\n--- Comparison ---');
  console.log(`  Original: ${originalBuffer.length}B | Gzip: ${gzipped.length}B (${gzipRatio}%) | Brotli: ${brotlied.length}B (${brotliRatio}%)`);

  // ============================================================
  // BLOCK 2 — Stream-Based Compression (Files)
  // ============================================================

  console.log('\n' + '='.repeat(60));
  console.log('  BLOCK 2: Stream-Based Compression (Files)');
  console.log('='.repeat(60));

  // WHY: Streams handle large files without loading everything into memory.
  // pipeline() handles backpressure and cleanup.

  const tmpDir = os.tmpdir();
  const srcFile = path.join(tmpDir, `dabbawala-${Date.now()}.txt`);
  const gzFile = srcFile + '.gz';
  const outFile = srcFile + '.restored.txt';

  const fileContent = Array.from({ length: 200 }, (_, i) =>
    `Route ${String(i + 1).padStart(4, '0')}: ${'ABCDEFGHIJ'.repeat(5)} — ${((i + 1) * 0.5).toFixed(1)}kg`
  ).join('\n');

  fs.writeFileSync(srcFile, fileContent, 'utf8');
  const srcSize = fs.statSync(srcFile).size;
  console.log(`\n  Source: ${srcSize} bytes`);

  // ── Compress ──────────────────────────────────────────────

  await pipeline(
    fs.createReadStream(srcFile),
    zlib.createGzip({ level: 9 }), // level 9 = max compression
    fs.createWriteStream(gzFile)
  );

  const gzSize = fs.statSync(gzFile).size;
  console.log(`  Gzipped: ${gzSize} bytes (${((1 - gzSize / srcSize) * 100).toFixed(1)}% smaller)`);

  // ── Decompress ────────────────────────────────────────────

  await pipeline(
    fs.createReadStream(gzFile),
    zlib.createGunzip(),
    fs.createWriteStream(outFile)
  );

  const outSize = fs.statSync(outFile).size;
  console.log(`  Restored: ${outSize} bytes, match: ${outSize === srcSize}`);
  console.log(`  Content match: ${fs.readFileSync(outFile, 'utf8') === fileContent}`);

  // ── Cleanup ───────────────────────────────────────────────
  for (const f of [srcFile, gzFile, outFile]) fs.unlinkSync(f);
  console.log('  Temp files cleaned up.');

  console.log('\n' + '='.repeat(60));

})().catch(console.error);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. gzipSync/gunzipSync — sync buffer compression
// 2. brotliCompressSync/brotliDecompressSync — better ratios
// 3. createGzip/createGunzip — transform streams for files
// 4. stream.pipeline() — connect streams with error handling
// 5. Compression level (1-9): higher = smaller but slower
// 6. Gzip is universal; Brotli is better but newer
// 7. Streams handle large files without memory bloat
// 8. Always verify decompressed data matches the original
// ============================================================
