from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from database import create_tables
from routes import shortener, dashboard

app = FastAPI(
    title="Jugaad Shortener",
    description="URL shortener with click analytics",
    version="1.0.0",
)

# Mount static files (CSS, JS, images)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include route modules
app.include_router(dashboard.router)
app.include_router(shortener.router)


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/")
def home():
    return {"message": "Welcome to Jugaad Shortener", "dashboard": "/dashboard"}
