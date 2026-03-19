from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    name: str
    email: str
    age: Optional[int] = None
    weight_kg: Optional[float] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    age: Optional[int] = None
    weight_kg: Optional[float] = None
