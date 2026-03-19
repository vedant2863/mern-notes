# Recording Guide — Yatra Planner API

## Episode Overview

Build a travel planning API that aggregates data from multiple sources concurrently and streams results via SSE. Teach async patterns, caching, and service layers.

Total estimated recording time: 50-60 minutes

---

## Step 1: models.py (5 min)

**Open:** `models.py`

**Explain:**
- Start with the data shapes — what does a travel plan look like?
- Walk through TravelRequest (input) and the response models
- Point out WeatherInfo, CurrencyRate, PlaceOfInterest are standalone pieces
- TravelPlan ties them all together into one response
- Mention Pydantic handles validation automatically

**Key talking point:** "We design models first because they define the contract between our services and our API."

---

## Step 2: services/weather_service.py (8 min)

**Open:** `services/weather_service.py`

**Explain:**
- Show the simulated data dictionaries — realistic temps for Indian cities
- Walk through `_get_simulated_weather` — generates day-by-day forecasts with random variation
- Focus on `fetch_weather` — the main async function
- Show the cache check at the top (explain you'll build cache next)
- Show how httpx.AsyncClient would call a real API
- Point out `async with` and `await` keywords
- Explain the fallback pattern: try real API, fall back to simulated

**Key talking point:** "This service is async because in production, we'll call real APIs. The simulated data lets us demo without API keys."

---

## Step 3: services/currency_service.py (6 min)

**Open:** `services/currency_service.py`

**Explain:**
- Same pattern as weather — simulated rates with real API fallback
- Show SIMULATED_RATES dictionary
- Walk through the fluctuation logic (small random changes)
- Point out it follows the exact same structure: check cache, try real, fall back

**Key talking point:** "Notice the pattern? Every service has the same shape. This makes the codebase predictable."

---

## Step 4: services/places_service.py (5 min)

**Open:** `services/places_service.py`

**Explain:**
- Pure simulated data — a database of places per destination
- Show the PlaceOfInterest instances with realistic Indian tourist spots
- DEFAULT_PLACES for unknown destinations
- Simulated delay to mimic a real API call
- Simplest service — just a lookup

**Key talking point:** "In production, this would call Google Places or a travel API. The interface stays the same."

---

## Step 5: services/cache.py (6 min)

**Open:** `services/cache.py`

**Explain:**
- Simple dictionary-based cache — no Redis needed for demos
- Walk through the data structure: key maps to {value, timestamp, ttl}
- `get_from_cache` — checks if entry exists and hasn't expired
- `set_in_cache` — stores with current timestamp
- `clear_cache` and `get_cache_stats` for debugging
- Mention this works great for single-process apps

**Key talking point:** "This is a 50-line cache that handles 90% of demo use cases. In production, swap in Redis."

---

## Step 6: routes/planner.py (8 min)

**Open:** `routes/planner.py`

**Explain:**
- This is where everything comes together
- Show the POST endpoint receiving TravelRequest
- Walk through validation (date checks, max 14 days)
- **Key moment:** `asyncio.gather` — runs all three service calls concurrently
- Explain gather vs sequential: 3 seconds total vs 1+1+1 = 3 sequential
- Show how results are unpacked and assembled into TravelPlan
- Bonus endpoints: cache-stats and cache-clear for debugging

**Key talking point:** "asyncio.gather is the star here. One line turns three sequential 1-second calls into one 1-second parallel call."

---

## Step 7: routes/stream.py (10 min)

**Open:** `routes/stream.py`

**Explain:**
- SSE version of the same plan — but streams sections one at a time
- Walk through `format_sse` helper — event name + JSON data + double newline
- Walk through `plan_event_generator` — an async generator
- Each section: send status event, fetch data, send data event
- Error handling per section — one failure doesn't kill the whole stream
- Show the StreamingResponse with `text/event-stream` media type
- Explain Cache-Control and Connection headers

**Key talking point:** "SSE is perfect for this — the client sees weather data immediately while currency rates are still loading."

**Demo:** If possible, open the SSE URL in the browser or use curl -N to show events appearing one by one.

---

## Step 8: config.py (2 min)

**Open:** `config.py`

**Explain:**
- Quick file — loads env vars with sensible defaults
- API keys are optional — empty string means use simulated data
- Cache TTL is configurable

---

## Step 9: main.py (3 min)

**Open:** `main.py`

**Explain:**
- Clean app setup with metadata
- Root endpoint shows available routes (self-documenting)
- Two routers included — planner and stream
- Both share the `/plan` prefix but different HTTP methods

**Demo:** Run `uvicorn main:app --reload` and show:
1. Swagger docs at /docs
2. POST /plan/ with a Goa trip
3. GET /plan/stream in browser or curl
4. Cache stats after a few requests

---

## Wrap-Up Talking Points

- asyncio.gather for concurrent API calls
- SSE as a lightweight alternative to WebSockets
- Cache pattern keeps things fast without external dependencies
- Service layer makes it easy to swap simulated data for real APIs
- Every service follows the same pattern — predictable and testable
