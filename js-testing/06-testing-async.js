// ============================================================
// FILE 06: TESTING ASYNCHRONOUS CODE
// Topic: Promises, async/await, callbacks, timers, and race conditions
// ============================================================

// ============================================================
// STORY: PhonePe processes 5+ billion UPI transactions monthly.
//   Every payment is async: initiate -> bank response -> verify ->
//   confirm. If tests don't properly await Promises, assertions
//   run after the test already passed -- the most dangerous false confidence.
// ============================================================

// BLOCK 1 — The Async Code Under Test

function initiatePayment(upiId, amount) {
  return new Promise((resolve, reject) => {
    if (!upiId || !upiId.includes("@")) { reject(new Error("Invalid UPI ID")); return; }
    if (amount <= 0) { reject(new Error("Amount must be positive")); return; }
    setTimeout(() => {
      resolve({ transactionId: "TXN" + Date.now(), status: "INITIATED", upiId, amount });
    }, 100);
  });
}

function verifyPayment(transactionId) {
  return new Promise((resolve, reject) => {
    if (!transactionId || !transactionId.startsWith("TXN")) { reject(new Error("Invalid transaction ID")); return; }
    setTimeout(() => resolve({ transactionId, status: "VERIFIED", bankRef: "BANK" + Math.floor(Math.random() * 100000) }), 50);
  });
}

async function processFullPayment(upiId, amount) {
  const initResult = await initiatePayment(upiId, amount);
  const verifyResult = await verifyPayment(initResult.transactionId);
  return { ...verifyResult, amount, upiId };
}


// ============================================================
// SECTION 1 — Testing Promises (Return the Promise)
// ============================================================

// WRONG: This test ALWAYS passes, even if the Promise rejects!
// test('bad', () => {
//   initiatePayment('merchant@ybl', 500).then(result => {
//     expect(result.status).toBe('INITIATED');  // Runs AFTER test passes!
//   });
// });

// CORRECT: Return the Promise so the runner waits
// test('good', () => {
//   return initiatePayment('merchant@ybl', 500).then(result => {
//     expect(result.status).toBe('INITIATED');
//   });
// });

// CLEANEST: .resolves / .rejects matchers
// test('resolves', () => {
//   return expect(initiatePayment('user@okaxis', 1000)).resolves.toMatchObject({ status: 'INITIATED' });
// });

console.log("--- Promise Return Pattern ---");
console.log("RULE: Always return or await Promises in tests.");
console.log("");


// ============================================================
// SECTION 2 — async/await (Preferred Pattern)
// ============================================================

// test('full payment pipeline', async () => {
//   const result = await processFullPayment('shop@ybl', 2500);
//   expect(result.status).toBe('VERIFIED');
//   expect(result.amount).toBe(2500);
// });

// For error paths, use .rejects -- NOT try/catch (fragile):
// test('rejects invalid UPI', async () => {
//   await expect(initiatePayment('bad-id', 100)).rejects.toThrow('Invalid UPI ID');
// });

console.log("--- async/await Tests ---");
console.log("PREFER: await expect(fn()).rejects.toThrow('message')");
console.log("");


// ============================================================
// SECTION 3 — Testing Callbacks (Legacy Pattern)
// ============================================================

function checkBalance(accountId, callback) {
  setTimeout(() => {
    if (!accountId) { callback(new Error("Account ID required"), null); return; }
    callback(null, { accountId, balance: 50000, currency: "INR" });
  }, 100);
}

// test('checks balance', (done) => {
//   checkBalance('ACC123', (error, result) => {
//     try {
//       expect(error).toBeNull();
//       expect(result.balance).toBe(50000);
//       done();        // Signal: test passed
//     } catch (err) {
//       done(err);     // Signal: test failed
//     }
//   });
// });

// The try/catch is critical! Without it, a failed expect() throws,
// done() never gets called, and you get a confusing timeout error.

console.log("--- Callback Testing with done() ---");
console.log("Use EITHER done OR async/await, never both.");
console.log("");


// ============================================================
// SECTION 4 — Testing Timers with Fake Timers
// ============================================================

function createPaymentTimeout(onTimeout, delayMs = 30000) {
  let resolved = false;
  const timerId = setTimeout(() => {
    if (!resolved) { resolved = true; onTimeout("Payment timed out. Please try again."); }
  }, delayMs);
  return {
    resolve: () => { resolved = true; clearTimeout(timerId); },
    isResolved: () => resolved,
  };
}

function debounce(fn, delayMs) {
  let timerId = null;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delayMs);
  };
}

// test('timeout fires after 30s', () => {
//   vi.useFakeTimers();
//   const onTimeout = vi.fn();
//   createPaymentTimeout(onTimeout, 30000);
//   vi.advanceTimersByTime(29999);
//   expect(onTimeout).not.toHaveBeenCalled();
//   vi.advanceTimersByTime(1);
//   expect(onTimeout).toHaveBeenCalledWith('Payment timed out. Please try again.');
//   vi.useRealTimers();
// });

// test('cancels when resolved early', () => {
//   vi.useFakeTimers();
//   const onTimeout = vi.fn();
//   const payment = createPaymentTimeout(onTimeout, 30000);
//   payment.resolve();
//   vi.advanceTimersByTime(30000);
//   expect(onTimeout).not.toHaveBeenCalled();
//   vi.useRealTimers();
// });

console.log("--- Fake Timers ---");
console.log("vi.useFakeTimers() / vi.advanceTimersByTime(ms) / vi.useRealTimers()");
console.log("");


// ============================================================
// SECTION 5 — Testing Race Conditions
// ============================================================

function fetchFromPrimaryBank(txnId) {
  return new Promise((r) => setTimeout(() => r({ txnId, source: "primary", status: "OK" }), 200));
}
function fetchFromFallbackBank(txnId) {
  return new Promise((r) => setTimeout(() => r({ txnId, source: "fallback", status: "OK" }), 500));
}

// test('Promise.race returns fastest response', async () => {
//   const result = await Promise.race([fetchFromPrimaryBank('TXN001'), fetchFromFallbackBank('TXN001')]);
//   expect(result.source).toBe('primary');  // 200ms beats 500ms
// });

// test('Promise.allSettled captures all including failures', async () => {
//   const results = await Promise.allSettled([
//     fetchFromPrimaryBank('TXN002'),
//     Promise.reject(new Error('Bank down')),
//   ]);
//   expect(results[0].status).toBe('fulfilled');
//   expect(results[1].status).toBe('rejected');
// });

console.log("--- Race Conditions ---");
console.log("Promise.race -- first to settle wins");
console.log("Promise.allSettled -- wait for ALL, capture each outcome");
console.log("");


// ============================================================
// SECTION 6 — Testing Retry Logic
// ============================================================

async function withRetry(fn, maxRetries = 3, baseDelay = 100) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (error) {
      lastError = error;
      if (error.nonRetriable) throw error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

// test('succeeds after 2 failures', async () => {
//   const mockApi = vi.fn()
//     .mockRejectedValueOnce(new Error('Timeout'))
//     .mockRejectedValueOnce(new Error('Timeout'))
//     .mockResolvedValueOnce({ status: 'VERIFIED' });
//   vi.useFakeTimers();
//   const promise = withRetry(mockApi, 3, 100);
//   await vi.advanceTimersByTimeAsync(100);  // 1st retry
//   await vi.advanceTimersByTimeAsync(200);  // 2nd retry
//   const result = await promise;
//   expect(result.status).toBe('VERIFIED');
//   expect(mockApi).toHaveBeenCalledTimes(3);
//   vi.useRealTimers();
// });

// test('does not retry non-retriable errors', async () => {
//   const err = new Error('Invalid credentials');
//   err.nonRetriable = true;
//   const mockApi = vi.fn().mockRejectedValue(err);
//   await expect(withRetry(mockApi, 3)).rejects.toThrow('Invalid credentials');
//   expect(mockApi).toHaveBeenCalledTimes(1);
// });

console.log("--- Retry Logic ---");
console.log("mockRejectedValueOnce for sequential failures then success.");
console.log("");


// ============================================================
// SECTION 7 — Common Async Mistakes
// ============================================================

// 1. Forgetting await -> test passes before assertion runs
// 2. Not testing rejections -> silent production failures
// 3. Mixing done + Promises -> double resolution warnings

console.log("--- Common Mistakes ---");
console.log("1. Forgetting await  2. No rejection tests  3. Mixing done + Promises");
console.log("");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. ALWAYS return or await Promises -- otherwise assertions
//    run after the test passes (the #1 async testing bug).
//
// 2. async/await is the default. Use .resolves/.rejects for
//    clean one-liner assertions on Promises.
//
// 3. done() ONLY for legacy callbacks. Never mix with Promises.
//
// 4. Fake timers for setTimeout/setInterval. Always restore
//    in afterEach.
//
// 5. Promise.race for first-to-settle, Promise.allSettled for
//    capturing all results including failures.
//
// 6. Retry logic: mock sequential failures then success.
//    Also test: retries exhausted, non-retriable errors.
//
// QUICK REFERENCE:
// | Pattern              | When to use                          |
// |----------------------|--------------------------------------|
// | async/await          | DEFAULT for all async tests          |
// | .resolves/.rejects   | Clean one-liner Promise assertions   |
// | done callback        | Legacy callback APIs only            |
// | vi.useFakeTimers()   | setTimeout, setInterval, debounce    |
// | Promise.allSettled   | Parallel ops with partial failure    |
// ============================================================

console.log("=== File 06 Complete: Testing Asynchronous Code ===");
