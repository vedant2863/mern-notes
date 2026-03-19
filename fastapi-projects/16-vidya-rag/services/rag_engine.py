"""
RAG Engine — the full pipeline that ties everything together.
Embed question -> Search vectors -> Build prompt -> Generate answer -> Extract citations
"""

import google.generativeai as genai
from config import GEMINI_API_KEY, GENERATION_MODEL, TOP_K_RESULTS
from services.embedder import embed_text
from services.vector_store import search_similar
from services.prompt_templates import build_rag_prompt, RAG_SYSTEM_PROMPT
from models import AnswerResponse, Citation

genai.configure(api_key=GEMINI_API_KEY)


def ask_question(question: str, top_k: int = TOP_K_RESULTS) -> AnswerResponse:
    """
    Full RAG pipeline:
    1. Embed the question
    2. Search for relevant chunks
    3. Build a grounded prompt
    4. Generate an answer
    5. Extract citations
    """

    # Step 1: Embed the question
    question_embedding = embed_text(question)

    # Step 2: Search for similar chunks in vector store
    results = search_similar(question_embedding, top_k=top_k)

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]

    # Handle empty results
    if not documents:
        return AnswerResponse(
            question=question,
            answer="No study materials have been uploaded yet. Please upload documents first.",
            citations=[],
            chunks_used=0
        )

    # Step 3: Build context from retrieved chunks
    chunks_with_metadata = []
    for i, (doc_text, metadata) in enumerate(zip(documents, metadatas)):
        chunks_with_metadata.append({
            "text": doc_text,
            "title": metadata.get("document_title", "Unknown"),
            "page_estimate": metadata.get("page_estimate", 1),
            "chunk_index": metadata.get("chunk_index", i)
        })

    # Step 4: Build prompt and generate answer
    prompt = build_rag_prompt(question, chunks_with_metadata)

    model = genai.GenerativeModel(
        model_name=GENERATION_MODEL,
        system_instruction=RAG_SYSTEM_PROMPT
    )
    response = model.generate_content(prompt)
    answer_text = response.text

    # Step 5: Build citations from the chunks we used
    citations = []
    for chunk_data in chunks_with_metadata:
        # Include a snippet of the relevant text
        snippet = chunk_data["text"][:150] + "..." if len(chunk_data["text"]) > 150 else chunk_data["text"]

        citations.append(Citation(
            document_title=chunk_data["title"],
            chunk_index=chunk_data["chunk_index"],
            page_estimate=chunk_data["page_estimate"],
            relevant_text=snippet
        ))

    return AnswerResponse(
        question=question,
        answer=answer_text,
        citations=citations,
        chunks_used=len(documents)
    )
