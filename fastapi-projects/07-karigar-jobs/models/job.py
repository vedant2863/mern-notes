from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime


class Job(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str
    location: str
    pay: int  # daily pay in rupees
    posted_by: int = Field(foreign_key="user.id")
    is_open: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JobCreate(SQLModel):
    title: str
    description: str
    location: str
    pay: int


class JobRead(SQLModel):
    id: int
    title: str
    description: str
    location: str
    pay: int
    posted_by: int
    is_open: bool
    created_at: datetime
