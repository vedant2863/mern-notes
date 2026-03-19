from fastapi import FastAPI

from routes.meals import router as meals_router
from routes.workouts import router as workouts_router
from routes.summary import router as summary_router
from middleware import RequestTimingMiddleware, SimpleRateLimiter

app = FastAPI(title="Sehat Log", version="1.0.0")

# Add middleware — order matters (last added runs first)
app.add_middleware(RequestTimingMiddleware)
app.add_middleware(SimpleRateLimiter, max_requests=60)

# Include routers
app.include_router(meals_router)
app.include_router(workouts_router)
app.include_router(summary_router)


@app.get("/")
async def root():
    return {
        "app": "Sehat Log",
        "message": "Health & fitness tracker API",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
