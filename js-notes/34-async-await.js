/**
 * ========================================================
 *  FILE 34: ASYNC / AWAIT
 * ========================================================
 *  async functions, await, try/catch, sequential vs
 *  parallel execution, async iteration, and converting
 *  callback APIs.
 *
 *  STORY — Amma's Udupi Thali
 *  Amma runs a famous Udupi restaurant. Some dishes must
 *  cook in order, others can cook simultaneously on
 *  multiple burners. She awaits each step at the right
 *  moment -- never blocking the kitchen.
 * ========================================================
 */

// ========================================================
//  HELPERS
// ========================================================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cookDish(name, ms, shouldFail = false) {
  await delay(ms);
  if (shouldFail) throw new Error(`${name} curdled!`);
  return { dish: name, time: ms };
}

// ========================================================
//  BLOCK 1 — FUNDAMENTALS
// ========================================================

// --- 1. ASYNC FUNCTION (always returns a Promise) ---
async function greetGuests() {
  return "Welcome to Amma's Udupi Restaurant!";
}
greetGuests().then(msg => console.log(msg));

// --- 2. AWAIT (pauses the async function, not the thread) ---
async function makeChutney() {
  const coconut    = await cookDish("Coconut", 100);
  const chilli     = await cookDish("Green Chillies", 80);
  const coriander  = await cookDish("Coriander", 50);
  console.log(`Chutney ready with: ${coconut.dish}, ${chilli.dish}, ${coriander.dish}`);
}

// --- 3. ERROR HANDLING: try / catch ---
async function makePayasam() {
  try {
    await cookDish("Paal Payasam", 100, true); // fails
  } catch (error) {
    console.log(`Payasam FAILED: ${error.message}`);
    return "Banana Sheera"; // fallback
  } finally {
    console.log("Kitchen cleaned up after payasam attempt.");
  }
}

// --- 4. SEQUENTIAL vs PARALLEL ---
async function makeThaliSequential() {
  const start = Date.now();
  const sambar = await cookDish("Sambar", 200);
  const rasam  = await cookDish("Rasam", 150);
  const avial  = await cookDish("Avial", 100);
  console.log(`Sequential: ~${Date.now() - start}ms`); // ~450ms
}

async function makeThaliParallel() {
  const start = Date.now();
  const [sambar, rasam, avial] = await Promise.all([
    cookDish("Sambar", 200),
    cookDish("Rasam", 150),
    cookDish("Avial", 100),
  ]);
  console.log(`Parallel: ~${Date.now() - start}ms`); // ~200ms
}

// --- 5. PARALLEL ERRORS with allSettled ---
async function cookWithFallback() {
  const results = await Promise.allSettled([
    cookDish("Rasam", 100),
    cookDish("Payasam", 150, true),
    cookDish("Appalam", 80),
  ]);

  results.forEach(r => {
    console.log(r.status === "fulfilled"
      ? `OK: ${r.value.dish}`
      : `FAILED: ${r.reason.message}`);
  });
}

// ========================================================
//  BLOCK 2 — ADVANCED PATTERNS
// ========================================================

// --- 6. ASYNC ITERATION: for await...of ---
async function* thaliCourses() {
  yield await cookDish("Chutney", 50);
  yield await cookDish("Sambar", 80);
  yield await cookDish("Payasam", 30);
}

async function serveCourses() {
  let n = 1;
  for await (const course of thaliCourses()) {
    console.log(`Course ${n++}: ${course.dish}`);
  }
}

// --- 7. CONVERTING CALLBACK APIs ---
function tandoorTimerCB(item, min, cb) {
  setTimeout(() => {
    min > 10
      ? cb(new Error(`${item} overcooked!`))
      : cb(null, { item, status: "done" });
  }, min * 10);
}

function tandoorTimer(item, min) {
  return new Promise((resolve, reject) => {
    tandoorTimerCB(item, min, (err, res) => err ? reject(err) : resolve(res));
  });
}

async function bakeDemo() {
  try {
    const r1 = await tandoorTimer("Naan", 5);
    console.log(`${r1.item}: ${r1.status}`);
    await tandoorTimer("Roti", 15); // fails
  } catch (e) {
    console.log(`Tandoor error: ${e.message}`);
  }
}

// --- 8. RETRY WITH BACKOFF ---
async function cookWithRetry(cookFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await cookFn();
    } catch (error) {
      console.log(`Attempt ${attempt}: ${error.message}`);
      if (attempt === maxRetries) throw new Error(`All ${maxRetries} attempts failed`);
      await delay(attempt * 50);
    }
  }
}

// --- 9. TOP-LEVEL AWAIT (ES Modules only) ---
// In .mjs or "type":"module" files:
//   const config = await loadConfig();
//   const db = await connectToDatabase(config);

// ========================================================
//  MAIN RUNNER
// ========================================================

async function main() {
  await makeChutney();
  await makePayasam();
  await makeThaliSequential();
  await makeThaliParallel();
  await cookWithFallback();
  await serveCourses();
  await bakeDemo();
}

main().catch(err => console.error("Unexpected error:", err));

/**
 * ========================================================
 *  KEY TAKEAWAYS
 * ========================================================
 *  1. async functions ALWAYS return a Promise.
 *  2. await pauses the function (not the thread) until
 *     the Promise settles.
 *  3. Use try/catch for error handling inside async fns.
 *  4. SEQUENTIAL: await one-by-one when tasks depend on
 *     each other. PARALLEL: Promise.all() when independent.
 *  5. for await...of consumes async generators/streams.
 *  6. Wrap callback APIs in new Promise() to await them.
 *  7. Top-level await works in ES modules only.
 *  8. Common patterns: retry with backoff, parallel with
 *     fallback via Promise.allSettled().
 * ========================================================
 */
