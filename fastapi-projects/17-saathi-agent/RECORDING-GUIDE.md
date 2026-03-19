# Saathi Agent — Recording Guide

## Episode Overview
**Duration:** ~50-60 minutes
**Theme:** Building an AI agent that can think, act, and remember
**Hook:** "ChatGPT uses tools. Gemini uses tools. Today you learn how AI agents actually work — by building one."

---

## Pre-Recording Checklist
- [ ] Gemini API key ready and working
- [ ] Python virtual environment activated
- [ ] All dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file configured
- [ ] Run `python seed_data.py` to populate demo expenses
- [ ] Verify the chat UI loads at localhost:8000
- [ ] Test one WebSocket chat message works end-to-end

---

## Recording Order

### 1. models/tool_schemas.py (5-6 min)
**Open with:** "Before an AI agent can use tools, it needs to know what tools exist. Think of this as giving the AI a menu of capabilities."

**Key points to explain:**
- Each tool is a dictionary with name, description, and parameters
- This is Gemini's function calling format — structured, not free text
- The descriptions matter — they help the AI decide WHEN to use each tool
- Parameter types and required fields guide the AI's arguments
- Walk through 2-3 tools in detail, skim the rest

**Highlight moment:** "The AI reads these descriptions to decide which tool to call. Good descriptions = smart tool choices."

---

### 2. services/tools/ — each tool file (8-10 min total)

#### expenses.py (4-5 min)
**Open with:** "These are the agent's hands — the actual functions that run when the AI decides to act."

**Key points:**
- Three functions: query, add, summary
- Each returns a formatted STRING (not dict) — the AI reads this string
- SQL queries with optional filters
- The spending_summary function calculates percentages

#### weather.py (1-2 min)
**Open with:** "Simulated weather — in production you'd call a real API."

**Key points:**
- Pre-built data for Indian cities
- Random fallback for unknown cities
- Returns a formatted string the AI can relay to the user

#### currency.py (1-2 min)
**Key points:**
- Cross-rate conversion through USD
- Simulated but realistic rates

#### calculator.py (1 min)
**Key points:**
- Safe eval with character whitelist
- Why we restrict allowed characters (security)

---

### 3. services/agent.py (8-10 min) — THE MOST IMPORTANT FILE
**Open with:** "This is the brain. The agent loop. Reason, act, observe, repeat. This is how ChatGPT works, how Gemini works, how every AI agent works."

**Key points to explain:**
- TOOL_FUNCTIONS map — connecting schema names to actual Python functions
- Building Gemini tool declarations from our schemas
- The execute_tool function — simple dispatcher
- **THE AGENT LOOP** (spend extra time here):
  - Send message to Gemini with tool definitions
  - Check if response contains function calls
  - If yes: execute each tool, collect results
  - Send results back to Gemini
  - Repeat until Gemini gives a text response (or max rounds hit)
- Why MAX_TOOL_ROUNDS exists (prevent infinite loops)
- The streaming version: run full loop, then yield chunks

**Highlight moment:** "This while loop IS the agent pattern. Send to AI, check for tool calls, execute, send results back, check again. That's it. That's how agents work."

**Draw attention to:** How function_calls are extracted from the response, and how FunctionResponse objects are sent back

---

### 4. services/memory.py (3-4 min)
**Open with:** "An agent without memory forgets you after every message. We save conversations to SQLite so Saathi remembers context."

**Key points:**
- save_message: stores each message with role, content, and any tool calls
- load_conversation: retrieves full history for a conversation ID
- get_all_conversations: admin view
- The conversation ID system (UUID-based)

---

### 5. models/expense.py + models/conversation.py (3-4 min)
**Open with:** "Quick data models — what expenses and conversations look like."

**Key points:**
- ExpenseCreate vs ExpenseResponse
- Conversation and Message models
- Tool calls stored as JSON in messages
- ConversationSummary for admin views

---

### 6. database.py (2-3 min)
**Open with:** "Three tables: expenses, conversations, messages."

**Key points:**
- Expenses table for financial data
- Conversations table for chat sessions
- Messages table with foreign key to conversations
- The tool_calls column stores JSON

---

### 7. routes/expenses.py (3-4 min)
**Open with:** "Manual expense CRUD — users can also manage expenses without the chat."

**Key points:**
- Standard CRUD (create, read, update, delete)
- Category filtering
- The agent's tool functions also write to this same table

---

### 8. routes/chat.py (6-7 min) — SECOND MOST IMPORTANT FILE
**Open with:** "This is where the magic meets the web. A WebSocket endpoint that streams agent responses in real time."

**Key points:**
- WebSocket accept and conversation ID setup
- Loading existing conversation history
- The message loop:
  - Receive user text
  - Save to memory
  - Stream agent response (tool calls, text chunks, done signal)
  - Save assistant response to memory
- Error handling with WebSocketDisconnect

**Highlight moment:** "Every message flows through this: user sends text, we run the agent loop, stream back the response, save everything. Real-time AI."

---

### 9. templates/chat.html + static/ (4-5 min)
**Open with:** "Let's give the agent a face."

**Key points (chat.html):**
- Simple structure: header, messages area, input form
- Tool indicator with spinner
- Links to static CSS and JS

**Key points (chat.js):**
- WebSocket connection with auto-reconnect
- handleMessage switches on message type (connected, tool_call, text, done)
- Text chunks append to the current message bubble
- Tool calls show the yellow indicator

**Key points (style.css):**
- Skim quickly — standard chat bubble styling
- User messages right-aligned (blue), assistant left-aligned (gray)

---

### 10. routes/admin.py (2-3 min)
**Open with:** "Monitor what the agent is doing — see all conversations, message counts, stats."

**Key points:**
- List all conversations with summaries
- View full conversation history
- Delete conversations
- Basic stats endpoint

---

### 11. seed_data.py (2 min)
**Open with:** "Demo data — realistic Indian expenses so the agent has something to query."

**Key points:**
- 30 sample expenses across 7 categories
- Date offsets from today (recent data)
- Run once before demo

---

### 12. main.py (2-3 min)
**Open with:** "Wire everything together — the final file."

**Key points:**
- Static files mount for CSS/JS
- Jinja2 templates for the chat HTML
- Three routers: expenses, chat, admin
- Root route serves the chat UI
- Database init on startup

---

## Live Demo (7-10 min)

1. **Start the server** — show it starting up
2. **Open the chat UI** at localhost:8000
3. **Try these conversations in order:**
   - "Hi, I'm Ravi" (test basic chat)
   - "I spent 450 on lunch at Haldiram's today" (watch the tool call indicator flash)
   - "How much did I spend on food this week?" (query tool + formatted response)
   - "Give me a complete spending summary" (summary tool)
   - "What's the weather in Mumbai?" (different tool)
   - "Convert 5000 rupees to dollars" (currency tool)
   - "How much is 18% GST on 2500?" (calculator tool)
4. **Open admin** — `/admin/conversations` to show conversation history
5. **Show Swagger docs** — `/docs` for the REST endpoints

## Closing Remarks
- "You just built an AI agent — the same architecture behind ChatGPT plugins, Gemini extensions, and every AI assistant"
- "The agent loop is the key: reason, act, observe, repeat"
- "This is Project 17 — the final capstone. You now know how to build real AI applications."
- "Next steps: add more tools, multi-user auth, persistent sessions, voice input"
