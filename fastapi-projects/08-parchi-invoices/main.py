from fastapi import FastAPI
from database import create_tables
from routes import invoices, uploads

app = FastAPI(
    title="Parchi Invoices",
    description="GST billing and invoice PDF generator",
    version="1.0.0",
)

app.include_router(invoices.router)
app.include_router(uploads.router)


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/")
def home():
    return {"message": "Welcome to Parchi Invoices", "docs": "/docs"}
