from fastapi import Request
from fastapi.responses import JSONResponse


class PincodeNotFoundError(Exception):
    def __init__(self, pincode: str):
        self.pincode = pincode


class InvalidPincodeError(Exception):
    def __init__(self, pincode: str, reason: str = "Invalid format"):
        self.pincode = pincode
        self.reason = reason


# Custom handler for PincodeNotFoundError
async def pincode_not_found_handler(request: Request, exc: PincodeNotFoundError):
    return JSONResponse(
        status_code=404,
        content={
            "error": "pincode_not_found",
            "message": f"No location data found for pincode: {exc.pincode}",
            "pincode": exc.pincode,
        },
    )


# Custom handler for InvalidPincodeError
async def invalid_pincode_handler(request: Request, exc: InvalidPincodeError):
    return JSONResponse(
        status_code=400,
        content={
            "error": "invalid_pincode",
            "message": f"Pincode '{exc.pincode}' is invalid: {exc.reason}",
            "pincode": exc.pincode,
        },
    )
