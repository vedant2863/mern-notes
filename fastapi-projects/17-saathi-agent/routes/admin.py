"""
Admin routes — monitor conversations and agent activity.
"""

from fastapi import APIRouter
from services.memory import get_all_conversations, load_conversation, delete_conversation

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/conversations")
async def list_conversations():
    """List all conversations with summary info."""
    conversations = get_all_conversations()
    return {
        "total": len(conversations),
        "conversations": conversations
    }


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get full conversation history."""
    messages = load_conversation(conversation_id)
    if not messages:
        return {"error": "Conversation not found"}

    return {
        "conversation_id": conversation_id,
        "message_count": len(messages),
        "messages": messages
    }


@router.delete("/conversations/{conversation_id}")
async def remove_conversation(conversation_id: str):
    """Delete a conversation."""
    deleted = delete_conversation(conversation_id)
    if not deleted:
        return {"error": "Conversation not found"}
    return {"message": f"Conversation {conversation_id} deleted"}


@router.get("/stats")
async def get_stats():
    """Get overall agent statistics."""
    conversations = get_all_conversations()
    total_messages = sum(c.get("message_count", 0) for c in conversations)

    return {
        "total_conversations": len(conversations),
        "total_messages": total_messages,
        "active_conversations": len([
            c for c in conversations if c.get("message_count", 0) > 0
        ])
    }
