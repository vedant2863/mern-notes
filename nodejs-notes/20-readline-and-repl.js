/** ============================================================
 FILE 20: Readline & REPL — Line-by-Line Input Processing
 ============================================================
 Topic: readline for interactive/streamed input, REPL basics
 WHY: CLI tools, log parsers, and interactive prompts all
   need line-by-line processing. readline handles this
   elegantly. REPL powers custom shells.
 ============================================================ */

const readline = require('readline');
const { Readable } = require('stream');

// ============================================================
// STORY: Chai Pe Charcha (Tea-time Chat)
// Ramu Bhaiya runs a chai tapri. He takes orders (lines of
// input), categorizes them, and serves. Block 1 uses
// callbacks; Block 2 upgrades to async/await.
// ============================================================

// ============================================================
// BLOCK 1 — Classic readline with Simulated Input
// ============================================================

console.log('='.repeat(60));
console.log('  BLOCK 1: Classic readline — Callback Style');
console.log('='.repeat(60));

// WHY: Readable.from() simulates input so the script exits cleanly.

const chaiOrders = [
  'CUTTING: Half glass, less sugar',
  'MASALA: Extra adrak and elaichi',
  'REGULAR: Normal chai, two cups',
  'SPECIAL: Sulaimani chai with lemon!'
];

const rl1 = readline.createInterface({
  input: Readable.from(chaiOrders.map(l => l + '\n')),
  crlfDelay: Infinity // WHY: Treats \r\n as a single newline
});

const categories = {};
let orderCount = 0;

console.log('\n--- Processing chai orders ---\n');

rl1.on('line', (line) => {
  orderCount++;
  const colonIdx = line.indexOf(':');
  const category = colonIdx > -1 ? line.slice(0, colonIdx).trim() : 'UNKNOWN';
  const message = colonIdx > -1 ? line.slice(colonIdx + 1).trim() : line.trim();
  categories[category] = (categories[category] || 0) + 1;

  const responses = {
    CUTTING: 'Pouring half glass cutting chai',
    MASALA: 'Brewing special masala blend',
    SPECIAL: 'Preparing sulaimani — extra care!',
  };

  console.log(`  Order #${orderCount}: [${category}] "${message}"`);
  console.log(`    -> ${responses[category] || 'One regular chai coming up'}`);
});

rl1.on('close', () => {
  console.log('\n--- Summary ---');
  console.log(`  Total: ${orderCount}`);
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`    ${cat.padEnd(10)}: ${count}`);
  }
  console.log('');
  runBlock2();
});

// ============================================================
// BLOCK 2 — readline/promises with async/await
// ============================================================

async function runBlock2() {
  console.log('='.repeat(60));
  console.log('  BLOCK 2: readline/promises — Async/Await Style');
  console.log('='.repeat(60));

  // WHY: Modern async API that works with for-await-of.
  const { createInterface } = require('readline/promises');

  const tapriAlerts = [
    'CHAI_SPILL customer=Sharma_ji table=3',
    'SUGAR_LOW stock=200g threshold=500g',
    'RUSH_HOUR counter=main queue=12',
    'MILK_LOW stock=2L threshold=5L'
  ];

  const rl2 = createInterface({
    input: Readable.from(tapriAlerts.map(t => t + '\n')),
    crlfDelay: Infinity
  });

  // WHY: Async iteration is cleaner than event callbacks.

  console.log('\n--- Processing alerts (async) ---\n');

  const alerts = { critical: 0, warning: 0 };
  let alertNum = 0;

  for await (const line of rl2) {
    alertNum++;
    const [alertType, ...pairs] = line.split(' ');
    const details = Object.fromEntries(pairs.map(p => p.split('=')));

    const severity = ['SUGAR_LOW', 'MILK_LOW'].includes(alertType) ? 'CRITICAL' : 'WARNING';
    alerts[severity.toLowerCase()]++;

    console.log(`  Alert #${alertNum}: ${alertType} [${severity}]`);
    console.log(`    Details: ${JSON.stringify(details)}`);
  }

  console.log('\n--- Summary ---');
  console.log(`  Total: ${alertNum}, Critical: ${alerts.critical}, Warning: ${alerts.warning}`);

  // ── rl.question() (simulated) ─────────────────────────────

  console.log('\n--- Simulated question() ---');
  const rl3 = createInterface({ input: Readable.from(['Ramu Bhaiya\n']) });
  const name = await rl3.question('  Tapri owner: ');
  console.log(`  Namaste, ${name}!`);
  rl3.close();

  // ── REPL reference ────────────────────────────────────────
  console.log('\n--- REPL Module (Reference) ---');
  console.log('  // repl.start({ prompt: "tapri> " })');
  console.log('  // Options: prompt, eval, useGlobal, writer');
  console.log('  // Not started here to avoid hanging the script.');

  console.log('\n' + '='.repeat(60));
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. readline.createInterface({ input, output }) — create reader
// 2. Readable.from() — simulate input without blocking on stdin
// 3. rl.on('line', cb) — process each line via callback
// 4. crlfDelay: Infinity — handle both \n and \r\n endings
// 5. readline/promises — modern async API
// 6. for await (const line of rl) — async iteration over lines
// 7. rl.question(prompt) — ask and await an answer
// 8. repl.start() — create custom interactive shells
// ============================================================
