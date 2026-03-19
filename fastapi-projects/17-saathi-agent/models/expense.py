"""
Expense models — what money tracking looks like.
"""

from pydantic import BaseModel
from datetime import date
from typing import Optional


class ExpenseCreate(BaseModel):
    amount: float
    category: str
    description: str
    date: Optional[str] = None  # ISO format, defaults to today


class ExpenseResponse(BaseModel):
    id: int
    amount: float
    category: str
    description: str
    date: str
    created_at: str

    class Config:
        from_attributes = True


class ExpenseQuery(BaseModel):
    category: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    limit: int = 20


class SpendingSummary(BaseModel):
    total: float
    by_category: dict[str, float]
    transaction_count: int
    period: str
