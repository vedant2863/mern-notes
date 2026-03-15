# File 23: Databases in Docker

**Topic:** PostgreSQL, MongoDB, Redis, MySQL — Data Persistence, Initialization, Replication

**WHY THIS MATTERS:**
Databases are the foundation of every application. Running them in Docker
gives you reproducible environments, easy testing, and consistent setups
across teams. But databases are STATEFUL — they store permanent data.
Docker containers are EPHEMERAL — they can be destroyed and recreated.
This tension is the core challenge. Solve it wrong, and you LOSE DATA.
This file teaches you how to run databases safely in Docker.

**PRE-REQUISITES:** Files 01-22 (Docker fundamentals, volumes, compose)

---

## Story: The Library System

Imagine the grand National Library of India in Kolkata.

**BOOK STORAGE** (Docker volumes) is the vault where all books live.
If the READING ROOM (container) burns down and is rebuilt, the
books in the vault survive because they're stored separately.
This is exactly what Docker volumes do for database files.

The **CATALOG INITIALIZATION** (init scripts) happens when a new
library branch opens. The head librarian sends a master catalog
(SQL init scripts) that sets up all the shelving categories,
labels, and initial reference books. In Docker, files placed in
`/docker-entrypoint-initdb.d/` run automatically on FIRST start.

**BRANCH LIBRARIES** (replicas) are copies of the main library.
Readers can visit any branch to read (SELECT queries), but new
books are only added at the main branch (INSERT/UPDATE), which
then distributes copies to all branches. This is PRIMARY-REPLICA
replication in databases.

The **LIBRARY CARD SYSTEM** (connection pooling) ensures that only
a manageable number of readers are in the building at once.
Without it, 10,000 readers would crowd the library and nobody
could find anything. PgBouncer does this for PostgreSQL.

---

## Section 1 — PostgreSQL in Docker

**WHY:** PostgreSQL is the most popular open-source relational database.
Understanding its Docker setup is essential for any backend developer.

### Basic PostgreSQL Container

```bash
# SYNTAX: docker run [OPTIONS] postgres:[TAG]
docker run -d \
  --name my-postgres \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=secretpass \
  -e POSTGRES_DB=myapp \
  -p 5432:5432 \
  -v pg_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

| Flag | Purpose |
|---|---|
| `-d` | Run in background (detached) |
| `--name my-postgres` | Container name for easy reference |
| `-e POSTGRES_USER` | Superuser username (default: postgres) |
| `-e POSTGRES_PASSWORD` | Superuser password (REQUIRED) |
| `-e POSTGRES_DB` | Database created on first start (default: POSTGRES_USER) |
| `-p 5432:5432` | Map host port to container port |
| `-v pg_data:/var/lib/...` | Named volume for data persistence |

**CRITICAL:** The volume mount point is `/var/lib/postgresql/data`.
This is where PostgreSQL stores ALL data files.
Without a volume, data is LOST when the container stops.

```bash
# Verify it's running
docker exec my-postgres pg_isready
# Expected output: /var/run/postgresql:5432 - accepting connections

# Connect with psql
docker exec -it my-postgres psql -U admin -d myapp

# Expected psql prompt:
# myapp=# SELECT version();
#                          version
# ─────────────────────────────────────────────────────────
#  PostgreSQL 16.2 on aarch64-unknown-linux-musl
```

### Mermaid: Database Container with Volumes

```mermaid
graph TD
    subgraph "Docker Host"
        subgraph "PostgreSQL Container"
            PG[PostgreSQL Server<br/>Port 5432]
            DATADIR[/var/lib/postgresql/data/]
            INITDIR[/docker-entrypoint-initdb.d/]
            CONFDIR[/etc/postgresql/]
        end

        subgraph "Named Volumes"
            VOL1[(pg_data volume<br/>Persists across restarts)]
            VOL2[(pg_config volume)]
        end

        subgraph "Bind Mounts"
            INIT[./db/init/<br/>01-schema.sql<br/>02-seed.sql<br/>03-functions.sql]
            CONF[./db/postgresql.conf]
        end
    end

    DATADIR -->|mounted from| VOL1
    CONFDIR -->|mounted from| VOL2
    INITDIR -->|mounted from| INIT
    CONF -->|optional override| CONFDIR

    PG --> DATADIR
    PG --> INITDIR
    PG --> CONFDIR

    style PG fill:#336791,color:#fff
    style VOL1 fill:#2d6a4f,color:#fff
    style VOL2 fill:#2d6a4f,color:#fff
    style INIT fill:#e9c46a,color:#000

    Note1[Init scripts run ONLY on<br/>first start when data dir is empty]

    style Note1 fill:#fff3cd,color:#000
```

---

## Example Block 1 — Initialization Scripts

**WHY:** You almost always need to set up schemas, create tables,
and seed data when a database container starts for the first time.

### How It Works

1. On FIRST start (when data directory is empty), PostgreSQL runs all `.sql`, `.sql.gz`, and `.sh` files in `/docker-entrypoint-initdb.d/`
2. Files are executed in ALPHABETICAL order
3. On subsequent starts, init scripts are SKIPPED (data already exists)

### Directory structure

```
db/init/
├── 01-create-extensions.sql
├── 02-create-schema.sql
├── 03-create-tables.sql
├── 04-seed-data.sql
└── 05-create-indexes.sql
```

**01-create-extensions.sql:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

**02-create-schema.sql:**
```sql
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS analytics;
```

**03-create-tables.sql:**
```sql
CREATE TABLE app.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app.products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**04-seed-data.sql:**
```sql
INSERT INTO app.users (email, password_hash) VALUES
    ('admin@example.com', crypt('admin123', gen_salt('bf')));
```

### Docker Compose mounting

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro    # :ro = read-only
```

**IMPORTANT:** If you change init scripts AFTER first start,
they WON'T re-run! You must either:
1. Delete the volume: `docker volume rm pg_data`
2. Or run migrations manually: `docker exec postgres psql -f /script.sql`

### Mermaid: Database Initialization Sequence

```mermaid
sequenceDiagram
    participant DC as Docker Compose
    participant PG as PostgreSQL Container
    participant VOL as pg_data Volume
    participant INIT as Init Scripts

    DC->>PG: Start container
    PG->>VOL: Check data directory

    alt Data directory EMPTY (first start)
        VOL-->>PG: Empty - no existing data
        PG->>PG: Initialize database cluster (initdb)
        PG->>PG: Create POSTGRES_USER
        PG->>PG: Create POSTGRES_DB
        PG->>INIT: Scan /docker-entrypoint-initdb.d/
        INIT-->>PG: Found: 01-extensions.sql
        PG->>PG: Execute 01-extensions.sql
        INIT-->>PG: Found: 02-schema.sql
        PG->>PG: Execute 02-schema.sql
        INIT-->>PG: Found: 03-tables.sql
        PG->>PG: Execute 03-tables.sql
        INIT-->>PG: Found: 04-seed.sql
        PG->>PG: Execute 04-seed.sql
        PG->>VOL: Write initialized data
        PG->>PG: Ready to accept connections
    else Data directory NOT empty (subsequent start)
        VOL-->>PG: Existing data found
        PG->>PG: Skip init scripts entirely
        PG->>PG: Start with existing data
        PG->>PG: Ready to accept connections
    end

    Note over PG: POSTGRES_PASSWORD is<br/>only set on first init!
```

---

## Example Block 2 — PostgreSQL with Custom Configuration

**WHY:** Default PostgreSQL config is conservative. Production workloads
need tuned settings for performance.

### Option 1: Command-line flags

```yaml
services:
  postgres:
    image: postgres:16-alpine
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "effective_cache_size=768MB"
      - "-c"
      - "work_mem=4MB"
      - "-c"
      - "maintenance_work_mem=128MB"
      - "-c"
      - "log_statement=all"         # Log all queries (dev only!)
      - "-c"
      - "log_min_duration_statement=1000"  # Log slow queries > 1s
```

### Option 2: Custom config file

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - ./db/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

### Option 3: Alter system (runtime changes)

```bash
docker exec my-postgres psql -U postgres -c "ALTER SYSTEM SET max_connections = 200;"
docker exec my-postgres psql -U postgres -c "SELECT pg_reload_conf();"
```

---

## Example Block 3 — MongoDB in Docker

**WHY:** MongoDB is the most popular NoSQL database. Its Docker setup
differs from PostgreSQL in important ways.

```bash
# Basic MongoDB container
docker run -d \
  --name my-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=secretpass \
  -e MONGO_INITDB_DATABASE=myapp \
  -p 27017:27017 \
  -v mongo_data:/data/db \
  -v mongo_config:/data/configdb \
  mongo:7
```

| Flag | Purpose |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Admin user (required for auth) |
| `MONGO_INITDB_ROOT_PASSWORD` | Admin password |
| `MONGO_INITDB_DATABASE` | Database to create + run init scripts against |
| `/data/db` | Where MongoDB stores data files |
| `/data/configdb` | Where MongoDB stores config |

### MongoDB Init Scripts

MongoDB also supports `/docker-entrypoint-initdb.d/`. It runs `.js` and `.sh` files (NOT .sql obviously).

Example `db/mongo-init/01-create-collections.js`:

```javascript
db = db.getSiblingDB('myapp');
db.createCollection('users');
db.createCollection('products');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.insertOne({
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
  createdAt: new Date()
});
```

### Docker Compose

```yaml
services:
  mongo:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: secretpass
      MONGO_INITDB_DATABASE: myapp
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
      - ./db/mongo-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
```

```bash
# Connect with mongosh
docker exec -it my-mongo mongosh -u admin -p secretpass --authenticationDatabase admin
```

---

## Example Block 4 — Redis in Docker

**WHY:** Redis is the go-to for caching, sessions, queues, and real-time
features. It's lightweight but needs careful persistence config.

```bash
# Basic Redis container
docker run -d \
  --name my-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine \
  redis-server --requirepass secretpass --appendonly yes
```

| Flag | Purpose |
|---|---|
| `--requirepass` | Set authentication password |
| `--appendonly yes` | Enable AOF persistence (recommended for data safety) |
| `/data` | Where Redis stores dump.rdb and appendonly.aof |

### Redis Persistence Modes

**1. RDB (snapshots) — Default**
Periodic snapshots of entire dataset. PRO: Compact, fast restart. CON: Can lose data between snapshots.
```bash
redis-server --save "60 1000"    # Snapshot if 1000 keys changed in 60s
```

**2. AOF (Append-Only File) — Recommended for persistence**
Logs every write operation. PRO: Minimal data loss (configurable fsync). CON: Larger files, slower restart.
```bash
redis-server --appendonly yes --appendfsync everysec
```

**3. Both RDB + AOF — Maximum safety**
```bash
redis-server --save "60 1000" --appendonly yes
```

**4. No persistence — Pure cache (fastest)**
```bash
redis-server --save "" --appendonly no
```

### Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

```bash
# Connect to Redis CLI
docker exec -it my-redis redis-cli -a secretpass

# Expected:
# 127.0.0.1:6379> PING
# PONG
# 127.0.0.1:6379> SET mykey "hello"
# OK
# 127.0.0.1:6379> GET mykey
# "hello"
```

---

## Example Block 5 — MySQL in Docker

**WHY:** MySQL is still heavily used in enterprise and WordPress ecosystems.

```bash
docker run -d \
  --name my-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=myapp \
  -e MYSQL_USER=appuser \
  -e MYSQL_PASSWORD=apppass \
  -p 3306:3306 \
  -v mysql_data:/var/lib/mysql \
  mysql:8.3
```

MySQL also supports `/docker-entrypoint-initdb.d/` for `.sql`, `.sql.gz`, `.sh` files.

### Docker Compose

```yaml
services:
  mysql:
    image: mysql:8.3
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: myapp
      MYSQL_USER: appuser
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./db/mysql-init:/docker-entrypoint-initdb.d:ro
    command: --default-authentication-plugin=mysql_native_password
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5
```

```bash
# Connect
docker exec -it my-mysql mysql -u appuser -papppass myapp
```

---

## Section 2 — Backup Strategies

**WHY:** Volumes persist data across container restarts, but they don't
protect against corruption, accidental deletion, or host failure.
You MUST have backup strategies.

### PostgreSQL Backup

```bash
# Method 1: pg_dump (logical backup — most common)
docker exec my-postgres pg_dump -U admin -d myapp > backup_$(date +%Y%m%d_%H%M%S).sql

# Method 2: pg_dump compressed
docker exec my-postgres pg_dump -U admin -Fc myapp > backup.dump

# Method 3: pg_dumpall (all databases)
docker exec my-postgres pg_dumpall -U admin > all_databases.sql

# Restore from backup
docker exec -i my-postgres psql -U admin -d myapp < backup.sql
# Or for custom format:
docker exec -i my-postgres pg_restore -U admin -d myapp < backup.dump
```

### MongoDB Backup

```bash
# mongodump to host
docker exec my-mongo mongodump --username admin --password secretpass \
  --authenticationDatabase admin --db myapp --archive > mongo_backup.archive

# Restore
docker exec -i my-mongo mongorestore --username admin --password secretpass \
  --authenticationDatabase admin --archive < mongo_backup.archive
```

### Redis Backup

```bash
# Trigger RDB snapshot
docker exec my-redis redis-cli -a secretpass BGSAVE
# Copy the dump file
docker cp my-redis:/data/dump.rdb ./redis_backup.rdb
```

### MySQL Backup

```bash
docker exec my-mysql mysqldump -u root -prootpass myapp > mysql_backup.sql
```

### Automated Backup with a Sidecar Container

```yaml
services:
  postgres-backup:
    image: prodrigestivill/postgres-backup-local
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secretpass
      SCHEDULE: "@daily"           # Cron schedule
      BACKUP_KEEP_DAYS: 7
      BACKUP_KEEP_WEEKS: 4
      BACKUP_KEEP_MONTHS: 6
    volumes:
      - ./backups:/backups
    depends_on:
      - postgres
```

---

## Section 3 — Replication Setup

**WHY:** Replication provides high availability, read scaling, and disaster recovery.

### PostgreSQL Primary-Replica Replication in Docker

```yaml
services:
  pg-primary:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secretpass
      POSTGRES_DB: myapp
    command:
      - "postgres"
      - "-c"
      - "wal_level=replica"
      - "-c"
      - "max_wal_senders=3"
      - "-c"
      - "max_replication_slots=3"
    volumes:
      - pg_primary_data:/var/lib/postgresql/data
      - ./db/init-primary.sh:/docker-entrypoint-initdb.d/init-primary.sh
    ports:
      - "5432:5432"
    networks:
      - db-network

  pg-replica:
    image: postgres:16-alpine
    environment:
      PGUSER: replicator
      PGPASSWORD: replicatorpass
    command: |
      bash -c "
      until pg_basebackup --pgdata=/var/lib/postgresql/data -R \
        --slot=replication_slot_1 --host=pg-primary --port=5432 \
        --username=replicator --password; do
        echo 'Waiting for primary...'
        sleep 2
      done
      chmod 0700 /var/lib/postgresql/data
      postgres
      "
    volumes:
      - pg_replica_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"          # Different host port!
    depends_on:
      - pg-primary
    networks:
      - db-network
```

**init-primary.sh** — Run on primary first start:

```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicatorpass';
  SELECT pg_create_physical_replication_slot('replication_slot_1');
EOSQL
echo "host replication replicator 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
```

### MongoDB Replica Set in Docker

```yaml
services:
  mongo1:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all --port 27017
    ports: ["27017:27017"]
    volumes: [mongo1_data:/data/db]
    networks: [mongo-net]

  mongo2:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all --port 27017
    ports: ["27018:27017"]
    volumes: [mongo2_data:/data/db]
    networks: [mongo-net]

  mongo3:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all --port 27017
    ports: ["27019:27017"]
    volumes: [mongo3_data:/data/db]
    networks: [mongo-net]

  mongo-init:
    image: mongo:7
    restart: "no"
    command: >
      mongosh --host mongo1:27017 --eval '
        rs.initiate({
          _id: "rs0",
          members: [
            { _id: 0, host: "mongo1:27017", priority: 2 },
            { _id: 1, host: "mongo2:27017", priority: 1 },
            { _id: 2, host: "mongo3:27017", priority: 1 }
          ]
        })
      '
    depends_on: [mongo1, mongo2, mongo3]
    networks: [mongo-net]
```

---

## Section 4 — Connection Pooling

**WHY:** Databases have limited connections. 100 web workers each opening
a connection = 100 connections. A pool reuses connections efficiently.

### Connection Pooling with PgBouncer

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secretpass
      POSTGRES_DB: myapp
    command: postgres -c max_connections=100
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - db-network

  pgbouncer:
    image: edoburu/pgbouncer
    environment:
      DATABASE_URL: "postgres://admin:secretpass@postgres:5432/myapp"
      POOL_MODE: transaction          # transaction | session | statement
      MAX_CLIENT_CONN: 1000           # Clients connect to PgBouncer
      DEFAULT_POOL_SIZE: 25           # PgBouncer connects to PostgreSQL
      MIN_POOL_SIZE: 5
      RESERVE_POOL_SIZE: 5
    ports:
      - "6432:6432"
    depends_on:
      - postgres
    networks:
      - db-network
```

**How it works:**
- Without PgBouncer: App (100 workers) -> PostgreSQL (100 connections)
- With PgBouncer: App (100 workers) -> PgBouncer (25 pool) -> PostgreSQL (25 connections)

Your app connects to `pgbouncer:6432` instead of `postgres:5432`:
`DATABASE_URL=postgresql://admin:secretpass@pgbouncer:6432/myapp`

**Pool Modes:**
- **transaction:** Connection returned to pool after each transaction (RECOMMENDED)
- **session:** Connection held for entire client session (like no pooling)
- **statement:** Connection returned after each statement (can break multi-statement txns)

---

## Section 5 — Health Checks for Databases

**WHY:** Your application should not start until the database is
actually ready to accept queries, not just running.

```yaml
services:
  # PostgreSQL health check
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d myapp"]
      interval: 5s       # Check every 5 seconds
      timeout: 5s        # Fail if check takes > 5s
      retries: 5         # Unhealthy after 5 failures
      start_period: 10s  # Grace period for startup

  # MongoDB health check
  mongo:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  # Redis health check
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # MySQL health check
  mysql:
    image: mysql:8.3
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s   # MySQL takes longer to initialize

  # Application waits for healthy DB
  backend:
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' my-postgres
# Expected: healthy

docker inspect --format='{{json .State.Health}}' my-postgres | python3 -m json.tool
# Shows detailed health check history with timestamps
```

---

## Section 6 — Database Administration Commands

### PostgreSQL

```bash
# List databases
docker exec my-postgres psql -U admin -l

# List tables in database
docker exec my-postgres psql -U admin -d myapp -c "\dt"

# Check active connections
docker exec my-postgres psql -U admin -c "SELECT count(*) FROM pg_stat_activity;"

# Check database size
docker exec my-postgres psql -U admin -c "SELECT pg_size_pretty(pg_database_size('myapp'));"
```

### MongoDB

```bash
# List databases
docker exec my-mongo mongosh -u admin -p secretpass --eval "show dbs"

# List collections
docker exec my-mongo mongosh -u admin -p secretpass myapp --eval "show collections"

# Check collection stats
docker exec my-mongo mongosh -u admin -p secretpass myapp --eval "db.users.stats()"
```

### Redis

```bash
# Check memory usage
docker exec my-redis redis-cli -a secretpass INFO memory

# List all keys (use in dev only!)
docker exec my-redis redis-cli -a secretpass KEYS "*"

# Monitor commands in real-time
docker exec my-redis redis-cli -a secretpass MONITOR
```

### MySQL

```bash
# List databases
docker exec my-mysql mysql -u root -prootpass -e "SHOW DATABASES;"

# Check process list
docker exec my-mysql mysql -u root -prootpass -e "SHOW PROCESSLIST;"

# Check table sizes
docker exec my-mysql mysql -u root -prootpass -e \
  "SELECT table_name, ROUND(data_length/1024/1024,2) AS 'Size (MB)' \
   FROM information_schema.tables WHERE table_schema='myapp';"
```

---

## Key Takeaways

1. **ALWAYS USE NAMED VOLUMES** for database data directories. PostgreSQL: `/var/lib/postgresql/data`. MongoDB: `/data/db`. Redis: `/data`. MySQL: `/var/lib/mysql`. Without volumes, data disappears when containers stop.

2. **INIT SCRIPTS** in `/docker-entrypoint-initdb.d/` run ONCE on first start when the data directory is empty. PostgreSQL/MySQL: `.sql`, `.sql.gz`, `.sh` files. MongoDB: `.js`, `.sh` files. Files execute in ALPHABETICAL order (prefix with 01-, 02-).

3. **HEALTH CHECKS are critical.** Use `depends_on` with `condition: service_healthy` to ensure your app waits for the database to be ready, not just running.

4. **NEVER expose database ports in production.** Remove port mappings from production compose files. Only the backend should reach the database via internal network.

5. **BACKUP REGULARLY.** Volumes protect against container deletion, but not against data corruption or host failure. Use `pg_dump`, `mongodump`, redis `BGSAVE`, `mysqldump`.

6. **CONNECTION POOLING** (PgBouncer) lets hundreds of app workers share a small pool of database connections.

7. **REPLICATION** provides high availability and read scaling. PostgreSQL streaming replication, MongoDB replica sets.

8. **CUSTOM CONFIGURATION** via command flags or mounted config files. Tune `shared_buffers`, `max_connections`, etc. for your workload.

9. **USE ALPINE TAGS** for smaller images: `postgres:16-alpine`, `redis:7-alpine`. MySQL doesn't have an official alpine tag.

10. **PASSWORDS in environment variables** are fine for development. In production, use Docker secrets or external secret managers.
