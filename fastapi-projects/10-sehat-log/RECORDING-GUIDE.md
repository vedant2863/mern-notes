# Recording Guide - Sehat Log

## Episode Overview
Build a fitness tracking API with custom middleware, rate limiting, and MongoDB aggregation.

## Estimated Duration: 40-50 minutes

---

## Step 1: models/ (7 min)
- Start with models/user.py — simple user with name, email, weight
- Then models/meal.py — MealCreate, MealResponse, MealUpdate
  - Explain the three-model pattern: Create (input), Response (output), Update (partial)
  - Show Optional fields in MealUpdate — only update what's sent
- Then models/workout.py — same pattern
  - Point out calories vs calories_burned — meals add, workouts subtract

## Step 2: database.py (3 min)
- Motor setup with three collections
- Explain why separate collections for meals and workouts (not embedded)
- Each document will have a user_id field for filtering

## Step 3: dependencies.py (5 min)
- CommonPagination class — this is dependency injection with a class
- Explain __init__ with Query parameters — FastAPI calls this automatically
- Show how skip and limit have validation (ge=0, le=100)
- get_db function — simple but shows the pattern for swapping databases

## Step 4: routes/meals.py (8 min)
- POST — log a meal, add timestamp server-side
- GET list — uses CommonPagination as a dependency via Depends()
  - Show how pagination.skip and pagination.limit work
- GET by ID — standard ObjectId lookup
- PUT — only updates fields that were actually sent (not None)
- DELETE — returns confirmation message
- Test with Swagger: create a meal, list meals, update calories

## Step 5: routes/workouts.py (5 min)
- Same CRUD pattern as meals — point out the similarity
- Explain this is intentional: real projects have repeated patterns
- Quick test in Swagger

## Step 6: routes/summary.py (10 min)
- This is the most interesting route file
- daily_summary — uses MongoDB aggregation pipeline
  - Walk through $match (date range filter) and $group ($sum)
  - Calculate net calories = calories_in - calories_burned
  - Explain the date parsing and range logic
- weekly_trend — loops through 7 days
  - Each day gets its own aggregation query
  - Returns an array of daily summaries
- Test: log some meals and workouts, then check the summary

## Step 7: middleware.py (8 min)
- RequestTimingMiddleware
  - Explain BaseHTTPMiddleware and the dispatch pattern
  - time.time() before and after call_next
  - Adds X-Process-Time header — show it in Swagger response headers
- SimpleRateLimiter
  - Stores request timestamps per IP in a dict
  - Cleans up old timestamps (sliding window)
  - Returns 429 if limit exceeded
  - Test: hit an endpoint rapidly, show the 429 response

## Step 8: main.py (4 min)
- Add middleware BEFORE routers — explain execution order
- Include all three routers
- Run and do a full walkthrough: log meals, log workouts, check summary, check timing header

## Key Talking Points
- Middleware runs on EVERY request — good for cross-cutting concerns
- Rate limiting in production uses Redis, but this shows the concept
- Dependency injection with classes is cleaner than function parameters
- MongoDB aggregation pipelines are powerful for analytics
- The three-model pattern (Create/Response/Update) is standard in production APIs
