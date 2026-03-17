"""
============================================================
FILE 11: DATABASE RELATIONSHIPS, JOINS, AND ADVANCED QUERIES
============================================================
Topics: one-to-many, foreign keys, Relationship(), back_populates,
        joins, many-to-many, aggregation, pagination, search

WHY THIS MATTERS:
Real-world applications never have just one table. Products have
reviews, users have orders, orders have items. Understanding how
to model relationships and write efficient queries is what
separates a toy app from a production-grade API.
============================================================
"""

# STORY: Amazon India — Product Has Reviews, User Has Reviews
# Amazon India handles 300M+ products and billions of reviews.
# Every product page you see is a JOIN across products, reviews,
# and users. When you filter by "4 stars & above" or sort by
# "most recent", that is a database query with WHERE, ORDER BY,
# and LIMIT — not Python filtering. Getting relationships and
# queries right is the backbone of every e-commerce platform.

from typing import Optional, List
from datetime import datetime, timezone

from sqlmodel import (
    SQLModel, Field, Relationship, Session, create_engine,
    select, col, or_, func
)
from fastapi import FastAPI, HTTPException, Query, Depends

# ════════════════════════════════════════════════════════════
# SECTION 1 — One-to-Many Relationships (User Has Many Reviews)
# ════════════════════════════════════════════════════════════

# WHY: One-to-many is the most common relationship in any app.
# A user writes many reviews, a product has many reviews, an
# order contains many items. Master this pattern first.

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(unique=True)

    # Relationship: this user's reviews
    # back_populates="reviewer" means Review.reviewer points back here
    reviews: List["Review"] = Relationship(back_populates="reviewer")


class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    price: float = Field(ge=0)
    category: str = Field(index=True)
    stock: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # One product has many reviews
    reviews: List["Review"] = Relationship(back_populates="product")


# --- Child Model: Review ---
# The "many" side. Each review belongs to one product AND one user.
# Foreign keys enforce integrity — no reviews for ghost products.

class Review(SQLModel, table=True):
    __tablename__ = "reviews"

    id: Optional[int] = Field(default=None, primary_key=True)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Foreign keys — "table.column" syntax links to parent
    product_id: Optional[int] = Field(default=None, foreign_key="products.id")
    reviewer_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Bidirectional relationships
    product: Optional[Product] = Relationship(back_populates="reviews")
    reviewer: Optional[User] = Relationship(back_populates="reviews")


# ════════════════════════════════════════════════════════════
# SECTION 2 — Many-to-Many Relationships (Tags <-> Products)
# ════════════════════════════════════════════════════════════

# WHY: Many products can share the same tag, and one product
# can have multiple tags. You need a junction/link table to
# model this. Think of Flipkart categories, Swiggy cuisine tags.

# Link table — NO data of its own, just two foreign keys.
class ProductTagLink(SQLModel, table=True):
    __tablename__ = "product_tag_link"

    product_id: Optional[int] = Field(
        default=None, foreign_key="products.id", primary_key=True
    )
    tag_id: Optional[int] = Field(
        default=None, foreign_key="tags.id", primary_key=True
    )


class Tag(SQLModel, table=True):
    __tablename__ = "tags"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)

    # link_model tells SQLModel which junction table to use
    products: List[Product] = Relationship(
        back_populates="tags", link_model=ProductTagLink
    )


# ════════════════════════════════════════════════════════════
# SECTION 3 — Seeding Related Data (Insertion Order Matters)
# ════════════════════════════════════════════════════════════

# WHY: Wrong insertion order = foreign key violations. Always
# create parent records (user) before children (review).

DATABASE_URL = "sqlite:///./amazon_india.db"
engine = create_engine(DATABASE_URL, echo=False)


def create_tables():
    SQLModel.metadata.create_all(engine)


def seed_data():
    """Insert sample data with relationships."""
    with Session(engine) as session:
        # Step 1: Parents first
        buyer = User(username="rahul_sharma", email="rahul@gmail.com")
        session.add(buyer)
        session.commit()
        session.refresh(buyer)

        # Step 2: Products
        phone = Product(name="Samsung Galaxy M34", price=14999.0,
                        category="Electronics", stock=500)
        session.add(phone)
        session.commit()
        session.refresh(phone)

        # Step 3: Reviews (reference both parent IDs)
        review = Review(rating=5, comment="Amazing battery life!",
                        product_id=phone.id, reviewer_id=buyer.id)
        session.add(review)
        session.commit()


# ════════════════════════════════════════════════════════════
# SECTION 4 — Joins and Aggregation
# ════════════════════════════════════════════════════════════

# WHY: Lazy loading makes N+1 queries (one per related object).
# For 50 products with reviews, that is 51 queries. JOINs fetch
# everything in ONE query — critical for performance.

# WHY AGGREGATION: "Average rating: 4.2 (1,234 reviews)" —
# every product page shows this. Doing it in Python means
# loading ALL reviews into memory. Push math to the database.

def join_and_aggregation_examples():
    with Session(engine) as session:
        # INNER JOIN: products with their reviews
        results = session.exec(select(Product, Review).join(Review)).all()
        for product, review in results:
            print(f"{product.name}: {review.rating} stars")

        # JOIN across three tables: username + product + rating
        results = session.exec(
            select(User.username, Product.name, Review.rating)
            .join(Review, Review.reviewer_id == User.id)
            .join(Product, Product.id == Review.product_id)
        ).all()

        # COUNT + AVG per product (the Amazon product page query)
        results = session.exec(
            select(
                Product.name,
                func.count(Review.id).label("review_count"),
                func.avg(Review.rating).label("avg_rating"),
            )
            .join(Review).group_by(Product.name)
        ).all()
        for name, count, avg in results:
            print(f"  {name}: {avg:.1f} stars ({count} reviews)")


# ════════════════════════════════════════════════════════════
# SECTION 5 — FastAPI Integration (Search, Filter, Paginate)
# ════════════════════════════════════════════════════════════

# WHY: All the query patterns above need API endpoints. This
# section shows the complete product listing + detail page
# that ties relationships, joins, and aggregation together.

app = FastAPI(title="Amazon India API", version="1.0.0")


def get_session():
    with Session(engine) as session:
        yield session


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/products")
def list_products(
    q: Optional[str] = Query(None, description="Search by name"),
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = Query("created_at", enum=["name", "price", "created_at"]),
    sort_order: str = Query("desc", enum=["asc", "desc"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session),
):
    """
    Search, filter, sort, and paginate products.
    This is the query behind Amazon India's product listing page.
    """
    statement = select(Product)

    if q:
        statement = statement.where(col(Product.name).contains(q))
    if category:
        statement = statement.where(Product.category == category)
    if min_price is not None:
        statement = statement.where(Product.price >= min_price)
    if max_price is not None:
        statement = statement.where(Product.price <= max_price)

    # Sort
    sort_col = getattr(Product, sort_by, Product.created_at)
    statement = statement.order_by(
        sort_col.desc() if sort_order == "desc" else sort_col.asc()
    )

    # Paginate
    offset_val = (page - 1) * page_size
    statement = statement.offset(offset_val).limit(page_size)

    return {"items": session.exec(statement).all(), "page": page}


@app.get("/products/{product_id}")
def get_product_detail(product_id: int, session: Session = Depends(get_session)):
    """
    Product with reviews and average rating — like an
    Amazon India product detail page.
    """
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Aggregated review stats in ONE query
    stats = session.exec(
        select(
            func.count(Review.id).label("count"),
            func.avg(Review.rating).label("avg_rating"),
        ).where(Review.product_id == product_id)
    ).first()

    reviews = session.exec(
        select(Review).where(Review.product_id == product_id)
        .order_by(Review.created_at.desc()).limit(10)
    ).all()

    return {
        "product": product,
        "review_count": stats[0] if stats else 0,
        "avg_rating": round(stats[1], 1) if stats and stats[1] else 0,
        "recent_reviews": reviews,
    }


@app.post("/products/{product_id}/reviews")
def create_review(
    product_id: int,
    rating: int = Query(ge=1, le=5),
    comment: str = "",
    reviewer_id: int = Query(ge=1),
    session: Session = Depends(get_session),
):
    """Create a review for a product."""
    if not session.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    if not session.get(User, reviewer_id):
        raise HTTPException(status_code=404, detail="User not found")

    review = Review(rating=rating, comment=comment,
                    product_id=product_id, reviewer_id=reviewer_id)
    session.add(review)
    session.commit()
    session.refresh(review)
    return review


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Use Field(foreign_key="table.column") for relationships
# 2. Relationship(back_populates="field") keeps both sides synced
# 3. Many-to-many needs a link table with two foreign keys
# 4. Always create parent records before children (user before review)
# 5. Use .join() for efficient multi-table queries (avoid N+1)
# 6. Use func.count/avg/sum for aggregation at the DB level
# 7. Pagination = .offset() + .limit() — never load all rows
# 8. Push search/filter/sort to the database — not Python loops
# "Data is the new oil, but only if you can query it." — Clive Humby
