/** ============================================================
 FILE 18: Worker Threads — True Parallelism in Node.js
 ============================================================
 Topic: The 'worker_threads' module — multi-threaded execution
 WHY: Worker threads run CPU-intensive JS in parallel WITHOUT
   spawning a new process. They share memory via
   SharedArrayBuffer and communicate via messages.
 ============================================================ */

const {
  isMainThread, Worker, parentPort, workerData, MessageChannel
} = require('worker_threads');
const { performance } = require('perf_hooks');

// ============================================================
// STORY: ISRO Parallel Computing Lab
// Mission Director Sivan assigns orbit calculations to
// computation nodes (Worker threads). Each node processes
// trajectory data in parallel, sharing telemetry via
// SharedArrayBuffer and communicating via messages.
// ============================================================

// ── Worker thread code path ─────────────────────────────────
if (!isMainThread) {
  const task = workerData;

  if (task.type === 'basic') {
    parentPort.postMessage({
      node: `ComputeNode-${task.id}`, input: task.num, squared: task.num * task.num
    });
  } else if (task.type === 'primes') {
    function countPrimes(max) {
      let count = 0;
      for (let i = 2; i <= max; i++) {
        let isPrime = true;
        for (let j = 2; j * j <= i; j++) {
          if (i % j === 0) { isPrime = false; break; }
        }
        if (isPrime) count++;
      }
      return count;
    }
    const start = performance.now();
    const count = countPrimes(task.max);
    parentPort.postMessage({ count, elapsed: performance.now() - start });
  } else if (task.type === 'shared') {
    const sharedArray = new Int32Array(task.sharedBuffer);
    for (let i = 0; i < task.iterations; i++) Atomics.add(sharedArray, 0, 1);
    parentPort.postMessage({ done: true, threadId: task.id });
  } else if (task.type === 'channel') {
    parentPort.once('message', (msg) => {
      if (msg.port) {
        msg.port.postMessage({ from: `ComputeNode-${task.id}`, message: 'Telemetry channel established!' });
        msg.port.close();
        parentPort.postMessage({ done: true });
      }
    });
  }
  return;
}

// ── Main thread (Mission Director) ──────────────────────────

async function main() {
  // ============================================================
  // BLOCK 1 — Worker Basics
  // ============================================================

  console.log('='.repeat(60));
  console.log('  BLOCK 1: Computation Node Basics');
  console.log('='.repeat(60));

  console.log(`\n  Main thread? : ${isMainThread}`);

  // WHY: Inline worker pattern — __filename runs this file,
  // the !isMainThread branch handles the task.

  console.log('\n--- Dispatching workers with workerData ---');

  const results = await Promise.all([10, 20, 30].map((num, i) => {
    return new Promise((resolve, reject) => {
      const w = new Worker(__filename, { workerData: { type: 'basic', id: i + 1, num } });
      w.on('message', (msg) => { console.log(`  ${msg.node}: ${msg.input}^2 = ${msg.squared}`); resolve(msg); });
      w.on('error', reject);
    });
  }));
  // Output: ComputeNode-1: 10^2 = 100, etc.

  // ============================================================
  // BLOCK 2 — CPU-Intensive Work: Main vs Worker
  // ============================================================

  console.log('\n' + '='.repeat(60));
  console.log('  BLOCK 2: CPU-Intensive — Main Thread vs Worker');
  console.log('='.repeat(60));

  const PRIME_MAX = 100000;

  // WHY: CPU-heavy work on main thread blocks everything.
  // In a worker, main thread stays responsive.

  function countPrimesMain(max) {
    let count = 0;
    for (let i = 2; i <= max; i++) {
      let isPrime = true;
      for (let j = 2; j * j <= i; j++) {
        if (i % j === 0) { isPrime = false; break; }
      }
      if (isPrime) count++;
    }
    return count;
  }

  console.log(`\n--- Counting primes up to ${PRIME_MAX.toLocaleString()} ---`);

  const mainStart = performance.now();
  const mainCount = countPrimesMain(PRIME_MAX);
  console.log(`  Main thread : ${mainCount} primes in ${(performance.now() - mainStart).toFixed(2)}ms`);

  const nodeResult = await new Promise((resolve, reject) => {
    const w = new Worker(__filename, { workerData: { type: 'primes', max: PRIME_MAX } });
    w.on('message', resolve);
    w.on('error', reject);
  });

  console.log(`  Worker      : ${nodeResult.count} primes in ${nodeResult.elapsed.toFixed(2)}ms`);
  console.log('  Key benefit: worker does NOT block the main thread');

  // ============================================================
  // BLOCK 3 — SharedArrayBuffer, Atomics & MessageChannel
  // ============================================================

  console.log('\n' + '='.repeat(60));
  console.log('  BLOCK 3: SharedArrayBuffer, Atomics & MessageChannel');
  console.log('='.repeat(60));

  // ── SharedArrayBuffer + Atomics ────────────────────────────
  // WHY: Threads access SAME memory. Atomics ensure thread-safety.

  console.log('\n--- SharedArrayBuffer + Atomics ---');

  const ITERATIONS = 10000;
  const NODE_COUNT = 3;
  const sharedBuffer = new SharedArrayBuffer(4);
  new Int32Array(sharedBuffer)[0] = 0;

  await Promise.all(Array.from({ length: NODE_COUNT }, (_, i) =>
    new Promise((resolve, reject) => {
      const w = new Worker(__filename, {
        workerData: { type: 'shared', id: i + 1, sharedBuffer, iterations: ITERATIONS }
      });
      w.on('message', () => resolve());
      w.on('error', reject);
    })
  ));

  const finalCount = new Int32Array(sharedBuffer)[0];
  const expected = NODE_COUNT * ITERATIONS;
  console.log(`  Final: ${finalCount}, Expected: ${expected}, Safe: ${finalCount === expected}`);

  // ── MessageChannel — direct port communication ────────────
  // WHY: Creates a port pair for direct thread-to-thread messaging.

  console.log('\n--- MessageChannel ---');

  const { port1, port2 } = new MessageChannel();
  await new Promise((resolve, reject) => {
    const w = new Worker(__filename, { workerData: { type: 'channel', id: 1 } });
    port1.on('message', (msg) => {
      console.log(`  Channel: from=${msg.from}, "${msg.message}"`);
      port1.close();
    });
    w.on('message', (msg) => { if (msg.done) resolve(); });
    w.on('error', reject);
    // WHY: transferList moves ownership — main can no longer use port2
    w.postMessage({ port: port2 }, [port2]);
  });

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. isMainThread — detect main vs worker context
// 2. new Worker(__filename, { workerData }) — inline pattern
// 3. parentPort.postMessage/on('message') — worker comms
// 4. Workers don't block the main thread — key advantage
// 5. SharedArrayBuffer — zero-copy shared memory between threads
// 6. Atomics.add/load/store — thread-safe shared memory ops
// 7. MessageChannel — port pairs for direct communication
// 8. transferList in postMessage moves ownership of ports/buffers
// ============================================================
