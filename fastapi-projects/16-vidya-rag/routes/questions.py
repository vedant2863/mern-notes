"""
Question routes — ask questions and get cited answers from study materials.
"""

from fastapi import APIRouter
from models import QuestionRequest, AnswerResponse
from services.rag_engine import ask_question
from database import log_question

router = APIRouter(prefix="/questions", tags=["Questions"])


@router.post("/ask", response_model=AnswerResponse)
async def ask(request: QuestionRequest):
    """
    Ask a question about uploaded study materials.
    The RAG pipeline will:
    1. Find relevant chunks from your documents
    2. Generate a grounded answer using only those chunks
    3. Return citations showing where the answer came from
    """

    result = ask_question(
        question=request.question,
        top_k=request.top_k
    )

    # Log the question for analytics
    log_question(
        question=result.question,
        answer=result.answer,
        chunks_used=result.chunks_used
    )

    return result
