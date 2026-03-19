"""
Saathi Agent — AI Personal Finance Assistant
Chat with an AI that can track expenses, check weather, convert currencies, and more.
"""

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from database import init_db
from routes.expenses import router as expenses_router
from routes.chat import router as chat_router
from routes.admin import router as admin_router

app = FastAPI(
    title="Saathi Agent",
    description="AI personal finance agent with tools, memory, and streaming",
    version="1.0.0"
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(expenses_router)
app.include_router(chat_router)
app.include_router(admin_router)


@app.on_event("startup")
def startup():
    """Initialize database on startup."""
    init_db()
    print("Saathi Agent is ready!")


@app.get("/")
async def home(request: Request):
    """Serve the chat UI."""
    return templates.TemplateResponse("chat.html", {"request": request})


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "Saathi"}
