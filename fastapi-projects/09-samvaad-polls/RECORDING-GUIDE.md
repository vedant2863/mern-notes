# Recording Guide - Samvaad Polls

## Episode Overview
Build a live polling app with WebSocket. Start with REST, then add real-time updates.

## Estimated Duration: 35-45 minutes

---

## Step 1: models.py (5 min)
- Start here — explain the data shape for a poll
- Show PollCreate (what the client sends) vs PollResponse (what we return)
- Explain how votes are stored as a dict: {"Python": 5, "Go": 3}
- Mention VoteRequest is just one field — the option name

## Step 2: database.py (3 min)
- Set up Motor — the async MongoDB driver
- Explain why we need async: WebSocket apps handle many connections at once
- Show the polls_collection — this is our single collection

## Step 3: routes/polls.py — REST endpoints (8 min)
- POST /polls/ — create poll, initialize all vote counts to 0
- GET /polls/{id} — fetch a poll by ObjectId
- POST /polls/{id}/vote — the key endpoint
  - Validate the option exists
  - Use $inc to atomically increment the vote
  - **Important:** After updating, broadcast to WebSocket clients (preview what's coming)
- Test all three with Swagger UI

## Step 4: websocket_manager.py (7 min)
- This is the core concept — explain ConnectionManager pattern
- active_connections is a dict: poll_id -> list of WebSocket connections
- Walk through connect(), disconnect(), broadcast()
- Explain why we group by poll_id — each poll is a "room"
- Show the singleton instance at the bottom

## Step 5: routes/live.py — WebSocket endpoint (6 min)
- /ws/polls/{poll_id} — this is NOT a regular HTTP route
- Explain the websocket parameter — FastAPI handles the upgrade
- On connect: send initial poll data so the client renders immediately
- The while True loop keeps the connection alive
- On disconnect: clean up from the manager
- Go back to routes/polls.py — show how the vote endpoint calls manager.broadcast()

## Step 6: templates/poll_live.html + static/poll.js (8 min)
- Show the HTML structure briefly — focus on the JS
- poll.js: createPoll() uses fetch (REST) to create
- connectToPoll() opens a WebSocket connection
- ws.onmessage handles "initial" and "vote_update" types
- castVote() uses REST — the WebSocket broadcast updates the UI
- Key insight: REST for actions, WebSocket for live updates

## Step 7: main.py (3 min)
- Mount static files
- Include both routers (polls REST + live WebSocket)
- The home route serves the HTML template
- Run uvicorn and demo with two browser tabs

## Demo Script
1. Open browser, create a poll "Best language?" with Python, JavaScript, Go
2. Copy the poll ID
3. Open a second tab, paste the poll ID, click Join
4. Vote from tab 1 — watch tab 2 update instantly
5. Vote from tab 2 — watch tab 1 update
6. Show the WebSocket tab in browser DevTools — show the messages flowing

## Key Talking Points
- WebSocket vs HTTP polling — why WebSocket is better for real-time
- ConnectionManager is a common pattern — Discord, Slack, chat apps all use this
- REST + WebSocket in the same app is a real-world pattern
- Motor gives us async MongoDB — important when you have many concurrent connections
