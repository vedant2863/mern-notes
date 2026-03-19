from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MealCreate(BaseModel):
    user_id: str
    food: str
    calories: int
    protein_g: Optional[float] = None
    notes: Optional[str] = None


class MealResponse(BaseModel):
    id: str
    user_id: str
    food: str
    calories: int
    protein_g: Optional[float] = None
    notes: Optional[str] = None
    timestamp: datetime


class MealUpdate(BaseModel):
    food: Optional[str] = None
    calories: Optional[int] = None
    protein_g: Optional[float] = None
    notes: Optional[str] = None
