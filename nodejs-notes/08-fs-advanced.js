/** ============================================================
 FILE 8: Advanced File System — Directories, Streams, Watchers
 ============================================================
 Topic: mkdir, readdir, stat, rename, copy, unlink, rm,
        watch, createReadStream, createWriteStream
 ============================================================ */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

// ============================================================
// STORY: Editor Kavita now manages the entire DD file archive —
// folder hierarchies, metadata, moving stories between desks,
// watching for breaking news (fs.watch), and streaming large
// broadcast recordings.
// ============================================================

const TEMP_DIR = path.join(__dirname, '_temp_dd_newsroom_08');

(async () => {

  // ============================================================
  // EXAMPLE BLOCK 1 — Directories and File Metadata
  // ============================================================

  console.log('=== BLOCK 1: Directories and File Metadata ===\n');

  // ────────────────────────────────────────────────────
  // SECTION 1 — Creating Directories
  // ────────────────────────────────────────────────────
  // recursive:true creates all parents; does NOT throw if exists.

  await fsp.mkdir(path.join(TEMP_DIR, 'archive', 'sports', 'cricket'), { recursive: true });
  await fsp.mkdir(path.join(TEMP_DIR, 'archive', 'politics'), { recursive: true });
  await fsp.mkdir(path.join(TEMP_DIR, 'archive', 'tech'), { recursive: true });
  console.log('Created: archive/{sports/cricket, politics, tech}');

  // Seed files
  const seeds = [
    ['archive/sports/scores.txt', 'India 350/4\n'],
    ['archive/sports/cricket/recap.txt', 'Virat hits century!\n'],
    ['archive/politics/parliament.txt', 'Monsoon session concludes.\n'],
    ['archive/tech/isro-update.txt', 'Chandrayaan-4 announced!\n'],
    ['archive/README.txt', 'DD Archive root.\n'],
  ];
  for (const [rel, content] of seeds) {
    await fsp.writeFile(path.join(TEMP_DIR, rel), content);
  }

  // ────────────────────────────────────────────────────
  // SECTION 2 — readdir with withFileTypes
  // ────────────────────────────────────────────────────
  // Returns Dirent objects — no extra stat() needed.

  const dirents = await fsp.readdir(path.join(TEMP_DIR, 'archive'), { withFileTypes: true });
  console.log('\nreaddir (withFileTypes):');
  for (const d of dirents) {
    console.log(`  [${d.isDirectory() ? 'DIR ' : 'FILE'}] ${d.name}`);
  }

  // ────────────────────────────────────────────────────
  // SECTION 3 — stat()
  // ────────────────────────────────────────────────────

  const stats = await fsp.stat(path.join(TEMP_DIR, 'archive', 'sports', 'scores.txt'));
  console.log('\nstat(scores.txt) — size:', stats.size, '| isFile:', stats.isFile());

  // ────────────────────────────────────────────────────
  // SECTION 4 — Recursive Directory Listing
  // ────────────────────────────────────────────────────

  async function listFilesRecursive(dir, baseDir) {
    baseDir = baseDir || dir;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...await listFilesRecursive(fullPath, baseDir));
      else results.push(path.relative(baseDir, fullPath));
    }
    return results;
  }

  const allFiles = await listFilesRecursive(path.join(TEMP_DIR, 'archive'));
  console.log('\nRecursive listing:');
  allFiles.forEach(f => console.log('  ' + f));

  // ============================================================
  // EXAMPLE BLOCK 2 — Rename, Copy, Delete
  // ============================================================

  console.log('\n=== BLOCK 2: Rename, Copy, Delete ===\n');

  // ────────────────────────────────────────────────────
  // SECTION 1 — rename (also moves files)
  // ────────────────────────────────────────────────────

  await fsp.rename(
    path.join(TEMP_DIR, 'archive', 'tech', 'isro-update.txt'),
    path.join(TEMP_DIR, 'archive', 'tech', 'chandrayaan-4.txt')
  );
  console.log('rename: isro-update.txt -> chandrayaan-4.txt');

  // ────────────────────────────────────────────────────
  // SECTION 2 — copyFile
  // ────────────────────────────────────────────────────

  const srcFile = path.join(TEMP_DIR, 'archive', 'politics', 'parliament.txt');
  const destFile = path.join(TEMP_DIR, 'archive', 'politics', 'parliament-backup.txt');
  await fsp.copyFile(srcFile, destFile);
  console.log('copyFile: parliament.txt -> parliament-backup.txt');

  // ────────────────────────────────────────────────────
  // SECTION 3 — unlink and rm
  // ────────────────────────────────────────────────────

  await fsp.unlink(destFile);
  console.log('unlink: parliament-backup.txt deleted');

  await fsp.mkdir(path.join(TEMP_DIR, 'archive', 'temp-desk'), { recursive: true });
  await fsp.writeFile(path.join(TEMP_DIR, 'archive', 'temp-desk', 'draft.txt'), 'Draft');
  await fsp.rm(path.join(TEMP_DIR, 'archive', 'temp-desk'), { recursive: true, force: true });
  console.log('rm (recursive): temp-desk/ deleted');

  // ============================================================
  // EXAMPLE BLOCK 3 — Watching Files and Streaming
  // ============================================================

  console.log('\n=== BLOCK 3: Watchers and Streams ===\n');

  // ────────────────────────────────────────────────────
  // SECTION 1 — fs.watch()
  // ────────────────────────────────────────────────────
  // Uses OS-level notifications. Always close when done.

  const watchedFile = path.join(TEMP_DIR, 'breaking-news.txt');
  await fsp.writeFile(watchedFile, 'Initial content\n');

  const watchResults = [];
  const watcher = fs.watch(watchedFile, (eventType, filename) => {
    watchResults.push({ eventType, filename });
  });

  await fsp.writeFile(watchedFile, 'BREAKING: DD watch event fired!\n');
  await new Promise(resolve => setTimeout(resolve, 200));
  watcher.close();

  if (watchResults.length > 0) {
    console.log('Watch event:', watchResults[0].eventType);
  }

  // ────────────────────────────────────────────────────
  // SECTION 2 — Stream Copy (manual data/end)
  // ────────────────────────────────────────────────────
  // Streams process data in chunks — a 2GB file needs only ~64KB RAM.

  const streamSrc = path.join(TEMP_DIR, 'large-bulletin.txt');
  const lines = Array.from({ length: 500 }, (_, i) =>
    `Line ${i + 1}: DD archive bulletin entry.`
  );
  await fsp.writeFile(streamSrc, lines.join('\n') + '\n');

  const streamDest = path.join(TEMP_DIR, 'large-bulletin-copy.txt');
  let chunkCount = 0;

  await new Promise((resolve, reject) => {
    const readable = fs.createReadStream(streamSrc, { encoding: 'utf8', highWaterMark: 1024 });
    const writable = fs.createWriteStream(streamDest);
    readable.on('data', (chunk) => { chunkCount++; writable.write(chunk); });
    readable.on('end', () => writable.end());
    writable.on('finish', resolve);
    readable.on('error', reject);
  });
  console.log('Stream copy — chunks:', chunkCount);

  // ────────────────────────────────────────────────────
  // SECTION 3 — pipe() (simpler, handles backpressure)
  // ────────────────────────────────────────────────────

  const pipeDest = path.join(TEMP_DIR, 'large-bulletin-piped.txt');
  await new Promise((resolve, reject) => {
    fs.createReadStream(streamSrc).pipe(fs.createWriteStream(pipeDest))
      .on('finish', resolve).on('error', reject);
  });

  const srcSize = (await fsp.stat(streamSrc)).size;
  const pipeSize = (await fsp.stat(pipeDest)).size;
  console.log('pipe() copy — sizes match:', srcSize === pipeSize);

  // ────────────────────────────────────────────────────
  // CLEANUP
  // ────────────────────────────────────────────────────

  await fsp.rm(TEMP_DIR, { recursive: true, force: true });
  console.log('\nCleanup complete.');

})();

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. mkdir({recursive:true}) creates deep trees safely.
// 2. readdir({withFileTypes:true}) avoids extra stat() calls.
// 3. stat() reveals size, timestamps, and type (isFile/isDirectory).
// 4. rename() moves/renames, copyFile() duplicates, unlink() deletes,
//    rm({recursive,force}) deletes entire trees.
// 5. fs.watch() for OS-level file change notifications; always close.
// 6. Streams process data in chunks — use pipe() for simple transfers.
// 7. Use streams for large files; readFile/writeFile for small ones.
// ============================================================
