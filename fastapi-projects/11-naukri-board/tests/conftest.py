import pytest
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

from main import app
from database import get_db

# Use a separate test database
TEST_MONGO_URL = "mongodb://localhost:27017"
TEST_DB_NAME = "naukri_board_test"

test_client = AsyncIOMotorClient(TEST_MONGO_URL)
test_db = test_client[TEST_DB_NAME]


async def override_get_db():
    return test_db


# Override the database dependency
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def client():
    """Async test client for our FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
async def clean_db():
    """Drop test collections before each test."""
    await test_db["jobs"].delete_many({})
    yield
    await test_db["jobs"].delete_many({})


@pytest.fixture
def sample_job():
    """A sample job payload for testing."""
    return {
        "title": "Python Developer",
        "company": {
            "name": "TechCorp",
            "location": "Bangalore",
            "website": "https://techcorp.example.com",
        },
        "description": "Build awesome Python APIs",
        "salary_min": 800000,
        "salary_max": 1500000,
        "job_type": "full-time",
        "skills": ["python", "fastapi", "mongodb"],
        "is_remote": True,
    }
