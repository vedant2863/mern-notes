import httpx
import asyncio
import random
from datetime import date, timedelta

from models import WeatherInfo
from services.cache import get_from_cache, set_in_cache
from config import WEATHER_API_KEY, CACHE_TTL_SECONDS


# Simulated weather data for demos
WEATHER_CONDITIONS = [
    "Sunny", "Partly Cloudy", "Cloudy",
    "Light Rain", "Thunderstorm", "Clear Sky",
]

DESTINATION_TEMPS = {
    "goa": {"high": 33, "low": 25, "humidity": 75},
    "manali": {"high": 18, "low": 5, "humidity": 40},
    "jaipur": {"high": 38, "low": 24, "humidity": 30},
    "mumbai": {"high": 34, "low": 26, "humidity": 80},
    "delhi": {"high": 36, "low": 22, "humidity": 45},
    "kerala": {"high": 31, "low": 24, "humidity": 85},
}


def _get_simulated_weather(destination: str, start: date, end: date) -> list[WeatherInfo]:
    """Generate realistic-looking weather data for any destination."""
    dest_key = destination.lower()
    base = DESTINATION_TEMPS.get(dest_key, {"high": 30, "low": 20, "humidity": 50})

    forecasts = []
    current = start

    while current <= end:
        # Add small random variations
        high = base["high"] + random.uniform(-3, 3)
        low = base["low"] + random.uniform(-2, 2)

        forecast = WeatherInfo(
            date=current.isoformat(),
            condition=random.choice(WEATHER_CONDITIONS),
            temperature_high=round(high, 1),
            temperature_low=round(low, 1),
            humidity=base["humidity"] + random.randint(-10, 10),
            rain_chance=random.randint(0, 60),
        )
        forecasts.append(forecast)
        current += timedelta(days=1)

    return forecasts


async def fetch_weather(
    destination: str, start_date: date, end_date: date
) -> list[WeatherInfo]:
    """Fetch weather forecast. Uses cache, falls back to simulated data."""
    cache_key = f"weather:{destination}:{start_date}:{end_date}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    # Simulate network delay
    await asyncio.sleep(random.uniform(0.5, 1.5))

    if WEATHER_API_KEY:
        # Real API call with httpx (example with weatherapi.com)
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://api.weatherapi.com/v1/forecast.json",
                    params={
                        "key": WEATHER_API_KEY,
                        "q": destination,
                        "days": (end_date - start_date).days + 1,
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

                forecasts = []
                for day in data.get("forecast", {}).get("forecastday", []):
                    forecasts.append(
                        WeatherInfo(
                            date=day["date"],
                            condition=day["day"]["condition"]["text"],
                            temperature_high=day["day"]["maxtemp_c"],
                            temperature_low=day["day"]["mintemp_c"],
                            humidity=day["day"]["avghumidity"],
                            rain_chance=day["day"].get("daily_chance_of_rain", 0),
                        )
                    )

                set_in_cache(cache_key, forecasts, CACHE_TTL_SECONDS)
                return forecasts

            except httpx.HTTPError:
                pass  # Fall through to simulated data

    # Use simulated data
    forecasts = _get_simulated_weather(destination, start_date, end_date)
    set_in_cache(cache_key, forecasts, CACHE_TTL_SECONDS)
    return forecasts
