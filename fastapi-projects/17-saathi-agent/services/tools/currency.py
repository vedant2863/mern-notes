"""
Currency conversion tool — simulated exchange rates.
In production, this would call a real forex API.
"""

# Simulated exchange rates (base: USD)
RATES_TO_USD = {
    "USD": 1.0,
    "INR": 83.5,
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 149.5,
    "AED": 3.67,
    "CAD": 1.36,
    "AUD": 1.53,
    "SGD": 1.34,
    "CHF": 0.88,
}


def convert_currency(
    amount: float,
    from_currency: str,
    to_currency: str
) -> str:
    """Convert between currencies using simulated rates."""
    from_code = from_currency.upper().strip()
    to_code = to_currency.upper().strip()

    if from_code not in RATES_TO_USD:
        return f"Unknown currency: {from_code}. Supported: {', '.join(RATES_TO_USD.keys())}"

    if to_code not in RATES_TO_USD:
        return f"Unknown currency: {to_code}. Supported: {', '.join(RATES_TO_USD.keys())}"

    # Convert: from_currency -> USD -> to_currency
    amount_in_usd = amount / RATES_TO_USD[from_code]
    result = amount_in_usd * RATES_TO_USD[to_code]

    rate = result / amount if amount != 0 else 0

    return (
        f"{amount:.2f} {from_code} = {result:.2f} {to_code}\n"
        f"Rate: 1 {from_code} = {rate:.4f} {to_code}\n"
        f"(Simulated rates — not real-time)"
    )
