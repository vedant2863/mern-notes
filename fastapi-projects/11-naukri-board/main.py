from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS
from routes.v1.jobs import router as v1_router
from routes.v2.jobs import router as v2_router

app = FastAPI(title="Naukri Board", version="2.0.0")

# CORS middleware — allows React, mobile, and third-party clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Versioned routers
app.include_router(v1_router)
app.include_router(v2_router)


@app.get("/")
async def root():
    return {
        "app": "Naukri Board",
        "versions": {
            "v1": "/v1/jobs — basic CRUD",
            "v2": "/v2/jobs — filtering, salary range, stats",
        },
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
