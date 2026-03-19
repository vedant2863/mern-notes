import httpx
import asyncio
import random
from datetime import datetime

from models import CurrencyRate
from services.cache import get_from_cache, set_in_cache
from config import CURRENCY_API_KEY, CACHE_TTL_SECONDS


# Simulated exchange rates (base: INR)
SIMULATED_RATES = {
    "INR": {
        "USD": 0.012,
        "EUR": 0.011,
        "GBP": 0.0095,
        "THB": 0.42,
        "LKR": 3.85,
        "MYR": 0.055,
    },
    "USD": {
        "INR": 83.50,
        "EUR": 0.92,
        "GBP": 0.79,
        "THB": 35.20,
    },
}

# Common travel currencies to show
TRAVEL_CURRENCIES = ["USD", "EUR", "GBP", "THB"]


async def fetch_currency_rates(base_currency: str) -> list[CurrencyRate]:
    """Fetch exchange rates for common travel currencies."""
    cache_key = f"currency:{base_currency}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    # Simulate network delay
    await asyncio.sleep(random.uniform(0.3, 1.0))

    if CURRENCY_API_KEY:
        # Real API call (example with exchangerate-api.com)
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://v6.exchangerate-api.com/v6/{CURRENCY_API_KEY}/latest/{base_currency}",
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

                rates = []
                for target in TRAVEL_CURRENCIES:
                    if target == base_currency:
                        continue
                    rate_value = data["conversion_rates"].get(target, 0)
                    rates.append(
                        CurrencyRate(
                            base=base_currency,
                            target=target,
                            rate=round(rate_value, 4),
                            last_updated=datetime.now().isoformat(),
                        )
                    )

                set_in_cache(cache_key, rates, CACHE_TTL_SECONDS)
                return rates

            except httpx.HTTPError:
                pass  # Fall through to simulated data

    # Use simulated data
    base_rates = SIMULATED_RATES.get(base_currency, SIMULATED_RATES["INR"])
    now = datetime.now().isoformat()

    rates = []
    for target in TRAVEL_CURRENCIES:
        if target == base_currency:
            continue

        base_rate = base_rates.get(target, 1.0)
        # Add small random fluctuation
        fluctuation = base_rate * random.uniform(-0.02, 0.02)

        rates.append(
            CurrencyRate(
                base=base_currency,
                target=target,
                rate=round(base_rate + fluctuation, 4),
                last_updated=now,
            )
        )

    set_in_cache(cache_key, rates, CACHE_TTL_SECONDS)
    return rates
