"""
============================================================
FILE 05: RESPONSE MODELS, STATUS CODES, AND ERROR HANDLING
============================================================
Topics: response_model, response_model filtering options,
        return type annotations, HTTP status codes,
        HTTPException, custom exception handlers,
        JSONResponse, input vs output models

WHY THIS MATTERS:
Your API is only as good as its responses. Wrong status codes
confuse clients, leaked fields (passwords!) cause security
breaches, and poor error messages waste developer hours.
Mastering responses makes your API professional and secure.
============================================================
"""

# STORY: PhonePe — Payment 201/400/503 Response Codes
# PhonePe processes over 1.5 billion UPI transactions monthly. Every
# payment response is critical — 201 means "payment initiated," 400
# means "bad request," 503 means "bank unavailable, retry later."
# A real incident returned 200 OK for failed payments, causing merchants
# to ship products for unpaid orders. Now every endpoint has strict
# response_model validation and explicit status codes.

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn

app = FastAPI(
    title="PhonePe Payment API",
    description="Learning response models and error handling through payments.",
    version="3.0.0",
)

# ════════════════════════════════════════════════════════════
# SECTION 1 — response_model: Filter Output Fields
# ════════════════════════════════════════════════════════════

# WHY: response_model tells FastAPI what shape the response
# should be. It filters out extra fields (like passwords!),
# validates output, and generates accurate docs.

class UserCreate(BaseModel):
    """What the client sends."""
    username: str
    email: str
    password: str                             # Client sends this


class UserResponse(BaseModel):
    """What the API returns — NO PASSWORD."""
    id: int
    username: str
    email: str
    is_active: bool = True


@app.post(
    "/users",
    response_model=UserResponse,              # Only these fields in response
    status_code=status.HTTP_201_CREATED,
    tags=["Users"],
)
def create_user(user: UserCreate):
    """
    response_model=UserResponse ensures:
    1. Password is NEVER sent back (not in UserResponse)
    2. Swagger docs show the EXACT response shape
    Even if you return a dict WITH password, response_model strips it.
    """
    user_dict = user.model_dump()
    user_dict["id"] = 42
    user_dict["is_active"] = True
    return user_dict  # password is in here but response_model removes it!


# --- response_model with List ---
@app.get("/users", response_model=List[UserResponse], tags=["Users"])
def list_users():
    """List[UserResponse] = JSON array where each element matches schema."""
    return [
        {"id": 1, "username": "rahul", "email": "rahul@test.com", "password": "secret123", "is_active": True},
        {"id": 2, "username": "priya", "email": "priya@test.com", "password": "hidden456", "is_active": True},
        # Passwords in dicts but response_model strips them!
    ]


# ════════════════════════════════════════════════════════════
# SECTION 2 — response_model Filtering Options
# ════════════════════════════════════════════════════════════

# WHY: Fine control over what fields appear — exclude unset
# (save bandwidth), include only specific fields (summary views).

class PaymentResponse(BaseModel):
    payment_id: str
    amount: float
    currency: str = "INR"
    payment_status: str
    upi_id: Optional[str] = None
    bank_reference: Optional[str] = None
    error_message: Optional[str] = None


@app.get(
    "/payments/{payment_id}/compact",
    response_model=PaymentResponse,
    response_model_exclude_unset=True,        # Skip fields not explicitly set
    tags=["Payments"],
)
def get_payment_compact(payment_id: str):
    """
    exclude_unset=True: only returns fields that were set.
    Result: {"payment_id": "...", "amount": 999, "payment_status": "success", "upi_id": "..."}
    NOT: {..., "bank_reference": null, "error_message": null}
    Saves bandwidth — critical at PhonePe's scale.
    """
    return PaymentResponse(
        payment_id=payment_id, amount=999.0,
        payment_status="success", upi_id="user@paytm",
    )


# ════════════════════════════════════════════════════════════
# SECTION 3 — Return Type Annotations vs response_model
# ════════════════════════════════════════════════════════════

# WHY: Two approaches, same result. Know both so you can pick
# the right one for each situation.

class TransactionSummary(BaseModel):
    txn_id: str
    amount: float
    txn_status: str


# Approach 1: response_model (explicit, supports filtering options)
@app.get("/transactions/v1/{txn_id}", response_model=TransactionSummary, tags=["Transactions"])
def get_transaction_v1(txn_id: str):
    """response_model works in all Python 3.7+ and supports exclude/include."""
    return {"txn_id": txn_id, "amount": 1250.0, "txn_status": "completed", "internal_note": "filtered out"}


# Approach 2: return type annotation (cleaner, Python 3.9+)
@app.get("/transactions/v2/{txn_id}", tags=["Transactions"])
def get_transaction_v2(txn_id: str) -> TransactionSummary:
    """Return type annotation — cleaner syntax, same behavior."""
    return TransactionSummary(txn_id=txn_id, amount=1250.0, txn_status="completed")


# ════════════════════════════════════════════════════════════
# SECTION 4 — HTTP Status Codes
# ════════════════════════════════════════════════════════════

# WHY: Status codes are the first thing clients check. Using 200
# for everything hides errors and breaks automated handling.

# 2xx Success:  200 OK, 201 Created, 202 Accepted, 204 No Content
# 4xx Client:   400 Bad Request, 401 Unauthorized, 403 Forbidden,
#               404 Not Found, 409 Conflict, 422 Validation, 429 Rate Limit
# 5xx Server:   500 Internal, 502 Bad Gateway, 503 Unavailable
#
# PhonePe: 201 = payment initiated, 400 = invalid UPI, 503 = bank down

@app.post("/payments", status_code=status.HTTP_201_CREATED, tags=["Payments"])
def initiate_payment(amount: float, upi_id: str):
    """Use status module constants for readable, self-documenting code."""
    return {"payment_id": "PAY_2024_001", "amount": amount, "upi_id": upi_id, "status": "initiated"}


@app.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Payments"])
def cancel_payment(payment_id: str):
    """204 No Content — deletion succeeded, nothing to return."""
    return None


# ════════════════════════════════════════════════════════════
# SECTION 5 — HTTPException for Error Responses
# ════════════════════════════════════════════════════════════

# WHY: HTTPException immediately stops execution and sends the
# error to the client with proper status code and message.

payments_db = {
    "PAY_001": {"id": "PAY_001", "amount": 999, "status": "success"},
    "PAY_002": {"id": "PAY_002", "amount": 2499, "status": "failed"},
}


@app.get("/payments/{payment_id}", tags=["Payments"])
def get_payment(payment_id: str):
    """
    /payments/PAY_001 → 200 OK with data
    /payments/PAY_999 → 404 Not Found
    """
    if payment_id not in payments_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found",
        )
    return payments_db[payment_id]


# --- HTTPException with structured detail ---
@app.get("/payments/{payment_id}/refund", tags=["Payments"])
def request_refund(payment_id: str):
    """detail can be string, dict, or list — dicts are great for structured errors."""
    if payment_id not in payments_db:
        raise HTTPException(status_code=404, detail={"error_code": "PAYMENT_NOT_FOUND", "message": "Not found"})

    payment = payments_db[payment_id]
    if payment["status"] != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "REFUND_NOT_ALLOWED", "message": f"Cannot refund a {payment['status']} payment"},
        )
    return {"refund_id": f"REF_{payment_id}", "refund_amount": payment["amount"], "status": "refund_initiated"}


# --- HTTPException with custom headers ---
@app.get("/rate-limited-endpoint", tags=["Demo"])
def rate_limited():
    """Custom headers — common for rate limiting (Retry-After, etc.)."""
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Rate limit exceeded. Max 100 requests per minute.",
        headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
    )


# ════════════════════════════════════════════════════════════
# SECTION 6 — Custom Exception Handlers
# ════════════════════════════════════════════════════════════

# WHY: Standardize ALL error responses across your API.
# Default format might not match your API's convention.

class PaymentException(Exception):
    def __init__(self, error_code: str, message: str):
        self.error_code = error_code
        self.message = message


@app.exception_handler(PaymentException)
async def payment_exception_handler(request: Request, exc: PaymentException):
    """Every PaymentException returns a consistent JSON format."""
    return JSONResponse(
        status_code=400,
        content={"success": False, "error": {"code": exc.error_code, "message": exc.message}},
    )


@app.post("/payments/process", tags=["Payments"])
def process_payment(amount: float, upi_id: str):
    """Uses custom exception for domain-specific errors."""
    if amount <= 0:
        raise PaymentException("INVALID_AMOUNT", f"Amount must be positive, got {amount}")
    return {"payment_id": "PAY_2024_NEW", "amount": amount, "status": "processing"}


# --- Override default 422 validation error format ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Convert default 422 to a simpler, consistent format."""
    errors = [
        {"field": " -> ".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"success": False, "message": f"Validation failed: {len(errors)} error(s)", "errors": errors},
    )


# ════════════════════════════════════════════════════════════
# SECTION 7 — Input/Output Model Separation (Security Pattern)
# ════════════════════════════════════════════════════════════

# WHY: The most important security pattern in FastAPI. Separate
# what clients send from what they receive.

class MerchantIn(BaseModel):
    """What merchants send — includes sensitive fields."""
    business_name: str = Field(..., min_length=3)
    pan_number: str = Field(..., pattern=r"^[A-Z]{5}\d{4}[A-Z]$")
    bank_account: str
    password: str = Field(..., min_length=8)


class MerchantOut(BaseModel):
    """What API returns — sensitive fields removed."""
    id: int
    business_name: str
    is_verified: bool = False
    # NO pan_number, bank_account, or password!


@app.post("/merchants", response_model=MerchantOut, status_code=201, tags=["Merchants"])
def register_merchant(merchant: MerchantIn):
    """
    Even if you return the full dict, response_model filters out
    PAN, bank account, and password. Security pattern every fintech MUST follow.
    """
    return {
        "id": 1001,
        "business_name": merchant.business_name,
        "pan_number": merchant.pan_number,    # FILTERED OUT by response_model
        "password": merchant.password,        # FILTERED OUT by response_model
        "is_verified": False,
    }


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. response_model filters output — use it to NEVER leak passwords or internal data.
# 2. Separate Input/Output models (UserCreate vs UserResponse) for security.
# 3. response_model_exclude_unset=True saves bandwidth by skipping null fields.
# 4. Use status module constants (status.HTTP_201_CREATED) for readable code.
# 5. HTTPException stops execution immediately — no if/else/return chains.
# 6. Custom exception handlers standardize error format across the entire API.
# 7. JSONResponse gives full control for custom headers and dynamic status codes.
# "Plans are useless, but planning is indispensable." — Eisenhower

if __name__ == "__main__":
    uvicorn.run("05-response-models-and-status-codes:app", host="127.0.0.1", port=8000, reload=True)
