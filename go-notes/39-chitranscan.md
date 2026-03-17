# Chapter 39 — ChitranScan: AI Image Analyzer
## *The Quality Inspector of the Grocery Warehouse*

> **Chitran** = Image | **Scan** = Analyze. Every crate entering BigBasket's
> warehouse gets photographed, fed to Gemini's multimodal AI, and graded
> for freshness and defects. No bruised tomatoes slip through.

---

## Why This Chapter?

Images are the fastest-growing data type in modern APIs. This chapter builds
a production-style image analysis service: multipart upload, AI vision,
concurrent batch processing.

| Concern | Tool | Why |
|---|---|---|
| Routing | Chi | net/http compatible, middleware-first |
| AI Vision | Gemini (simulated) | Multimodal: text + images |
| Upload | `multipart/form-data` | Standard file upload |
| Concurrency | Goroutines + semaphore | Parallel analysis, rate-limited |

---

## Core Concepts

### 1. Multipart File Upload
Go's `r.FormFile("image")` gives you an `io.Reader`. Always set
`MaxBytesReader` to prevent memory bombs, and validate MIME type.

### 2. Gemini Multimodal Pattern
Send text prompt + base64 image in one request. Simulated here for learning;
swap in real client when ready.

### 3. Concurrent Batch Analysis
Fan-out/fan-in with a buffered channel as semaphore:

```go
sem := make(chan struct{}, 5)  // max 5 concurrent
sem <- struct{}{}              // acquire
// ... analyze ...
<-sem                          // release
```

### 4. Prompt Templates
| Type | Focus | Use Case |
|---|---|---|
| `quality` | Freshness, defects | Incoming produce |
| `label` | Text extraction, expiry | Packaged goods |
| `categorize` | Classification | Warehouse sorting |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/analyze` | Single image analysis |
| `POST` | `/api/analyze/batch` | Multiple images concurrently |
| `GET` | `/api/analysis/{id}` | Retrieve previous result |
| `GET` | `/health` | Health check |

---

## Project Structure

```
39-chitranscan/
├── main.go
├── go.mod / Dockerfile / docker-compose.yml
└── internal/
    ├── config/config.go
    ├── ai/gemini.go, prompts.go
    ├── model/analysis.go
    ├── handler/analysis_handler.go
    └── middleware/middleware.go
```

---

## Key Takeaways

1. **File uploads are just bytes** — `r.FormFile()` gives an `io.Reader`.
2. **Always limit upload size** — `MaxBytesReader` prevents crashes.
3. **Concurrent processing needs coordination** — WaitGroup + channels +
   semaphore.
4. **Simulated AI is great for learning** — same pipeline, swap in real
   client later.
5. **Prompt engineering is backend work** — version, template, and test prompts.
