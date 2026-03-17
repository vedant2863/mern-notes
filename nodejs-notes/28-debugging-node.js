/** ============================================================
    FILE 28: Debugging Node.js
    ============================================================
    Topic: Console methods, inspector, memory, diagnostics
    WHY THIS MATTERS:
    Node provides rich built-in tools beyond console.log —
    timers, tables, groups, memory profiling, and Chrome
    DevTools integration. Mastering these cuts debug time
    from hours to minutes.
    ============================================================ */

// ============================================================
// STORY: Railway Fault Detection
// The Indian Railway fault detection team inspects tracks.
// console.log = visual inspection. debugger = ultrasonic
// testing. --inspect = connecting the diagnostic computer.
// ============================================================

// ============================================================
// EXAMPLE BLOCK 1 — Console Methods Deep Dive
// ============================================================

console.log('=== Railway Fault Detection toolkit ===\n');

// ──────────────────────────────────────────────────────────
// console.dir() — inspect objects with depth control
// ──────────────────────────────────────────────────────────
const deepObject = {
  level1: { level2: { level3: { level4: { fault: 'Rail fracture!', readings: [1, 2, 3] } } } },
};

console.log('console.log (truncates deep objects):');
console.log(deepObject);

console.log('\nconsole.dir with depth: null (shows everything):');
console.dir(deepObject, { depth: null, colors: true });

// ──────────────────────────────────────────────────────────
// console.table() — tabular data display
// ──────────────────────────────────────────────────────────
const trackSections = [
  { name: 'Delhi-Agra',        faultType: 'Rail wear',      cleared: false },
  { name: 'Mumbai-Pune',       faultType: 'Fishplate crack', cleared: true },
  { name: 'Chennai-Bangalore', faultType: 'Alignment shift', cleared: false },
];
console.log('\nconsole.table():');
console.table(trackSections);
console.table(trackSections, ['name', 'cleared']);

// ──────────────────────────────────────────────────────────
// console.time / timeLog / timeEnd
// ──────────────────────────────────────────────────────────
console.log('\nconsole.time/timeEnd:');
console.time('track-inspection');
let sum = 0;
for (let i = 0; i < 1_000_000; i++) sum += i;
console.timeLog('track-inspection', '— measured rail segments');
// timeLog prints elapsed WITHOUT stopping the timer.
const arr = Array.from({ length: 10_000 }, (_, i) => i);
arr.sort(() => Math.random() - 0.5);
console.timeEnd('track-inspection');

// ──────────────────────────────────────────────────────────
// console.count / countReset
// ──────────────────────────────────────────────────────────
console.log('\nconsole.count:');
function logFault(type) { console.count(type); }
logFault('rail-crack');     // rail-crack: 1
logFault('rail-crack');     // rail-crack: 2
logFault('signal-failure'); // signal-failure: 1
console.countReset('rail-crack');
logFault('rail-crack');     // rail-crack: 1 (reset!)

// ──────────────────────────────────────────────────────────
// console.group / groupEnd
// ──────────────────────────────────────────────────────────
console.log('\nconsole.group:');
console.group('Route #42 — Delhi-Howrah');
console.log('Section: Kanpur to Allahabad');
console.group('Faults');
console.log('1. Rail wear at km 234');
console.log('2. Signal malfunction at km 289');
console.groupEnd();
console.groupEnd();

// ──────────────────────────────────────────────────────────
// console.trace() — print call stack
// ──────────────────────────────────────────────────────────
console.log('\nconsole.trace():');
function outerInspection() { innerInspection(); }
function innerInspection() { console.trace('Stack from ultrasonicTest'); }
outerInspection();

// ============================================================
// SECTION 2 — Inspector, Diagnostics, and Memory
// ============================================================

console.log('\n--- Inspector & Memory ---\n');

// --inspect and --inspect-brk
console.log('--inspect / --inspect-brk:');
console.log('  node --inspect app.js     — start inspector on :9229');
console.log('  node --inspect-brk app.js — pause on first line');
console.log('  `debugger;` pauses when inspector is active.\n');

console.log('NODE_DEBUG=http,net node app.js — verbose core logging');
console.log('--trace-warnings — stack traces for Node warnings\n');

// ──────────────────────────────────────────────────────────
// process.memoryUsage() — detect memory leaks
// ──────────────────────────────────────────────────────────
function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function showMemory(label) {
  const mem = process.memoryUsage();
  console.log(`  [${label}] rss: ${formatBytes(mem.rss)}, heap: ${formatBytes(mem.heapUsed)}/${formatBytes(mem.heapTotal)}`);
  return mem;
}

const before = showMemory('Before');
const trackReadings = [];
for (let i = 0; i < 100_000; i++) {
  trackReadings.push({ index: i, data: `reading-${i}` });
}
const after = showMemory('After 100k objects');
console.log(`  Heap growth: ${formatBytes(after.heapUsed - before.heapUsed)}`);

console.log('\n  Leak detection: snapshot memoryUsage before/after, check linear growth.');

// ──────────────────────────────────────────────────────────
// process.cpuUsage()
// ──────────────────────────────────────────────────────────
console.log('\nprocess.cpuUsage():');
const cpuBefore = process.cpuUsage();
let x = 0;
for (let i = 0; i < 5_000_000; i++) x += Math.sqrt(i);
const cpuAfter = process.cpuUsage(cpuBefore);
console.log(`  user: ${(cpuAfter.user / 1000).toFixed(1)} ms, system: ${(cpuAfter.system / 1000).toFixed(1)} ms`);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. console.dir({ depth: null }) reveals deeply nested objects.
// 2. console.table() renders arrays of objects as ASCII tables.
// 3. console.time/timeEnd measure execution duration.
// 4. console.count() tracks execution frequency by label.
// 5. console.group/groupEnd nests output for clarity.
// 6. console.trace() prints the call stack at any point.
// 7. --inspect opens Chrome DevTools; --inspect-brk pauses first.
// 8. NODE_DEBUG=module,http enables core debug output.
// 9. process.memoryUsage() tracks heap growth for leak detection.
// 10. process.cpuUsage(prev) measures CPU time deltas.
// ============================================================

console.log('\nRailway Fault Detection team closes inspection.');
