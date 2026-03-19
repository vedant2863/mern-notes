from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, DB_NAME

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

# Collections
analyses_collection = db["analyses"]


async def init_db():
    """Create indexes for faster queries."""
    await analyses_collection.create_index("upload_date")
    await analyses_collection.create_index("crop_detected")
    await analyses_collection.create_index("severity")
