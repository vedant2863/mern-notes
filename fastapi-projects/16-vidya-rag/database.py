"""
SQLite database for document metadata.
"""

import sqlite3
from datetime import datetime
from config import DATABASE_URL


def get_db_path():
    # Extract path from sqlite:///./vidya.db
    return DATABASE_URL.replace("sqlite:///", "")


def get_connection():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            chunk_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS questions_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            chunks_used INTEGER DEFAULT 0,
            asked_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def insert_document(title: str, chunk_count: int) -> int:
    """Insert a document record and return its ID."""
    conn = get_connection()
    cursor = conn.cursor()

    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO documents (title, chunk_count, created_at) VALUES (?, ?, ?)",
        (title, chunk_count, now)
    )

    doc_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return doc_id


def get_all_documents() -> list[dict]:
    """Get all documents."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_document_by_id(doc_id: int) -> dict | None:
    """Get a single document."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_document(doc_id: int) -> bool:
    """Delete a document record."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def log_question(question: str, answer: str, chunks_used: int):
    """Log a question for analytics."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO questions_log (question, answer, chunks_used, asked_at) VALUES (?, ?, ?, ?)",
        (question, answer, chunks_used, now)
    )
    conn.commit()
    conn.close()
