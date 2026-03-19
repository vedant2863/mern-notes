from dotenv import load_dotenv
import os

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# File upload settings
UPLOAD_DIR = "uploads"
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = [".pdf", ".txt"]

# MongoDB (optional - uses in-memory store if not set)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "vakeel_contracts")
