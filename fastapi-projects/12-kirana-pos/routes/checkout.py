from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.sale import CheckoutRequest, SaleResponse, SaleItem
from services.checkout_service import process_checkout

router = APIRouter(prefix="/checkout", tags=["checkout"])


@router.post("/", response_model=SaleResponse)
def checkout(request: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Process a checkout — atomic transaction.
    Creates a sale record and decrements stock for each product.
    If any product has insufficient stock, everything rolls back.
    """
    sale = process_checkout(db, request.items, request.payment_method)

    return SaleResponse(
        id=str(sale.id),
        items=[SaleItem(**item) for item in sale.items],
        total=sale.total,
        payment_method=sale.payment_method,
        created_at=sale.created_at,
    )
