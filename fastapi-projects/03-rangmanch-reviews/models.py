from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


# Database table — this is what gets stored in SQLite
class Review(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    play_name: str = Field(index=True)
    reviewer_name: str
    rating: int = Field(ge=1, le=5)
    comment: str
    created_at: datetime = Field(default_factory=datetime.now)


# Schema for creating a new review (no id, no timestamp)
class ReviewCreate(SQLModel):
    play_name: str
    reviewer_name: str
    rating: int = Field(ge=1, le=5)
    comment: str


# Schema for reading a review (includes everything)
class ReviewRead(SQLModel):
    id: int
    play_name: str
    reviewer_name: str
    rating: int
    comment: str
    created_at: datetime


# Schema for updating — all fields optional
class ReviewUpdate(SQLModel):
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = None
