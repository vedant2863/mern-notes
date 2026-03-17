# Chapter 42 — VaaniSutra: AI Processing Pipeline

## The Jio Call Center Challenge

Jio handles **millions** of calls daily. Each transcript needs sentiment
analysis, entity extraction, and summarization. VaaniSutra is the concurrent
pipeline that processes transcripts through multiple AI stages, then stores
results in a vector database for semantic search.

This is the **capstone project** — bringing together goroutines, channels,
select, context, concurrency patterns, HTTP servers, and vector databases.

---

## 1. Fan-Out / Fan-In

Three independent analyses per transcript: sentiment, entities, summary.
Fan-out to three goroutines, fan-in the results.

```
Transcript --> [Sentiment] --+
          --> [Entities]   --+--> Fan-In --> Embed --> Store
          --> [Summary]    --+
```

Sequential: 300-600ms. Concurrent: 50-200ms (slowest one). 3x speedup.

## 2. Worker Pool

Bounded concurrency (default: 4 workers) prevents memory spikes and API
rate-limit violations. Backpressure: full queue returns "queue full" response.

## 3. Channel Pipeline

Queue channel decouples submission from processing. HTTP handler returns
202 Accepted immediately; pipeline processes asynchronously.

## 4. AI Text Analytics

| Stage | Output |
|---|---|
| Sentiment | Score (-1 to 1), label, confidence |
| Entities | Types and positions |
| Summary | 2-3 sentences |
| Keywords | Top terms by frequency |
| Embedding | 256-dim vector for search |

Simulated mode: word counting + FNV hashing. No API keys needed.

## 5. Vector DB Integration

Qdrant (or in-memory fallback) enables semantic search: "customer unhappy
with internet speed" finds transcripts about slow connections and bandwidth.

## 6. Graceful Shutdown

1. Stop accepting HTTP requests
2. Close pipeline input channel
3. Wait for in-flight workers (WaitGroup)
4. Shut down server

## 7. Metrics

Atomic counters track: Queued, Processing, Completed, Failed, WorkerCount,
Uptime. Access via `GET /api/pipeline/status`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/transcripts | Submit single transcript |
| POST | /api/transcripts/batch | Submit batch |
| GET | /api/transcripts/{id} | Get processed result |
| POST | /api/search | Semantic search |
| GET | /api/pipeline/status | Pipeline metrics |
| GET | /health | Health check |

---

## Running

```bash
cd 42-vaanisutra && go run main.go    # in-memory mode

curl -X POST http://localhost:8086/api/transcripts \
  -H "Content-Type: application/json" \
  -d '{"caller_id":"JIO-9876543210","agent_id":"AGT-101","content":"Very angry about slow internet on Jio 999 plan.","duration":180,"language":"en"}'

curl http://localhost:8086/api/pipeline/status

# Docker (with Qdrant)
docker compose up --build
```

---

## Key Takeaways

1. **Fan-out/fan-in** for independent concurrent work with combined results.
2. **Worker pools** provide bounded concurrency — essential for production.
3. **Channel pipelines** decouple producers from consumers with backpressure.
4. **Atomic operations** beat mutexes for simple counters.
5. **Graceful shutdown** ensures no half-processed transcripts during deploys.
6. **Vector search** transforms unstructured data querying from keywords to
   semantics.
7. **Simulate everything** — works without API keys or running Qdrant.
