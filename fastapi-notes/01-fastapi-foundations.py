"""
============================================================
FILE 01: FASTAPI FOUNDATIONS AND YOUR FIRST API
============================================================
Topics: FastAPI overview, ASGI vs WSGI, installation,
        app creation, first routes, uvicorn,
        request-response lifecycle, interactive docs,
        async vs def

WHY THIS MATTERS:
FastAPI is the fastest-growing Python web framework. It gives
you automatic validation, serialization, and documentation
out of the box — things Flask/Django devs build manually.
Mastering its foundations saves weeks of boilerplate.
============================================================
"""

# STORY: Swiggy — Flask to FastAPI for 2M Orders/Day
# Swiggy processes over 2 million orders daily across 500+ cities.
# Their early microservices on Flask were synchronous, with no built-in
# validation and always-outdated docs. Migrating to FastAPI gave them
# 3x throughput (async) and faster onboarding (auto Swagger docs).
# Lesson: choosing the right framework foundation compounds over time.

# ════════════════════════════════════════════════════════════
# SECTION 1 — What Is FastAPI and Why It Exists
# ════════════════════════════════════════════════════════════

# WHY: Understanding the building blocks helps you debug deeper
# issues and know which docs to read (FastAPI, Starlette, or Pydantic).

# FastAPI is built on two powerful libraries:
#   Starlette = engine + chassis (handles HTTP, routing, WebSockets)
#   Pydantic  = safety system (validates and serializes data)
#   FastAPI   = the finished car (developer experience + OpenAPI docs)
#
# Used by Microsoft, Netflix, Uber, and many Indian startups.
# One of the fastest Python frameworks (on par with Node.js/Go).

# ════════════════════════════════════════════════════════════
# SECTION 2 — ASGI vs WSGI: The Protocol Difference
# ════════════════════════════════════════════════════════════

# WHY: If you've used Flask/Django, you used WSGI. Understanding
# ASGI explains why FastAPI handles thousands of concurrent
# connections where Flask chokes.

# WSGI (Flask, Django): synchronous — one request per worker.
#   1000 concurrent users = need ~1000 workers.
# ASGI (FastAPI, Starlette): asynchronous — many requests per worker.
#   1000 concurrent users = a few workers can manage it.
#
# Analogy (Swiggy context):
#   WSGI = one delivery partner per order (even if waiting at restaurant)
#   ASGI = one delivery partner picks up multiple orders intelligently
#
# Install: pip install "fastapi[standard]"
# Gives you FastAPI + uvicorn + python-multipart + httpx for testing.

# ════════════════════════════════════════════════════════════
# SECTION 3 — Creating Your First FastAPI Application
# ════════════════════════════════════════════════════════════

# WHY: The app object is the heart of everything. Every route,
# middleware, and event handler is registered on it.

from fastapi import FastAPI, Request
import uvicorn

app = FastAPI(
    title="Swiggy Order Service",
    description="Internal API for managing food orders.",
    version="2.1.0",
    # docs_url="/docs",       # Swagger UI (default)
    # redoc_url="/redoc",     # ReDoc (default)
    # In production: docs_url=None, redoc_url=None
)

# ════════════════════════════════════════════════════════════
# SECTION 4 — Your First Route and Running the Server
# ════════════════════════════════════════════════════════════

# WHY: Routes map URLs to functions. This is the core pattern
# you'll repeat hundreds of times in any real project.

@app.get("/")
def read_root():
    """Root endpoint — health check / welcome message."""
    # FastAPI automatically converts this dict to JSON
    return {"message": "Welcome to Swiggy Order Service", "status": "healthy"}


# --- Running with uvicorn ---
#   uvicorn 01-fastapi-foundations:app --reload
#   --reload   → auto-restart on code changes (dev only!)
#   --host     → bind address (default 127.0.0.1)
#   --port     → port number (default 8000)
#   --workers  → number of worker processes (production)

# ════════════════════════════════════════════════════════════
# SECTION 5 — The Request-Response Lifecycle
# ════════════════════════════════════════════════════════════

# WHY: Knowing what happens between request and response helps
# you debug middleware, auth, and performance issues.

# 1. CLIENT sends HTTP request → 2. UVICORN receives raw bytes
# → 3. STARLETTE matches URL to route → 4. MIDDLEWARE runs
# → 5. DEPENDENCIES resolve (DB, auth) → 6. PYDANTIC validates input
# → 7. YOUR FUNCTION runs → 8. PYDANTIC validates response
# → 9. MIDDLEWARE (response side) → 10. UVICORN sends response
#
# If validation fails at step 6, FastAPI returns 422 automatically.
# Your function never even runs — saving compute.

@app.get("/debug/request-info")
async def request_info(request: Request):
    """Inspect the raw request object (useful for debugging)."""
    return {
        "method": request.method,
        "url": str(request.url),
        "client_host": request.client.host if request.client else None,
        "query_params": dict(request.query_params),
    }


# ════════════════════════════════════════════════════════════
# SECTION 6 — Interactive Docs and Path Operation Parameters
# ════════════════════════════════════════════════════════════

# WHY: Auto-generated docs are FastAPI's killer feature. Frontend
# devs and QA can test your API without Postman — always in sync.
#
# Visit after running:
#   /docs         → Swagger UI (interactive, send real requests)
#   /redoc        → ReDoc (beautiful read-only docs)
#   /openapi.json → Raw OpenAPI schema (import to Postman, API Gateway, etc.)

@app.get(
    "/orders/active",
    summary="Get Active Orders",
    description="Returns orders currently being prepared or out for delivery.",
    tags=["Orders"],
    response_description="List of active order objects",
)
def get_active_orders():
    """Decorator params control how the route appears in docs."""
    return {
        "active_orders": [
            {"id": 2, "item": "Masala Dosa", "status": "preparing"},
            {"id": 3, "item": "Paneer Tikka", "status": "out_for_delivery"},
        ]
    }


# --- Deprecated endpoint example ---
@app.get(
    "/orders/v1/history",
    tags=["Orders"],
    deprecated=True,
    summary="[DEPRECATED] Use /orders/history/v2 instead",
)
def orders_history_v1():
    """Shows strikethrough in Swagger docs — signals migration needed."""
    return {"orders": [], "warning": "This endpoint is deprecated"}


# ════════════════════════════════════════════════════════════
# SECTION 7 — async def vs def: When to Use Which
# ════════════════════════════════════════════════════════════

# WHY: Using async wrong can actually HURT performance. This
# is the #1 mistake new FastAPI developers make.

# RULE OF THUMB:
#   async def → when you use await (httpx, motor, asyncpg, aioredis)
#   plain def → when you call sync libs (requests, pymongo, pandas)
#               or when you're NOT SURE (def is the safe default!)
#
# WHY THIS MATTERS:
#   async def runs on the main event loop.
#   plain def runs in a thread pool (FastAPI handles this!).
#   If you use async def but call sync code inside,
#   you BLOCK the entire event loop = terrible performance.
#
# Swiggy: order service uses motor (async MongoDB driver) → async def
#         analytics service uses pandas (sync) → plain def

@app.get("/demo/async-correct", tags=["Demo"])
async def async_correct():
    """Correct: async def — would use await for DB/HTTP calls."""
    # In real code: result = await async_db.find_one({"id": 1})
    return {"pattern": "async def + await = correct"}


@app.get("/demo/sync-correct", tags=["Demo"])
def sync_correct():
    """Correct: plain def — FastAPI runs this in a thread pool."""
    # In real code: result = requests.get("https://api.example.com")
    return {"pattern": "def + sync library = correct (threadpool)"}


# WRONG (don't do this!):
# async def + time.sleep(5) → blocks the ENTIRE event loop
# Fix: use plain def, OR use await asyncio.sleep(5)

# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. FastAPI = Starlette (async HTTP) + Pydantic (validation) + OpenAPI (docs).
# 2. ASGI handles thousands of concurrent connections; WSGI cannot.
# 3. Install: pip install "fastapi[standard]" — gives you everything.
# 4. Every route is a decorator (@app.get, @app.post) on a function.
# 5. /docs and /redoc give you free, always-accurate interactive API docs.
# 6. Use def for sync code, async def only when you actually await things.
# 7. OpenAPI schema at /openapi.json exports to Postman, API Gateways, SDKs.
# "First, solve the problem. Then, write the code." — John Johnson

if __name__ == "__main__":
    uvicorn.run("01-fastapi-foundations:app", host="127.0.0.1", port=8000, reload=True)
