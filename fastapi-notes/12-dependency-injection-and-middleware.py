"""
============================================================
FILE 12: DEPENDENCY INJECTION, MIDDLEWARE, AND REQUEST LIFECYCLE
============================================================
Topics: Depends(), function deps, class deps, yield deps,
        nested deps, dependency overrides, middleware, CORS,
        timing, lifespan

WHY THIS MATTERS:
Every production API needs authentication checks, database
sessions, logging, and CORS headers on every request. Without
DI and middleware, you would copy-paste the same 20 lines
into every single endpoint. DI is how professionals build
maintainable, testable APIs.
============================================================
"""

# STORY: Paytm — Rate Limit -> Auth -> Log -> Compress Pipeline
# Paytm processes 1.5 billion+ transactions per month. Every API
# request goes through a pipeline: rate limiting, authentication,
# logging, and compression. This is exactly what middleware and
# dependency injection solve. Paytm's backend uses DI for auth
# and DB sessions, and middleware for logging and CORS.

from typing import Annotated
from datetime import datetime, timezone
import time

from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, Header, Query,
    Request, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

# ════════════════════════════════════════════════════════════
# SECTION 1 — Simple Function Dependencies
# ════════════════════════════════════════════════════════════

# WHY: The simplest form of DI — a function that extracts or
# validates something from the request. FastAPI calls it for
# you and injects the return value.

# How Depends() works:
# 1. FastAPI sees Depends(some_function) in your endpoint signature
# 2. Before calling your endpoint, it calls some_function
# 3. It inspects some_function's parameters too (recursively!)
# 4. The return value is passed to your endpoint
# 5. If some_function raises HTTPException, your endpoint never runs

def common_pagination(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    """
    Extract pagination params. Instead of repeating these two
    query params in every list endpoint, define once, Depends() everywhere.
    """
    return {"page": page, "page_size": page_size, "skip": (page - 1) * page_size}


def verify_api_key(x_api_key: str = Header(...)):
    """Check that the request includes a valid API key header."""
    if x_api_key not in {"paytm-key-2024", "test-key-001"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Invalid API key")
    return x_api_key


# ════════════════════════════════════════════════════════════
# SECTION 2 — Parameterized Dependencies (Factory Pattern)
# ════════════════════════════════════════════════════════════

# WHY: Sometimes you need a configurable dependency — like a
# role checker that accepts different allowed roles per endpoint.
# A function that RETURNS a function achieves this.

def require_role(allowed_roles: list):
    """
    Factory: creates a dependency.
    Usage: Depends(require_role(["admin", "manager"]))
    """
    def role_checker(x_user_role: str = Header("user")):
        if x_user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{x_user_role}' not allowed. Need: {allowed_roles}"
            )
        return x_user_role
    return role_checker


# ════════════════════════════════════════════════════════════
# SECTION 3 — Nested Dependencies (Dependency Chains)
# ════════════════════════════════════════════════════════════

# WHY: Real apps have dependency chains. To get the current user,
# first extract the token, then decode it, then look up the user.
# Each step is a dependency that feeds the next.

def extract_token(authorization: str = Header(...)):
    """Step 1: Extract bearer token from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header format")
    return authorization.replace("Bearer ", "")


def decode_token(token: str = Depends(extract_token)):
    """
    Step 2: Decode token to get user info.
    Depends on extract_token — FastAPI chains them automatically.
    In production, use python-jose: jwt.decode(token, SECRET, algorithms=["HS256"])
    """
    fake_users = {
        "valid-token-rahul": {"user_id": 1, "username": "rahul", "role": "admin"},
        "valid-token-priya": {"user_id": 2, "username": "priya", "role": "user"},
    }
    user_data = fake_users.get(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_data


def get_current_user(user_data: dict = Depends(decode_token)):
    """Step 3: Chain complete — Header -> extract -> decode -> user."""
    return user_data


# ════════════════════════════════════════════════════════════
# SECTION 4 — Class-Based Dependencies (Stateful Logic)
# ════════════════════════════════════════════════════════════

# WHY: When a dependency needs state or configuration, a class
# with __call__ is cleaner than nested closures. Think of a
# rate limiter that tracks request counts per IP.

class RateLimiter:
    """In-memory rate limiter. Production: use Redis."""

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict = {}  # ip -> [timestamps]

    def __call__(self, request: Request):
        """FastAPI calls this because __call__ makes the instance callable."""
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # Clean old requests, check limit
        self.requests[client_ip] = [
            t for t in self.requests.get(client_ip, [])
            if now - t < self.window_seconds
        ]
        if len(self.requests[client_ip]) >= self.max_requests:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")

        self.requests[client_ip].append(now)
        return {"ip": client_ip, "remaining": self.max_requests - len(self.requests[client_ip])}


rate_limiter = RateLimiter(max_requests=50, window_seconds=60)


# ════════════════════════════════════════════════════════════
# SECTION 5 — Yield Dependencies (Setup + Cleanup)
# ════════════════════════════════════════════════════════════

# WHY: Database sessions, file handles, and connections must be
# CLOSED after the request. Yield dependencies give you setup +
# cleanup in one function — like a context manager.

def get_db_session():
    """
    Everything before yield = setup.
    Everything after yield = cleanup (always runs, even on error).
    """
    print("[DB] Opening session...")
    session = {"connection": "active", "queries": []}
    try:
        yield session
        print("[DB] Committing...")
    except Exception:
        print("[DB] Rolling back...")
        raise
    finally:
        print("[DB] Closing session...")


# ════════════════════════════════════════════════════════════
# SECTION 6 — Router-Level Dependencies and Overrides
# ════════════════════════════════════════════════════════════

# WHY: Some dependencies should run on EVERY request in a group.
# Set them at the router level instead of on each endpoint.

# Router-level: all admin endpoints require admin role
admin_router = APIRouter(
    prefix="/admin", tags=["Admin"],
    dependencies=[Depends(require_role(["admin"]))],
)


@admin_router.get("/dashboard")
def admin_dashboard():
    """Only accessible if x-user-role header is 'admin'."""
    return {"message": "Welcome to admin dashboard"}


# --- Dependency Overrides for Testing ---
# In tests, swap real deps with fakes — no DB, no auth needed.
# app.dependency_overrides[get_current_user] = lambda: {"user_id": 999, "role": "admin"}
# ... run tests ...
# app.dependency_overrides.clear()


# ════════════════════════════════════════════════════════════
# SECTION 7 — Middleware and CORS
# ════════════════════════════════════════════════════════════

# WHY: Middleware wraps EVERY request — runs before the endpoint
# and after the response. Perfect for timing, logging, headers.
# CORS is required when your React frontend is on a different
# domain than your API.

# Request lifecycle:
# Client -> Middleware 1 -> Middleware 2 -> Route Handler
# Client <- Middleware 1 <- Middleware 2 <- Response

app = FastAPI(title="Paytm-style API with Middleware")
app.include_router(admin_router)

# --- Timing Middleware ---
# Paytm monitors this to ensure UPI payments respond within 2 seconds.
@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """Add X-Process-Time header to every response."""
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{time.time() - start:.4f}"
    return response

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://paytm.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GZip: compress responses > 500 bytes (great for 2G/3G users) ---
app.add_middleware(GZipMiddleware, minimum_size=500)


# ════════════════════════════════════════════════════════════
# SECTION 8 — Lifespan Events (Startup/Shutdown)
# ════════════════════════════════════════════════════════════

# WHY: Initialize resources (DB pool, cache, ML model) on startup
# and clean them up on shutdown. The modern way is the lifespan
# context manager (replaces deprecated @app.on_event).

@asynccontextmanager
async def lifespan(the_app: FastAPI):
    """Single function for both startup and shutdown."""
    # --- Startup ---
    print("[STARTUP] Connecting to DB, loading cache...")
    the_app.state.cache = {"initialized": True}
    yield  # App runs and handles requests
    # --- Shutdown ---
    print("[SHUTDOWN] Closing connections...")

# Usage: app = FastAPI(lifespan=lifespan)


# ════════════════════════════════════════════════════════════
# SECTION 9 — Endpoints Using Dependencies
# ════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"message": "Welcome to Paytm API", "status": "healthy"}


@app.get("/transactions")
def list_transactions(
    pagination: dict = Depends(common_pagination),
    rate_info: dict = Depends(rate_limiter),
    db: dict = Depends(get_db_session),
):
    """
    Three dependencies injected automatically:
    1. pagination — extracts page/page_size from query params
    2. rate_info — enforces rate limit
    3. db — provides a database session (with cleanup via yield)
    """
    return {
        "transactions": [{"id": 1, "amount": 500, "type": "UPI"}],
        "pagination": pagination,
        "rate_limit_remaining": rate_info["remaining"],
    }


@app.get("/profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    """
    Protected endpoint — requires valid Bearer token.
    Dependency chain: Header -> extract -> decode -> user
    """
    return {"user": current_user, "message": f"Hello, {current_user['username']}!"}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Depends() injects return values of functions into endpoints
# 2. Dependencies can depend on other dependencies (chaining)
# 3. yield dependencies provide setup + guaranteed cleanup
# 4. Class-based dependencies (__call__) are great for stateful logic
# 5. Router-level deps apply to all endpoints in that router
# 6. dependency_overrides lets you swap deps for testing
# 7. Middleware wraps every request — use for logging, timing, CORS
# 8. Lifespan context manager replaces startup/shutdown events
# "Write code that is easy to delete, not easy to extend." — tef
