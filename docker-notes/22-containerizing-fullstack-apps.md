# File 22: Containerizing Fullstack Applications

**Topic:** Multi-Container Architectures, Frontend + Backend + DB + Cache, Compose for Full Stacks

**WHY THIS MATTERS:**
Real-world applications are never a single service. A typical SaaS product
has a React frontend, a Node/Python backend API, a PostgreSQL database,
a Redis cache, maybe an Nginx reverse proxy, and a background worker.
Docker Compose lets you define ALL of these as a single orchestrated unit.
This file teaches you how to wire them together properly.

**PRE-REQUISITES:** Files 01-21 (Docker basics, networking, volumes, Python containers)

---

## Story: The Shopping Mall

Picture a grand shopping mall in Bengaluru — Phoenix Marketcity.

Each **SHOP** is a different service:
- The clothing store (React frontend) — what customers see first
- The warehouse (Express/FastAPI backend) — handles orders, inventory
- The storage room (PostgreSQL) — permanent records of everything
- The express counter (Redis cache) — quick lookups, no waiting
- The security gate (Nginx) — controls who enters, directs traffic

The **SHARED PARKING LOT** is the Docker network — all shops can reach
each other through internal roads (container names as hostnames),
but customers only enter through the main gate (exposed ports).

**MALL MANAGEMENT** (docker-compose.yml) decides:
- Which shops open first (depends_on)
- How much space each shop gets (resource limits)
- What the internal roads look like (networks)
- Where permanent records are stored (volumes)

The **FOOD COURT** (shared database) serves multiple shops — the
clothing store and electronics store both use it, but they have
their own tables (database schemas).

---

## Section 1 — Fullstack Architecture Overview

**WHY:** Before writing docker-compose.yml, understand what you're connecting.

### Mermaid: Fullstack Docker Architecture

```mermaid
graph TD
    CLIENT[Browser / Mobile Client] -->|HTTPS :443| NGINX[Nginx Reverse Proxy<br/>Port 80/443]

    NGINX -->|/api/*| BACKEND[Backend API<br/>Express / FastAPI<br/>Port 8000]
    NGINX -->|/* static| FRONTEND[Frontend<br/>React / Next.js<br/>Port 3000]

    BACKEND -->|queries| POSTGRES[(PostgreSQL<br/>Port 5432)]
    BACKEND -->|cache get/set| REDIS[(Redis<br/>Port 6379)]
    BACKEND -->|enqueue jobs| WORKER[Background Worker<br/>Celery / BullMQ]

    WORKER -->|process| POSTGRES
    WORKER -->|dequeue| REDIS

    POSTGRES --- PG_VOL[pg_data volume]
    REDIS --- REDIS_VOL[redis_data volume]

    subgraph "Docker Network: app-network"
        NGINX
        FRONTEND
        BACKEND
        POSTGRES
        REDIS
        WORKER
    end

    subgraph "Exposed to Host"
        CLIENT
    end

    style CLIENT fill:#e63946,color:#fff
    style NGINX fill:#457b9d,color:#fff
    style FRONTEND fill:#2a9d8f,color:#fff
    style BACKEND fill:#e9c46a,color:#000
    style POSTGRES fill:#264653,color:#fff
    style REDIS fill:#f4a261,color:#000
    style WORKER fill:#606c38,color:#fff
```

---

## Example Block 1 — Project Structure

**WHY:** A well-organized monorepo makes multi-container development manageable.

```
my-fullstack-app/
├── docker-compose.yml           # Orchestration (main file)
├── docker-compose.dev.yml       # Development overrides
├── docker-compose.prod.yml      # Production overrides
├── .env                         # Environment variables (NOT committed)
├── .env.example                 # Template for .env (committed)
│
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.dev           # Development Dockerfile with hot reload
│   ├── .dockerignore
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       └── ...
│
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt         # or pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   └── tests/
│
├── nginx/
│   ├── nginx.conf               # Nginx configuration
│   └── ssl/                     # SSL certificates (not committed)
│
├── db/
│   └── init/
│       ├── 01-schema.sql        # Initial schema
│       └── 02-seed.sql          # Seed data
│
└── worker/
    ├── Dockerfile
    └── tasks/
```

---

## Example Block 2 — Frontend Dockerfile (Next.js)

**WHY:** Frontend builds are large (node_modules) but output is small (static files).
Multi-stage builds are critical here.

```dockerfile
# frontend/Dockerfile — Next.js Production Build

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# WHY: Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy only what's needed to run
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]

# Result: ~150MB instead of ~1.5GB
```

### Frontend Development Dockerfile (with hot reload)

```dockerfile
# frontend/Dockerfile.dev — Development with Hot Reload
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# WHY: Don't copy source — it will be bind-mounted
# This Dockerfile is just for installing deps

EXPOSE 3000

# WHY: next dev enables hot module replacement
CMD ["npm", "run", "dev"]
```

---

## Example Block 3 — Backend Dockerfile (FastAPI)

**WHY:** The backend API is the heart of the system. It connects to
both the database and cache, and serves the frontend.

```dockerfile
# backend/Dockerfile — FastAPI Production Build

FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser . .

USER appuser
EXPOSE 8000

# WHY: gunicorn with uvicorn workers = production async Python
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", \
     "-w", "4", \
     "--access-logfile", "-"]
```

---

## Example Block 4 — Nginx Reverse Proxy Configuration

**WHY:** Nginx sits in front, routes /api to backend and everything
else to the frontend. It also handles SSL termination, compression,
and rate limiting.

```nginx
# nginx/nginx.conf — Reverse Proxy Configuration

upstream frontend {
    server frontend:3000;    # Docker DNS resolves 'frontend' to the container
}

upstream backend {
    server backend:8000;     # Docker DNS resolves 'backend' to the container
}

server {
    listen 80;
    server_name myapp.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    gzip_min_length 1000;

    # API routes → Backend
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WHY: Timeouts prevent hung connections
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # WebSocket support (for real-time features)
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Everything else → Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Example Block 5 — Docker Compose: Development

**WHY:** The development compose file prioritizes fast iteration,
hot reload, and easy debugging over security and performance.

```yaml
# docker-compose.yml — Base Configuration

version: "3.9"

services:
  # ── Frontend (Next.js) ──────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      # WHY: Bind mount for hot reload — code changes reflect instantly
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
      # WHY: Anonymous volume preserves node_modules from image
      # Without this, the bind mount would HIDE node_modules
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost/api
      - WATCHPACK_POLLING=true     # WHY: Enable polling for Docker file watching
    depends_on:
      - backend
    networks:
      - app-network

  # ── Backend (FastAPI) ───────────────────────────────────
  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    volumes:
      # WHY: Bind mount for hot reload with uvicorn --reload
      - ./backend/app:/app/app
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/myapp
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=dev-secret-key-not-for-production
      - DEBUG=true
    # WHY: Override CMD for development (enable --reload)
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network

  # ── PostgreSQL ──────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"            # WHY: Expose for local DB tools (pgAdmin, DBeaver)
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d    # WHY: Auto-run init SQL scripts
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  # ── Redis ───────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  # ── Nginx (Reverse Proxy) ──────────────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - frontend
      - backend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  pg_data:
  redis_data:
```

---

## Example Block 6 — Docker Compose: Production Overrides

**WHY:** Production compose removes debug settings, uses proper images,
adds resource limits, and doesn't expose internal ports.

```yaml
# docker-compose.prod.yml — Production Overrides
# USAGE: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# The prod file OVERRIDES the base file's settings.

version: "3.9"

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile         # Production Dockerfile (multi-stage)
    ports: []                         # WHY: No direct port exposure in prod
    volumes: []                       # WHY: No bind mounts in prod (use image)
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://myapp.com/api
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
      restart_policy:
        condition: on-failure
        max_attempts: 3

  backend:
    volumes: []                       # WHY: No bind mounts — use built image
    ports: []                         # WHY: Only accessible through nginx
    environment:
      - DATABASE_URL=${DATABASE_URL}  # From .env file or environment
      - REDIS_URL=${REDIS_URL}
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=false
    command: []                       # WHY: Use Dockerfile CMD (gunicorn)
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
      restart_policy:
        condition: on-failure
        max_attempts: 5

  postgres:
    ports: []                         # WHY: Never expose DB port in production!
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G

  redis:
    ports: []                         # WHY: Never expose Redis in production!
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  nginx:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/ssl:/etc/nginx/ssl:ro   # SSL certificates
```

---

## Section 2 — Request Flow Through Services

### Mermaid: Request Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant N as Nginx :80
    participant F as Frontend :3000
    participant B as Backend :8000
    participant R as Redis :6379
    participant P as PostgreSQL :5432

    Note over C,P: Page Load Flow
    C->>N: GET / (page request)
    N->>F: Proxy to frontend:3000
    F-->>N: HTML + JS bundle
    N-->>C: Serve page

    Note over C,P: API Data Flow
    C->>N: GET /api/products
    N->>B: Proxy to backend:8000
    B->>R: Check cache (GET products:all)
    alt Cache HIT
        R-->>B: Cached JSON data
        B-->>N: 200 OK + JSON
    else Cache MISS
        R-->>B: null
        B->>P: SELECT * FROM products
        P-->>B: Result rows
        B->>R: SET products:all (TTL 300s)
        B-->>N: 200 OK + JSON
    end
    N-->>C: JSON response

    Note over C,P: Mutation Flow
    C->>N: POST /api/products (new product)
    N->>B: Proxy to backend
    B->>P: INSERT INTO products
    P-->>B: Created row
    B->>R: DEL products:all (invalidate cache)
    B-->>N: 201 Created
    N-->>C: Success response
```

---

## Example Block 7 — Environment Variable Management

**WHY:** Hardcoding secrets in compose files is a security disaster.
Use .env files for development, proper secret managers in production.

```bash
# .env.example — Template (commit this to git)

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=myapp
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# Redis
REDIS_PASSWORD=CHANGE_ME
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# Backend
SECRET_KEY=CHANGE_ME_TO_RANDOM_STRING
DEBUG=false
ALLOWED_HOSTS=myapp.com,www.myapp.com

# Frontend
NEXT_PUBLIC_API_URL=https://myapp.com/api
```

Docker Compose reads `.env` automatically from the project root.

**SYNTAX in compose:** `${VARIABLE_NAME}`

Override order (highest wins):
1. Shell environment variables
2. `.env` file values
3. Default values in compose: `${VAR:-default}`

---

## Section 3 — Development Workflow Commands

**WHY:** Knowing the right commands saves hours of fumbling.

```bash
# Start all services in development mode
docker compose up -d
# Expected output:
#  ✔ Network myapp_app-network  Created
#  ✔ Container myapp-postgres-1 Healthy
#  ✔ Container myapp-redis-1    Healthy
#  ✔ Container myapp-backend-1  Started
#  ✔ Container myapp-frontend-1 Started
#  ✔ Container myapp-nginx-1    Started

# Watch logs from all services (colored by service)
docker compose logs -f

# Watch logs from ONE service
docker compose logs -f backend

# Rebuild ONE service after Dockerfile changes
docker compose up -d --build backend

# Restart ONE service (without rebuilding)
docker compose restart backend

# Run database migrations
docker compose exec backend alembic upgrade head

# Open a Python shell in the backend container
docker compose exec backend python

# Run tests
docker compose exec backend pytest tests/ -v

# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d myapp

# Connect to Redis CLI
docker compose exec redis redis-cli

# Stop everything (keeps volumes)
docker compose down

# Stop everything AND delete volumes (fresh start)
docker compose down -v

# Start with production overrides
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Example Block 8 — Adding a Background Worker

**WHY:** Many apps need background job processing — email sending,
image processing, report generation. Workers run the same code
but with a different entrypoint.

```yaml
# Adding a Celery/BullMQ Worker to docker-compose.yml

services:
  # ... (frontend, backend, postgres, redis as above)

  # ── Background Worker ──────────────────────────────────
  worker:
    build:
      context: ./backend            # SAME codebase as backend!
    # WHY: Different command = same image, different behavior
    command: celery -A app.celery worker --loglevel=info --concurrency=4
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/myapp
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./backend/app:/app/app      # Hot reload for workers too
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G

  # ── Celery Beat (Scheduled Tasks) ──────────────────────
  scheduler:
    build:
      context: ./backend
    command: celery -A app.celery beat --loglevel=info
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    networks:
      - app-network

  # ── Flower (Celery Monitoring Dashboard) ────────────────
  flower:
    build:
      context: ./backend
    command: celery -A app.celery flower --port=5555
    ports:
      - "5555:5555"
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    networks:
      - app-network
```

---

## Section 4 — Common Patterns and Tips

### Pattern 1: Wait for Dependencies (depends_on + healthcheck)

`depends_on` without condition only waits for container START, not for the service to be READY. Use healthchecks!

```yaml
depends_on:
  postgres:
    condition: service_healthy    # Waits until healthcheck passes
  redis:
    condition: service_healthy
```

### Pattern 2: Shared Volumes for File Uploads

If backend stores uploaded files, nginx needs access too:

```yaml
services:
  backend:
    volumes:
      - uploads:/app/uploads
  nginx:
    volumes:
      - uploads:/usr/share/nginx/uploads:ro  # Read-only for serving
volumes:
  uploads:
```

### Pattern 3: Multiple Networks for Isolation

Frontend shouldn't talk directly to the database:

```yaml
services:
  frontend:
    networks: [frontend-net]
  backend:
    networks: [frontend-net, backend-net]     # Both networks!
  postgres:
    networks: [backend-net]                   # Only backend network

networks:
  frontend-net:
  backend-net:
```

### Pattern 4: Profiles for Optional Services

```yaml
services:
  mailhog:
    image: mailhog/mailhog
    ports: ["8025:8025"]
    profiles: ["debug"]           # Only starts with --profile debug
```

Start with: `docker compose --profile debug up -d`

### Pattern 5: Init Containers (one-off setup tasks)

```yaml
services:
  migrate:
    build: ./backend
    command: alembic upgrade head
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"                 # Run once and stop
    networks: [app-network]
```

---

## Section 5 — Troubleshooting Fullstack Docker

### Common Issues and Solutions

**ISSUE:** "Connection refused" from backend to postgres
**CAUSE:** Backend started before Postgres was ready
**FIX:** Use healthcheck + `depends_on` `condition: service_healthy`

**ISSUE:** Frontend can't reach /api in browser
**CAUSE:** CORS or Nginx proxy misconfiguration
**FIX:** Ensure nginx `proxy_pass` includes trailing slash correctly:
- `/api/` -> `http://backend/` (strips /api prefix)
- `/api` -> `http://backend/api` (keeps /api prefix)

**ISSUE:** Hot reload not working in Docker
**CAUSE:** File system events don't propagate through bind mounts on some OS
**FIX:** Set `WATCHPACK_POLLING=true` (Next.js) or `CHOKIDAR_USEPOLLING=true` (React CRA) or use `uvicorn --reload --reload-dir /app/app` (FastAPI)

**ISSUE:** node_modules missing after bind mount
**CAUSE:** Bind mount hides the image's node_modules
**FIX:** Use anonymous volume trick:
```yaml
volumes:
  - ./frontend/src:/app/src
  - /app/node_modules       # preserves image's node_modules
```

**ISSUE:** "address already in use" on port 5432
**CAUSE:** Local PostgreSQL is running on the same port
**FIX:** Stop local PG or map to different port: `"5433:5432"`

**ISSUE:** Containers can't resolve each other by name
**CAUSE:** Not on the same Docker network
**FIX:** Ensure all services share a network in docker-compose.yml

---

## Key Takeaways

1. **SEPARATE CONCERNS:** Each service gets its own container. Frontend, backend, database, cache, proxy = 5 containers.

2. **NGINX REVERSE PROXY** sits in front, routes traffic. `/api/*` -> backend, `/*` -> frontend. Only Nginx port is exposed.

3. **DOCKER COMPOSE** orchestrates everything with one command. `docker compose up -d` starts your entire stack.

4. **DEV vs PROD** compose files use overrides: `docker compose -f base.yml -f prod.yml up -d`. Dev has bind mounts, exposed ports, hot reload. Prod has resource limits, no debug, no exposed DB ports.

5. **HEALTHCHECKS + depends_on condition** ensure proper startup order. Without healthchecks, your backend will crash connecting to a still-starting database.

6. **ENVIRONMENT VARIABLES** go in `.env` files (not in compose). Never commit `.env` to git. Commit `.env.example` instead.

7. **ANONYMOUS VOLUME TRICK** preserves node_modules when using bind mounts for hot reload: `- /app/node_modules`

8. **MULTIPLE NETWORKS** isolate services. Frontend shouldn't talk directly to the database.

9. **WORKERS** use the SAME image as backend with a different CMD. Don't duplicate Dockerfiles for workers.

10. **FILE POLLING** may be needed for hot reload in Docker: `WATCHPACK_POLLING=true` for Next.js, `CHOKIDAR_USEPOLLING` for React, `--reload` flag for uvicorn.
