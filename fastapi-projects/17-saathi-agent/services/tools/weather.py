"""
Weather tool — simulated weather data.
In production, this would call a real weather API.
"""

import random


# Simulated weather data for Indian cities
WEATHER_DATA = {
    "mumbai": {"temp": 32, "condition": "Humid and partly cloudy", "humidity": 78},
    "delhi": {"temp": 38, "condition": "Hot and sunny", "humidity": 45},
    "bangalore": {"temp": 26, "condition": "Pleasant with light clouds", "humidity": 65},
    "chennai": {"temp": 34, "condition": "Hot and humid", "humidity": 80},
    "kolkata": {"temp": 33, "condition": "Warm with scattered clouds", "humidity": 72},
    "hyderabad": {"temp": 35, "condition": "Hot and dry", "humidity": 40},
    "pune": {"temp": 30, "condition": "Warm and pleasant", "humidity": 55},
    "jaipur": {"temp": 40, "condition": "Very hot and dry", "humidity": 25},
    "ahmedabad": {"temp": 37, "condition": "Hot and clear", "humidity": 35},
    "lucknow": {"temp": 36, "condition": "Hot with haze", "humidity": 50},
}


def get_weather(city: str) -> str:
    """Get simulated weather for a city."""
    city_lower = city.lower().strip()

    if city_lower in WEATHER_DATA:
        data = WEATHER_DATA[city_lower]
        return (
            f"Weather in {city.title()}:\n"
            f"Temperature: {data['temp']}°C\n"
            f"Condition: {data['condition']}\n"
            f"Humidity: {data['humidity']}%"
        )

    # For unknown cities, generate random but reasonable data
    temp = random.randint(20, 40)
    humidity = random.randint(30, 80)
    conditions = ["Sunny", "Partly cloudy", "Cloudy", "Light rain", "Clear skies"]
    condition = random.choice(conditions)

    return (
        f"Weather in {city.title()}:\n"
        f"Temperature: {temp}°C\n"
        f"Condition: {condition}\n"
        f"Humidity: {humidity}%"
    )
