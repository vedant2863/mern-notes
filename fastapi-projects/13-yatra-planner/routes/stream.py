import json
import asyncio
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from datetime import date

from services.weather_service import fetch_weather
from services.currency_service import fetch_currency_rates
from services.places_service import fetch_places

router = APIRouter(prefix="/plan", tags=["Stream"])


async def plan_event_generator(
    destination: str,
    start_date: date,
    end_date: date,
    base_currency: str,
):
    """Generator that yields SSE events as each section is fetched."""

    # Event: started
    yield format_sse("status", {"message": f"Planning your trip to {destination}..."})

    # Fetch weather
    yield format_sse("status", {"message": "Fetching weather forecast..."})
    try:
        weather = await fetch_weather(destination, start_date, end_date)
        weather_data = [w.model_dump() for w in weather]
        yield format_sse("weather", {"forecast": weather_data})
    except Exception as e:
        yield format_sse("error", {"section": "weather", "detail": str(e)})

    # Fetch currency rates
    yield format_sse("status", {"message": "Checking exchange rates..."})
    try:
        rates = await fetch_currency_rates(base_currency)
        rates_data = [r.model_dump() for r in rates]
        yield format_sse("currency", {"rates": rates_data})
    except Exception as e:
        yield format_sse("error", {"section": "currency", "detail": str(e)})

    # Fetch places
    yield format_sse("status", {"message": "Finding places of interest..."})
    try:
        places = await fetch_places(destination)
        places_data = [p.model_dump() for p in places]
        yield format_sse("places", {"places": places_data})
    except Exception as e:
        yield format_sse("error", {"section": "places", "detail": str(e)})

    # Done
    yield format_sse("complete", {"message": "Your travel plan is ready!"})


def format_sse(event: str, data: dict) -> str:
    """Format data as a Server-Sent Event string."""
    json_data = json.dumps(data)
    return f"event: {event}\ndata: {json_data}\n\n"


@router.get("/stream")
async def stream_travel_plan(
    destination: str = Query(..., description="Where are you going?"),
    start_date: date = Query(..., description="Trip start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Trip end date (YYYY-MM-DD)"),
    base_currency: str = Query("INR", description="Your home currency"),
):
    """Stream a travel plan via Server-Sent Events.

    Each section (weather, currency, places) is sent as it becomes available.
    Connect with EventSource in the browser or any SSE client.
    """
    return StreamingResponse(
        plan_event_generator(destination, start_date, end_date, base_currency),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
