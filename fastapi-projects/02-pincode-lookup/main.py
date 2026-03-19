from fastapi import FastAPI
from data import pincode_db
from models import LocationResponse, BulkRequest, BulkResponse
from exceptions import (
    PincodeNotFoundError,
    InvalidPincodeError,
    pincode_not_found_handler,
    invalid_pincode_handler,
)

app = FastAPI(
    title="Pincode Lookup API",
    description="Auto-fill city and state from Indian pincodes during checkout",
)

# Register custom exception handlers
app.add_exception_handler(PincodeNotFoundError, pincode_not_found_handler)
app.add_exception_handler(InvalidPincodeError, invalid_pincode_handler)


@app.get("/")
def root():
    return {"message": "Pincode Lookup API", "total_pincodes": len(pincode_db)}


@app.get("/pincode/{code}", response_model=LocationResponse)
def lookup_pincode(code: str):
    # Validate format before looking up
    if len(code) != 6 or not code.isdigit():
        raise InvalidPincodeError(code, "Must be exactly 6 digits")

    if code not in pincode_db:
        raise PincodeNotFoundError(code)

    return pincode_db[code]


@app.post("/pincode/bulk", response_model=BulkResponse)
def bulk_lookup(request: BulkRequest):
    """Look up multiple pincodes at once — useful for batch address validation."""
    results = []
    missing = []

    for code in request.pincodes:
        if code in pincode_db:
            results.append(pincode_db[code])
        else:
            missing.append(code)

    return BulkResponse(
        found=len(results),
        not_found=len(missing),
        results=results,
        missing=missing,
    )
