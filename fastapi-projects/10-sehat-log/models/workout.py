from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WorkoutCreate(BaseModel):
    user_id: str
    workout_type: str
    duration_min: int
    calories_burned: int
    notes: Optional[str] = None


class WorkoutResponse(BaseModel):
    id: str
    user_id: str
    workout_type: str
    duration_min: int
    calories_burned: int
    notes: Optional[str] = None
    timestamp: datetime


class WorkoutUpdate(BaseModel):
    workout_type: Optional[str] = None
    duration_min: Optional[int] = None
    calories_burned: Optional[int] = None
    notes: Optional[str] = None
