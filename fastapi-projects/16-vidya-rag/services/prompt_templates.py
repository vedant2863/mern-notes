"""
Prompt templates for the RAG pipeline.
These tell the AI exactly how to use retrieved context and cite sources.
"""

RAG_SYSTEM_PROMPT = """You are Vidya, an expert UPSC study assistant.
You answer questions ONLY using the provided context from study materials.

RULES:
1. Only use information from the provided context chunks
2. If the context doesn't contain enough information, say so honestly
3. Always cite which chunks you used in your answer
4. Be concise but thorough
5. Use simple language suitable for exam preparation"""


RAG_ANSWER_PROMPT = """Based on the following study material chunks, answer the student's question.

CONTEXT CHUNKS:
{context}

STUDENT'S QUESTION: {question}

INSTRUCTIONS:
- Answer using ONLY the information in the context chunks above
- After your answer, list the chunk numbers you referenced
- Format citations as: [Sources: Chunk X, Chunk Y]
- If the context doesn't have enough info, say "The uploaded materials don't cover this topic sufficiently."

YOUR ANSWER:"""


def build_context_string(chunks: list[dict]) -> str:
    """Format retrieved chunks into a context string for the prompt."""
    context_parts = []

    for i, chunk in enumerate(chunks):
        title = chunk.get("title", "Unknown")
        page = chunk.get("page_estimate", "?")
        text = chunk.get("text", "")

        context_parts.append(
            f"[Chunk {i + 1}] (From: {title}, Page ~{page})\n{text}"
        )

    return "\n\n---\n\n".join(context_parts)


def build_rag_prompt(question: str, chunks: list[dict]) -> str:
    """Build the complete RAG prompt with context and question."""
    context = build_context_string(chunks)
    return RAG_ANSWER_PROMPT.format(context=context, question=question)
