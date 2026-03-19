from dotenv import load_dotenv
import os

load_dotenv()

# API keys for real integrations (optional - app works with simulated data)
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "")
CURRENCY_API_KEY = os.getenv("CURRENCY_API_KEY", "")

# Cache settings
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "300"))
