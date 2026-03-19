from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from models import Order, OrderStatus, OrderCreate, OrderUpdate, StatusLog
from database import get_session

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/", response_model=Order)
def create_order(order: OrderCreate, session: Session = Depends(get_session)):
    db_order = Order(**order.model_dump())
    session.add(db_order)
    session.commit()
    session.refresh(db_order)
    return db_order


@router.get("/", response_model=list[Order])
def list_orders(
    status: OrderStatus | None = Query(None, description="Filter by status"),
    created_date: date | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    query = select(Order)

    if status:
        query = query.where(Order.status == status)

    # Filter by date: match orders created on that calendar day
    if created_date:
        start = datetime.combine(created_date, datetime.min.time())
        end = datetime.combine(created_date, datetime.max.time())
        query = query.where(Order.created_at >= start, Order.created_at <= end)

    query = query.offset(skip).limit(limit)
    return session.exec(query).all()


@router.get("/{order_id}", response_model=Order)
def get_order(order_id: int, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}", response_model=StatusLog)
def update_order(
    order_id: int, update: OrderUpdate, session: Session = Depends(get_session)
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status.value

    # Apply only the fields that were sent
    update_data = update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for key, value in update_data.items():
        setattr(order, key, value)

    order.updated_at = datetime.now()
    session.add(order)
    session.commit()
    session.refresh(order)

    # Return a status log showing what changed
    return StatusLog(
        order_id=order.id,
        old_status=old_status,
        new_status=order.status.value,
        changed_at=order.updated_at,
    )
