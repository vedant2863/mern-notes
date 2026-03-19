"""
Conversation models — how we track chat history.
"""

from pydantic import BaseModel
from typing import Optional


class Message(BaseModel):
    role: str  # "user", "assistant", or "tool"
    content: str
    tool_calls: Optional[list[dict]] = None


class Conversation(BaseModel):
    id: str
    messages: list[Message]
    created_at: str
    updated_at: str


class ConversationSummary(BaseModel):
    id: str
    message_count: int
    created_at: str
    updated_at: str
    last_message: str
