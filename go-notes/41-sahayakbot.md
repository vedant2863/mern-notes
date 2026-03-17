# Chapter 41 — SahayakBot: AI Conversational Agent
## *The Intelligent Customer Support Agent*

> **Sahayak** = Helper | **Bot** = Automated Agent. Swiggy handles 10,000+
> queries per minute. SahayakBot understands intent, calls internal tools
> (order lookup, refund, restaurant search), and maintains conversation
> memory so users never repeat themselves.

---

## Why This Chapter?

AI agents go beyond request-response: they understand intent, decide which
tools to call, execute them, and maintain memory across a conversation.

| Concern | Tool | Why |
|---|---|---|
| Routing | Chi | net/http compatible |
| Real-time | WebSocket (gorilla) | Persistent bidirectional chat |
| AI Reasoning | Gemini (simulated) | Function calling / tool use |
| Memory | Session Manager | Conversation history |
| Tools | Tool Registry | Plugin-style capabilities |

---

## Core Concepts

### 1. AI Function Calling
The AI decides which tools to call based on user intent. Our backend executes
them — the AI never has direct DB access (security).

```
User: "Where is order #12345?"
-> AI requests: check_order_status(order_id: "12345")
-> Backend executes, returns result
-> AI formats: "Your biryani is out for delivery! ETA: 12 min."
```

### 2. Tool Execution Loop
```
while tool_calls_remaining and iterations < MAX:
    response = AI.chat(messages, tools)
    if response.has_tool_calls:
        execute tools, append results
    else:
        return response.text
```
Always cap iterations to prevent infinite loops.

### 3. WebSocket for Chat
HTTP: new connection per message. WebSocket: persistent bidirectional channel.
Server can push tool execution progress.

### 4. Session Memory
Without memory: "Cancel it" -> "Cancel what?" (bad).
With memory: "Cancel it" -> "Cancelling order #12345" (good).
Context window: only last N messages sent to AI.

### 5. Tool Definitions
```json
{"name": "check_order_status", "description": "Check Swiggy order status",
 "parameters": [{"name": "order_id", "type": "string", "required": true}]}
```
Plugin architecture: add tools without changing AI logic.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | HTTP chat |
| `GET` | `/ws/chat` | WebSocket chat |
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions/{id}` | Session history |
| `GET` | `/api/tools` | List tools |
| `GET` | `/health` | Health check |

---

## Key Takeaways

1. **AI agents are loops, not single calls** — tool execution loop is the core.
2. **Tools are plugins** — registry pattern adds capabilities without AI changes.
3. **Memory is essential** — sessions turn a chatbot into a useful assistant.
4. **WebSocket fits chat** — persistent connections, no per-message overhead.
5. **Always cap iterations** — prevent infinite tool-calling loops.
6. **Simulate first, integrate later** — full pipeline without API key.

---

## Running

```bash
cd 41-sahayakbot && go run main.go          # simulated mode
GEMINI_API_KEY=your-key go run main.go      # real API

curl -X POST http://localhost:8085/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Where is my order SWG-12345?"}'
```
