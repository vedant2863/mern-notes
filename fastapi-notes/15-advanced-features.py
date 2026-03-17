"""
============================================================
FILE 15: BACKGROUND TASKS, WEBSOCKETS, TESTING, AND DEPLOYMENT
============================================================
Topics: BackgroundTasks, WebSocket, ConnectionManager, SSE,
        TestClient, dependency overrides, Alembic, Docker

WHY THIS MATTERS:
Shipping an API is more than writing endpoints. You need
background jobs (emails, notifications), real-time features
(WebSockets), automated tests (CI/CD), and deployment config
(Docker). This file covers the "last mile" to production.
============================================================
"""

# STORY: Hotstar (JioCinema) — Live Cricket Push to 50M Users
# During IPL, JioCinema served 50M+ concurrent viewers — a world
# record. Every six, wicket, and boundary triggers push notifications
# to millions. This requires background tasks (send without blocking),
# WebSockets (real-time score updates), and rock-solid deployment
# (zero downtime during India vs Pakistan).

from datetime import datetime, timezone
import asyncio
import json

from fastapi import (
    FastAPI, BackgroundTasks, WebSocket, WebSocketDisconnect,
    Depends, HTTPException, Query
)
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.testclient import TestClient

# ════════════════════════════════════════════════════════════
# SECTION 1 — Background Tasks
# ════════════════════════════════════════════════════════════

# WHY: When a wicket falls, you need to send push notifications
# to millions. This should NOT block the API response. Background
# tasks run AFTER the response is sent.

app = FastAPI(title="Hotstar/JioCinema API", version="1.0.0")


def write_log(message: str):
    """Background task — runs after response is sent, in a thread pool."""
    timestamp = datetime.now(timezone.utc).isoformat()
    with open("/tmp/hotstar_api.log", "a") as f:
        f.write(f"[{timestamp}] {message}\n")


def send_notification(user_id: int, title: str, body: str):
    """
    In production: call Firebase Cloud Messaging or Apple Push
    Notification Service. Here we just log it.
    """
    write_log(f"Notification to user {user_id}: {title} — {body}")


@app.post("/matches/{match_id}/events")
def record_match_event(
    match_id: int,
    event_type: str = Query(..., enum=["six", "four", "wicket", "century"]),
    player: str = Query(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Record a cricket event. Returns immediately, then:
    1. Sends push notifications in background
    2. Logs the event in background
    """
    background_tasks.add_task(send_notification, 0, f"{event_type.upper()}!",
                              f"{player} hits a {event_type}!")
    background_tasks.add_task(write_log, f"Event: {player} - {event_type}")

    return {"status": "event_recorded", "match_id": match_id,
            "event": event_type, "player": player}


# ════════════════════════════════════════════════════════════
# SECTION 2 — WebSocket Basics
# ════════════════════════════════════════════════════════════

# WHY: HTTP is request-response. WebSockets are bidirectional —
# the server can PUSH data at any time. Essential for live scores,
# chat, and real-time dashboards.

@app.websocket("/ws/echo")
async def websocket_echo(websocket: WebSocket):
    """Echo WebSocket — sends back whatever it receives."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        pass


# ════════════════════════════════════════════════════════════
# SECTION 3 — Broadcasting to Multiple Clients
# ════════════════════════════════════════════════════════════

# WHY: When Kohli hits a six, ALL connected clients need the
# update. ConnectionManager tracks active WebSocket connections
# per match and broadcasts to all of them.

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, match_id: int):
        await websocket.accept()
        self.active_connections.setdefault(match_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, match_id: int):
        if match_id in self.active_connections:
            self.active_connections[match_id].remove(websocket)
            if not self.active_connections[match_id]:
                del self.active_connections[match_id]

    async def broadcast(self, match_id: int, message: dict):
        disconnected = []
        for conn in self.active_connections.get(match_id, []):
            try:
                await conn.send_json(message)
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            self.active_connections[match_id].remove(conn)

    def viewer_count(self, match_id: int) -> int:
        return len(self.active_connections.get(match_id, []))


manager = ConnectionManager()


@app.websocket("/ws/live/{match_id}")
async def websocket_live(websocket: WebSocket, match_id: int):
    """Live match WebSocket — broadcasts score updates to all viewers."""
    await manager.connect(websocket, match_id)
    try:
        await manager.broadcast(match_id, {
            "type": "viewer_count", "count": manager.viewer_count(match_id)})
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "score_update":
                await manager.broadcast(match_id, {
                    "type": "score_update", "score": data.get("score"),
                    "overs": data.get("overs"),
                    "timestamp": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)
        await manager.broadcast(match_id, {
            "type": "viewer_count", "count": manager.viewer_count(match_id)})


# ════════════════════════════════════════════════════════════
# SECTION 4 — Server-Sent Events (SSE)
# ════════════════════════════════════════════════════════════

# WHY: SSE is simpler than WebSockets — server pushes, client
# listens. Works with regular HTTP. Perfect for live scores
# and notification feeds.

async def score_event_generator(match_id: int):
    scores = [
        {"score": "0/0", "overs": "0.0", "event": "Match started"},
        {"score": "18/0", "overs": "1.4", "event": "FOUR! Cover drive"},
        {"score": "24/1", "overs": "2.1", "event": "WICKET! Caught behind"},
    ]
    for s in scores:
        yield f"data: {json.dumps(s)}\n\n"
        await asyncio.sleep(1)


@app.get("/sse/score/{match_id}")
async def sse_live_score(match_id: int):
    """
    SSE endpoint. Client uses:
      const source = new EventSource('/sse/score/1');
      source.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    return StreamingResponse(score_event_generator(match_id),
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


# ════════════════════════════════════════════════════════════
# SECTION 5 — Testing with TestClient
# ════════════════════════════════════════════════════════════

# WHY: Without tests, every code change risks breaking features.
# FastAPI's TestClient makes it easy — no server required.

test_app = FastAPI()

@test_app.get("/matches/{match_id}")
def test_get_match(match_id: int):
    if match_id == 999:
        raise HTTPException(status_code=404, detail="Match not found")
    return {"match_id": match_id, "team1": "India", "team2": "Pakistan"}


def run_tests():
    """In a real project, use pytest: pytest tests/"""
    client = TestClient(test_app)

    # Test: successful fetch
    r = client.get("/matches/42")
    assert r.status_code == 200 and r.json()["match_id"] == 42

    # Test: 404
    r = client.get("/matches/999")
    assert r.status_code == 404

    # Test: WebSocket echo
    ws_client = TestClient(app)
    with ws_client.websocket_connect("/ws/echo") as ws:
        ws.send_text("Hello!")
        assert ws.receive_text() == "Echo: Hello!"

    print("All tests passed!")


# --- Dependency Overrides: swap real deps for fakes in tests ---
#
# def fake_viewer():
#     return {"viewer_id": 999, "plan": "free"}
# app.dependency_overrides[get_current_viewer] = fake_viewer
# client = TestClient(app)
# ... run tests ...
# app.dependency_overrides.clear()


# ════════════════════════════════════════════════════════════
# SECTION 6 — Alembic, Docker, and Deployment
# ════════════════════════════════════════════════════════════

# --- Alembic: database migrations without data loss ---
# pip install alembic && alembic init alembic
# alembic revision --autogenerate -m "add reviews table"
# alembic upgrade head       # apply pending migrations
# alembic downgrade -1       # rollback one migration

# --- Dockerfile ---
# FROM python:3.11-slim
# WORKDIR /app
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt
# COPY . .
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# --- docker-compose.yml ---
# services:
#   api:
#     build: .
#     ports: ["8000:8000"]
#     depends_on: [db, redis]
#   db:
#     image: postgres:15-alpine
#   redis:
#     image: redis:7-alpine

# --- Production Checklist ---
# SECURITY: HTTPS, CORS with specific origins, strong JWT secret,
#           bcrypt passwords, rate limiting, input validation
# PERFORMANCE: DB connection pooling, GZip, pagination, background tasks
# RELIABILITY: /health endpoint, structured logging, Sentry,
#              Alembic migrations, CI/CD tests, Docker

# --- Deployment Options ---
# Railway, Render, AWS EC2+RDS, Google Cloud Run, DigitalOcean

# --- Production command ---
# gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. BackgroundTasks run AFTER the response — use for notifications, logs
# 2. WebSockets enable bidirectional real-time communication
# 3. ConnectionManager pattern broadcasts to multiple clients
# 4. SSE is simpler than WebSockets for server-to-client push
# 5. TestClient lets you test endpoints without running the server
# 6. dependency_overrides swaps real deps for fakes in tests
# 7. Alembic manages schema changes without data loss
# 8. Docker + docker-compose gives reproducible deployments
# "First, solve the problem. Then, write the code." — John Johnson
