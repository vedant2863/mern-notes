from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CartItem(BaseModel):
    product_id: str
    quantity: int


class CheckoutRequest(BaseModel):
    items: list[CartItem]
    payment_method: str = "cash"  # cash, upi, card


class SaleItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    price: float
    subtotal: float


class SaleResponse(BaseModel):
    id: str
    items: list[SaleItem]
    total: float
    payment_method: str
    created_at: datetime
