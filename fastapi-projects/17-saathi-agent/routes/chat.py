"""
Chat route — WebSocket endpoint for real-time agent interaction.
This is where the magic happens.
"""

import json
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.agent import run_agent_streaming
from services.memory import save_message, load_conversation

router = APIRouter(tags=["Chat"])


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket, conversation_id: str = None):
    """
    WebSocket endpoint for streaming agent chat.
    Client sends text messages, server streams back agent responses.
    """
    await websocket.accept()

    # Create or resume a conversation
    if not conversation_id:
        conversation_id = str(uuid.uuid4())[:8]

    # Load existing conversation history
    history = load_conversation(conversation_id)

    # Send the conversation ID to the client
    await websocket.send_json({
        "type": "connected",
        "conversation_id": conversation_id,
        "history_length": len(history)
    })

    try:
        while True:
            # Receive user message
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                user_text = message.get("message", data)
            except json.JSONDecodeError:
                user_text = data

            if not user_text.strip():
                continue

            # Save user message to memory
            save_message(conversation_id, "user", user_text)
            history.append({"role": "user", "content": user_text})

            # Stream the agent response
            full_response = ""
            all_tool_calls = []

            async for chunk in run_agent_streaming(user_text, history):
                if chunk["type"] == "tool_call":
                    await websocket.send_json({
                        "type": "tool_call",
                        "data": chunk["data"]
                    })

                elif chunk["type"] == "text":
                    full_response += chunk["data"]
                    await websocket.send_json({
                        "type": "text",
                        "data": chunk["data"]
                    })

                elif chunk["type"] == "done":
                    all_tool_calls = chunk.get("tool_calls", [])
                    await websocket.send_json({
                        "type": "done",
                        "data": ""
                    })

            # Save assistant response to memory
            save_message(
                conversation_id,
                "assistant",
                full_response,
                tool_calls=all_tool_calls if all_tool_calls else None
            )
            history.append({"role": "assistant", "content": full_response})

    except WebSocketDisconnect:
        pass
