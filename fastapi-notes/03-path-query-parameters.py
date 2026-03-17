"""
============================================================
FILE 03: PATH PARAMETERS, QUERY PARAMETERS, AND TYPE CONVERSION
============================================================
Topics: path parameters, type conversion (int, str, UUID),
        Enum parameters, query parameters, required vs optional,
        bool conversion, pagination, combining path + query,
        Path() and Query() validation

WHY THIS MATTERS:
Every real API needs to identify resources (path params) and
filter/sort/paginate them (query params). Getting the type
system right means FastAPI validates inputs for free — no
manual parsing, no try/except on every int() call.
============================================================
"""

# STORY: IRCTC — /trains/{number} vs ?from=Delhi&to=Mumbai
# IRCTC handles over 25 lakh (2.5 million) bookings daily. Their API
# must identify specific trains by number (/trains/12301 for Rajdhani)
# while letting users search with filters (?from=NDLS&to=BCT&class=3A).
# Path params identify WHAT resource; query params filter HOW to view it.
# Before type-safe validation, wrong types (train number as "abc") caused
# cascading database errors. Type-safe parameters eliminated those entirely.

from enum import Enum
from uuid import UUID
from typing import Optional
from fastapi import FastAPI, Query, Path
import uvicorn

app = FastAPI(
    title="IRCTC Railway API",
    description="Learning path and query parameters through Indian Railways.",
    version="1.0.0",
)

# ════════════════════════════════════════════════════════════
# SECTION 1 — Path Parameters Basics
# ════════════════════════════════════════════════════════════

# WHY: Path parameters identify a specific resource. They're
# part of the URL itself, making URLs bookmarkable and meaningful.

@app.get("/trains/{train_number}", tags=["Trains"])
def get_train(train_number: int):
    """
    Path parameter: {train_number}
    URL: /trains/12301

    FastAPI sees `int` type hint and:
    1. Extracts "12301" from URL → converts to int
    2. If conversion fails (/trains/abc) → automatic 422 error
    """
    trains = {
        12301: {"number": 12301, "name": "Howrah Rajdhani", "from": "NDLS", "to": "HWH"},
        12951: {"number": 12951, "name": "Mumbai Rajdhani", "from": "NDLS", "to": "BCT"},
    }
    if train_number in trains:
        return trains[train_number]
    return {"error": f"Train {train_number} not found"}


# --- Multiple path parameters ---
@app.get("/trains/{train_number}/coaches/{coach_number}", tags=["Trains"])
def get_coach(train_number: int, coach_number: str):
    """
    Multiple path params: int + str in one URL.
    URL: /trains/12301/coaches/B1
    """
    return {
        "train": train_number,
        "coach": coach_number,
        "seats": 72 if coach_number.startswith("S") else 46,
    }


# ════════════════════════════════════════════════════════════
# SECTION 2 — Type Conversion (str, float, UUID)
# ════════════════════════════════════════════════════════════

# WHY: FastAPI uses Python type hints for automatic conversion.
# You write the type hint, FastAPI handles parsing + error messages.

@app.get("/fare/{distance_km}", tags=["Fare"])
def calculate_fare(distance_km: float):
    """
    float type: auto-converts "123.5" → 123.5
    /fare/abc → 422 error automatically.
    """
    base_fare = distance_km * 0.60  # ~60 paise/km for sleeper
    return {
        "distance_km": distance_km,
        "base_fare": round(base_fare, 2),
        "total_with_gst": round(base_fare * 1.05, 2),
    }


@app.get("/bookings/{booking_id}", tags=["Bookings"])
def get_booking(booking_id: UUID):
    """
    UUID type: validates UUID format automatically.
    /bookings/550e8400-e29b-41d4-a716-446655440000 → OK
    /bookings/not-a-uuid → 422 error.
    """
    return {"booking_id": str(booking_id), "status": "CONFIRMED", "passengers": 2}


# ════════════════════════════════════════════════════════════
# SECTION 3 — Enum Path Parameters
# ════════════════════════════════════════════════════════════

# WHY: Enums restrict path parameters to a fixed set of values.
# FastAPI generates a dropdown in Swagger UI and rejects invalid
# values automatically.

class TrainClass(str, Enum):
    """
    Inheriting from str AND Enum makes it work with
    FastAPI's JSON serialization and OpenAPI schema.
    """
    sleeper = "SL"
    ac_three_tier = "3A"
    ac_two_tier = "2A"
    ac_first = "1A"


@app.get("/classes/{travel_class}/fare-chart", tags=["Fare"])
def fare_chart(travel_class: TrainClass):
    """
    Enum path parameter: only accepts defined values.
    /classes/SL/fare-chart → OK
    /classes/INVALID → 422 with allowed values listed!
    Swagger UI shows a dropdown with all valid options.
    """
    multiplier = {
        TrainClass.sleeper: 1.0,
        TrainClass.ac_three_tier: 2.5,
        TrainClass.ac_two_tier: 3.8,
        TrainClass.ac_first: 5.5,
    }
    return {
        "class": travel_class.value,
        "fare_multiplier": multiplier[travel_class],
        "effective_rate_per_km": 0.60 * multiplier[travel_class],
    }


# ════════════════════════════════════════════════════════════
# SECTION 4 — Query Parameters Basics
# ════════════════════════════════════════════════════════════

# WHY: Query parameters filter, sort, and paginate. They appear
# after ? in the URL — the standard way to customize GET requests.

# Any function parameter NOT in the URL path → query parameter.

@app.get("/search/trains", tags=["Search"])
def search_trains(
    from_station: str,                        # Required (no default)
    to_station: str,                          # Required (no default)
    date: str = "2024-12-25",                 # Optional with default
):
    """
    /search/trains?from_station=NDLS&to_station=BCT&date=2024-12-25
    /search/trains?from_station=NDLS&to_station=BCT  (date defaults)

    No default = REQUIRED. With default = OPTIONAL.
    """
    return {
        "from": from_station,
        "to": to_station,
        "date": date,
        "trains": [
            {"number": 12951, "name": "Mumbai Rajdhani", "departure": "16:55"},
        ],
    }


# --- Optional query parameters with None + bool ---
@app.get("/search/stations", tags=["Search"])
def search_stations(
    zone: Optional[str] = None,
    has_wifi: Optional[bool] = None,
):
    """
    Optional params default to None.
    Bool params accept: true/false/1/0/yes/no/on/off

    /search/stations                    → all stations
    /search/stations?zone=NR&has_wifi=true → filtered
    """
    results = [
        {"name": "New Delhi", "zone": "NR", "has_wifi": True},
        {"name": "Mumbai Central", "zone": "WR", "has_wifi": True},
        {"name": "Patna", "zone": "ER", "has_wifi": False},
    ]
    if zone:
        results = [s for s in results if s["zone"] == zone.upper()]
    if has_wifi is not None:
        results = [s for s in results if s["has_wifi"] == has_wifi]
    return {"stations": results, "count": len(results)}


# ════════════════════════════════════════════════════════════
# SECTION 5 — Pagination and Combining Path + Query
# ════════════════════════════════════════════════════════════

# WHY: Pagination is the most common query param pattern, and
# real APIs almost always combine path + query params together.

@app.get("/trains/{train_number}/schedule", tags=["Trains"])
def train_schedule(
    train_number: int,                        # Path param (from URL)
    date: str = "2024-12-25",                 # Query param
    include_stops: bool = True,               # Query param
):
    """
    FastAPI knows: train_number is PATH (in URL template),
    date and include_stops are QUERY (not in URL template).
    /trains/12301/schedule?date=2024-12-26&include_stops=false
    """
    schedule = {"train_number": train_number, "date": date}
    if include_stops:
        schedule["stops"] = [
            {"station": "New Delhi", "departure": "16:55"},
            {"station": "Mumbai Central", "arrival": "08:35"},
        ]
    return schedule


# ════════════════════════════════════════════════════════════
# SECTION 6 — Query() and Path() with Validation
# ════════════════════════════════════════════════════════════

# WHY: Query() and Path() add validation constraints (min, max,
# regex) and richer documentation to parameters.

@app.get("/validated/trains/{train_number}", tags=["Validated"])
def validated_train(
    train_number: int = Path(
        ...,                                  # ... = required
        title="Train Number",
        description="5-digit Indian Railways train number",
        ge=10000, le=99999,                   # ge=greater-or-equal, le=less-or-equal
        examples=[12301],
    ),
):
    """
    /validated/trains/12301  → OK (between 10000-99999)
    /validated/trains/999    → 422 (less than 10000)
    """
    return {"train_number": train_number, "valid": True}


@app.get("/validated/search", tags=["Validated"])
def validated_search(
    q: str = Query(
        ..., min_length=2, max_length=50,
        description="Search for trains, stations, or routes",
    ),
    limit: int = Query(default=10, ge=1, le=100, description="Max results (1-100)"),
):
    """
    /validated/search?q=Rajdhani&limit=10  → OK
    /validated/search?q=R                  → 422 (q too short)
    /validated/search?limit=200            → 422 (limit > 100)
    """
    return {"query": q, "limit": limit}


# --- Path validation with regex ---
@app.get("/validated/pnr/{pnr_number}", tags=["Validated"])
def check_pnr(
    pnr_number: str = Path(
        ...,
        pattern=r"^\d{10}$",                 # Exactly 10 digits
        description="10-digit PNR number",
        examples=["4512367890"],
    ),
):
    """
    /validated/pnr/4512367890 → OK
    /validated/pnr/ABC123     → 422 (pattern mismatch)
    """
    return {"pnr": pnr_number, "status": "CONFIRMED", "train": "12301 Howrah Rajdhani"}


# ════════════════════════════════════════════════════════════
# SECTION 7 — Route Ordering with Path Parameters
# ════════════════════════════════════════════════════════════

# WHY: Static routes must come before parameterized routes,
# or the generic route swallows the specific one.

@app.get("/specials/tatkal", tags=["Specials"])
def tatkal_info():
    """Static route: MUST be defined BEFORE /specials/{scheme_name}."""
    return {"scheme": "Tatkal", "booking_opens": "10:00 AM (AC), 11:00 AM (Non-AC)"}


@app.get("/specials/{scheme_name}", tags=["Specials"])
def get_special_scheme(scheme_name: str):
    """Generic route — catches everything not matched above."""
    return {"scheme": scheme_name, "message": f"Details for {scheme_name} scheme"}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Path params identify resources (/trains/12301); query params filter (?class=3A).
# 2. Type hints (int, float, UUID) give automatic conversion + 422 errors for free.
# 3. Enum path params restrict to fixed values — dropdown in Swagger UI.
# 4. No default = REQUIRED; with default = OPTIONAL.
# 5. Bool query params accept true/false/1/0/yes/no/on/off.
# 6. Path() and Query() add validation (ge, le, min_length, max_length, pattern).
# 7. Static routes (/items/special) BEFORE parameterized (/items/{id}).
# "Simplicity is the soul of efficiency." — Austin Freeman

if __name__ == "__main__":
    uvicorn.run("03-path-query-parameters:app", host="127.0.0.1", port=8000, reload=True)
