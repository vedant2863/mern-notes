from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from models.db_models import Sale

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily")
def daily_sales_summary(
    date: Optional[str] = Query(None, description="YYYY-MM-DD, defaults to today"),
    db: Session = Depends(get_db),
):
    """Get total sales, revenue, and transaction count for a day."""
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    else:
        target_date = datetime.utcnow().date()

    start = datetime.combine(target_date, datetime.min.time())
    end = start + timedelta(days=1)

    # Query sales for the day
    sales = (
        db.query(Sale)
        .filter(Sale.created_at >= start, Sale.created_at < end)
        .all()
    )

    total_revenue = sum(sale.total for sale in sales)
    total_items = 0
    for sale in sales:
        for item in sale.items:
            total_items += item["quantity"]

    return {
        "date": str(target_date),
        "total_transactions": len(sales),
        "total_revenue": round(total_revenue, 2),
        "total_items_sold": total_items,
    }


@router.get("/top-products")
def top_products(
    days: int = Query(7, description="Look back N days"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get top selling products by quantity sold."""
    start = datetime.utcnow() - timedelta(days=days)

    sales = (
        db.query(Sale)
        .filter(Sale.created_at >= start)
        .all()
    )

    # Aggregate product sales from JSON items
    product_totals = {}
    for sale in sales:
        for item in sale.items:
            pid = item["product_id"]
            if pid not in product_totals:
                product_totals[pid] = {
                    "product_id": pid,
                    "product_name": item["product_name"],
                    "total_quantity": 0,
                    "total_revenue": 0.0,
                }
            product_totals[pid]["total_quantity"] += item["quantity"]
            product_totals[pid]["total_revenue"] += item["subtotal"]

    # Sort by quantity and take top N
    sorted_products = sorted(
        product_totals.values(),
        key=lambda x: x["total_quantity"],
        reverse=True,
    )

    return {
        "period_days": days,
        "top_products": sorted_products[:limit],
    }


@router.get("/revenue")
def revenue_by_date_range(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Get daily revenue breakdown for a date range."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)

    sales = (
        db.query(Sale)
        .filter(Sale.created_at >= start, Sale.created_at < end)
        .order_by(Sale.created_at)
        .all()
    )

    # Group by date
    daily = {}
    for sale in sales:
        day_key = sale.created_at.strftime("%Y-%m-%d")
        if day_key not in daily:
            daily[day_key] = {"date": day_key, "revenue": 0.0, "transactions": 0}
        daily[day_key]["revenue"] += sale.total
        daily[day_key]["transactions"] += 1

    # Round revenue
    for day in daily.values():
        day["revenue"] = round(day["revenue"], 2)

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_revenue": round(sum(d["revenue"] for d in daily.values()), 2),
        "daily_breakdown": list(daily.values()),
    }
