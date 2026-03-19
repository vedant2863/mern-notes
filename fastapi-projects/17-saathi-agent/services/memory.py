"""
Conversation memory — save and load chat history from SQLite.
This gives the agent long-term memory across page refreshes.
"""

import json
import sqlite3
from datetime import datetime
from typing import Optional


def get_connection():
    conn = sqlite3.connect("./saathi.db")
    conn.row_factory = sqlite3.Row
    return conn


def save_message(conversation_id: str, role: str, content: str, tool_calls: list = None):
    """Save a single message to a conversation."""
    conn = get_connection()
    cursor = conn.cursor()

    now = datetime.now().isoformat()
    tool_calls_json = json.dumps(tool_calls) if tool_calls else None

    # Create conversation if it doesn't exist
    cursor.execute(
        "INSERT OR IGNORE INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)",
        (conversation_id, now, now)
    )

    # Insert the message
    cursor.execute(
        "INSERT INTO messages (conversation_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?)",
        (conversation_id, role, content, tool_calls_json, now)
    )

    # Update conversation timestamp
    cursor.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (now, conversation_id)
    )

    conn.commit()
    conn.close()


def load_conversation(conversation_id: str) -> list[dict]:
    """Load all messages for a conversation."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT role, content, tool_calls FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    messages = []
    for row in rows:
        msg = {
            "role": row["role"],
            "content": row["content"]
        }
        if row["tool_calls"]:
            msg["tool_calls"] = json.loads(row["tool_calls"])
        messages.append(msg)

    return messages


def get_all_conversations() -> list[dict]:
    """Get all conversations with summary info."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            c.id,
            c.created_at,
            c.updated_at,
            COUNT(m.id) as message_count,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY c.id
        ORDER BY c.updated_at DESC
    """)

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and all its messages."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
