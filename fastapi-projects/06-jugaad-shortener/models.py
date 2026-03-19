from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import string
import random


def generate_code(length: int = 6) -> str:
    """Generate a random short code like 'aB3xK9'."""
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


# Database table
class ShortURL(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    original_url: str
    short_code: str = Field(default_factory=generate_code, unique=True, index=True)
    click_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Request body
class ShortURLCreate(SQLModel):
    original_url: str


# Response body
class ShortURLRead(SQLModel):
    id: int
    original_url: str
    short_code: str
    click_count: int
    created_at: datetime
