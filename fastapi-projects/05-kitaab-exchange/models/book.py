from sqlmodel import SQLModel, Field, Relationship
from typing import Optional


# Database table
class Book(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    author: str = Field(index=True)
    price: int
    is_sold: bool = Field(default=False)

    # Foreign key linking to user
    user_id: int = Field(foreign_key="user.id")
    owner: Optional["User"] = Relationship(back_populates="books")


# Request body for creating a book
class BookCreate(SQLModel):
    title: str
    author: str
    price: int
    user_id: int


# Response body
class BookRead(SQLModel):
    id: int
    title: str
    author: str
    price: int
    is_sold: bool
    user_id: int


# For marking as sold or updating price
class BookUpdate(SQLModel):
    price: Optional[int] = None
    is_sold: Optional[bool] = None


from models.user import User

Book.model_rebuild()
