"""
Vidya RAG — UPSC Doubt Solver with Document Citations
Upload study materials, ask questions, get grounded answers.
"""

from fastapi import FastAPI
from database import init_db
from routes.documents import router as documents_router
from routes.questions import router as questions_router
from services.vector_store import get_collection_stats

app = FastAPI(
    title="Vidya RAG",
    description="UPSC study material Q&A with citations — powered by RAG + Gemini",
    version="1.0.0"
)

# Include routers
app.include_router(documents_router)
app.include_router(questions_router)


@app.on_event("startup")
def startup():
    """Initialize database on startup."""
    init_db()
    print("Vidya RAG is ready!")


@app.get("/")
async def root():
    """Health check with vector store stats."""
    stats = get_collection_stats()
    return {
        "app": "Vidya RAG",
        "status": "running",
        "tagline": "Your UPSC doubt solver",
        "vector_store": stats
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
