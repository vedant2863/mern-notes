"""
Tool definitions for Gemini function calling.
These schemas tell the AI what tools it can use and what parameters they expect.
"""

# Each tool is a dict matching Gemini's function declaration format

QUERY_EXPENSES_TOOL = {
    "name": "query_expenses",
    "description": "Search past expenses. Can filter by category and date range.",
    "parameters": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "description": "Filter by category (e.g., food, transport, entertainment)"
            },
            "start_date": {
                "type": "string",
                "description": "Start date in YYYY-MM-DD format"
            },
            "end_date": {
                "type": "string",
                "description": "End date in YYYY-MM-DD format"
            },
            "limit": {
                "type": "integer",
                "description": "Max number of results (default 20)"
            }
        },
        "required": []
    }
}

ADD_EXPENSE_TOOL = {
    "name": "add_expense",
    "description": "Record a new expense. Requires amount, category, and description.",
    "parameters": {
        "type": "object",
        "properties": {
            "amount": {
                "type": "number",
                "description": "Expense amount in INR"
            },
            "category": {
                "type": "string",
                "description": "Category (e.g., food, transport, entertainment, bills, shopping)"
            },
            "description": {
                "type": "string",
                "description": "Brief description of the expense"
            },
            "date": {
                "type": "string",
                "description": "Date in YYYY-MM-DD format (defaults to today)"
            }
        },
        "required": ["amount", "category", "description"]
    }
}

SPENDING_SUMMARY_TOOL = {
    "name": "spending_summary",
    "description": "Get a spending breakdown by category for a given period.",
    "parameters": {
        "type": "object",
        "properties": {
            "start_date": {
                "type": "string",
                "description": "Start date in YYYY-MM-DD format"
            },
            "end_date": {
                "type": "string",
                "description": "End date in YYYY-MM-DD format"
            }
        },
        "required": []
    }
}

GET_WEATHER_TOOL = {
    "name": "get_weather",
    "description": "Get current weather for a city.",
    "parameters": {
        "type": "object",
        "properties": {
            "city": {
                "type": "string",
                "description": "City name (e.g., Mumbai, Delhi, Bangalore)"
            }
        },
        "required": ["city"]
    }
}

CONVERT_CURRENCY_TOOL = {
    "name": "convert_currency",
    "description": "Convert an amount from one currency to another.",
    "parameters": {
        "type": "object",
        "properties": {
            "amount": {
                "type": "number",
                "description": "Amount to convert"
            },
            "from_currency": {
                "type": "string",
                "description": "Source currency code (e.g., USD, INR, EUR)"
            },
            "to_currency": {
                "type": "string",
                "description": "Target currency code (e.g., USD, INR, EUR)"
            }
        },
        "required": ["amount", "from_currency", "to_currency"]
    }
}

CALCULATE_TOOL = {
    "name": "calculate",
    "description": "Perform a basic math calculation.",
    "parameters": {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Math expression to evaluate (e.g., '1500 + 2300 * 0.18')"
            }
        },
        "required": ["expression"]
    }
}

# All tools in one list — this gets passed to Gemini
ALL_TOOLS = [
    QUERY_EXPENSES_TOOL,
    ADD_EXPENSE_TOOL,
    SPENDING_SUMMARY_TOOL,
    GET_WEATHER_TOOL,
    CONVERT_CURRENCY_TOOL,
    CALCULATE_TOOL,
]
