from fastapi import FastAPI
from database import create_tables
from routes import auth, jobs, applications

app = FastAPI(
    title="Karigar Jobs",
    description="Blue-collar job platform with JWT auth and RBAC",
    version="1.0.0",
)

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(applications.router)


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/")
def home():
    return {"message": "Welcome to Karigar Jobs", "docs": "/docs"}
