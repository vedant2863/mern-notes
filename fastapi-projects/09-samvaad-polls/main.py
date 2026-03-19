from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pathlib import Path

from routes.polls import router as polls_router
from routes.live import router as live_router

app = FastAPI(title="Samvaad Polls", version="1.0.0")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(polls_router)
app.include_router(live_router)


@app.get("/", response_class=HTMLResponse)
async def home():
    html_path = Path("templates/poll_live.html")
    return HTMLResponse(content=html_path.read_text())


@app.get("/health")
async def health():
    return {"status": "ok", "app": "Samvaad Polls"}
