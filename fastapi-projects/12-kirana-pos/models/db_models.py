from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from datetime import datetime
from database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    barcode = Column(String, unique=True, nullable=True)
    category = Column(String, nullable=True)


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    items = Column(JSON, nullable=False)
    total = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False, default="cash")
    created_at = Column(DateTime, default=datetime.utcnow)
