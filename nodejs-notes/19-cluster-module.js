/** ============================================================
 FILE 19: Cluster Module — Multi-Process Servers
 ============================================================
 Topic: The 'cluster' module — forking worker processes
 WHY: A single Node.js process uses one CPU core. Cluster
   forks multiple workers sharing the same port, utilizing
   all cores. Essential for production HTTP servers.
 ============================================================ */

const cluster = require('cluster');
const http = require('http');
const os = require('os');

// ============================================================
// STORY: Indian Railway Booking Counters
// The Station Master (primary) opens multiple booking counters
// (workers). Each clerk serves passengers independently.
// The Station Master coordinates — opening new counters if
// one shuts down, and closing when the day ends.
// ============================================================

const PORT = 0;
const mode = process.argv[2] || 'block1';

if (mode === 'block1') runBlock1();
else if (mode === 'block2-primary') runBlock2Primary();
else if (mode === 'block2-worker') runBlock2Worker();
else if (mode === 'block1-worker') runBlock1Worker();

// ============================================================
// BLOCK 1 — Cluster Basics: Station Master & Clerks
// ============================================================

function runBlock1() {
  console.log('='.repeat(60));
  console.log('  BLOCK 1: Cluster Basics');
  console.log('='.repeat(60));

  if (cluster.isPrimary) {
    console.log(`\n  Station Master PID: ${process.pid}, CPU Cores: ${os.cpus().length}`);
    console.log('  Opening 2 booking counters...\n');

    const NUM_CLERKS = 2;
    let exitedClerks = 0;

    for (let i = 0; i < NUM_CLERKS; i++) {
      const worker = cluster.fork({ COUNTER_NAME: `Counter-${i + 1}` });
      console.log(`  Opened counter ${worker.id} (PID: ${worker.process.pid})`);
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`  Clerk ${worker.id} exited — code: ${code}`);
      exitedClerks++;
      if (exitedClerks === NUM_CLERKS) {
        console.log('\n  All counters closed.');
        console.log('='.repeat(60));
        runBlock2Launcher();
      }
    });
  } else {
    runBlock1Worker();
  }
}

function runBlock1Worker() {
  const counter = process.env.COUNTER_NAME || 'unknown';
  let sum = 0;
  for (let i = 0; i < 1000000; i++) sum += i;
  console.log(`  [${counter}] Clerk ${cluster.worker.id} — bookings done. Closing.`);
  process.exit(0);
}

// ============================================================
// BLOCK 2 — HTTP Server Cluster with Auto-Restart
// ============================================================

function runBlock2Launcher() {
  console.log('\n' + '='.repeat(60));
  console.log('  BLOCK 2: HTTP Cluster with Auto-Restart');
  console.log('='.repeat(60));

  // WHY: Launch as separate cluster since cluster state cannot be reset.
  const { fork: cpFork } = require('child_process');
  const child = cpFork(__filename, ['block2-primary'], { stdio: 'inherit' });
  child.on('exit', () => {
    console.log('\n' + '='.repeat(60));
    console.log('  ALL BLOCKS COMPLETE');
    console.log('='.repeat(60));
  });
}

function runBlock2Primary() {
  if (!cluster.isPrimary) { runBlock2Worker(); return; }

  const NUM_CLERKS = 2;
  const MAX_RESTARTS = 1;
  let restartCount = 0;
  let shuttingDown = false;

  console.log(`\n  Station Master PID: ${process.pid}`);
  console.log(`  Opening ${NUM_CLERKS} counters...\n`);

  for (let i = 0; i < NUM_CLERKS; i++) cluster.fork();

  // ── Port discovery & test request ─────────────────────────
  let serverPort = null;
  let readyClerks = 0;

  cluster.on('message', (worker, msg) => {
    if (msg.type === 'listening' && !serverPort) serverPort = msg.port;
    if (msg.type === 'listening') {
      readyClerks++;
      if (readyClerks === NUM_CLERKS) makeTestRequest(serverPort);
    }
  });

  // ── Auto-restart on crash ─────────────────────────────────
  // WHY: Keep service running. Cap restarts to prevent storms.
  cluster.on('exit', (worker, code) => {
    console.log(`  Clerk ${worker.id} exited (code: ${code})`);
    if (!shuttingDown && restartCount < MAX_RESTARTS) {
      restartCount++;
      console.log(`  Reopening... (restart ${restartCount}/${MAX_RESTARTS})`);
      cluster.fork();
    }
  });

  // ── Graceful shutdown ─────────────────────────────────────
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n  Initiating shutdown...');
    for (const id in cluster.workers) {
      const w = cluster.workers[id];
      if (w) {
        w.send({ type: 'shutdown' });
        setTimeout(() => { try { w.kill(); } catch (e) {} }, 2000);
      }
    }
    setTimeout(() => { console.log('  Station shut down.'); process.exit(0); }, 3000);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  function makeTestRequest(port) {
    console.log(`\n  Test booking at http://localhost:${port}...`);
    http.get(`http://localhost:${port}/`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        console.log(`  Response: ${body.trim()}`);
        setTimeout(shutdown, 500);
      });
    }).on('error', () => shutdown());
  }

  setTimeout(() => { process.exit(0); }, 10000);
}

function runBlock2Worker() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Booking Clerk ${cluster.worker.id} (PID: ${process.pid}) — Ticket issued!\n`);
  });

  server.listen(0, () => {
    process.send({ type: 'listening', port: server.address().port });
    console.log(`  Clerk ${cluster.worker.id} (PID: ${process.pid}) — ready`);
  });

  process.on('message', (msg) => {
    if (msg.type === 'shutdown') {
      server.close(() => { console.log(`  Clerk ${cluster.worker.id} — closed.`); process.exit(0); });
    }
  });
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. cluster.isPrimary — detect if you're the coordinator
// 2. cluster.fork() — spawn a worker sharing the same port
// 3. Workers are full processes (separate memory, own PID)
// 4. Primary manages lifecycle: fork, monitor, restart, shutdown
// 5. cluster.on('exit') — detect and auto-restart crashed workers
// 6. Cap restart count to prevent infinite restart storms
// 7. Graceful shutdown — close servers then exit
// 8. Workers share the same server port via OS load balancing
// ============================================================
