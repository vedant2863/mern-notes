from fastapi import FastAPI
from routes.planner import router as planner_router
from routes.stream import router as stream_router

app = FastAPI(
    title="Yatra Planner API",
    description="Aggregate travel data from multiple sources into a single plan. Supports SSE streaming.",
    version="1.0.0",
)


@app.get("/")
async def root():
    return {
        "app": "Yatra Planner",
        "version": "1.0.0",
        "endpoints": {
            "POST /plan/": "Create a travel plan (aggregated)",
            "GET /plan/stream": "Stream a travel plan via SSE",
            "GET /plan/cache-stats": "View cache statistics",
            "DELETE /plan/cache": "Clear cache",
        },
    }


app.include_router(planner_router)
app.include_router(stream_router)
