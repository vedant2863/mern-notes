from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, DB_NAME

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

# Collections
contracts_collection = db["contracts"]
analyses_collection = db["analyses"]


async def init_db():
    """Create indexes for faster queries."""
    await contracts_collection.create_index("filename", unique=True)
    await analyses_collection.create_index("contract_id")
