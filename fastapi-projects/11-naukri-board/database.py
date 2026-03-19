from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

jobs_collection = db["jobs"]


async def get_db():
    return db
