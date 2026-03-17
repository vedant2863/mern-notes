"""
============================================================
FILE 23: EMBEDDINGS AND VECTOR DATABASES
============================================================
Topics: embeddings, vector representations, cosine similarity,
        Gemini embedding API, ChromaDB, semantic search,
        metadata filtering, batch embeddings

WHY THIS MATTERS:
Traditional search is keyword-based — "red kurti" only finds
listings with those exact words. Embeddings convert text to
numerical vectors that capture MEANING. So "affordable red
kurta for women" also finds "ladies maroon ethnic top under
500." This is how modern search and RAG work.
============================================================
"""

# STORY: Meesho — 150M Products, Semantic Search Revolution
# Meesho (Bangalore) is India's largest social commerce platform
# with 150M+ product listings from small sellers. Most sellers
# write poor titles like "good quality dress material combo."
# Meesho uses embeddings to understand buyer INTENT — when a
# user types "red kurti under 500," vector search finds relevant
# products even without keyword matches, increasing search-to-
# purchase conversion by 35%.

import math
import hashlib
from typing import List, Dict, Any
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field


# ════════════════════════════════════════════════════════════
# SECTION 1 — What Are Embeddings?
# ════════════════════════════════════════════════════════════

# WHY: Computers understand numbers, not text. Embeddings
# convert text into a list of numbers (a vector) that captures
# the MEANING. Similar meanings produce similar vectors.

# Example (simplified to 3D):
#   "king"   → [0.8, 0.2, 0.9]
#   "queen"  → [0.7, 0.3, 0.9]   ← close to king (royalty)
#   "apple"  → [0.1, 0.9, 0.2]   ← far from king (different concept)
#
# Real embeddings: Gemini embedding-001 → 768 dimensions
# KEY INSIGHT: "comfortable office chair" ≈ "ergonomic desk seating"
# Almost NO words in common, but embeddings are very close.


# ════════════════════════════════════════════════════════════
# SECTION 2 — Cosine Similarity: The Math
# ════════════════════════════════════════════════════════════

# WHY: With two vectors, you need a similarity metric.
# Cosine similarity measures the angle between vectors:
#   1.0 = identical meaning, 0.0 = unrelated, -1.0 = opposite

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    cos(θ) = (A · B) / (||A|| × ||B||)
    This is the SAME math powering Google Search, Meesho's
    product matching, and every vector database.
    """
    if len(vec_a) != len(vec_b):
        raise ValueError(f"Dimension mismatch: {len(vec_a)} vs {len(vec_b)}")
    dot_prod = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot_prod / (mag_a * mag_b)

# Distance metrics comparison:
# Cosine: measures angle, ignores magnitude — best for text similarity
# Euclidean: straight-line distance — best when magnitude matters
# Dot Product: alignment + magnitude — best for recommendations


# ════════════════════════════════════════════════════════════
# SECTION 3 — Generating Embeddings with Gemini
# ════════════════════════════════════════════════════════════

# WHY: Google's embedding model is free (1500 RPM) and produces
# high-quality 768-dim vectors. Perfect for Indian startups.

# PRODUCTION:
# import google.generativeai as genai
# genai.configure(api_key=os.environ["GEMINI_API_KEY"])
# result = genai.embed_content(
#     model="models/embedding-001",
#     content="comfortable office chair",
#     task_type="retrieval_document",  # or "retrieval_query"
# )
# embedding = result["embedding"]  # List of 768 floats

# Task types: retrieval_document (for docs), retrieval_query (for search),
# semantic_similarity (comparing texts), classification (categorization)

EMBEDDING_DIM = 768

def generate_embedding(text: str, task_type: str = "retrieval_document") -> List[float]:
    """
    Simulated embedding for teaching. PRODUCTION: use genai.embed_content()
    Produces deterministic vectors from text hash so same text = same vector.
    """
    hash_bytes = hashlib.sha256(text.encode()).digest()
    emb = [(hash_bytes[i % len(hash_bytes)] / 255.0 * 2 - 1) * math.cos(i * 0.01) * 0.5
           for i in range(EMBEDDING_DIM)]
    mag = math.sqrt(sum(x * x for x in emb))
    return [x / mag for x in emb] if mag > 0 else emb

def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Batch embed multiple texts — 5-10x faster than one-by-one.
    PRODUCTION: genai.embed_content(model=..., content=texts_list)
    """
    return [generate_embedding(t) for t in texts]


# ════════════════════════════════════════════════════════════
# SECTION 4 — Vector Store (ChromaDB Pattern)
# ════════════════════════════════════════════════════════════

# WHY: You need somewhere to STORE and SEARCH embeddings.
# ChromaDB runs locally, no signup, no cloud, no credit card.
# Perfect for dev and datasets up to ~1M vectors.

# PRODUCTION:
# import chromadb
# client = chromadb.PersistentClient(path="./chroma_data")
# collection = client.create_collection("products", metadata={"hnsw:space": "cosine"})
# collection.add(documents=[...], embeddings=[...], ids=[...], metadatas=[...])
# results = collection.query(query_embeddings=[...], n_results=5, where={"category": "kurti"})

# ChromaDB vs Pinecone:
#   ChromaDB: local, free, ~1M vectors, great for dev
#   Pinecone: cloud, free tier 100K, scales to billions

class SimulatedCollection:
    """Simulates ChromaDB collection with cosine search and metadata filtering."""

    def __init__(self, name: str):
        self.name = name
        self.documents: List[str] = []
        self.embeddings: List[List[float]] = []
        self.ids: List[str] = []
        self.metadatas: List[Dict] = []

    def add(self, documents: List[str], embeddings: List[List[float]],
            ids: List[str], metadatas: List[Dict] = None):
        metadatas = metadatas or [{}] * len(documents)
        for doc, emb, doc_id, meta in zip(documents, embeddings, ids, metadatas):
            if doc_id in self.ids:
                idx = self.ids.index(doc_id)
                self.documents[idx], self.embeddings[idx], self.metadatas[idx] = doc, emb, meta
            else:
                self.documents.append(doc)
                self.embeddings.append(emb)
                self.ids.append(doc_id)
                self.metadatas.append(meta)

    def query(self, query_embeddings: List[List[float]], n_results: int = 5,
              where: Dict = None) -> Dict:
        if not self.embeddings:
            return {"ids": [[]], "documents": [[]], "distances": [[]], "metadatas": [[]]}
        query_emb = query_embeddings[0]
        scored = []
        for emb, doc, did, meta in zip(self.embeddings, self.documents, self.ids, self.metadatas):
            if where and not all(meta.get(k) == v for k, v in where.items()):
                continue
            scored.append((did, doc, 1.0 - cosine_similarity(query_emb, emb), meta))
        scored.sort(key=lambda x: x[2])
        top = scored[:n_results]
        return {"ids": [[x[0] for x in top]], "documents": [[x[1] for x in top]],
                "distances": [[round(x[2], 4) for x in top]],
                "metadatas": [[x[3] for x in top]]}

    def count(self) -> int:
        return len(self.documents)


# ════════════════════════════════════════════════════════════
# SECTION 5 — Pydantic Models
# ════════════════════════════════════════════════════════════

class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)

class IndexRequest(BaseModel):
    document_id: str = Field(..., min_length=1, max_length=100)
    text: str = Field(..., min_length=1, max_length=50000)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=5000)
    n_results: int = Field(5, ge=1, le=50)
    filters: Dict[str, Any] = Field(default_factory=dict,
        description='Optional metadata filter, e.g., {"category": "electronics"}')

class SearchResult(BaseModel):
    document_id: str
    text: str
    similarity_score: float
    metadata: Dict[str, Any]

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int


# ════════════════════════════════════════════════════════════
# SECTION 6 — FastAPI App and Sample Data
# ════════════════════════════════════════════════════════════

app = FastAPI(
    title="Meesho Semantic Search API",
    description="Semantic product search powered by embeddings and vector databases.",
    version="1.0.0",
)

collection = SimulatedCollection(name="products")

SAMPLE_PRODUCTS = [
    {"id": "prod_001",
     "text": "Premium cotton kurti with chikankari embroidery, perfect for office wear "
             "and festive occasions, available in red and maroon",
     "metadata": {"category": "women-clothing", "price": 899, "seller": "lucknow_crafts"}},
    {"id": "prod_002",
     "text": "Ergonomic mesh office chair with lumbar support and adjustable armrests, "
             "breathable fabric for long work-from-home sessions in Indian summers",
     "metadata": {"category": "furniture", "price": 8999, "seller": "office_comfort"}},
    {"id": "prod_003",
     "text": "Wireless Bluetooth earbuds with noise cancellation, 30-hour battery, "
             "IPX5 waterproof, deep bass for Bollywood and hip-hop music",
     "metadata": {"category": "electronics", "price": 2499, "seller": "tech_bazaar"}},
    {"id": "prod_004",
     "text": "Stainless steel pressure cooker 5L induction base ISI certified, "
             "ideal for dal rice biryani and Indian curries",
     "metadata": {"category": "kitchen", "price": 1899, "seller": "kitchen_india"}},
]

@app.on_event("startup")
async def seed_products():
    """Seed collection with sample Indian e-commerce products."""
    texts = [p["text"] for p in SAMPLE_PRODUCTS]
    embeddings = generate_embeddings_batch(texts)
    collection.add(documents=texts, embeddings=embeddings,
                   ids=[p["id"] for p in SAMPLE_PRODUCTS],
                   metadatas=[p["metadata"] for p in SAMPLE_PRODUCTS])


# ════════════════════════════════════════════════════════════
# SECTION 7 — POST /embed (Generate Embedding)
# ════════════════════════════════════════════════════════════

@app.post("/embed")
async def embed_text(request: EmbedRequest):
    """Generate embedding vector. Returns first 10 dims as preview."""
    embedding = generate_embedding(request.text)
    return {"text": request.text, "embedding_dim": len(embedding),
            "embedding_preview": embedding[:10], "model": "models/embedding-001"}


# ════════════════════════════════════════════════════════════
# SECTION 8 — POST /index (Add Document to Vector Store)
# ════════════════════════════════════════════════════════════

# WHY: To search, you first index documents. This generates
# the embedding and stores text + embedding + metadata.

@app.post("/index")
async def index_document(request: IndexRequest):
    """Add a document: generate embedding and store in vector DB."""
    embedding = generate_embedding(request.text)
    collection.add(documents=[request.text], embeddings=[embedding],
                   ids=[request.document_id], metadatas=[request.metadata])
    return {"message": f"Document '{request.document_id}' indexed",
            "embedding_dim": len(embedding), "total_documents": collection.count()}


# ════════════════════════════════════════════════════════════
# SECTION 9 — POST /search (Semantic Search + Filtering)
# ════════════════════════════════════════════════════════════

# WHY: This is where the magic happens. Natural language query
# → embedding → find most similar documents. "comfortable
# office chair" finds the ergonomic chair without exact keywords.
# Metadata filters combine semantic matching with traditional
# database-style filters: "kurti under 500" = semantic + price.

@app.post("/search", response_model=SearchResponse)
async def semantic_search(request: SearchRequest):
    """
    Semantic search via vector similarity, with optional metadata filter.
    Try: "comfortable chair for working from home" → finds office chair
         "ethnic Indian dress" → finds kurti
    Add filters: {"category": "electronics"} to narrow results.
    """
    query_emb = generate_embedding(request.query, task_type="retrieval_query")
    where = request.filters if request.filters else None
    results = collection.query(query_embeddings=[query_emb], n_results=request.n_results,
                               where=where)
    search_results = [
        SearchResult(document_id=results["ids"][0][i], text=results["documents"][0][i],
                     similarity_score=round(1.0 - results["distances"][0][i], 4),
                     metadata=results["metadatas"][0][i])
        for i in range(len(results["ids"][0]))
    ]
    return SearchResponse(query=request.query, results=search_results,
                          total_results=len(search_results))


# ════════════════════════════════════════════════════════════
# SECTION 10 — POST /similarity (Compare Two Texts)
# ════════════════════════════════════════════════════════════

@app.post("/similarity")
async def compare_similarity(text_a: str = Query(...), text_b: str = Query(...)):
    """
    Compare semantic similarity between two texts (0.0 to 1.0).
    Try: "red kurti" vs "maroon ethnic top" — should be similar!
    """
    sim = cosine_similarity(generate_embedding(text_a), generate_embedding(text_b))
    interp = ("very similar" if sim > 0.8 else "similar" if sim > 0.6
              else "somewhat related" if sim > 0.4 else "different")
    return {"text_a": text_a, "text_b": text_b,
            "cosine_similarity": round(sim, 4), "interpretation": interp}


# ════════════════════════════════════════════════════════════
# SECTION 11 — Utility
# ════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    return {"status": "healthy", "embedding_model": "models/embedding-001",
            "embedding_dim": EMBEDDING_DIM, "total_documents": collection.count()}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Embeddings convert text to numerical vectors that capture MEANING, not just keywords
# 2. Cosine similarity measures angle between vectors: 1.0 = same, 0.0 = unrelated
# 3. Gemini embedding-001 is free (1500 RPM) and produces 768-dimensional vectors
# 4. ChromaDB runs locally with zero setup — perfect for dev; Pinecone scales to billions
# 5. Always use task_type="retrieval_query" for queries and "retrieval_document" for docs
# 6. Metadata filtering combines semantic search with traditional database-style filters
# 7. Batch embedding is 5-10x faster than embedding one document at a time
# 8. Semantic search finds "ergonomic desk chair" when you search "comfortable office chair"
# "Data is the new oil, but embeddings are the refinery." — inspired by Meesho's AI team
