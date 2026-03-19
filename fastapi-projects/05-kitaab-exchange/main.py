from fastapi import FastAPI
from database import create_tables
from routes import users, books

app = FastAPI(
    title="Kitaab Exchange",
    description="DU college book exchange platform",
    version="1.0.0",
)

app.include_router(users.router)
app.include_router(books.router)


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/")
def home():
    return {"message": "Welcome to Kitaab Exchange", "docs": "/docs"}
