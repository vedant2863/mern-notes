/** ============================================================
 FILE 17: Child Processes — exec, spawn, fork
 ============================================================
 Topic: The 'child_process' module — running external commands
 WHY: Node is single-threaded. Child processes let you run
   system commands, shell scripts, and other Node programs
   in separate processes.
 ============================================================ */

const { execSync, exec, execFile, spawn, fork } = require('child_process');
const path = require('path');

// ============================================================
// STORY: Indian Army Command
// Brigadier Chauhan (main process) dispatches missions.
// execSync = direct radio command (waits). exec/execFile =
// async dispatches. spawn = platoon streaming intel back.
// fork = independent squad with its own IPC channel.
// ============================================================

// ── Handle forked child mode ────────────────────────────────
if (process.argv[2] === '--child') {
  process.on('message', (msg) => {
    process.send({
      squad: `Squad-${process.pid}`,
      mission: msg.mission,
      status: 'COMPLETED',
      intel: `Target "${msg.mission}" secured at sector ${Math.floor(Math.random() * 100)}`
    });
  });
  process.send({ squad: `Squad-${process.pid}`, status: 'READY' });
  return;
}

// ── Main process (Brigadier Chauhan) ────────────────────────

async function main() {
  // ============================================================
  // BLOCK 1 — execSync, exec, execFile
  // ============================================================

  console.log('='.repeat(60));
  console.log('  BLOCK 1: execSync, exec, execFile');
  console.log('='.repeat(60));

  // ── execSync — synchronous, blocks until complete ─────────
  // WHY: Simplest way to run a command. Blocks event loop — use only for scripts/CLI.

  console.log('\n--- execSync ---');
  console.log(`  echo: "${execSync('echo "Operation Vijay confirmed"').toString().trim()}"`);

  try {
    execSync('nonexistent-command-xyz 2>/dev/null');
  } catch (err) {
    console.log(`  Error caught: status ${err.status}`);
  }

  // ── exec — async with callback ────────────────────────────
  // WHY: Non-blocking, but buffers ALL output in memory.

  console.log('\n--- exec ---');
  await new Promise((resolve) => {
    exec('echo "Field report from platoon alpha"', (error, stdout) => {
      if (!error) console.log(`  stdout: "${stdout.trim()}"`);
      resolve();
    });
  });

  // ── execFile — no shell interpretation ────────────────────
  // WHY: Runs file directly (no shell). Safer against injection.

  console.log('\n--- execFile ---');
  await new Promise((resolve) => {
    execFile('node', ['-e', 'console.log("Intel: sector " + (40+2))'], (error, stdout) => {
      if (!error) console.log(`  out: "${stdout.trim()}"`);
      resolve();
    });
  });

  // ============================================================
  // BLOCK 2 — spawn (Streaming Output)
  // ============================================================

  console.log('\n' + '='.repeat(60));
  console.log('  BLOCK 2: spawn (Streaming Intel)');
  console.log('='.repeat(60));

  // WHY: spawn streams stdout/stderr as data arrives — best for
  // long-running processes or large output.

  console.log('\n--- spawn with streaming ---');

  await new Promise((resolve) => {
    const child = spawn('node', ['-e', `
      console.log("Sector Rajputana clear");
      console.log("Sector Maratha clear");
      console.error("WARNING: Sector Gorkha activity");
      console.log("Sector Sikh clear");
    `]);

    const out = [], err = [];
    child.stdout.on('data', (d) => out.push(d.toString().trim()));
    child.stderr.on('data', (d) => err.push(d.toString().trim()));
    child.on('close', (code) => {
      out.forEach(l => console.log(`  stdout: ${l}`));
      err.forEach(l => console.log(`  stderr: ${l}`));
      console.log(`  Exit code: ${code}`);
      resolve();
    });
  });

  // ============================================================
  // BLOCK 3 — fork (IPC Communication)
  // ============================================================

  console.log('\n' + '='.repeat(60));
  console.log('  BLOCK 3: fork (IPC Communication)');
  console.log('='.repeat(60));

  // WHY: fork() creates a Node.js process with a built-in IPC channel.
  // Parent and child exchange messages. Perfect for offloading CPU work.

  console.log('\n--- Forking squads ---');

  const missions = ['Recon Leh', 'Patrol Siachen'];

  const results = await Promise.all(missions.map((mission, i) => {
    return new Promise((resolve) => {
      const child = fork(__filename, ['--child']);
      let ready = false;

      child.on('message', (msg) => {
        if (msg.status === 'READY' && !ready) {
          ready = true;
          console.log(`  ${msg.squad} reporting for duty`);
          child.send({ mission });
        } else if (msg.status === 'COMPLETED') {
          console.log(`  ${msg.squad}: ${msg.intel}`);
          child.disconnect();
          resolve(msg);
        }
      });

      setTimeout(() => { try { child.kill(); } catch (e) {} resolve({ status: 'TIMEOUT' }); }, 5000);
    });
  }));

  console.log(`\n  Completed: ${results.filter(r => r.status === 'COMPLETED').length}/${missions.length}`);
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. execSync — synchronous, blocks, returns Buffer
// 2. exec — async callback, buffers ALL output in memory
// 3. execFile — like exec but no shell (safer, no injection)
// 4. spawn — async streams, best for large/continuous output
// 5. fork — spawn + IPC channel for Node-to-Node messaging
// 6. Options: cwd, env, timeout, shell, stdio
// 7. Use --child flag pattern for fork() in same file
// 8. process.send()/process.on('message') for IPC
// ============================================================
