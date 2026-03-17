/** ============================================================
 FILE 6: The Path Module — Cross-Platform File Paths
 ============================================================
 Topic: path.join, resolve, parse, format, normalize, relative
 ============================================================ */

const path = require('path');

// ============================================================
// STORY: Clerk Pandey ji manages a government office archive.
// He needs tools to navigate, combine, and normalize file
// addresses across ministry buildings (operating systems).
// ============================================================

// ============================================================
// EXAMPLE BLOCK 1 — Building and Dissecting Paths
// ============================================================

// ────────────────────────────────────────────────────
// SECTION 1 — path.join()
// ────────────────────────────────────────────────────
// Concatenates segments using OS separator. Never use + for paths.

const shelved = path.join('ministry', 'revenue', 'taxation', 'gst-circular.txt');
console.log('join:', shelved);

// join handles .. and . intelligently
const backtracked = path.join('ministry', 'revenue', '..', 'defence', 'procurement.txt');
console.log('join with ..:', backtracked);
// Output: ministry/defence/procurement.txt

// ────────────────────────────────────────────────────
// SECTION 2 — path.resolve()
// ────────────────────────────────────────────────────
// Builds an ABSOLUTE path. Processes right-to-left until absolute.

const resolved1 = path.resolve('revenue', 'gst-circular.txt');
console.log('\nresolve (relative):', resolved1);  // cwd + revenue/gst-circular.txt

const resolved2 = path.resolve('/ministry', '/archive', 'old-record.txt');
console.log('resolve (reset):', resolved2);  // /archive/old-record.txt

// ────────────────────────────────────────────────────
// SECTION 3 — basename, dirname, extname
// ────────────────────────────────────────────────────

const filePath = '/ministry/revenue/taxation/gst-circular.txt';
console.log('\n--- Dissecting a path ---');
console.log('basename:', path.basename(filePath));           // gst-circular.txt
console.log('basename sans ext:', path.basename(filePath, '.txt')); // gst-circular
console.log('dirname:', path.dirname(filePath));             // /ministry/revenue/taxation
console.log('extname:', path.extname(filePath));             // .txt
console.log('extname of .tar.gz:', path.extname('archive.tar.gz')); // .gz

// ────────────────────────────────────────────────────
// SECTION 4 — path.parse() and path.format()
// ────────────────────────────────────────────────────
// parse() splits into {root, dir, base, ext, name}. format() rebuilds.

const parsed = path.parse(filePath);
console.log('\nparse():', parsed);

const formatted = path.format({ dir: '/ministry/defence', name: 'procurement-policy', ext: '.pdf' });
console.log('format():', formatted);

// ============================================================
// EXAMPLE BLOCK 2 — Normalizing, Comparing, and Cross-Platform
// ============================================================

// ────────────────────────────────────────────────────
// SECTION 1 — path.relative()
// ────────────────────────────────────────────────────

console.log('\n--- relative() ---');
console.log('Relative:', path.relative('/ministry/revenue/taxation', '/ministry/defence/procurement'));
// Output: ../../defence/procurement

// ────────────────────────────────────────────────────
// SECTION 2 — path.normalize()
// ────────────────────────────────────────────────────

console.log('\n--- normalize() ---');
console.log(path.normalize('/ministry//revenue///taxation'));
// Output: /ministry/revenue/taxation
console.log(path.normalize('/ministry/revenue/../defence/./procurement'));
// Output: /ministry/defence/procurement

// ────────────────────────────────────────────────────
// SECTION 3 — Platform Constants
// ────────────────────────────────────────────────────

console.log('\n--- Platform ---');
console.log('path.sep:', JSON.stringify(path.sep));         // "/" or "\\"
console.log('path.delimiter:', JSON.stringify(path.delimiter)); // ":" or ";"
console.log('isAbsolute("/ministry"):', path.isAbsolute('/ministry'));     // true
console.log('isAbsolute("revenue"):', path.isAbsolute('revenue/taxation')); // false

// ────────────────────────────────────────────────────
// SECTION 4 — Cross-Platform: posix vs win32
// ────────────────────────────────────────────────────

console.log('\n--- Cross-Platform ---');
console.log('posix.join:', path.posix.join('ministry', 'revenue', 'file.txt'));
console.log('win32.join:', path.win32.join('ministry', 'revenue', 'file.txt'));

// ────────────────────────────────────────────────────
// SECTION 5 — Practical: Building Project Paths
// ────────────────────────────────────────────────────
// Anchor to __dirname, not process.cwd().

console.log('\n--- Project Path Builder ---');
const configFile = path.join(__dirname, 'config', 'settings.json');
console.log('Config file:', configFile);

const fileA = path.join(__dirname, 'src', 'routes', 'api', 'users.js');
const fileB = path.join(__dirname, 'src', 'models', 'User.js');
const importPath = path.relative(path.dirname(fileA), fileB);
console.log('Import path:', './' + importPath.split(path.sep).join('/'));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. NEVER concatenate paths with +. Use path.join() or path.resolve().
// 2. parse()/format() are inverses for decomposing/rebuilding paths.
// 3. relative() generates import paths between two locations.
// 4. normalize() cleans double slashes, dots, trailing slashes.
// 5. path.posix/path.win32 for cross-platform path generation.
// 6. Anchor project paths to __dirname, not process.cwd().
// ============================================================
