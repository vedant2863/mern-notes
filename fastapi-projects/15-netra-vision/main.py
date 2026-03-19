from fastapi import FastAPI
from database import init_db
from routes.analyze import router as analyze_router
from routes.history import router as history_router

app = FastAPI(
    title="Netra Vision API",
    description="AI-powered crop disease detection using Gemini Vision. Upload plant photos, get disease diagnosis and treatment plans.",
    version="1.0.0",
)


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/")
async def root():
    return {
        "app": "Netra Vision",
        "version": "1.0.0",
        "endpoints": {
            "POST /analyze/": "Upload image for disease analysis",
            "POST /analyze/batch": "Upload multiple images",
            "GET /analyses/": "List past analyses",
            "GET /analyses/{id}": "Get full analysis details",
            "GET /analyses/stats/summary": "View statistics",
        },
    }


app.include_router(analyze_router)
app.include_router(history_router)
