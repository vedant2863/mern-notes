"""
Calculator tool — safe basic math evaluation.
"""


def calculate(expression: str) -> str:
    """
    Evaluate a basic math expression safely.
    Only allows numbers and basic operators.
    """
    # Only allow safe characters: digits, operators, spaces, dots, parens
    allowed = set("0123456789+-*/.() ")
    if not all(c in allowed for c in expression):
        return f"Invalid expression. Only basic math is supported (numbers, +, -, *, /, parentheses)."

    try:
        result = eval(expression)
        return f"{expression} = {result}"
    except ZeroDivisionError:
        return "Error: Division by zero"
    except Exception:
        return f"Could not evaluate: {expression}"
