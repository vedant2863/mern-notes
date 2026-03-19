"""
Seed data — populate sample expenses for demo.
Run this before recording to have data to query.

Usage: python seed_data.py
"""

import sqlite3
from datetime import datetime, timedelta
from database import init_db


SAMPLE_EXPENSES = [
    # Food expenses
    (250, "food", "Lunch at office canteen", -1),
    (180, "food", "Evening chai and samosa", -1),
    (450, "food", "Dinner at Sharma ji dhaba", -2),
    (120, "food", "Morning breakfast — poha", -2),
    (800, "food", "Weekend biryani party", -3),
    (350, "food", "Grocery — vegetables and dal", -4),
    (1200, "food", "Monthly grocery from BigBasket", -5),
    (90, "food", "Cutting chai x3", -6),

    # Transport
    (150, "transport", "Auto to office", -1),
    (250, "transport", "Uber to meeting", -2),
    (500, "transport", "Metro monthly pass top-up", -3),
    (180, "transport", "Auto from station", -5),
    (2500, "transport", "Petrol for bike", -7),

    # Entertainment
    (600, "entertainment", "Movie tickets — Pushpa 3", -2),
    (299, "entertainment", "Netflix monthly subscription", -5),
    (150, "entertainment", "Books from roadside stall", -8),
    (499, "entertainment", "Spotify premium", -10),

    # Bills
    (1500, "bills", "Electricity bill — March", -3),
    (799, "bills", "Mobile recharge — Jio", -5),
    (500, "bills", "Internet bill — Airtel fiber", -6),
    (2000, "bills", "Society maintenance", -8),

    # Shopping
    (1999, "shopping", "New kurta for Holi", -4),
    (599, "shopping", "Phone cover from Amazon", -6),
    (3500, "shopping", "Running shoes — Decathlon", -9),

    # Health
    (500, "health", "Gym monthly — March", -1),
    (1200, "health", "Doctor visit — cold and cough", -7),
    (350, "health", "Medicines from Apollo pharmacy", -7),

    # Education
    (4999, "education", "Udemy course — FastAPI masterclass", -10),
    (200, "education", "Notebook and pens", -12),
]


def seed():
    """Insert sample expenses into the database."""
    init_db()

    conn = sqlite3.connect("./saathi.db")
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute("DELETE FROM expenses")

    today = datetime.now()

    for amount, category, description, days_ago in SAMPLE_EXPENSES:
        expense_date = (today + timedelta(days=days_ago)).strftime("%Y-%m-%d")
        created_at = (today + timedelta(days=days_ago)).isoformat()

        cursor.execute(
            "INSERT INTO expenses (amount, category, description, date, created_at) VALUES (?, ?, ?, ?, ?)",
            (amount, category, description, expense_date, created_at)
        )

    conn.commit()
    conn.close()

    print(f"Seeded {len(SAMPLE_EXPENSES)} sample expenses!")
    print("Categories: food, transport, entertainment, bills, shopping, health, education")
    print("Date range: last 12 days")


if __name__ == "__main__":
    seed()
