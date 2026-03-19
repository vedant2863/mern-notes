# Recording Guide - Naukri Board

## Episode Overview
Build a job board API with CORS, API versioning, tests, and Docker. This is the most "production-ready" project.

## Estimated Duration: 45-55 minutes

---

## Step 1: models/job.py (5 min)
- Company is a nested model — embedded inside Job
- Show the three model pattern: JobCreate, JobResponse, JobUpdate
- Point out salary_min and salary_max — we will filter by range in v2
- skills is a list — we will filter by individual skill in v2

## Step 2: database.py (3 min)
- Standard Motor setup
- Config reads from environment variables — important for Docker
- Show get_db — we will override this in tests

## Step 3: routes/v1/jobs.py (8 min)
- Basic CRUD — create, list, get, update, delete
- List just returns latest 20, no filtering
- Explain doc_to_response helper — converts MongoDB doc to Pydantic model
- Show the prefix "/v1/jobs" — this is how versioning works
- Test all endpoints in Swagger UI

## Step 4: main.py with CORS (6 min)
- Import CORSMiddleware from fastapi.middleware.cors
- Explain what CORS is: browsers block cross-origin requests by default
- Show the ALLOWED_ORIGINS list — React on 3000, Vite on 5173
- Explain allow_methods=["*"] and allow_headers=["*"]
- Include v1 router, test it works
- Show CORS headers in browser DevTools (Options preflight request)

## Step 5: routes/v2/jobs.py — Enhanced (10 min)
- Same CRUD but the list endpoint is different
- Walk through all query parameters: job_type, location, is_remote, skill
- Salary range filtering — salary_max >= salary_min filter (overlap logic)
- Pagination with skip and limit
- NEW: /stats endpoint using aggregation pipeline
  - Groups by job_type, counts, averages salary
- Compare v1 list vs v2 list side by side
- Explain why versioning: v1 clients are not broken, v2 clients get new features

## Step 6: tests/ (10 min)
- tests/conftest.py
  - Explain fixtures: client, clean_db, sample_job
  - Show dependency override: app.dependency_overrides[get_db] = override_get_db
  - Explain why we use a separate test database
  - autouse=True on clean_db — runs before every test automatically
- tests/test_jobs.py
  - Walk through each test — create, list, get, update, delete, v2 filter
  - Explain the pattern: arrange (create data) -> act (make request) -> assert
  - Run pytest with -v flag, show output
  - Show what a failing test looks like (intentionally break something)

## Step 7: Dockerfile + docker-compose.yml (8 min)
- Dockerfile: multi-stage build
  - Stage 1 (builder): install dependencies into /install
  - Stage 2 (runtime): copy only what we need — smaller image
  - Explain why multi-stage: security + smaller image size
- docker-compose.yml
  - Two services: app and mongo
  - Environment variables passed to app container
  - depends_on ensures mongo starts first
  - Named volume for data persistence
- Run docker-compose up --build and demo

## Step 8: config.py (3 min)
- Show os.getenv with defaults — works locally and in Docker
- CORS origins list — in production this comes from env vars
- Explain the pattern: config.py is the single source of truth

## Key Talking Points
- CORS is required for any API consumed by a browser-based frontend
- API versioning lets you evolve without breaking existing clients
- Tests with dependency override let you test against a clean database
- Multi-stage Docker builds are industry standard
- This project structure works for real production APIs
