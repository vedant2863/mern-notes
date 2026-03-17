// ============================================================
// FILE 08: TESTING API CALLS
// Topic: Mocking HTTP requests -- from manual fetch mocks to MSW
// ============================================================

// ============================================================
// STORY: Ola processes millions of ride requests daily, calling
//   Google Maps, a pricing engine, and driver matching. Real API
//   calls in tests cost thousands in fees and fail on network hiccups.
//   MSW lets engineers test every scenario in milliseconds at zero cost.
// ============================================================

// Real API calls in tests: SLOW (100ms-2s), FLAKY (network),
// EXPENSIVE (API fees), UNCONTROLLABLE, and have SIDE EFFECTS.

console.log("--- The Problem with Real API Calls ---");
console.log("Slow, flaky, expensive, uncontrollable, side effects.");
console.log("");


// ============================================================
// SECTION 1 — The Ride Service (Code Under Test)
// ============================================================

const BASE_URL = "https://api.ola-internal.com";

async function geocodeAddress(address) {
  const response = await fetch(`${BASE_URL}/geocode?address=${encodeURIComponent(address)}`);
  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
  return response.json();
}

async function calculateDistance(fromCoords, toCoords) {
  const response = await fetch(`${BASE_URL}/distance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromCoords, to: toCoords }),
  });
  if (!response.ok) throw new Error(`Distance calculation failed: ${response.status}`);
  return response.json();
}

async function estimateFare(distanceKm, rideType = "mini") {
  const response = await fetch(`${BASE_URL}/fare`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-token-123" },
    body: JSON.stringify({ distanceKm, rideType }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Authentication failed. Please login again.");
    throw new Error(`Fare estimation failed: ${response.status}`);
  }
  return response.json();
}

async function getRideEstimate(pickup, dropoff, rideType = "mini") {
  const [pickupCoords, dropoffCoords] = await Promise.all([
    geocodeAddress(pickup), geocodeAddress(dropoff),
  ]);
  const { distanceKm, durationMin } = await calculateDistance(pickupCoords, dropoffCoords);
  const { fare, surgeFactor } = await estimateFare(distanceKm, rideType);
  return { pickup, dropoff, distanceKm, durationMin, fare, surgeFactor, rideType };
}


// ============================================================
// SECTION 2 — Approach 1: Mock global.fetch
// ============================================================

// Pro: simple, direct control. Con: coupled to fetch library.

// test('geocodeAddress returns coordinates', async () => {
//   global.fetch = vi.fn().mockResolvedValue({
//     ok: true,
//     json: () => Promise.resolve({ lat: 12.9716, lng: 77.5946 }),
//   });
//   const result = await geocodeAddress('Koramangala, Bangalore');
//   expect(result).toEqual({ lat: 12.9716, lng: 77.5946 });
//   expect(global.fetch).toHaveBeenCalledWith(
//     'https://api.ola-internal.com/geocode?address=Koramangala%2C%20Bangalore'
//   );
// });

// test('throws on API error', async () => {
//   global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
//   await expect(geocodeAddress('Invalid')).rejects.toThrow('Geocoding failed: 500');
// });

console.log("--- Approach 1: Mock global.fetch ---");
console.log("Pro: simple. Con: coupled to fetch library.");
console.log("");


// ============================================================
// SECTION 3 — Approach 2: Mock the Service Layer
// ============================================================

// Pro: decoupled from HTTP library. Con: service itself untested.
// vi.mock('./rideService', () => ({ getEstimate: vi.fn() }));

async function handleEstimateRequest(pickup, dropoff, type) {
  if (!pickup || !dropoff) return { error: "Pickup and dropoff are required" };
  try {
    const estimate = await getRideEstimate(pickup, dropoff, type);
    return { success: true, estimate: { ...estimate, formattedFare: `Rs. ${estimate.fare}` } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// test('handler formats estimate correctly', async () => {
//   getEstimate.mockResolvedValue({ distanceKm: 12, fare: 250, surgeFactor: 1.2 });
//   const result = await handleEstimateRequest('Indiranagar', 'Airport', 'sedan');
//   expect(result.estimate.formattedFare).toBe('Rs. 250');
// });

console.log("--- Approach 2: Mock the Service Layer ---");
console.log("Pro: decoupled. Con: service itself untested.");
console.log("");


// ============================================================
// SECTION 4 — Approach 3: MSW (Mock Service Worker)
// ============================================================

// MSW intercepts at the NETWORK level. Your code makes REAL fetch calls.
// Catches URL construction, header, and body bugs that code-level mocks miss.

// import { http, HttpResponse } from 'msw';
// import { setupServer } from 'msw/node';
//
// const handlers = [
//   http.get('https://api.ola-internal.com/geocode', ({ request }) => {
//     const url = new URL(request.url);
//     const address = url.searchParams.get('address');
//     const coords = {
//       'Koramangala': { lat: 12.9352, lng: 77.6245 },
//       'Airport':     { lat: 13.1986, lng: 77.7066 },
//     };
//     return HttpResponse.json(coords[address] || { lat: 12.9716, lng: 77.5946 });
//   }),
//
//   http.post('https://api.ola-internal.com/fare', async ({ request }) => {
//     const authHeader = request.headers.get('Authorization');
//     if (!authHeader?.startsWith('Bearer ')) return new HttpResponse(null, { status: 401 });
//     const body = await request.json();
//     const rate = { mini: 10, sedan: 15, suv: 20 }[body.rideType] || 10;
//     return HttpResponse.json({ fare: Math.round(body.distanceKm * rate + 50), surgeFactor: 1.0 });
//   }),
// ];
// const server = setupServer(...handlers);

console.log("--- MSW Setup ---");
console.log("Define handlers with http.get()/http.post(), create server with setupServer()");
console.log("");


// ============================================================
// SECTION 5 — MSW Lifecycle & Error Scenarios
// ============================================================

// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());

// server.use() overrides a handler for ONE test only:

// test('handles geocoding failure (500)', async () => {
//   server.use(http.get(`${BASE_URL}/geocode`, () => new HttpResponse(null, { status: 500 })));
//   await expect(getRideEstimate('A', 'B')).rejects.toThrow('Geocoding failed: 500');
// });

// test('handles auth failure (401)', async () => {
//   server.use(http.post(`${BASE_URL}/fare`, () => new HttpResponse(null, { status: 401 })));
//   await expect(getRideEstimate('A', 'B')).rejects.toThrow('Authentication failed');
// });

// test('handles network failure', async () => {
//   server.use(http.get(`${BASE_URL}/geocode`, () => HttpResponse.error()));
//   await expect(getRideEstimate('A', 'B')).rejects.toThrow();
// });

console.log("--- Error Scenarios ---");
console.log("server.use(handler) -- override for one test, reset in afterEach");
console.log("");


// ============================================================
// SECTION 6 — Verifying Requests & Retry Logic
// ============================================================

// test('sends auth header with fare request', async () => {
//   let capturedAuth;
//   server.use(http.post(`${BASE_URL}/fare`, async ({ request }) => {
//     capturedAuth = request.headers.get('Authorization');
//     return HttpResponse.json({ fare: 200, surgeFactor: 1.0 });
//   }));
//   await getRideEstimate('A', 'B', 'mini');
//   expect(capturedAuth).toBe('Bearer test-token-123');
// });

// Stateful handler for retry testing:
// test('retries and succeeds on 3rd attempt', async () => {
//   let callCount = 0;
//   server.use(http.get(`${BASE_URL}/geocode`, () => {
//     callCount++;
//     if (callCount <= 2) return new HttpResponse(null, { status: 503 });
//     return HttpResponse.json({ lat: 12.97, lng: 77.59 });
//   }));
// });

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status < 500) throw new Error(`Client error: ${response.status}`);
      lastError = new Error(`Server error: ${response.status}`);
    } catch (error) { lastError = error; }
    if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 100 * attempt));
  }
  throw lastError;
}

// MSW works in BOTH Node (setupServer) and browser (setupWorker).
// Same handlers, different runtime -- share handler files.

console.log("--- Request Verification & Retry ---");
console.log("Capture body/headers in handler. Stateful handlers for retry tests.");
console.log("");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Never make real API calls in tests.
//
// 2. Three approaches (lowest to highest fidelity):
//    a) Mock fetch directly -- quick but brittle
//    b) Mock the service module -- decoupled but less realistic
//    c) MSW -- network-level, most realistic
//
// 3. MSW intercepts real fetch calls. Catches URL, header, and
//    body bugs that code-level mocks miss.
//
// 4. MSW lifecycle: listen() beforeAll, resetHandlers() afterEach,
//    close() afterAll.
//
// 5. server.use() overrides handlers per-test for error scenarios.
//
// 6. Verify request payloads by capturing body/headers in handlers.
//
// 7. Use delay() for loading states. Stateful handlers for retry.
//
// 8. MSW works in Node (setupServer) and browser (setupWorker).
// ============================================================

console.log("=== File 08 Complete: Testing API Calls ===");
