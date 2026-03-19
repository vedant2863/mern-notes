from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from bson import ObjectId

from database import polls_collection
from websocket_manager import manager

router = APIRouter(tags=["live"])


@router.websocket("/ws/polls/{poll_id}")
async def poll_websocket(websocket: WebSocket, poll_id: str):
    """WebSocket endpoint for live poll updates."""

    # Verify poll exists before accepting connection
    poll = await polls_collection.find_one({"_id": ObjectId(poll_id)})
    if not poll:
        await websocket.close(code=4004)
        return

    await manager.connect(poll_id, websocket)

    try:
        # Send current votes on connect
        await websocket.send_json({
            "type": "initial",
            "question": poll["question"],
            "options": poll["options"],
            "votes": poll["votes"],
        })

        # Keep connection alive — listen for client messages
        while True:
            data = await websocket.receive_text()
            # Client can send ping to keep alive
            if data == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(poll_id, websocket)
