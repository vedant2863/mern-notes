from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from models.db_models import Product, Sale
from models.sale import CartItem


def process_checkout(
    db: Session,
    items: list[CartItem],
    payment_method: str,
) -> Sale:
    """
    Atomic checkout transaction.
    Creates a sale and decrements stock for each item.
    Rolls back everything if any item has insufficient stock.
    """
    sale_items = []
    total = 0.0

    try:
        for item in items:
            product = (
                db.query(Product)
                .filter(Product.id == int(item.product_id))
                .with_for_update()  # Lock the row to prevent race conditions
                .first()
            )

            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"Product {item.product_id} not found",
                )

            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {product.name}. "
                           f"Available: {product.stock_quantity}, "
                           f"Requested: {item.quantity}",
                )

            # Decrement stock
            product.stock_quantity -= item.quantity

            subtotal = product.price * item.quantity
            total += subtotal

            sale_items.append({
                "product_id": str(product.id),
                "product_name": product.name,
                "quantity": item.quantity,
                "price": product.price,
                "subtotal": round(subtotal, 2),
            })

        # Create the sale record
        sale = Sale(
            items=sale_items,
            total=round(total, 2),
            payment_method=payment_method,
            created_at=datetime.utcnow(),
        )
        db.add(sale)

        # Commit everything — stock decrements + sale creation
        db.commit()
        db.refresh(sale)
        return sale

    except HTTPException:
        # Roll back stock changes if validation fails
        db.rollback()
        raise

    except Exception as e:
        # Roll back on any unexpected error
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")
