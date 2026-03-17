/** ============================================================
    FILE 29: KaamKaro — Daily Kaam Manager
    ============================================================
    Topic: Building a complete CLI application
    Combines: process.argv, fs/promises, path, crypto

    USAGE:
      node 29-project-cli-task-manager.js add "Process pension"
      node 29-project-cli-task-manager.js list
      node 29-project-cli-task-manager.js done <id>
      node 29-project-cli-task-manager.js delete <id>
      node 29-project-cli-task-manager.js clear

    DEMO MODE (no arguments):
      node 29-project-cli-task-manager.js
    ============================================================ */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ============================================================
// SECTION 1: Configuration
// ============================================================
const DEMO_MODE = process.argv.length <= 2 || process.argv[2] === '--demo';
const KAAM_DIR = DEMO_MODE
  ? path.join(os.tmpdir(), 'kaamkaro-demo-' + process.pid)
  : path.dirname(process.argv[1]);
const KAAM_FILE = path.join(KAAM_DIR, 'kaam.json');

// ============================================================
// SECTION 2: Helpers
// ============================================================
function shortId() { return crypto.randomBytes(4).toString('hex'); }
function timestamp() { return new Date().toISOString(); }
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

function banner(text) {
  const rule = '='.repeat(60);
  console.log(`\n${CYAN}${rule}${RESET}`);
  console.log(`${BOLD}  ${text}${RESET}`);
  console.log(`${CYAN}${rule}${RESET}`);
}

function thinRule() { console.log(DIM + '\u2500'.repeat(60) + RESET); }

// ============================================================
// SECTION 3: Task Storage (JSON file I/O)
// ============================================================

async function ensureDir() { await fsp.mkdir(KAAM_DIR, { recursive: true }); }

async function loadKaam() {
  try { return JSON.parse(await fsp.readFile(KAAM_FILE, 'utf-8')); }
  catch { return []; }
}

async function saveKaam(tasks) {
  await ensureDir();
  await fsp.writeFile(KAAM_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

// ============================================================
// SECTION 4: Core Commands
// ============================================================

async function addKaam(title) {
  const tasks = await loadKaam();
  const task = { id: shortId(), title, status: 'pending', createdAt: timestamp() };
  tasks.push(task);
  await saveKaam(tasks);
  console.log(`${GREEN}  + Added:${RESET} [${task.id}] ${task.title}`);
  return task;
}

async function listKaam() {
  const tasks = await loadKaam();
  if (tasks.length === 0) {
    console.log(`${DIM}  (desk is empty)${RESET}`);
    return tasks;
  }
  for (const t of tasks) {
    const icon = t.status === 'done' ? `${GREEN}\u2713${RESET}` : `${YELLOW}\u2610${RESET}`;
    const titleStr = t.status === 'done' ? `${DIM}${t.title}${RESET}` : t.title;
    console.log(`  ${icon}  [${CYAN}${t.id}${RESET}] ${titleStr}  ${DIM}${formatDate(t.createdAt)}${RESET}`);
  }
  return tasks;
}

async function markDone(id) {
  const tasks = await loadKaam();
  const task = tasks.find(t => t.id === id);
  if (!task) { console.log(`${RED}  ! Not found: ${id}${RESET}`); return null; }
  task.status = 'done';
  await saveKaam(tasks);
  console.log(`${GREEN}  \u2713 Done:${RESET} ${task.title}`);
  return task;
}

async function deleteKaam(id) {
  const tasks = await loadKaam();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) { console.log(`${RED}  ! Not found: ${id}${RESET}`); return null; }
  const [removed] = tasks.splice(idx, 1);
  await saveKaam(tasks);
  console.log(`${RED}  - Deleted:${RESET} ${removed.title}`);
  return removed;
}

async function clearDesk() {
  await saveKaam([]);
  console.log(`${YELLOW}  ~ All tasks cleared${RESET}`);
}

// ============================================================
// SECTION 5: CLI Router
// ============================================================

async function runCLI(args) {
  const [command, ...rest] = args;
  switch (command) {
    case 'add': {
      const title = rest.join(' ');
      if (!title) { console.log(`${RED}Usage: add <description>${RESET}`); return; }
      await addKaam(title); break;
    }
    case 'list': await listKaam(); break;
    case 'done':
      if (!rest[0]) { console.log(`${RED}Usage: done <id>${RESET}`); return; }
      await markDone(rest[0]); break;
    case 'delete':
      if (!rest[0]) { console.log(`${RED}Usage: delete <id>${RESET}`); return; }
      await deleteKaam(rest[0]); break;
    case 'clear': await clearDesk(); break;
    default:
      console.log(`${RED}Unknown: ${command}${RESET}`);
      console.log('Commands: add, list, done, delete, clear');
  }
}

// ============================================================
// SECTION 6: Demo Mode
// ============================================================

async function runDemo() {
  banner('KaamKaro \u2014 Daily Kaam Manager (DEMO)');
  console.log(`  Storage: ${DIM}${KAAM_FILE}${RESET}\n`);

  thinRule();
  console.log(`${BOLD}  Step 1: Adding tasks${RESET}`);
  thinRule();
  const t1 = await addKaam('Process pension application');
  const t2 = await addKaam('Draft reply to RTI query');
  const t3 = await addKaam('Forward file to Under Secretary');

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 2: Listing all${RESET}`);
  thinRule();
  await listKaam();

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 3: Mark done + delete${RESET}`);
  thinRule();
  await markDone(t1.id);
  await deleteKaam(t3.id);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 4: Final state${RESET}`);
  thinRule();
  await listKaam();

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 5: Clear all${RESET}`);
  thinRule();
  await clearDesk();
  await listKaam();

  // Cleanup
  await fsp.rm(KAAM_DIR, { recursive: true, force: true });
  console.log(`${DIM}  Removed ${KAAM_DIR}${RESET}`);

  banner('KEY TAKEAWAYS');
  console.log(`
  1. process.argv slicing gives clean command routing
  2. fs/promises keeps file I/O async and non-blocking
  3. crypto.randomBytes generates compact unique IDs
  4. JSON.stringify with indent makes human-readable storage
  5. ANSI codes make CLI tools feel polished
  6. Always clean up temp resources in demo/test modes
`);
}

// ============================================================
// SECTION 7: Entry Point
// ============================================================

async function main() {
  if (DEMO_MODE) await runDemo();
  else { await ensureDir(); await runCLI(process.argv.slice(2)); }
}

main().catch(err => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
