"""
Embedding service — converts text into numerical vectors.
These vectors capture the *meaning* of text, so similar concepts
end up close together in vector space.
"""

import google.generativeai as genai
from config import GEMINI_API_KEY, EMBEDDING_MODEL

# Configure the Gemini client
genai.configure(api_key=GEMINI_API_KEY)


def embed_text(text: str) -> list[float]:
    """Generate an embedding vector for a single text string."""
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text
    )
    return result["embedding"]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in one call."""
    if not texts:
        return []

    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=texts
    )
    return result["embedding"]
