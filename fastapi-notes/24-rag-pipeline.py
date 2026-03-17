"""
============================================================
FILE 24: RAG PIPELINE — RETRIEVAL-AUGMENTED GENERATION
============================================================
Topics: RAG architecture, document loading, chunking strategies,
        overlap, embedding and indexing, retrieval, prompt
        augmentation, grounded generation, citations,
        confidence thresholds

WHY THIS MATTERS:
LLMs hallucinate — they confidently make up facts. RAG solves
this by retrieving REAL documents and feeding them as context.
Instead of getting a generic (possibly wrong) answer, RAG
retrieves the actual source and generates a grounded response.
============================================================
"""

# STORY: Krutrim (Ola's AI) — India's First Homegrown LLM
# Krutrim, built by Ola founder Bhavish Aggarwal, is India's
# first homegrown LLM trained on Indian languages. Krutrim uses
# RAG to ground responses in verified knowledge — IRCTC train
# schedules, government schemes like PM Kisan and Ayushman Bharat.
# Without RAG, wrong train times and eligibility criteria.
# With RAG, verified answers with source citations.

import os
import re
import math
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field


# ════════════════════════════════════════════════════════════
# SECTION 1 — What is RAG?
# ════════════════════════════════════════════════════════════

# WHY: Fine-tuning costs ₹50L+ and takes weeks. RAG achieves
# 90% of the benefit at 1% of the cost. Retrieve relevant docs,
# include them in the prompt, LLM generates grounded answers.

# RAG PIPELINE:
#   Query → Embed → Vector Search → Top-K Chunks
#     → Augment Prompt (inject context) → Generate Answer
#     → Grounded Answer + Citations
#
# Fine-tuning: ₹50L, weeks, static knowledge
# RAG: ₹0 (free APIs), hours, updates instantly when docs change


# ════════════════════════════════════════════════════════════
# SECTION 2 — Embedding and Vector Store (reused from File 23)
# ════════════════════════════════════════════════════════════

EMBEDDING_DIM = 768

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    dot_p = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    return dot_p / (mag_a * mag_b) if mag_a and mag_b else 0.0

def generate_embedding(text: str, task_type: str = "retrieval_document") -> List[float]:
    """Simulated embedding. PRODUCTION: genai.embed_content(model="models/embedding-001", ...)"""
    h = hashlib.sha256(text.lower().encode()).digest()
    emb = [(h[i % len(h)] / 255.0 * 2 - 1) * math.cos(i * 0.01) * 0.5 for i in range(EMBEDDING_DIM)]
    mag = math.sqrt(sum(x * x for x in emb))
    return [x / mag for x in emb] if mag > 0 else emb

class VectorStore:
    """In-memory vector store. PRODUCTION: chromadb.PersistentClient()"""
    def __init__(self):
        self.documents: List[Dict[str, Any]] = []

    def add(self, doc_id: str, text: str, embedding: List[float],
            metadata: Dict[str, Any] = None):
        for doc in self.documents:
            if doc["id"] == doc_id:
                doc.update({"text": text, "embedding": embedding, "metadata": metadata or {}})
                return
        self.documents.append({"id": doc_id, "text": text, "embedding": embedding,
                               "metadata": metadata or {}})

    def search(self, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        scored = []
        for doc in self.documents:
            sim = cosine_similarity(query_embedding, doc["embedding"])
            scored.append({**doc, "similarity": round(sim, 4)})
        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_k]

    def count(self) -> int:
        return len(self.documents)

    def clear(self):
        self.documents.clear()


# ════════════════════════════════════════════════════════════
# SECTION 3 — Chunking Strategies
# ════════════════════════════════════════════════════════════

# WHY: LLMs have context limits (32K tokens for Gemini Flash).
# A 100-page PDF does not fit. You MUST split into chunks.
# HOW you chunk matters: bad = splits mid-sentence; good =
# preserves meaning with overlap for continuity.

def chunk_fixed_size(text: str, chunk_size: int = 500, overlap: int = 100) -> List[Dict]:
    """
    Fixed-size chunking with overlap. Simplest strategy.
    Overlap prevents losing context at chunk boundaries.
    """
    if chunk_size <= overlap:
        raise ValueError("chunk_size must exceed overlap")
    chunks, start, idx = [], 0, 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append({"chunk_id": idx, "text": chunk_text, "strategy": "fixed_size"})
            idx += 1
        start += chunk_size - overlap
    return chunks

def chunk_by_paragraphs(text: str, max_chunk_size: int = 1000,
                        overlap_chars: int = 100) -> List[Dict]:
    """
    Paragraph-based chunking — best for structured documents like
    government schemes. Krutrim uses this for Indian policy docs.
    """
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    chunks, idx, current = [], 0, ""
    for para in paragraphs:
        if current and len(current) + len(para) + 2 > max_chunk_size:
            chunks.append({"chunk_id": idx, "text": current.strip(), "strategy": "paragraph"})
            idx += 1
            current = (current[-overlap_chars:] + "\n\n" + para
                       if overlap_chars and len(current) > overlap_chars else para)
        else:
            current = current + "\n\n" + para if current else para
    if current.strip():
        chunks.append({"chunk_id": idx, "text": current.strip(), "strategy": "paragraph"})
    return chunks


# ════════════════════════════════════════════════════════════
# SECTION 4 — RAG Pipeline Core Functions
# ════════════════════════════════════════════════════════════

# WHY: These implement the pipeline: ingest → chunk → embed →
# store → retrieve → augment → generate

def process_document(content: str, filename: str, chunk_strategy: str = "paragraph",
                     chunk_size: int = 500, overlap: int = 100) -> List[Dict]:
    """Full pipeline: chunk document, generate embeddings, return ready for indexing."""
    if chunk_strategy == "fixed":
        chunks = chunk_fixed_size(content, chunk_size, overlap)
    elif chunk_strategy == "paragraph":
        chunks = chunk_by_paragraphs(content, chunk_size, overlap)
    else:
        raise ValueError(f"Unknown strategy: {chunk_strategy}. Use 'fixed' or 'paragraph'.")
    for chunk in chunks:
        chunk["embedding"] = generate_embedding(chunk["text"])
        chunk["source_file"] = filename
        chunk["doc_id"] = f"{filename}_{chunk['chunk_id']}"
    return chunks

def build_rag_prompt(question: str, retrieved_chunks: List[Dict]) -> str:
    """
    Build augmented prompt: system instruction + retrieved context + question.
    This is the critical RAG step — grounding the LLM in real documents.
    """
    system = (
        "You are a knowledgeable assistant. Answer based ONLY on the provided context.\n"
        "Rules: 1) Only use information from context below. "
        "2) If context lacks the answer, say 'I don't have enough information.' "
        "3) Cite sources using [Source: filename]. 4) Be concise but thorough.\n"
    )
    context_parts = [f"[Source {i}: {c.get('source_file', c.get('metadata', {}).get('source_file', 'unknown'))}]"
                     f"\n{c['text']}" for i, c in enumerate(retrieved_chunks, 1)]
    context = "\n---\n".join(context_parts)
    return f"{system}\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer (cite sources):"

def generate_answer(prompt: str) -> str:
    """
    Simulated Gemini generation.
    PRODUCTION:
        model = genai.GenerativeModel("gemini-1.5-flash",
            system_instruction="Answer based ONLY on provided context...")
        return model.generate_content(prompt).text
    """
    if "Context:" in prompt and "Question:" in prompt:
        q_start = prompt.index("Question:")
        question = prompt[q_start + 9:].strip().split("\n")[0]
        return f"Based on the provided context regarding '{question[:60]}':\n\n" \
               f"[Simulated RAG response. Set GEMINI_API_KEY for real generation.]"
    return f"[Simulated response for: {prompt[:100]}]"

def extract_citations(answer: str, chunks: List[Dict]) -> List[Dict[str, str]]:
    """Extract [Source: filename] patterns and link to actual chunks."""
    citations, seen = [], set()
    for match in re.findall(r'\[Source(?:\s*\d*):\s*([^\]]+)\]', answer):
        source = match.strip()
        if source in seen:
            continue
        seen.add(source)
        for c in chunks:
            src = c.get("source_file", c.get("metadata", {}).get("source_file", ""))
            if src == source or source in src:
                citations.append({"source": source, "chunk_preview": c["text"][:150] + "..."})
                break
    return citations


# ════════════════════════════════════════════════════════════
# SECTION 5 — Pydantic Models
# ════════════════════════════════════════════════════════════

class DocumentUploadResponse(BaseModel):
    filename: str
    chunks_created: int
    chunk_strategy: str

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    top_k: int = Field(3, ge=1, le=10)

class SourceChunk(BaseModel):
    chunk_id: str
    text: str
    source_file: str
    similarity_score: float

class QueryResponse(BaseModel):
    question: str
    answer: str
    sources: List[SourceChunk]
    citations: List[Dict[str, str]]
    confidence: str


# ════════════════════════════════════════════════════════════
# SECTION 6 — FastAPI App and Sample Knowledge Base
# ════════════════════════════════════════════════════════════

app = FastAPI(
    title="Krutrim RAG API — Indian Knowledge Base",
    description="RAG pipeline for Indian government schemes. Upload docs, ask questions, "
                "get grounded answers with citations.",
    version="1.0.0",
)

vector_store = VectorStore()
document_registry: Dict[str, Dict[str, Any]] = {}

# --- Sample Indian Government Scheme Data ---
SAMPLE_SCHEMES = [
    {"filename": "pm_kisan_yojana.txt", "content": (
        "PM-KISAN Scheme (Pradhan Mantri Kisan Samman Nidhi)\n\n"
        "PM-KISAN provides income support of Rs. 6,000 per year to all landholding "
        "farmer families. The amount is paid in three installments of Rs. 2,000 each, "
        "directly into farmers' bank accounts.\n\n"
        "Eligibility: All landholding farmer families with cultivable land. Excluded: "
        "institutional landholders, holders of constitutional posts, serving/retired "
        "government officers, professionals like doctors engineers lawyers, and income "
        "tax payers.\n\n"
        "How to Apply: Visit pmkisan.gov.in, enter Aadhaar number and state, fill land "
        "details and bank account, submit for verification by local patwari.")},
    {"filename": "ayushman_bharat.txt", "content": (
        "Ayushman Bharat - PM Jan Arogya Yojana (PM-JAY)\n\n"
        "World's largest government health insurance scheme. Provides Rs. 5 lakh "
        "coverage per family per year for secondary and tertiary hospitalization.\n\n"
        "Eligibility: Families from SECC 2011 database. Rural: no adult aged 16-59, "
        "female-headed household, SC/ST, landless, manual labourers. Urban: domestic "
        "workers, street vendors, construction workers, sanitation workers.\n\n"
        "Benefits: Covers 1393 medical procedures, free treatment at empanelled "
        "hospitals, no cap on family size or age. Helpline: 14555 (toll-free).")},
]

@app.on_event("startup")
async def seed_knowledge_base():
    """Seed with Indian government scheme documents."""
    for scheme in SAMPLE_SCHEMES:
        chunks = process_document(scheme["content"], scheme["filename"],
                                  chunk_strategy="paragraph", chunk_size=800, overlap=100)
        for chunk in chunks:
            vector_store.add(doc_id=chunk["doc_id"], text=chunk["text"],
                             embedding=chunk["embedding"],
                             metadata={"source_file": scheme["filename"],
                                       "chunk_id": chunk["chunk_id"]})
        document_registry[scheme["filename"]] = {
            "filename": scheme["filename"], "chunk_count": len(chunks),
            "char_count": len(scheme["content"])}


# ════════════════════════════════════════════════════════════
# SECTION 7 — POST /documents/upload
# ════════════════════════════════════════════════════════════

# WHY: Users upload their own .txt/.md documents to build a
# custom knowledge base for RAG queries.

@app.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    chunk_strategy: str = Form("paragraph"),
    chunk_size: int = Form(500),
    overlap: int = Form(100),
):
    """Upload a document (.txt/.md), chunk it, embed, and index for RAG."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".txt", ".md"}:
        raise HTTPException(status_code=400, detail=f"Unsupported type '{ext}'. Use .txt or .md")
    content = (await file.read()).decode("utf-8")
    if len(content.strip()) < 10:
        raise HTTPException(status_code=400, detail="File too short (min 10 chars)")

    chunks = process_document(content, file.filename, chunk_strategy, chunk_size, overlap)
    for chunk in chunks:
        vector_store.add(doc_id=chunk["doc_id"], text=chunk["text"],
                         embedding=chunk["embedding"],
                         metadata={"source_file": file.filename, "chunk_id": chunk["chunk_id"]})
    document_registry[file.filename] = {
        "filename": file.filename, "chunk_count": len(chunks), "char_count": len(content)}
    return DocumentUploadResponse(filename=file.filename, chunks_created=len(chunks),
                                  chunk_strategy=chunk_strategy)


# ════════════════════════════════════════════════════════════
# SECTION 8 — POST /query (RAG Query with Sources)
# ════════════════════════════════════════════════════════════

# WHY: The MAIN endpoint. User asks a question → embed → search
# → retrieve chunks → augment prompt → generate grounded answer.
# Includes confidence threshold — returns "I don't know" when
# similarity is too low, preventing hallucination.
# Try: "Am I eligible for PM Kisan if I am a doctor?"
#      "How much health coverage does Ayushman Bharat provide?"

CONFIDENCE_THRESHOLD = 0.3

@app.post("/query", response_model=QueryResponse)
async def rag_query(request: QueryRequest):
    """RAG query: retrieve relevant chunks, generate grounded answer with citations."""
    if vector_store.count() == 0:
        raise HTTPException(status_code=404, detail="No documents indexed. Upload first.")

    query_emb = generate_embedding(request.question, task_type="retrieval_query")
    retrieved = vector_store.search(query_emb, top_k=request.top_k)

    max_sim = max(c["similarity"] for c in retrieved) if retrieved else 0.0

    if not retrieved or max_sim < CONFIDENCE_THRESHOLD:
        return QueryResponse(question=request.question,
            answer="I don't have enough information in my knowledge base to answer accurately.",
            sources=[], citations=[], confidence="insufficient")

    prompt = build_rag_prompt(request.question, retrieved)
    answer = generate_answer(prompt)
    citations = extract_citations(answer, retrieved)

    sources = [SourceChunk(chunk_id=c["id"], text=c["text"][:300],
                           source_file=c.get("metadata", {}).get("source_file", "unknown"),
                           similarity_score=c["similarity"]) for c in retrieved]

    confidence = "high" if max_sim > 0.8 else "medium" if max_sim > 0.6 else "low"
    return QueryResponse(question=request.question, answer=answer, sources=sources,
                         citations=citations, confidence=confidence)


# ════════════════════════════════════════════════════════════
# SECTION 9 — Utility Endpoints
# ════════════════════════════════════════════════════════════

@app.get("/documents")
async def list_documents():
    """List all indexed documents with chunk counts."""
    return {"documents": list(document_registry.values()),
            "total_documents": len(document_registry),
            "total_chunks": vector_store.count()}

@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Remove a document and its chunks from the knowledge base."""
    if filename not in document_registry:
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found")
    vector_store.documents = [d for d in vector_store.documents
                              if d.get("metadata", {}).get("source_file") != filename]
    del document_registry[filename]
    return {"message": f"'{filename}' and its chunks removed."}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "total_documents": len(document_registry),
            "total_chunks": vector_store.count(),
            "models": {"embedding": "models/embedding-001", "generation": "gemini-1.5-flash"}}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. RAG = Retrieve relevant docs + Augment prompt + Generate grounded answer
# 2. RAG costs ₹0 vs fine-tuning at ₹50L+ — and updates instantly when docs change
# 3. Chunking strategy matters: paragraph-based with overlap works best for structured docs
# 4. Overlap between chunks prevents losing context at boundaries (100 chars default)
# 5. System instructions MUST tell the model to say "I don't know" when context is insufficient
# 6. Citations build trust — always link answers back to source documents
# 7. Confidence scoring (similarity threshold) prevents hallucinated answers
# 8. RAG is the #1 production pattern for LLM apps — used by Krutrim, ChatGPT, every enterprise AI
# "Don't fine-tune when you can retrieve. RAG is the 80/20 of AI." — inspired by Bhavish Aggarwal
