"""
Expense tool functions — the agent's ability to track money.
These are the actual functions that run when the AI decides to use a tool.
"""

import sqlite3
from datetime import date, datetime


def get_connection():
    conn = sqlite3.connect("./saathi.db")
    conn.row_factory = sqlite3.Row
    return conn


def query_expenses(
    category: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 20
) -> str:
    """Search expenses with optional filters."""
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM expenses WHERE 1=1"
    params = []

    if category:
        query += " AND LOWER(category) = LOWER(?)"
        params.append(category)

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " ORDER BY date DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return "No expenses found matching your criteria."

    results = []
    total = 0
    for row in rows:
        total += row["amount"]
        results.append(
            f"- {row['date']}: {row['category']} — {row['description']} — Rs.{row['amount']:.2f}"
        )

    header = f"Found {len(rows)} expenses (Total: Rs.{total:.2f}):\n"
    return header + "\n".join(results)


def add_expense(
    amount: float,
    category: str,
    description: str,
    date: str = None
) -> str:
    """Record a new expense."""
    if date is None:
        expense_date = datetime.now().strftime("%Y-%m-%d")
    else:
        expense_date = date

    conn = get_connection()
    cursor = conn.cursor()

    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO expenses (amount, category, description, date, created_at) VALUES (?, ?, ?, ?, ?)",
        (amount, category.lower(), description, expense_date, now)
    )
    conn.commit()
    expense_id = cursor.lastrowid
    conn.close()

    return f"Expense recorded! ID: {expense_id} — Rs.{amount:.2f} for {description} ({category}) on {expense_date}"


def spending_summary(
    start_date: str = None,
    end_date: str = None
) -> str:
    """Get spending breakdown by category."""
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE 1=1"
    params = []

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " GROUP BY category ORDER BY total DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Also get grand total
    total_query = "SELECT SUM(amount) as grand_total, COUNT(*) as total_count FROM expenses WHERE 1=1"
    total_params = []
    if start_date:
        total_query += " AND date >= ?"
        total_params.append(start_date)
    if end_date:
        total_query += " AND date <= ?"
        total_params.append(end_date)

    cursor.execute(total_query, total_params)
    totals = cursor.fetchone()
    conn.close()

    if not rows:
        return "No expenses found for this period."

    period = "All time"
    if start_date and end_date:
        period = f"{start_date} to {end_date}"
    elif start_date:
        period = f"From {start_date}"
    elif end_date:
        period = f"Until {end_date}"

    lines = [f"Spending Summary ({period}):"]
    lines.append(f"Total: Rs.{totals['grand_total']:.2f} across {totals['total_count']} transactions\n")
    lines.append("By Category:")

    for row in rows:
        percentage = (row["total"] / totals["grand_total"] * 100) if totals["grand_total"] else 0
        lines.append(f"  {row['category'].title()}: Rs.{row['total']:.2f} ({row['count']} transactions, {percentage:.1f}%)")

    return "\n".join(lines)
