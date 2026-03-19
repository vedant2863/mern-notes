import asyncio
from fastapi import APIRouter, HTTPException

from models import TravelRequest, TravelPlan
from services.weather_service import fetch_weather
from services.currency_service import fetch_currency_rates
from services.places_service import fetch_places
from services.cache import get_cache_stats, clear_cache

router = APIRouter(prefix="/plan", tags=["Travel Planner"])


TRAVEL_TIPS = {
    "goa": "Best time to visit is November to February. Carry sunscreen!",
    "manali": "Pack warm layers even in summer. Roads can be tricky in monsoon.",
    "jaipur": "Wear comfortable shoes for fort visits. Bargain at local markets.",
    "mumbai": "Carry an umbrella during monsoon season (June-September).",
    "delhi": "Visit monuments early morning to avoid crowds and heat.",
}


@router.post("/", response_model=TravelPlan)
async def create_travel_plan(request: TravelRequest):
    """Aggregate weather, currency, and places data into a single travel plan."""

    if request.end_date < request.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    trip_days = (request.end_date - request.start_date).days
    if trip_days > 14:
        raise HTTPException(status_code=400, detail="Trip cannot exceed 14 days")

    # Fetch all data concurrently using asyncio.gather
    weather_result, currency_result, places_result = await asyncio.gather(
        fetch_weather(request.destination, request.start_date, request.end_date),
        fetch_currency_rates(request.base_currency),
        fetch_places(request.destination),
    )

    # Pick a travel tip
    dest_key = request.destination.lower()
    tip = TRAVEL_TIPS.get(dest_key, "Have a wonderful trip! Check local customs.")

    plan = TravelPlan(
        destination=request.destination,
        start_date=request.start_date.isoformat(),
        end_date=request.end_date.isoformat(),
        weather_forecast=weather_result,
        currency_rates=currency_result,
        places_of_interest=places_result,
        travel_tip=tip,
    )

    return plan


@router.get("/cache-stats")
async def cache_stats():
    """Check what's cached right now."""
    return get_cache_stats()


@router.delete("/cache")
async def flush_cache():
    """Clear all cached data."""
    clear_cache()
    return {"message": "Cache cleared"}
