# Chapter 33 — NotesKaro: CRUD Notes API

## Story: Infosys Mysore Training Campus

Thousands of fresh graduates arrive at Infosys Mysore every quarter. Training
coordinators need a simple note-saving system per batch — lightweight, fast to
deploy, dead simple. **NotesKaro** is that system: a CRUD REST API with Chi
router and SQLite.

---

## Why Chi Router?

Chi is a router, not a framework. Your handlers remain plain `http.HandlerFunc`.
It adds URL params (`chi.URLParam`), middleware chaining, and subrouters while
staying fully `net/http` compatible. You can eject Chi and keep all your code.

## Why SQLite with modernc.org/sqlite?

`modernc.org/sqlite` is a **pure Go** SQLite — no CGO, no C compiler needed.
`CGO_ENABLED=0` works, cross-compilation is trivial, and Docker scratch images
work without gcc. Same SQL, same reliability.

---

## Project Architecture

```
33-noteskaro/
├── main.go                         # Wiring, server, graceful shutdown
├── go.mod
├── Dockerfile / docker-compose.yml
└── internal/
    ├── config/config.go            # Environment → Config struct
    ├── model/note.go               # Data structures
    ├── store/sqlite.go             # SQLite repository (CRUD)
    ├── handler/note_handler.go     # HTTP handlers (JSON in/out)
    └── middleware/middleware.go     # Logger, RequestID, Recovery
```

Dependencies flow **inward**: handlers depend on store, store depends on model,
model depends on nothing (Dependency Inversion Principle).

---

## API Endpoints

| Method   | Path              | Description        | Status Codes      |
|----------|-------------------|--------------------|-------------------|
| `GET`    | `/health`         | Health check       | 200               |
| `GET`    | `/api/notes`      | List all notes     | 200               |
| `POST`   | `/api/notes`      | Create a note      | 201, 400          |
| `GET`    | `/api/notes/{id}` | Get single note    | 200, 404          |
| `PUT`    | `/api/notes/{id}` | Update a note      | 200, 400, 404     |
| `DELETE` | `/api/notes/{id}` | Delete a note      | 204, 404          |

---

## Key Go Patterns

1. **Repository Pattern** — `store.SQLiteStore` hides SQL behind clean methods.
2. **Graceful Shutdown** — `SIGINT`/`SIGTERM` triggers `server.Shutdown(ctx)`.
3. **Middleware Chain** — Recovery (outermost) -> RequestID -> Logger -> Handler.
4. **Constructor Injection** — `NewNoteHandler(store)` takes store as param.
5. **Context Propagation** — Every store method takes `context.Context`.

---

## How to Run

```bash
cd 33-noteskaro && go mod tidy && go run main.go  # starts on :8080

curl http://localhost:8080/health
curl -X POST http://localhost:8080/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Go Channels","content":"Channels are typed conduits","category":"golang"}'

# Docker
docker compose up --build
```

| Variable        | Default        | Description         |
|-----------------|----------------|---------------------|
| `PORT`          | `8080`         | Server listen port  |
| `DB_PATH`       | `noteskaro.db` | SQLite file path    |
| `READ_TIMEOUT`  | `10s`          | HTTP read timeout   |
| `WRITE_TIMEOUT` | `10s`          | HTTP write timeout  |

---

## Key Takeaways

1. **Chi is net/http-compatible** — no framework lock-in.
2. **SQLite is legitimate for read-heavy, single-writer workloads** — with WAL
   mode it handles concurrent reads well.
3. **`internal/` is a compile-time boundary**, not just naming convention.
4. **Graceful shutdown is not optional** — without it, users get broken
   connections during deployments.
5. **Repository Pattern** decouples business logic from storage — swap SQLite
   for PostgreSQL by changing only the store package.
6. **Pure Go dependencies** (`modernc.org/sqlite`) simplify build pipelines.

---

## What is Next?

Chapter 34 (**Dwarpal**) adds JWT auth. Chapter 35 (**BazaarAPI**) scales to a
marketplace with multiple resources, pagination, and transactions.
