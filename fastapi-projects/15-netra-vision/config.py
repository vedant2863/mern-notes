from dotenv import load_dotenv
import os

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# File upload settings
UPLOAD_DIR = "uploads"
MAX_FILE_SIZE_MB = 5
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_IMAGE_DIMENSION = 2048

# MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "netra_vision")
