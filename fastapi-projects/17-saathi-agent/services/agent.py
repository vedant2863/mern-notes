"""
The Agent — the brain that decides, calls tools, and responds.
This is the core AI agent loop: reason -> act -> observe -> repeat.
"""

import json
import google.generativeai as genai
from config import GEMINI_API_KEY, GENERATION_MODEL, SYSTEM_PROMPT, MAX_TOOL_ROUNDS
from models.tool_schemas import ALL_TOOLS
from services.tools.expenses import query_expenses, add_expense, spending_summary
from services.tools.weather import get_weather
from services.tools.currency import convert_currency
from services.tools.calculator import calculate

genai.configure(api_key=GEMINI_API_KEY)

# Map tool names to actual functions
TOOL_FUNCTIONS = {
    "query_expenses": query_expenses,
    "add_expense": add_expense,
    "spending_summary": spending_summary,
    "get_weather": get_weather,
    "convert_currency": convert_currency,
    "calculate": calculate,
}

# Build Gemini tool declarations
gemini_tools = genai.protos.Tool(
    function_declarations=[
        genai.protos.FunctionDeclaration(
            name=tool["name"],
            description=tool["description"],
            parameters=tool["parameters"]
        )
        for tool in ALL_TOOLS
    ]
)


def execute_tool(function_name: str, function_args: dict) -> str:
    """Execute a tool function and return the result as a string."""
    if function_name not in TOOL_FUNCTIONS:
        return f"Unknown tool: {function_name}"

    func = TOOL_FUNCTIONS[function_name]

    try:
        result = func(**function_args)
        return str(result)
    except Exception as e:
        return f"Tool error: {str(e)}"


async def run_agent(user_message: str, history: list[dict] = None) -> dict:
    """
    Run the agent loop:
    1. Send user message + history to Gemini
    2. If Gemini wants to call tools, execute them
    3. Send tool results back to Gemini
    4. Repeat until Gemini gives a final text response

    Returns dict with "response" and "tool_calls" used.
    """

    model = genai.GenerativeModel(
        model_name=GENERATION_MODEL,
        system_instruction=SYSTEM_PROMPT,
        tools=[gemini_tools]
    )

    # Build conversation history for Gemini
    gemini_history = []
    if history:
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})

    chat = model.start_chat(history=gemini_history)

    # Send the user message
    response = chat.send_message(user_message)

    all_tool_calls = []
    rounds = 0

    # Agent loop — keep going while there are tool calls
    while response.candidates[0].content.parts and rounds < MAX_TOOL_ROUNDS:
        parts = response.candidates[0].content.parts

        # Check if any part is a function call
        function_calls = [p for p in parts if p.function_call.name]

        if not function_calls:
            break  # No more tool calls, we have the final response

        # Execute each tool call
        tool_responses = []
        for part in function_calls:
            fn_name = part.function_call.name
            fn_args = dict(part.function_call.args) if part.function_call.args else {}

            # Log the tool call
            all_tool_calls.append({
                "tool": fn_name,
                "args": fn_args
            })

            # Execute the tool
            result = execute_tool(fn_name, fn_args)

            tool_responses.append(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=fn_name,
                        response={"result": result}
                    )
                )
            )

        # Send all tool results back to Gemini
        response = chat.send_message(tool_responses)
        rounds += 1

    # Extract the final text response
    final_text = ""
    for part in response.candidates[0].content.parts:
        if part.text:
            final_text += part.text

    if not final_text:
        final_text = "I processed your request but don't have a text response to show."

    return {
        "response": final_text,
        "tool_calls": all_tool_calls
    }


async def run_agent_streaming(user_message: str, history: list[dict] = None):
    """
    Streaming version of the agent — yields chunks as they come.
    For WebSocket usage.
    """

    # For streaming, we run the full agent loop first
    # then yield the response in chunks (simulated streaming)
    result = await run_agent(user_message, history)

    # Yield tool call notifications
    for tc in result["tool_calls"]:
        yield {
            "type": "tool_call",
            "data": f"Using tool: {tc['tool']}"
        }

    # Yield the response in chunks for smooth streaming effect
    response_text = result["response"]
    words = response_text.split(" ")
    chunk = ""

    for i, word in enumerate(words):
        chunk += word + " "
        # Send every few words
        if len(chunk) > 30 or i == len(words) - 1:
            yield {
                "type": "text",
                "data": chunk
            }
            chunk = ""

    # Signal completion
    yield {
        "type": "done",
        "data": "",
        "tool_calls": result["tool_calls"]
    }
