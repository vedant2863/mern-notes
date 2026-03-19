"""
Expense CRUD routes — manual expense management.
The agent can also create expenses via tools, but these
endpoints let users manage expenses directly.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.expense import ExpenseCreate, ExpenseResponse

import sqlite3

router = APIRouter(prefix="/expenses", tags=["Expenses"])


def get_connection():
    conn = sqlite3.connect("./saathi.db")
    conn.row_factory = sqlite3.Row
    return conn


@router.post("/", response_model=ExpenseResponse)
async def create_expense(expense: ExpenseCreate):
    """Create a new expense manually."""
    conn = get_connection()
    cursor = conn.cursor()

    expense_date = expense.date or datetime.now().strftime("%Y-%m-%d")
    now = datetime.now().isoformat()

    cursor.execute(
        "INSERT INTO expenses (amount, category, description, date, created_at) VALUES (?, ?, ?, ?, ?)",
        (expense.amount, expense.category.lower(), expense.description, expense_date, now)
    )

    expense_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return ExpenseResponse(
        id=expense_id,
        amount=expense.amount,
        category=expense.category.lower(),
        description=expense.description,
        date=expense_date,
        created_at=now
    )


@router.get("/", response_model=list[ExpenseResponse])
async def list_expenses(
    category: str = None,
    limit: int = 50
):
    """List expenses with optional category filter."""
    conn = get_connection()
    cursor = conn.cursor()

    if category:
        cursor.execute(
            "SELECT * FROM expenses WHERE LOWER(category) = LOWER(?) ORDER BY date DESC LIMIT ?",
            (category, limit)
        )
    else:
        cursor.execute(
            "SELECT * FROM expenses ORDER BY date DESC LIMIT ?",
            (limit,)
        )

    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(expense_id: int):
    """Get a single expense."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    return dict(row)


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: int, expense: ExpenseCreate):
    """Update an existing expense."""
    conn = get_connection()
    cursor = conn.cursor()

    expense_date = expense.date or datetime.now().strftime("%Y-%m-%d")

    cursor.execute(
        "UPDATE expenses SET amount = ?, category = ?, description = ?, date = ? WHERE id = ?",
        (expense.amount, expense.category.lower(), expense.description, expense_date, expense_id)
    )

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")

    conn.commit()

    cursor.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)


@router.delete("/{expense_id}")
async def delete_expense(expense_id: int):
    """Delete an expense."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")

    conn.commit()
    conn.close()
    return {"message": f"Expense {expense_id} deleted"}
