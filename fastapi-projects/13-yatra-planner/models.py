from pydantic import BaseModel
from typing import Optional
from datetime import date


# --- Request Models ---

class TravelRequest(BaseModel):
    destination: str
    start_date: date
    end_date: date
    base_currency: str = "INR"


# --- Response Models ---

class WeatherInfo(BaseModel):
    date: str
    condition: str
    temperature_high: float
    temperature_low: float
    humidity: int
    rain_chance: int


class CurrencyRate(BaseModel):
    base: str
    target: str
    rate: float
    last_updated: str


class PlaceOfInterest(BaseModel):
    name: str
    category: str
    description: str
    rating: float
    estimated_time_hours: float
    entry_fee: Optional[float] = None


class TravelPlan(BaseModel):
    destination: str
    start_date: str
    end_date: str
    weather_forecast: list[WeatherInfo]
    currency_rates: list[CurrencyRate]
    places_of_interest: list[PlaceOfInterest]
    travel_tip: str
