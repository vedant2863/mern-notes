# Chapter 40 — GyaanKhoj: RAG Search Engine
## *The Knowledge Seeker*

> **Gyaan** = Knowledge | **Khoj** = Search. TCS (600,000+ employees)
> generates thousands of internal docs weekly. GyaanKhoj lets employees
> ask natural language questions and get cited answers from company docs,
> powered by RAG and Qdrant vector database.

---

## Why This Chapter?

RAG is the dominant pattern for enterprise AI search. It retrieves context
from your own documents and augments the LLM prompt before generation —
no fine-tuning, always up-to-date, traceable citations.

| Concern | Tool | Why |
|---|---|---|
| Routing | Chi | net/http compatible |
| Embeddings | Gemini (simulated) | Text -> vectors |
| Vector DB | Qdrant (+ in-memory fallback) | Similarity search |
| Generation | Gemini (simulated) | Answer synthesis |

---

## Core Concepts

### 1. RAG Pipeline
```
INGESTION:  Document -> Chunk -> Embed -> Vector DB (offline)
QUERY:      Question -> Embed -> Vector search -> Top-K -> LLM -> Answer+citations
```

### 2. Vector Databases
Traditional DB: `WHERE content LIKE '%deploy%'` (misses synonyms).
Vector DB: `SEARCH(embed("How to deploy?"), top_k=5)` (semantic match).
Qdrant uses HNSW indexing for O(log n) search.

### 3. Chunking
Fixed-size (500 chars) with 50-char overlap. Overlap prevents losing context
at boundaries. Sentence-based is cleaner but variable-sized.

### 4. Retrieval Quality
- **Top-K**: 3-10 chunks per query
- **Threshold**: minimum cosine similarity (0.7+) to filter noise

### 5. Citation Tracking
Every answer traces to source documents — critical for enterprise auditing.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents` | Ingest document |
| `POST` | `/api/documents/bulk` | Bulk ingest |
| `POST` | `/api/search` | Semantic search |
| `POST` | `/api/ask` | RAG: question -> cited answer |
| `GET` | `/api/documents` | List documents |
| `DELETE` | `/api/documents/{id}` | Delete document + vectors |
| `GET` | `/health` | Health check |

---

## Project Structure

```
40-gyaankhoj/
├── main.go
├── go.mod / Dockerfile / docker-compose.yml
└── internal/
    ├── config/config.go
    ├── ai/gemini.go, prompts.go
    ├── model/document.go, search.go
    ├── handler/document_handler.go, search_handler.go, rag_service.go, seed.go
    ├── vectordb/qdrant.go          # Qdrant + in-memory fallback
    └── middleware/middleware.go
```

**Without Docker:** In-memory vector store auto-activates. Just `go run main.go`.

---

## Key Takeaways

1. **RAG = Retrieve + Augment + Generate** — no fine-tuning, always current.
2. **Vector DBs search by meaning**, not keywords.
3. **Chunking is critical** — too small loses context, too large dilutes relevance.
4. **Provide fallbacks** — in-memory store for dev, Qdrant for production.
5. **Citations build trust** — enterprise users need source verification.
6. **Simulate first** — full pipeline without API keys; swap in real AI later.
