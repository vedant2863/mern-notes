/** ============================================================
 FILE 15: OS Module — System Information & Diagnostics
 ============================================================
 Topic: The 'os' module — querying system-level information
 WHY: Applications need system info for resource management,
   platform-specific behavior, and diagnostics.
 ============================================================ */

const os = require('os');

// ============================================================
// STORY: INS VIKRANT DIAGNOSTIC PANEL
// Lt. Commander Mehra runs the morning diagnostic sweep on
// INS Vikrant's systems. Every sensor reading maps to an
// os module call — platform, memory, CPU, network, uptime.
// ============================================================

// ============================================================
// BLOCK 1 — Full Diagnostic Report
// ============================================================

console.log('='.repeat(60));
console.log('  INS VIKRANT DIAGNOSTIC REPORT');
console.log('='.repeat(60));

// ── SECTION: Platform & Architecture ────────────────────────
// WHY: Determine which OS for platform-specific logic

console.log('\n--- Hull Classification (Platform & Architecture) ---');
console.log(`  Platform : ${os.platform()}`);    // darwin, linux, win32
console.log(`  Arch     : ${os.arch()}`);         // arm64, x64
console.log(`  OS Type  : ${os.type()}`);         // Darwin, Linux, Windows_NT
console.log(`  Release  : ${os.release()}`);

// ── SECTION: CPU Information ────────────────────────────────
// WHY: CPU count drives worker/cluster sizing

const cpus = os.cpus();
console.log('\n--- Engine Cores (CPU) ---');
console.log(`  Cores    : ${cpus.length}`);
console.log(`  Model    : ${cpus[0].model}`);

// ── SECTION: Memory ─────────────────────────────────────────
// WHY: Monitor memory for leak detection, capacity planning

const totalGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
const freeGB = (os.freemem() / (1024 ** 3)).toFixed(2);
const usedPercent = (((totalGB - freeGB) / totalGB) * 100).toFixed(1);

console.log('\n--- Fuel Capacity (Memory) ---');
console.log(`  Total    : ${totalGB} GB`);
console.log(`  Free     : ${freeGB} GB`);
console.log(`  Used     : ${usedPercent}%`);

// ── SECTION: Uptime ─────────────────────────────────────────

const secs = os.uptime();
const d = Math.floor(secs / 86400);
const h = Math.floor((secs % 86400) / 3600);
const m = Math.floor((secs % 3600) / 60);

console.log('\n--- Mission Clock (Uptime) ---');
console.log(`  Uptime   : ${d}d ${h}h ${m}m`);

// ── SECTION: Host & User ────────────────────────────────────

const userInfo = os.userInfo();
console.log('\n--- Ship Registry (Host & User) ---');
console.log(`  Hostname : ${os.hostname()}`);
console.log(`  Home Dir : ${os.homedir()}`);
console.log(`  Temp Dir : ${os.tmpdir()}`);
console.log(`  Username : ${userInfo.username}`);
console.log(`  Shell    : ${userInfo.shell}`);

// ── SECTION: Network Interfaces ─────────────────────────────
// WHY: Discover IP addresses for server binding, service discovery

const nets = os.networkInterfaces();
console.log('\n--- Communication Array (Network — IPv4, External) ---');

for (const [name, interfaces] of Object.entries(nets)) {
  for (const iface of interfaces) {
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(`  ${name}: ${iface.address} (MAC: ${iface.mac})`);
    }
  }
}

// ── SECTION: Load Average & EOL ─────────────────────────────

const loadAvg = os.loadavg();
console.log('\n--- Engine Load ---');
console.log(`  1/5/15m  : ${loadAvg.map(l => l.toFixed(2)).join(' / ')}`);

console.log('\n--- Data Format (EOL) ---');
console.log(`  EOL char : ${os.EOL === '\n' ? '\\n (Unix/macOS)' : '\\r\\n (Windows)'}`);

// ── Diagnostic Summary ──────────────────────────────────────

const memStatus = usedPercent > 90 ? 'CRITICAL' : usedPercent > 70 ? 'WARNING' : 'NOMINAL';
const loadStatus = loadAvg[0] > cpus.length ? 'HIGH' : 'NOMINAL';

console.log('\n' + '='.repeat(60));
console.log(`  Memory: ${memStatus} (${usedPercent}%) | CPU Load: ${loadStatus} | Up: ${d}d ${h}h ${m}m`);
console.log('='.repeat(60));

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. os.platform()/arch()/type() — identify the environment
// 2. os.cpus().length — core count for worker/cluster sizing
// 3. os.totalmem()/freemem() — memory in bytes
// 4. os.uptime() — system uptime in seconds
// 5. os.homedir()/tmpdir()/hostname() — filesystem landmarks
// 6. os.networkInterfaces() — all adapters with IPs
// 7. os.userInfo() — current user details
// 8. os.EOL — platform-correct line ending
// 9. os.loadavg() — 1/5/15 min CPU load averages
// ============================================================
