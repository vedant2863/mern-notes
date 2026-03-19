from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import create_tables
from routes.reviews import router as reviews_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    create_tables()
    print("Database tables created")
    yield
    # Shutdown: cleanup would go here
    print("Shutting down")


app = FastAPI(
    title="Rangmanch Reviews API",
    description="Theatre reviews API for Pune's booking platform",
    lifespan=lifespan,
)

app.include_router(reviews_router)


@app.get("/")
def root():
    return {"message": "Welcome to Rangmanch Reviews API"}
