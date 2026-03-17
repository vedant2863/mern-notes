"""
============================================================
FILE 04: REQUEST BODY, PYDANTIC MODELS, AND DATA VALIDATION
============================================================
Topics: request body vs query params, Pydantic BaseModel,
        type hints, optional fields, Field() validation,
        model_dump(), nested models, List/Set fields,
        model_config, combining body+path+query, model inheritance

WHY THIS MATTERS:
Request bodies carry complex structured data — user profiles,
product listings, payment details. Without validation, bad data
flows into your database and corrupts everything. Pydantic
catches errors at the API boundary, before they cause damage.
============================================================
"""

# STORY: Flipkart — Seller Product Listing (No Price = -500 Allowed)
# Flipkart's marketplace hosts 1.4 lakh+ sellers listing millions of
# products. A seller API bug once allowed negative prices — someone listed
# a phone at -500 INR, and checkout tried to pay the customer! After that,
# Flipkart enforced strict schema validation: price > 0, title 3-200 chars,
# pincode exactly 6 digits. Pydantic enforces these rules declaratively.

from typing import Optional, List, Set
from pydantic import BaseModel, Field, ConfigDict
from fastapi import FastAPI, Body
from enum import Enum
import uvicorn

app = FastAPI(
    title="Flipkart Seller API",
    description="Learning Pydantic models through e-commerce product listing.",
    version="2.0.0",
)

# ════════════════════════════════════════════════════════════
# SECTION 1 — Why Request Body Over Query Parameters
# ════════════════════════════════════════════════════════════

# Query params (?key=value): simple filters, pagination, search.
#   Visible in browser history/logs, max ~2048 chars.
# Request body (JSON): creating/updating, nested data, sensitive data.
#   No size limit, not in browser history.
#
# Flipkart: GET /products?category=phones → query params (filtering)
#           POST /products { "title": "...", "price": ... } → body (creating)

# ════════════════════════════════════════════════════════════
# SECTION 2 — Pydantic BaseModel Basics
# ════════════════════════════════════════════════════════════

# WHY: BaseModel is the foundation of all request/response
# validation in FastAPI. Master this and you master FastAPI.

class ProductCreate(BaseModel):
    """
    Fields without defaults = REQUIRED.
    Fields with defaults or Optional = OPTIONAL.
    FastAPI reads JSON body and validates against this automatically.
    """
    title: str
    price: float
    category: str
    is_active: bool = True                    # Optional, defaults to True


@app.post("/products", tags=["Products"])
def create_product(product: ProductCreate):
    """
    FastAPI automatically: reads JSON → validates → converts types → 422 if invalid.
    Your function only runs if data is valid.
    """
    return {
        "message": "Product created",
        "product": product.model_dump(),      # Convert model to dict
        "id": 12345,
    }


# ════════════════════════════════════════════════════════════
# SECTION 3 — Optional Fields and model_dump()
# ════════════════════════════════════════════════════════════

# WHY: For PATCH (partial update), all fields should be Optional.
# model_dump(exclude_unset=True) gives only fields the user sent.

class ProductUpdate(BaseModel):
    """All Optional for partial updates."""
    title: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None


@app.patch("/products/{product_id}", tags=["Products"])
def update_product(product_id: int, product: ProductUpdate):
    """
    model_dump(exclude_unset=True) = only fields the client sent.
    Send {"price": 14999} → update_data = {"price": 14999} (title/category excluded).
    """
    update_data = product.model_dump(exclude_unset=True)
    return {"product_id": product_id, "updated_fields": update_data}


# ════════════════════════════════════════════════════════════
# SECTION 4 — Field() for Detailed Validation
# ════════════════════════════════════════════════════════════

# WHY: Field() prevents the "-500 price" bug. Constraints enforced
# automatically — no manual if-else chains.

class ValidatedProduct(BaseModel):
    """This is what Flipkart's actual product listing API might look like."""
    title: str = Field(
        ..., min_length=3, max_length=200,
        description="Product title as shown to buyers",
    )
    price: float = Field(
        ..., gt=0, le=10_000_000,             # gt=greater-than (exclusive)
        description="Price in INR. Must be positive.",
    )
    quantity: int = Field(
        default=0, ge=0, le=100_000,          # ge=greater-or-equal
    )
    seller_pincode: str = Field(
        ..., pattern=r"^\d{6}$",              # Exactly 6 digits
        description="6-digit pincode of seller warehouse",
    )
    # Field validation summary:
    #   gt/ge/lt/le = numeric bounds
    #   min_length/max_length = string length
    #   pattern = regex for strings


@app.post("/products/validated", tags=["Products"])
def create_validated_product(product: ValidatedProduct):
    """
    These will FAIL with 422:
    - {"title": "AB", ...}                → title too short
    - {"price": -500, ...}                → price not > 0
    - {"seller_pincode": "ABC", ...}      → pincode invalid
    The error response tells you EXACTLY which field failed and why.
    """
    return {"message": "Product validated and created", "product": product.model_dump()}


# ════════════════════════════════════════════════════════════
# SECTION 5 — Nested Models and Complex Structures
# ════════════════════════════════════════════════════════════

# WHY: Real data is nested. A seller has an address, an order
# has items. Pydantic handles nesting with model composition.

class Address(BaseModel):
    """Reusable address model."""
    street: str
    city: str
    pincode: str = Field(..., pattern=r"^\d{6}$")


class SellerProfile(BaseModel):
    """Seller with nested address — validated recursively."""
    business_name: str = Field(..., min_length=2)
    phone: str = Field(..., pattern=r"^\+91\d{10}$")
    warehouse_address: Address                # Required nested model
    return_address: Optional[Address] = None  # Optional nested model


@app.post("/sellers/register", tags=["Sellers"])
def register_seller(seller: SellerProfile):
    """
    Nested validation: if warehouse_address.pincode is invalid,
    the 422 error points to warehouse_address.pincode specifically!
    """
    return {"message": "Seller registered", "seller": seller.model_dump()}


# --- List and Set fields ---
class ProductListing(BaseModel):
    title: str
    price: float = Field(..., gt=0)
    images: List[str] = []                    # Ordered, allows duplicates
    tags: Set[str] = set()                    # Auto-deduplicates!


@app.post("/products/listing", tags=["Products"])
def create_listing(listing: ProductListing):
    """
    Send: {"tags": ["phone", "5G", "phone"]}
    Receive: {"tags": ["phone", "5G"]} — Set removes duplicates!
    """
    return {"listing": listing.model_dump(), "unique_tags": len(listing.tags)}


# ════════════════════════════════════════════════════════════
# SECTION 6 — model_config and JSON Schema Examples
# ════════════════════════════════════════════════════════════

# WHY: Good examples in docs = fewer support tickets. model_config
# adds example data that shows up in Swagger UI's "Example Value".

class OrderItem(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=1, le=50)
    unit_price: float = Field(..., gt=0)

    model_config = ConfigDict(json_schema_extra={
        "examples": [{"product_id": 101, "quantity": 1, "unit_price": 15999.0}]
    })


class Order(BaseModel):
    customer_name: str
    delivery_address: Address
    items: List[OrderItem] = Field(..., min_length=1)  # At least 1 item
    payment_method: str = "COD"

    model_config = ConfigDict(json_schema_extra={
        "examples": [{
            "customer_name": "Amit Patel",
            "delivery_address": {"street": "42 Jubilee Hills", "city": "Hyderabad", "pincode": "500033"},
            "items": [{"product_id": 101, "quantity": 1, "unit_price": 15999.0}],
            "payment_method": "UPI",
        }]
    })


@app.post("/orders", tags=["Orders"])
def place_order(order: Order):
    """Examples show up in Swagger "Example Value" section."""
    total = sum(item.unit_price * item.quantity for item in order.items)
    return {"order_id": "FK-2024-78901", "total": total, "status": "placed"}


# ════════════════════════════════════════════════════════════
# SECTION 7 — Combining Body + Path + Query Parameters
# ════════════════════════════════════════════════════════════

# WHY: Real APIs often need all three: path to identify resource,
# query for options, body for actual data.

class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


@app.post("/products/{product_id}/reviews", tags=["Reviews"])
def add_review(
    product_id: int,                          # Path parameter
    notify_seller: bool = True,               # Query parameter
    review: ReviewCreate = Body(...),         # Request body
):
    """
    FastAPI figures out each parameter's source:
    - In URL path template? → path parameter
    - Pydantic model? → request body
    - Everything else? → query parameter
    """
    return {"product_id": product_id, "notify_seller": notify_seller, "review": review.model_dump()}


# ════════════════════════════════════════════════════════════
# SECTION 8 — Model Inheritance
# ════════════════════════════════════════════════════════════

# WHY: Define shared fields once, extend for create/update/response.
# Avoids duplication and keeps models in sync.

class ProductBase(BaseModel):
    """Shared fields."""
    title: str = Field(..., min_length=3, max_length=200)
    price: float = Field(..., gt=0)
    category: str = "General"


class ProductIn(ProductBase):
    """What client sends to CREATE. Adds seller_id."""
    seller_id: int


class ProductOut(ProductBase):
    """What server RETURNS. Adds id, hides seller_id."""
    id: int
    is_available: bool


@app.post("/products/v2", tags=["Products V2"], response_model=ProductOut)
def create_product_v2(product: ProductIn):
    """
    Client sends ProductIn (with seller_id).
    Server returns ProductOut (with id, WITHOUT seller_id).
    response_model filters out seller_id automatically — security pattern.
    """
    return ProductOut(
        id=12345,
        title=product.title,
        price=product.price,
        category=product.category,
        is_available=True,
    )


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Query params for filters; request body (Pydantic models) for complex data.
# 2. No default = REQUIRED; Optional/default = OPTIONAL.
# 3. Field(gt=0, min_length=3, pattern=r"...") prevents bad data at the boundary.
# 4. model_dump(exclude_unset=True) = only fields the client sent (perfect for PATCH).
# 5. Nested models validate recursively — errors pinpoint the exact nested field.
# 6. Set fields auto-deduplicate; List fields preserve order.
# 7. Model inheritance (Base → In / Out) avoids field duplication.
# "Data is a precious thing and will last longer than the systems themselves." — Tim Berners-Lee

if __name__ == "__main__":
    uvicorn.run("04-request-body-and-pydantic:app", host="127.0.0.1", port=8000, reload=True)
