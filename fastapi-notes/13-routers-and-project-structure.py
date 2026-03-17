"""
============================================================
FILE 13: APIROUTER, PROJECT STRUCTURE, AND CONFIG
============================================================
Topics: APIRouter, prefix, tags, include_router, nested routers,
        project structure, pydantic-settings, .env config

WHY THIS MATTERS:
A 500-line main.py is unmaintainable. When three developers
work on flights, hotels, and buses, they need separate files.
APIRouter and proper project structure are how professional
Python teams organize FastAPI applications.
============================================================
"""

# STORY: MakeMyTrip — Flights/Hotels/Buses as Separate Modules
# MakeMyTrip has 80M+ monthly users booking flights, hotels,
# buses, trains, and holidays. Each travel vertical is owned by
# a different team. The flights team cannot be editing the same
# file as the hotels team — that causes merge conflicts daily.
# They split the API into modules, each with its own router,
# models, and business logic. The main app just includes routers.

from typing import Optional
from datetime import datetime, timezone
import os

from fastapi import FastAPI, APIRouter, Depends, Query, HTTPException

# ════════════════════════════════════════════════════════════
# SECTION 1 — APIRouter Basics
# ════════════════════════════════════════════════════════════

# WHY: APIRouter is a "mini FastAPI" that you define separately
# and then include in the main app. It has the same decorators
# (@router.get, @router.post) but lives in its own file.

flights_router = APIRouter()


@flights_router.get("/search")
def search_flights(
    origin: str = Query(..., example="DEL"),
    destination: str = Query(..., example="BOM"),
    date: str = Query(..., example="2025-03-15"),
):
    """Search available flights between two cities."""
    return {
        "flights": [
            {"airline": "IndiGo", "flight_no": "6E 2345",
             "origin": origin, "destination": destination,
             "date": date, "price": 4500},
        ]
    }


@flights_router.post("/book")
def book_flight(flight_id: int, passengers: int = Query(1, ge=1, le=9)):
    """Book seats on a flight."""
    return {"booking_id": "MMT-FL-001", "flight_id": flight_id,
            "passengers": passengers, "status": "confirmed"}


# ════════════════════════════════════════════════════════════
# SECTION 2 — Router with Prefix, Tags, and Dependencies
# ════════════════════════════════════════════════════════════

# WHY: Prefix avoids repeating "/hotels" in every route. Tags
# group endpoints in Swagger docs. Dependencies enforce rules
# (like auth) on all endpoints in the router.

hotels_router = APIRouter(
    prefix="/hotels", tags=["Hotels"],
    responses={404: {"description": "Hotel not found"}},
)

HOTELS_DB = [
    {"id": 1, "name": "Taj Palace Delhi", "city": "Delhi", "price": 15000, "rating": 4.8},
    {"id": 2, "name": "Lemon Tree Pune", "city": "Pune", "price": 3500, "rating": 4.1},
]


@hotels_router.get("/")
def list_hotels(
    city: Optional[str] = None,
    sort_by: str = Query("price", enum=["price", "rating", "name"]),
):
    """List hotels with optional city filter and sorting."""
    results = HOTELS_DB.copy()
    if city:
        results = [h for h in results if h["city"].lower() == city.lower()]
    results.sort(key=lambda h: h.get(sort_by, 0))
    return {"hotels": results, "count": len(results)}


@hotels_router.get("/{hotel_id}")
def get_hotel(hotel_id: int):
    """Get hotel details by ID."""
    hotel = next((h for h in HOTELS_DB if h["id"] == hotel_id), None)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return hotel


# ════════════════════════════════════════════════════════════
# SECTION 3 — Nested Routers (Reviews inside Buses)
# ════════════════════════════════════════════════════════════

# WHY: Nested routers compose sub-modules. Bus reviews live
# under /buses/{bus_id}/reviews — a natural REST hierarchy.

buses_router = APIRouter(prefix="/buses", tags=["Buses"])
bus_reviews_router = APIRouter()


@buses_router.get("/search")
def search_buses(
    origin: str = Query(..., example="Bangalore"),
    destination: str = Query(..., example="Chennai"),
):
    """Search available buses between two cities."""
    return {"buses": [{"operator": "RedBus VRL", "price": 850, "type": "Sleeper AC"}]}


@bus_reviews_router.get("/")
def list_bus_reviews(bus_id: int):
    return {"bus_id": bus_id, "reviews": [
        {"user": "Priya", "rating": 4, "comment": "Clean bus, on time"},
    ]}


@bus_reviews_router.post("/")
def add_bus_review(bus_id: int, rating: int = Query(ge=1, le=5), comment: str = ""):
    return {"bus_id": bus_id, "rating": rating, "comment": comment, "status": "added"}


# Nest reviews inside buses
buses_router.include_router(
    bus_reviews_router, prefix="/{bus_id}/reviews", tags=["Bus Reviews"],
)


# ════════════════════════════════════════════════════════════
# SECTION 4 — Including Routers in the Main App
# ════════════════════════════════════════════════════════════

# WHY: The main app file should be thin — just create the app,
# include routers, and add middleware. All business logic lives
# in the router modules.

app = FastAPI(
    title="MakeMyTrip API",
    description="Travel booking API with modular architecture",
    version="2.0.0",
)

app.include_router(flights_router, prefix="/flights", tags=["Flights"])
app.include_router(hotels_router)   # prefix already set on router
app.include_router(buses_router)    # prefix already set on router


@app.get("/", tags=["Health"])
def root():
    return {"app": "MakeMyTrip API", "version": "2.0.0",
            "modules": ["flights", "hotels", "buses"]}


# ════════════════════════════════════════════════════════════
# SECTION 5 — Recommended Project Structure
# ════════════════════════════════════════════════════════════

# WHY: A consistent folder layout means any new developer can
# find code immediately. This is the standard FastAPI layout.

# makemytrip-api/
# |-- main.py                  # App creation, include routers
# |-- config.py                # Settings, env vars
# |-- database.py              # Engine, session, create_tables
# |-- models.py                # SQLModel table definitions
# |-- routes/
# |   |-- flights.py           # flights_router
# |   |-- hotels.py            # hotels_router
# |   |-- buses.py             # buses_router
# |-- services/                # Business logic (not in routes)
# |   |-- flight_service.py
# |-- dependencies/
# |   |-- auth.py              # get_current_user, require_role
# |   |-- database.py          # get_session
# |-- tests/
# |   |-- test_flights.py
# |-- .env                     # Secrets (git-ignored)
# |-- .env.example             # Template (committed)
# |-- requirements.txt
# |-- Dockerfile


# ════════════════════════════════════════════════════════════
# SECTION 6 — Config Management with Pydantic Settings
# ════════════════════════════════════════════════════════════

# WHY: Hardcoding database URLs and API keys is a security risk.
# Settings should come from env vars or .env, validated at startup.

# --- Production pattern (requires: pip install pydantic-settings) ---
#
# from pydantic_settings import BaseSettings
# from functools import lru_cache
#
# class Settings(BaseSettings):
#     app_name: str = "MakeMyTrip API"
#     database_url: str = "sqlite:///./mmt.db"
#     jwt_secret: str = "change-me"
#     allowed_origins: list[str] = ["http://localhost:3000"]
#
#     class Config:
#         env_file = ".env"
#
# @lru_cache()
# def get_settings() -> Settings:
#     return Settings()   # loaded once, reused everywhere

# --- Simulated version (no extra dependency) ---

class Settings:
    def __init__(self):
        self.app_name = os.getenv("APP_NAME", "MakeMyTrip API")
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./mmt.db")
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me")


def get_settings() -> Settings:
    return Settings()


@app.get("/config-demo", tags=["Config"])
def config_demo(settings: Settings = Depends(get_settings)):
    """Show current config (non-sensitive fields only)."""
    return {"app_name": settings.app_name, "debug": settings.debug}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. APIRouter is a "mini FastAPI" — define endpoints separately
# 2. Use prefix to avoid repeating the module path in every route
# 3. Use tags to group endpoints in Swagger documentation
# 4. Nested routers compose sub-modules (reviews inside buses)
# 5. Keep main.py thin — only app creation, router inclusion, middleware
# 6. Use pydantic-settings (BaseSettings) for type-safe config from .env
# 7. Never commit .env with secrets — commit .env.example as template
# "Any fool can write code that a computer can understand.
#  Good programmers write code that humans can understand." — Martin Fowler
