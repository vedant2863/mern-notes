from sqlmodel import SQLModel, Field
from typing import Optional


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="worker")  # "worker" or "customer"
    phone: Optional[str] = None
    city: Optional[str] = None


class UserCreate(SQLModel):
    name: str
    email: str
    password: str
    role: str  # "worker" or "customer"
    phone: Optional[str] = None
    city: Optional[str] = None


class UserRead(SQLModel):
    id: int
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    city: Optional[str] = None


class UserLogin(SQLModel):
    email: str
    password: str
