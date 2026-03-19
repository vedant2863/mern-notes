from fastapi import WebSocket
import json


class ConnectionManager:
    """Manages WebSocket connections grouped by poll ID."""

    def __init__(self):
        # poll_id -> list of active websocket connections
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, poll_id: str, websocket: WebSocket):
        await websocket.accept()
        if poll_id not in self.active_connections:
            self.active_connections[poll_id] = []
        self.active_connections[poll_id].append(websocket)

    def disconnect(self, poll_id: str, websocket: WebSocket):
        if poll_id in self.active_connections:
            self.active_connections[poll_id].remove(websocket)
            # Clean up empty lists
            if not self.active_connections[poll_id]:
                del self.active_connections[poll_id]

    async def broadcast(self, poll_id: str, data: dict):
        """Send vote update to all clients watching this poll."""
        if poll_id not in self.active_connections:
            return
        message = json.dumps(data)
        for connection in self.active_connections[poll_id]:
            try:
                await connection.send_text(message)
            except Exception:
                pass


# Single shared instance
manager = ConnectionManager()
