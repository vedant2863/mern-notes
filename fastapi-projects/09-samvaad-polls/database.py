from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "samvaad_polls"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

polls_collection = db["polls"]


async def get_db():
    return db
