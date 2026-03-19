from datetime import datetime
from enum import Enum
from typing import Optional
from sqlmodel import SQLModel, Field


class OrderStatus(str, Enum):
    preparing = "preparing"
    picked_up = "picked_up"
    in_transit = "in_transit"
    delivered = "delivered"


# Database table for orders
class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_name: str
    delivery_address: str
    items: str  # comma-separated tiffin items
    status: OrderStatus = Field(default=OrderStatus.preparing)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


# Schema for creating an order
class OrderCreate(SQLModel):
    customer_name: str
    delivery_address: str
    items: str


# Schema for updating order status via PATCH
class OrderUpdate(SQLModel):
    status: Optional[OrderStatus] = None
    delivery_address: Optional[str] = None


# Response that includes status change info
class StatusLog(SQLModel):
    order_id: int
    old_status: str
    new_status: str
    changed_at: datetime
