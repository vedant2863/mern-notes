from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import Product
from models.product import ProductCreate, ProductResponse, ProductUpdate, StockUpdate

router = APIRouter(prefix="/products", tags=["products"])


def product_to_response(product: Product) -> ProductResponse:
    return ProductResponse(
        id=str(product.id),
        name=product.name,
        price=product.price,
        stock_quantity=product.stock_quantity,
        barcode=product.barcode,
        category=product.category,
    )


@router.post("/", response_model=ProductResponse)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return product_to_response(db_product)


@router.get("/", response_model=list[ProductResponse])
def list_products(
    category: str = Query(None),
    search: str = Query(None, description="Search by name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if category:
        query = query.filter(Product.category == category)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    products = query.offset(skip).limit(limit).all()
    return [product_to_response(p) for p in products]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_response(product)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, updates: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product_to_response(product)


@router.patch("/{product_id}/stock", response_model=ProductResponse)
def update_stock(product_id: int, stock: StockUpdate, db: Session = Depends(get_db)):
    """Add or subtract stock. Use positive to add, negative to subtract."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    new_quantity = product.stock_quantity + stock.quantity
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock cannot go below 0")

    product.stock_quantity = new_quantity
    db.commit()
    db.refresh(product)
    return product_to_response(product)


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}
