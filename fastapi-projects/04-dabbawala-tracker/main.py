from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import create_tables
from routes.orders import router as orders_router
from routes.stats import router as stats_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    print("Dabbawala database ready")
    yield
    print("Shutting down")


app = FastAPI(
    title="Dabbawala Tracker API",
    description="Track Mumbai tiffin deliveries through every stage",
    lifespan=lifespan,
)

app.include_router(orders_router)
app.include_router(stats_router)


@app.get("/")
def root():
    return {"message": "Dabbawala Tracker API", "version": "1.0"}
