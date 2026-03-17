"""
============================================================
FILE 06: ADVANCED VALIDATION — QUERY, PATH, BODY, HEADER
============================================================
Topics: Query(), Path(), Body(), Header(), Cookie(), Field(),
        @field_validator, @model_validator, Annotated types

WHY THIS MATTERS:
Bad data is the #1 source of production bugs. Validation is
your first line of defense. FastAPI + Pydantic give you the
most powerful validation toolkit in any Python framework.
============================================================
"""

# STORY: Aadhaar (UIDAI) — 12-Digit Validation at 1.4 Billion Scale
# The Unique Identification Authority of India issues Aadhaar numbers
# to 1.4 billion residents. Every API call — whether from a bank
# verifying KYC or a government portal disbursing subsidies — MUST
# validate that the 12-digit number is structurally correct before it
# even hits the database. At 100 million+ daily authentications,
# validation is not optional — it is the architecture.

from fastapi import FastAPI, Query, Path, Body, Header, Cookie
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Annotated, Optional

app = FastAPI(title="Validation Deep Dive")


# ════════════════════════════════════════════════════════════
# SECTION 1 — Query Parameter Validation with Query()
# ════════════════════════════════════════════════════════════

# WHY: Query parameters come directly from users via URLs. They are
# the most exposed surface of your API — never trust them blindly.

@app.get("/search")
def search_items(
    q: Annotated[str, Query(min_length=2, max_length=100)] = ...,
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 10,
):
    """Search with validated query parameters — length, min/max, required."""
    return {"query": q, "page": page, "size": size}


# --- Query() with regex pattern ---
# Indian pincode is exactly 6 digits, first digit 1-9
@app.get("/location")
def get_location(
    pincode: Annotated[
        str,
        Query(pattern=r"^[1-9][0-9]{5}$", description="Indian PIN code"),
    ]
):
    """Validate Indian PIN code format via regex pattern."""
    return {"pincode": pincode, "valid": True}


# --- Query() with alias (when Python name differs from URL param) ---
@app.get("/items")
def list_items(
    # URL uses ?item-type=xyz but Python needs a valid variable name
    item_type: Annotated[
        Optional[str],
        Query(alias="item-type", max_length=50),
    ] = None,
):
    """Use alias when URL param name is not a valid Python identifier."""
    return {"item_type": item_type}


# ════════════════════════════════════════════════════════════
# SECTION 2 — Path Parameter Validation with Path()
# ════════════════════════════════════════════════════════════

# WHY: Path parameters are part of the URL structure. Validating them
# prevents nonsensical routes like /users/-5 or /orders/0.

@app.get("/users/{user_id}")
def get_user(
    user_id: Annotated[int, Path(ge=1, le=999999999, title="User ID")]
):
    """Path param must be a positive integer."""
    return {"user_id": user_id}


@app.get("/profiles/{username}")
def get_profile(
    username: Annotated[
        str,
        Path(min_length=3, max_length=30, pattern=r"^[a-z0-9_]+$"),
    ]
):
    """Username: lowercase alphanumeric + underscore, 3-30 chars."""
    return {"username": username}


# ════════════════════════════════════════════════════════════
# SECTION 3 — Body & Header Validation
# ════════════════════════════════════════════════════════════

# WHY: Body() controls how JSON body fields are parsed.
# Header() validates auth tokens and client metadata.

@app.put("/items/{item_id}")
def update_item_importance(
    item_id: int,
    # Without embed=True, FastAPI expects just the raw int in body
    # With embed=True, it expects {"importance": 5}
    importance: Annotated[int, Body(ge=1, le=10, embed=True)],
):
    """Body(embed=True) wraps a single value in a JSON key."""
    return {"item_id": item_id, "importance": importance}


@app.get("/with-headers")
def read_headers(
    # Python: user_agent -> HTTP header: User-Agent (auto-converted)
    user_agent: Annotated[Optional[str], Header()] = None,
    # Custom header: x_token -> X-Token
    x_token: Annotated[Optional[str], Header(min_length=10)] = None,
):
    """FastAPI auto-converts underscores to hyphens for headers."""
    return {"user_agent": user_agent, "x_token": x_token}


@app.get("/dashboard")
def get_dashboard(
    session_id: Annotated[Optional[str], Cookie(min_length=20)] = None,
):
    """Read and validate a cookie value."""
    if not session_id:
        return {"logged_in": False}
    return {"logged_in": True, "session_id_prefix": session_id[:8] + "..."}


# ════════════════════════════════════════════════════════════
# SECTION 4 — Field() Inside Pydantic Models
# ════════════════════════════════════════════════════════════

# WHY: Field() is where you put validation INSIDE your data models.
# This is the most common place for business-rule validation.

class Product(BaseModel):
    name: str = Field(min_length=2, max_length=100, examples=["Parle-G Biscuits"])
    price: float = Field(gt=0, le=10_000_000, description="Price in INR")
    category: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9 _-]{1,49}$")
    stock: int = Field(ge=0)

@app.post("/products")
def create_product(product: Product):
    """All Field() validations run automatically on the request body."""
    return {"created": product.model_dump()}


# ════════════════════════════════════════════════════════════
# SECTION 5 — Custom Validators: @field_validator and @model_validator
# ════════════════════════════════════════════════════════════

# WHY: Built-in constraints handle 80% of cases. The remaining 20% —
# Luhn checks, cross-field logic, business rules — need custom validators.

class AadhaarVerification(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    aadhaar: str = Field(min_length=12, max_length=12)
    phone: str = Field(min_length=10, max_length=10)
    pan: str = Field(min_length=10, max_length=10)

    @field_validator("aadhaar")
    @classmethod
    def validate_aadhaar(cls, v: str) -> str:
        """Aadhaar: exactly 12 digits, first digit not 0 or 1."""
        if not v.isdigit():
            raise ValueError("Aadhaar must contain only digits")
        if v[0] in ("0", "1"):
            raise ValueError("Aadhaar cannot start with 0 or 1")
        return v

    @field_validator("phone")
    @classmethod
    def validate_indian_phone(cls, v: str) -> str:
        """Indian mobile: 10 digits starting with 6-9."""
        if not v.isdigit() or v[0] not in ("6", "7", "8", "9"):
            raise ValueError("Indian mobile must be 10 digits starting with 6-9")
        return v

    @field_validator("pan")
    @classmethod
    def validate_pan_card(cls, v: str) -> str:
        """PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)."""
        import re
        v = v.upper()
        if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", v):
            raise ValueError("Invalid PAN format. Expected: ABCDE1234F")
        return v


# --- @model_validator for cross-field validation ---
class MoneyTransfer(BaseModel):
    sender_account: str
    receiver_account: str
    amount: float = Field(gt=0, le=10_00_000)  # 10 lakh limit

    @model_validator(mode="after")
    def validate_transfer(self):
        """Cross-field: cannot transfer to yourself."""
        if self.sender_account == self.receiver_account:
            raise ValueError("Sender and receiver accounts must differ")
        return self


@app.post("/verify-aadhaar")
def verify_aadhaar(data: AadhaarVerification):
    """All field validators run before this function executes."""
    return {"verified": True, "name": data.name}


@app.post("/transfer")
def transfer_money(transfer: MoneyTransfer):
    """Cross-field validation ensures sender != receiver."""
    return {"status": "initiated", "amount": transfer.amount}


# ════════════════════════════════════════════════════════════
# SECTION 6 — Annotated Types for Reusable Validation
# ════════════════════════════════════════════════════════════

# WHY: Without Annotated types, you copy-paste the same Query(pattern=...)
# everywhere. Annotated lets you define a type ONCE and reuse it.

IndianPhone = Annotated[str, Field(pattern=r"^[6-9]\d{9}$")]
AadhaarNumber = Annotated[str, Field(pattern=r"^[2-9]\d{11}$")]
PINCode = Annotated[str, Field(pattern=r"^[1-9]\d{5}$")]
PANNumber = Annotated[str, Field(pattern=r"^[A-Z]{5}\d{4}[A-Z]$")]
PageNumber = Annotated[int, Query(ge=1, description="Page number")]
PageSize = Annotated[int, Query(ge=1, le=100, description="Items per page")]


# --- Use them in models: clean and DRY ---
class CustomerKYC(BaseModel):
    """KYC model using reusable Annotated types."""
    full_name: str = Field(min_length=2, max_length=100)
    phone: IndianPhone
    aadhaar: AadhaarNumber
    pan: PANNumber
    address_pincode: PINCode


@app.get("/customers")
def list_customers(page: PageNumber = 1, size: PageSize = 20):
    """Reusable Query types keep endpoint signatures clean."""
    return {"page": page, "size": size}


@app.post("/kyc")
def submit_kyc(kyc: CustomerKYC):
    """All Indian-format validations via reusable Annotated types."""
    return {"status": "submitted", "name": kyc.full_name}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Query(), Path(), Body(), Header(), Cookie() — each has its own
#    validation parameters suited to its HTTP location.
# 2. Field() inside Pydantic models is the workhorse for body
#    validation — supports min/max, patterns, descriptions, examples.
# 3. @field_validator runs on a SINGLE field — great for format checks
#    like Aadhaar, PAN, phone.
# 4. @model_validator runs on the WHOLE model — use mode="after" for
#    cross-field checks (sender != receiver).
# 5. Annotated types (IndianPhone, PINCode, etc.) let you define
#    validation ONCE and reuse across all models and endpoints.
# 6. Indian-specific patterns to memorize:
#    Phone: ^[6-9]\d{9}$  |  Aadhaar: ^[2-9]\d{11}$
#    PAN: ^[A-Z]{5}\d{4}[A-Z]$  |  PIN: ^[1-9]\d{5}$
# "Garbage in, garbage out. Validate at the gate." — Every UIDAI engineer
