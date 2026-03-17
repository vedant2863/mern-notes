"""
============================================================
FILE 02: ROUTES, HTTP METHODS, AND PATH OPERATIONS
============================================================
Topics: HTTP methods (GET, POST, PUT, PATCH, DELETE),
        route ordering, operation_id, status codes,
        building a complete CRUD API

WHY THIS MATTERS:
HTTP methods are the verbs of the web. Using the right method
for the right action affects caching, security, idempotency,
and how intermediaries (CDNs, proxies, browsers) treat requests.
============================================================
"""

# STORY: Zomato — GET Browse, POST Order, PUT Update, DELETE Cancel
# Zomato serves 50M+ monthly active users. Early on, some developers
# used GET for everything — even placing orders — leading to duplicate
# orders from browser prefetch and cached proxies. Proper HTTP method
# usage eliminated an entire class of bugs overnight.

from fastapi import FastAPI
from starlette import status
import uvicorn

app = FastAPI(
    title="Zomato Food Service API",
    description="Learning HTTP methods through a food delivery context.",
    version="1.0.0",
)

# ════════════════════════════════════════════════════════════
# SECTION 1 — HTTP Methods Overview
# ════════════════════════════════════════════════════════════

# WHY: Each HTTP method has specific semantics that clients,
# browsers, CDNs, and API gateways rely on.

# GET     — Read/retrieve. SAFE + IDEMPOTENT. Cacheable.
# POST    — Create new resource. NOT idempotent (10x = 10 resources).
# PUT     — Replace entire resource. IDEMPOTENT. Send FULL object.
# PATCH   — Partial update. Send ONLY changed fields.
# DELETE  — Remove resource. IDEMPOTENT.
#
# Zomato impact:
#   GET /restaurants  → browser/CDN can cache this
#   POST /orders      → browser will NEVER cache, warns on refresh
#   DELETE /orders/123 → calling twice won't double-delete

# ════════════════════════════════════════════════════════════
# SECTION 2 — Complete CRUD for One Resource
# ════════════════════════════════════════════════════════════

# WHY: In real projects, each resource gets a complete set of
# CRUD routes. Seeing the full pattern helps you build consistent APIs.

restaurants_db = {
    1: {"id": 1, "name": "Biryani Blues", "city": "Delhi", "rating": 4.3},
    2: {"id": 2, "name": "Saravana Bhavan", "city": "Chennai", "rating": 4.6},
}
next_id = 3


# --- GET: List all ---
@app.get("/restaurants", tags=["Restaurants"], summary="List All Restaurants")
def list_restaurants():
    """GET for listing — returns a collection. Cacheable, no side effects."""
    return {"restaurants": list(restaurants_db.values()), "count": len(restaurants_db)}


# --- GET: Single resource ---
@app.get("/restaurants/{restaurant_id}", tags=["Restaurants"], summary="Get Restaurant by ID")
def get_restaurant(restaurant_id: int):
    """GET for detail — returns one specific resource."""
    if restaurant_id not in restaurants_db:
        return {"error": "Restaurant not found", "id": restaurant_id}
    return restaurants_db[restaurant_id]


# --- POST: Create ---
@app.post(
    "/restaurants",
    tags=["Restaurants"],
    summary="Add a New Restaurant",
    status_code=status.HTTP_201_CREATED,  # 201 = resource created (not 200!)
)
def add_restaurant(name: str, city: str):
    """POST creates a new resource. Returns 201 with the created object."""
    global next_id
    restaurant = {"id": next_id, "name": name, "city": city, "rating": 0.0}
    restaurants_db[next_id] = restaurant
    next_id += 1
    return restaurant


# --- PUT: Full replacement ---
@app.put("/restaurants/{restaurant_id}", tags=["Restaurants"], summary="Replace Restaurant")
def replace_restaurant(restaurant_id: int, name: str, city: str, rating: float):
    """
    PUT = full replacement. Client must send ALL fields.
    If they forget 'rating', it's required — not silently defaulted.
    """
    if restaurant_id not in restaurants_db:
        return {"error": "Restaurant not found"}
    restaurants_db[restaurant_id] = {
        "id": restaurant_id, "name": name, "city": city, "rating": rating,
    }
    return restaurants_db[restaurant_id]


# --- PATCH: Partial update ---
@app.patch("/restaurants/{restaurant_id}", tags=["Restaurants"], summary="Update Restaurant (Partial)")
def update_restaurant(restaurant_id: int, name: str = None, city: str = None, rating: float = None):
    """
    PATCH = partial update. Only provided fields change.
    Zomato uses this when a restaurant updates just their name —
    they don't need to resend every single field.
    """
    if restaurant_id not in restaurants_db:
        return {"error": "Restaurant not found"}
    restaurant = restaurants_db[restaurant_id]
    if name is not None:
        restaurant["name"] = name
    if city is not None:
        restaurant["city"] = city
    if rating is not None:
        restaurant["rating"] = rating
    return restaurant


# --- DELETE: Remove ---
@app.delete(
    "/restaurants/{restaurant_id}",
    tags=["Restaurants"],
    summary="Remove a Restaurant",
    status_code=status.HTTP_204_NO_CONTENT,  # 204 = success, no body
)
def remove_restaurant(restaurant_id: int):
    """
    DELETE must be idempotent — deleting something already gone
    should not crash. pop with default = idempotent.
    """
    restaurants_db.pop(restaurant_id, None)
    return None


# ════════════════════════════════════════════════════════════
# SECTION 3 — Route Order Matters
# ════════════════════════════════════════════════════════════

# WHY: FastAPI matches the FIRST route that fits (top to bottom).
# Getting this wrong means specific routes become unreachable.

# CORRECT: specific before generic
@app.get("/menu/today", tags=["Menu"])
def todays_menu():
    """This MUST come before /menu/{menu_id} or it will never match."""
    return {"menu": "Today's special: Dal Makhani + Naan"}


@app.get("/menu/{menu_id}", tags=["Menu"])
def get_menu(menu_id: int):
    """Generic route — matched after specific ones above."""
    return {"menu_id": menu_id, "items": ["Item 1", "Item 2"]}


# WRONG ORDER (don't do this):
# @app.get("/menu/{menu_id}")    # ← Catches "today" as menu_id!
# @app.get("/menu/today")        # ← NEVER runs!


# ════════════════════════════════════════════════════════════
# SECTION 4 — operation_id and Route Grouping
# ════════════════════════════════════════════════════════════

# WHY: operation_id controls SDK method names when you generate
# TypeScript/Java/Kotlin clients from your OpenAPI schema.

@app.get(
    "/orders",
    tags=["Orders"],
    summary="List All Orders",
    operation_id="listAllOrders",  # Default would be "list_orders"
)
def list_orders():
    """operation_id is used by code generators for method names."""
    return {"orders": [], "count": 0}


# --- Route Grouping Strategies ---
# 1. Tags: tags=["GroupName"] → sections in Swagger UI
# 2. APIRouter: separate routers per resource (covered later)
# 3. URL prefix: /api/v1/orders/..., /api/v2/orders/...

# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. GET reads (cacheable, safe). POST creates (not cacheable).
# 2. PUT replaces whole resource; PATCH updates only specified fields.
# 3. DELETE should be idempotent — deleting twice should not error.
# 4. Route order matters: /items/special BEFORE /items/{id}.
# 5. status_code=201 for POST, 204 for DELETE.
# 6. Tags group routes in Swagger UI — use them consistently.
# 7. operation_id matters for SDK generation — keep them unique.
# "An API is a user interface for developers. Design it carefully."

if __name__ == "__main__":
    uvicorn.run("02-routes-and-http-methods:app", host="127.0.0.1", port=8000, reload=True)
