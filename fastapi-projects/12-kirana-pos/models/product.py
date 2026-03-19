from pydantic import BaseModel
from typing import Optional


class ProductCreate(BaseModel):
    name: str
    price: float
    stock_quantity: int
    barcode: Optional[str] = None
    category: Optional[str] = None


class ProductResponse(BaseModel):
    id: str
    name: str
    price: float
    stock_quantity: int
    barcode: Optional[str] = None
    category: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    barcode: Optional[str] = None
    category: Optional[str] = None


class StockUpdate(BaseModel):
    quantity: int  # positive to add, negative to subtract
