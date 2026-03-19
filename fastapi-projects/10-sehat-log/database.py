from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db["users"]
meals_collection = db["meals"]
workouts_collection = db["workouts"]
