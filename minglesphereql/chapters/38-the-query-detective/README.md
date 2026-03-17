# Chapter 38: The Query Detective

## Story

The MingleSphereQL dashboard was loading in 12 seconds. Users were complaining. The team opened their monitoring tools and saw high CPU and disk I/O on the database server, but could not pinpoint which queries were responsible. "Is it the feed query? The notifications query? The friend suggestions?" Nobody knew.

The backend developer's first instinct was to add `console.time()` around every database call. But there were hundreds of query call sites, and the overhead of instrumenting each one was enormous. Worse, timing at the application level included network latency and connection pool wait time -- it did not reflect the actual database execution cost.

Then the DBA introduced the team to **pg_stat_statements**, a PostgreSQL extension that automatically tracks every query the database executes. It records how many times each query ran, total and mean execution time, rows returned, blocks read from cache vs. disk, and more. No code changes. No instrumentation. Just enable the extension and the database becomes a self-monitoring system.

With the top slow queries identified, the team learned to read **EXPLAIN ANALYZE** output like detectives reading clues. A `Seq Scan` on a million-row table? That is the smoking gun -- an index is missing. A `Nested Loop` with 10,000 iterations? That is the N+1 problem manifesting inside the database. `Hash Join` replacing `Nested Loop`? The query rewrite worked. `actual rows=50000` but `rows=1` in the estimate? Statistics are stale -- time to run `ANALYZE`.

One by one, the team fixed the bottlenecks: added a missing index on `posts.author_id`, rewrote a correlated subquery as a `JOIN`, and ran `ANALYZE` on a recently-loaded table. The dashboard dropped from 12 seconds to 400 milliseconds. The query detective had solved the case.

## Concepts

- **pg_stat_statements**: A built-in extension that tracks execution statistics for all SQL statements.
- **EXPLAIN ANALYZE**: Executes a query and shows the actual execution plan with real timing and row counts.
- **Seq Scan vs. Index Scan**: Sequential scan reads every row; index scan uses a B-tree (or other) index to jump directly to matching rows.
- **Nested Loop vs. Hash Join vs. Merge Join**: Different join strategies with different performance characteristics depending on data size and distribution.
- **Cost estimation**: PostgreSQL's planner estimates the cost of each operation. `cost=0.00..35.50` means startup cost and total cost in arbitrary units.
- **Actual vs. estimated rows**: When `rows=1` in the plan but `actual rows=50000` in EXPLAIN ANALYZE, the planner's statistics are stale or misleading.
- **The N+1 problem**: Executing one query per item in a list (e.g., fetching each user's posts in a loop) instead of a single batch query.

## Code Examples

### Enabling pg_stat_statements

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- Verify it works:
SELECT COUNT(*) FROM pg_stat_statements;
```

### Finding the slowest queries

```sql
SELECT
  query,
  calls,
  mean_exec_time::numeric(10,2) AS avg_ms,
  total_exec_time::numeric(10,2) AS total_ms,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Running EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT p.*, u.username
FROM posts p
JOIN users u ON u.id = p.author_id
WHERE p.created_at > NOW() - INTERVAL '7 days';
```

### Detecting sequential scans in a plan

The EXPLAIN output contains node types. A `Seq Scan` on a large table usually means a missing index:

```json
{
  "Node Type": "Seq Scan",
  "Relation Name": "posts",
  "Actual Rows": 500000,
  "Actual Total Time": 1234.56
}
```

### Finding missing indexes from query patterns

```sql
SELECT
  schemaname, relname, seq_scan, seq_tup_read,
  idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE relname = 'posts'
  AND seq_scan > idx_scan;
```

## Practice Goals

1. Enable the `pg_stat_statements` extension and verify it is active.
2. Query `pg_stat_statements` to find the slowest queries by mean execution time.
3. Run `EXPLAIN ANALYZE` on a query and return the structured execution plan.
4. Detect sequential scans on a specific table using `pg_stat_user_tables`.
5. Analyze query patterns and suggest missing indexes based on table scan statistics.
6. Reset query statistics counters to start fresh monitoring.

## Tips

- `pg_stat_statements` requires the extension to be installed in the database. On managed services (RDS, Cloud SQL), it is usually pre-installed but may need to be enabled.
- Always use `FORMAT JSON` with EXPLAIN when processing the output programmatically. The JSON format is structured and parseable, while the text format is for human reading only.
- `EXPLAIN` shows the **estimated** plan without executing the query. `EXPLAIN ANALYZE` actually **runs** the query and shows real timing. Be careful running `EXPLAIN ANALYZE` on destructive statements (INSERT, UPDATE, DELETE) -- wrap them in a transaction and rollback if you only want the plan.
- `mean_exec_time` in pg_stat_statements is in **milliseconds**. A query with `mean_exec_time = 500` and `calls = 10000` has consumed 5000 seconds of database time.
- Sequential scans are not always bad. On small tables (under ~1000 rows), a sequential scan is often faster than an index scan because it avoids the overhead of traversing the B-tree.
- After adding an index, run the query again with `EXPLAIN ANALYZE` to confirm the planner is using it. Sometimes the planner prefers a sequential scan if table statistics are stale -- run `ANALYZE tablename` to update them.
