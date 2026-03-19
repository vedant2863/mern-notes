"""
Configuration for Vidya RAG application.
"""

import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_data")
DATABASE_URL = "sqlite:///./vidya.db"

# Chunking settings
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# Embedding settings
EMBEDDING_MODEL = "models/text-embedding-004"
EMBEDDING_DIMENSION = 768

# Generation settings
GENERATION_MODEL = "gemini-2.0-flash"
TOP_K_RESULTS = 5
