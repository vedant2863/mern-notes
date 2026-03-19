from fastapi import FastAPI
from database import init_db
from routes.contracts import router as contracts_router
from routes.analysis import router as analysis_router

app = FastAPI(
    title="Vakeel Contracts API",
    description="AI-powered contract analysis using Gemini. Upload PDFs, get structured legal insights.",
    version="1.0.0",
)


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/")
async def root():
    return {
        "app": "Vakeel Contracts",
        "version": "1.0.0",
        "endpoints": {
            "POST /contracts/upload": "Upload a PDF or TXT contract",
            "GET /contracts/": "List all contracts",
            "GET /contracts/{id}": "Get contract details",
            "POST /analysis/analyze/{contract_id}": "Run AI analysis",
            "GET /analysis/{id}": "Get analysis result",
            "GET /analysis/contract/{contract_id}": "Get all analyses for a contract",
        },
    }


app.include_router(contracts_router)
app.include_router(analysis_router)
