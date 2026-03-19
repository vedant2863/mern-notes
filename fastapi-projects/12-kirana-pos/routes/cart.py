from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import Product
from models.sale import CartItem

router = APIRouter(prefix="/cart", tags=["cart"])

# In-memory cart storage (per session in production, use Redis)
# For simplicity, we use a single global cart
cart: list[dict] = []


@router.post("/add")
def add_to_cart(item: CartItem, db: Session = Depends(get_db)):
    """Add a product to the cart."""
    product = db.query(Product).filter(Product.id == int(item.product_id)).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock_quantity < item.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Only {product.stock_quantity} in stock",
        )

    # Check if already in cart, update quantity
    for cart_item in cart:
        if cart_item["product_id"] == item.product_id:
            cart_item["quantity"] += item.quantity
            return {"message": "Cart updated", "cart": cart}

    cart.append({
        "product_id": item.product_id,
        "product_name": product.name,
        "price": product.price,
        "quantity": item.quantity,
    })

    return {"message": "Added to cart", "cart": cart}


@router.get("/")
def view_cart():
    """View current cart contents."""
    total = sum(item["price"] * item["quantity"] for item in cart)
    return {
        "items": cart,
        "item_count": len(cart),
        "total": round(total, 2),
    }


@router.delete("/{product_id}")
def remove_from_cart(product_id: str):
    """Remove a product from the cart."""
    global cart
    original_length = len(cart)
    cart = [item for item in cart if item["product_id"] != product_id]

    if len(cart) == original_length:
        raise HTTPException(status_code=404, detail="Item not in cart")

    return {"message": "Removed from cart", "cart": cart}


@router.delete("/")
def clear_cart():
    """Clear the entire cart."""
    cart.clear()
    return {"message": "Cart cleared"}
