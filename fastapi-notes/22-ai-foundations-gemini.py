"""
============================================================
FILE 22: AI FOUNDATIONS WITH GOOGLE GEMINI AND FASTAPI
============================================================
Topics: AI + FastAPI, Google Gemini API, text generation,
        multi-turn chat, streaming responses, structured JSON
        output, prompt engineering, error handling

WHY THIS MATTERS:
AI is no longer a research curiosity — it is the core feature
of modern SaaS products. FastAPI's async nature makes it the
perfect framework for AI inference endpoints that call
external LLM APIs like Google Gemini.
============================================================
"""

# STORY: Freshworks — India's SaaS Unicorn Saves ₹50Cr/Year
# Freshworks (Chennai, NASDAQ-listed) integrated Google Gemini
# into Freshdesk to auto-resolve 40% of customer support tickets.
# Their AI reads the ticket, understands intent, searches the
# knowledge base, and drafts a response — all via FastAPI
# microservices. This saved ₹50Cr/year in support costs and
# reduced average resolution time from 4 hours to 8 minutes.

import os
import json
import hashlib
import asyncio
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


# ════════════════════════════════════════════════════════════
# SECTION 1 — Why AI + FastAPI?
# ════════════════════════════════════════════════════════════

# WHY: FastAPI is async-first. When your endpoint calls Gemini,
# the request waits 1-5 seconds for the AI response. With Flask
# (sync), that blocks the entire worker. With FastAPI (async),
# other requests are served while waiting — 10x more concurrent
# users on the same hardware.


# ════════════════════════════════════════════════════════════
# SECTION 2 — Google Gemini API Setup
# ════════════════════════════════════════════════════════════

# WHY: Google Gemini is free for developers (up to 60 RPM).
# Unlike OpenAI, you do not need a credit card.

# SETUP: 1) Visit https://aistudio.google.com/app/apikey
# 2) Create API Key (free) 3) export GEMINI_API_KEY="your-key"
# 4) pip install google-generativeai

# PRODUCTION:
# import google.generativeai as genai
# genai.configure(api_key=os.environ["GEMINI_API_KEY"])
# model = genai.GenerativeModel("gemini-1.5-flash")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


# ════════════════════════════════════════════════════════════
# SECTION 3 — Pydantic Models for Request/Response
# ════════════════════════════════════════════════════════════

# WHY: AI endpoints need well-defined contracts. Pydantic
# validates both sides — crucial when AI output is parsed
# downstream by other services.

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=10000)
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="0=deterministic, 2=creative")
    max_output_tokens: int = Field(1024, ge=1, le=8192)

class GenerateResponse(BaseModel):
    text: str
    model: str
    total_tokens: int
    cached: bool = False

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    session_id: str = Field(..., min_length=1, max_length=100)
    system_instruction: Optional[str] = None

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|model)$")
    content: str

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    turn_count: int

class AnalysisResult(BaseModel):
    sentiment: Optional[str] = None
    confidence: Optional[float] = None
    summary: Optional[str] = None


# ════════════════════════════════════════════════════════════
# SECTION 4 — FastAPI App, Caching, and Safety
# ════════════════════════════════════════════════════════════

# WHY: The app needs in-memory stores for chat sessions and
# response caching. Caching avoids re-calling Gemini for
# identical prompts — saves quota and reduces latency.

app = FastAPI(
    title="Freshworks AI API — Gemini-Powered Support",
    description="AI-powered API using Google Gemini for text generation, chat, and analysis.",
    version="1.0.0",
)

chat_sessions: Dict[str, Dict[str, Any]] = {}   # session_id -> {history, created_at}
response_cache: Dict[str, Dict[str, Any]] = {}  # prompt_hash -> {response, timestamp}
CACHE_TTL_SECONDS = 300  # 5 minutes

def get_cache_key(prompt: str, temperature: float) -> str:
    return hashlib.sha256(f"{prompt}:{temperature}".encode()).hexdigest()

def get_cached_response(cache_key: str) -> Optional[Dict]:
    if cache_key in response_cache:
        cached = response_cache[cache_key]
        if time.time() - cached["timestamp"] < CACHE_TTL_SECONDS:
            return cached["response"]
        del response_cache[cache_key]
    return None

# --- Safety Settings ---
# WHY: AI can generate harmful content. Configure filters per use case.
# PRODUCTION: from google.generativeai.types import HarmCategory, HarmBlockThreshold
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]


# ════════════════════════════════════════════════════════════
# SECTION 5 — Prompt Engineering Helpers
# ════════════════════════════════════════════════════════════

# WHY: Raw prompts give mediocre results. Engineered prompts
# give 10x better output. Freshworks improved resolution
# accuracy from 25% to 40% with proper prompt engineering.

def build_few_shot_prompt(task: str, examples: List[Dict[str, str]], query: str) -> str:
    """Few-shot: provide examples so the model learns the expected format."""
    prompt = f"Task: {task}\n\nExamples:\n"
    for i, ex in enumerate(examples, 1):
        prompt += f"\nExample {i}:\nInput: {ex['input']}\nOutput: {ex['output']}\n"
    prompt += f"\nNow process this:\nInput: {query}\nOutput:"
    return prompt

def build_chain_of_thought_prompt(question: str) -> str:
    """Chain-of-thought: step-by-step reasoning improves accuracy 20-30%."""
    return (
        f"Question: {question}\n\nThink step by step:\n"
        "Step 1: Identify key information\nStep 2: Break down the problem\n"
        "Step 3: Reason through each part\nStep 4: Final answer\n\n"
        "Show your reasoning, then give the final answer."
    )


# ════════════════════════════════════════════════════════════
# SECTION 6 — Error Handling with Retry
# ════════════════════════════════════════════════════════════

# WHY: AI APIs fail often — rate limits, timeouts, safety blocks.
# Implement retry with exponential backoff: 1s, 2s, 4s.

MAX_RETRIES = 3

async def call_gemini_with_retry(prompt: str, stream=False):
    """
    Call Gemini with automatic retry on transient failures.
    PRODUCTION:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt, stream=stream)
    """
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            # PRODUCTION: return model.generate_content(prompt, stream=stream)
            raise NotImplementedError("Set GEMINI_API_KEY and use real SDK")
        except NotImplementedError:
            raise HTTPException(status_code=501, detail="Configure Gemini SDK for real responses")
        except Exception as e:
            last_error = e
            msg = str(e).lower()
            if "quota" in msg or "403" in msg:
                raise HTTPException(status_code=429, detail="Gemini quota exhausted.")
            if "safety" in msg or "blocked" in msg:
                raise HTTPException(status_code=400, detail="Content blocked by safety filters.")
            if any(k in msg for k in ["429", "rate", "timeout", "connection"]):
                await asyncio.sleep(1.0 * (2 ** attempt))  # Exponential backoff
                continue
            raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")
    raise HTTPException(status_code=503, detail=f"Gemini unavailable after {MAX_RETRIES} retries")


# ════════════════════════════════════════════════════════════
# SECTION 7 — POST /generate (Basic Text Generation)
# ════════════════════════════════════════════════════════════

# WHY: The simplest AI endpoint — send a prompt, get text back.
# Every AI product starts here.

@app.post("/generate", response_model=GenerateResponse)
async def generate_text(request: GenerateRequest):
    """
    Generate text using Google Gemini with caching and retry.
    PRODUCTION: Use genai.GenerativeModel with GenerationConfig.
    """
    cache_key = get_cache_key(request.prompt, request.temperature)
    cached = get_cached_response(cache_key)
    if cached:
        cached["cached"] = True
        return cached

    # PRODUCTION:
    # config = genai.GenerationConfig(temperature=request.temperature,
    #                                  max_output_tokens=request.max_output_tokens)
    # model = genai.GenerativeModel("gemini-1.5-flash", generation_config=config)
    # response = model.generate_content(request.prompt)
    # result = {"text": response.text, "model": "gemini-1.5-flash",
    #           "total_tokens": response.usage_metadata.total_token_count, "cached": False}

    response = await call_gemini_with_retry(request.prompt)
    return response  # Unreachable with stub — see PRODUCTION comments above


# ════════════════════════════════════════════════════════════
# SECTION 8 — POST /chat (Multi-Turn Conversation)
# ════════════════════════════════════════════════════════════

# WHY: Real AI products are conversational. A support chatbot
# needs to remember that the user shared their order number
# 3 messages ago. Gemini's chat API maintains context.

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Multi-turn chat with session management.
    PRODUCTION: model.start_chat(history=[]) then chat.send_message(msg)
    """
    sid = request.session_id
    if sid not in chat_sessions:
        # PRODUCTION:
        # model = genai.GenerativeModel("gemini-1.5-flash",
        #     system_instruction=request.system_instruction or "You are a helpful support agent.")
        # chat_obj = model.start_chat(history=[])
        chat_sessions[sid] = {"history": [], "created_at": datetime.now(timezone.utc).isoformat()}

    history = chat_sessions[sid]["history"]
    history.append({"role": "user", "content": request.message})

    # PRODUCTION: reply = chat_obj.send_message(request.message).text
    reply = f"[Configure Gemini SDK] Received: {request.message[:60]}"
    history.append({"role": "model", "content": reply})

    return ChatResponse(reply=reply, session_id=sid, turn_count=len(history) // 2)


# ════════════════════════════════════════════════════════════
# SECTION 9 — GET /stream (SSE Streaming Response)
# ════════════════════════════════════════════════════════════

# WHY: Waiting 5 seconds for a complete response feels slow.
# Streaming tokens as they generate (like ChatGPT) feels instant.
# SSE format: data: {"token": "Hello"}\n\n

async def gemini_stream_generator(prompt: str):
    """Async generator yielding SSE-formatted chunks from Gemini."""
    try:
        # PRODUCTION:
        # response = model.generate_content(prompt, stream=True)
        # for chunk in response:
        #     data = json.dumps({"token": chunk.text, "done": False})
        #     yield f"data: {data}\n\n"
        yield f"data: {json.dumps({'token': '[Configure Gemini SDK for streaming]', 'done': True})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

@app.get("/stream")
async def stream_response(prompt: str = Query(..., min_length=1, max_length=5000)):
    """
    Stream AI response via Server-Sent Events.
    JS: const es = new EventSource("/stream?prompt=Hello");
        es.onmessage = (e) => { const d = JSON.parse(e.data); ... };
    """
    return StreamingResponse(
        gemini_stream_generator(prompt),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


# ════════════════════════════════════════════════════════════
# SECTION 10 — POST /analyze (Structured JSON Output)
# ════════════════════════════════════════════════════════════

# WHY: Raw AI text is hard to use programmatically. Instruct
# Gemini to return JSON, then parse with Pydantic. Freshworks
# extracts sentiment, urgency, and category from every ticket.

@app.post("/analyze", response_model=AnalysisResult)
async def analyze_text(text: str = Query(..., min_length=10, max_length=20000)):
    """Extract structured information from text. Parses Gemini JSON output with Pydantic."""
    prompt = (
        "Analyze the text and return JSON with: sentiment (positive/negative/neutral), "
        "confidence (0.0-1.0), summary (1-2 sentences). Return ONLY valid JSON.\n\n"
        f"Text: {text}"
    )
    # PRODUCTION:
    # response = model.generate_content(prompt)
    # raw = response.text.strip()
    # if raw.startswith("```"):  # Remove markdown code blocks
    #     raw = "\n".join(raw.split("\n")[1:-1])
    # parsed = json.loads(raw)
    # return AnalysisResult(**parsed)

    return AnalysisResult(sentiment="unknown", confidence=0.0,
                          summary="[Configure Gemini SDK for real analysis]")


# ════════════════════════════════════════════════════════════
# SECTION 11 — Generation Config Reference
# ════════════════════════════════════════════════════════════

# TEMPERATURE (0.0-2.0): 0=deterministic (facts), 0.7=balanced, 1.5+=creative
# TOP_P (0.0-1.0): nucleus sampling. 0.1=focused, 0.95=broad (default)
# TOP_K (1-100): consider top K tokens. 1=greedy, 40=default
# MAX_OUTPUT_TOKENS: 1024 tokens ~ 750 words, 8192 ~ 6000 words

# Recommended presets:
#   Factual QA:    temperature=0.1, top_p=0.8,  max_output_tokens=512
#   Support Reply: temperature=0.5, top_p=0.9,  max_output_tokens=1024
#   Creative Copy: temperature=1.2, top_p=0.95, max_output_tokens=4096
#   Code Gen:      temperature=0.2, top_p=0.8,  max_output_tokens=2048
#   JSON Extract:  temperature=0.0, top_p=1.0,  max_output_tokens=1024


# ════════════════════════════════════════════════════════════
# SECTION 12 — Utility Endpoints
# ════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Health check for load balancers and monitoring."""
    return {"status": "healthy", "model": "gemini-1.5-flash",
            "api_key_set": bool(GEMINI_API_KEY),
            "active_sessions": len(chat_sessions),
            "cached_responses": len(response_cache)}

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session and free memory."""
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    del chat_sessions[session_id]
    return {"message": f"Session {session_id} deleted"}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. FastAPI's async nature makes it ideal for AI endpoints — non-blocking API calls
# 2. Google Gemini is free (60 RPM) — no credit card needed, perfect for Indian devs
# 3. Always cache AI responses — same prompt + params = same response, save quota
# 4. Streaming (SSE) makes AI feel instant — users see tokens as they generate
# 5. Structured JSON output turns raw AI text into usable data for your app
# 6. Temperature controls creativity: 0.0 for facts, 0.7 for balance, 1.5 for creativity
# 7. Few-shot prompting (give examples) beats lengthy instructions every time
# 8. Always implement retry with exponential backoff — AI APIs are unreliable
# "The best AI feature is the one users don't notice — it just works." — Girish Mathrubootham, Freshworks CEO
