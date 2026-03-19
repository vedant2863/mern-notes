"""
Pydantic models for Vidya RAG.
"""

from pydantic import BaseModel
from datetime import datetime


# --- Document models ---

class DocumentCreate(BaseModel):
    title: str
    content: str  # raw text content


class DocumentResponse(BaseModel):
    id: int
    title: str
    chunk_count: int
    created_at: str

    class Config:
        from_attributes = True


# --- Chunk model (internal) ---

class Chunk(BaseModel):
    text: str
    document_id: int
    chunk_index: int
    page_estimate: int  # estimated page number


# --- Question and Answer models ---

class QuestionRequest(BaseModel):
    question: str
    top_k: int = 5


class Citation(BaseModel):
    document_title: str
    chunk_index: int
    page_estimate: int
    relevant_text: str


class AnswerResponse(BaseModel):
    question: str
    answer: str
    citations: list[Citation]
    chunks_used: int


# --- Upload response ---

class UploadResponse(BaseModel):
    message: str
    document_id: int
    title: str
    chunks_created: int
