from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


# Nested model for a single line item
class LineItem(BaseModel):
    description: str
    quantity: int
    unit_price: float


# Tax breakdown returned in responses
class TaxBreakdown(BaseModel):
    subtotal: float
    cgst: float
    sgst: float
    igst: float
    total: float


# Database table
class Invoice(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_name: str
    customer_name: str
    shop_state: str
    customer_state: str
    line_items: list = Field(sa_column=Column(JSON), default=[])
    subtotal: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    total: float = 0.0
    logo_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Request body for creating an invoice
class InvoiceCreate(SQLModel):
    shop_name: str
    customer_name: str
    shop_state: str
    customer_state: str
    line_items: list[LineItem]
    logo_path: Optional[str] = None


# Response body
class InvoiceRead(SQLModel):
    id: int
    shop_name: str
    customer_name: str
    shop_state: str
    customer_state: str
    line_items: list
    subtotal: float
    cgst: float
    sgst: float
    igst: float
    total: float
    logo_path: Optional[str]
    created_at: datetime
