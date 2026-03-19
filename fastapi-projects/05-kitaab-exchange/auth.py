from fastapi import Header, HTTPException

# In production, store this in .env
API_KEY = "kitaab-secret-2024"


def verify_api_key(x_api_key: str = Header()):
    """Check the X-API-Key header on protected routes."""
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key
