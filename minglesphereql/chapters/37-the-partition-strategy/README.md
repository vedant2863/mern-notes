# Chapter 37: The Partition Strategy

## Story

It started with a Slack message from the on-call engineer at 2 AM: "The posts feed is timing out." MingleSphereQL had crossed 50 million posts, and the single `posts` table was buckling under the weight. Index scans that once took milliseconds now dragged for seconds. The nightly cleanup job -- a simple `DELETE FROM posts WHERE created_at < NOW() - INTERVAL '2 years'` -- ran for 45 minutes, locking rows, bloating WAL files, and triggering `VACUUM` storms that consumed the entire server's I/O budget.

The team huddled and considered their options. They could archive old data into a separate table manually, but that meant rewriting every query. They could shard across multiple databases, but that introduced enormous application complexity. Then Priya pulled up the PostgreSQL documentation on **declarative partitioning** and everything clicked.

Table partitioning splits one logical table into many physical pieces called **partitions**. Each partition stores a subset of the data based on a partition key. When PostgreSQL executes a query, it examines the `WHERE` clause and determines which partitions are relevant -- a process called **partition pruning**. If you query posts from March 2024, PostgreSQL only touches the March 2024 partition, completely skipping the other 49 million rows stored in other partitions.

The team chose **range partitioning** on `created_at`, creating one partition per month. Creating a new month's partition was a single DDL statement. Deleting an entire month of old data became an instant `ALTER TABLE ... DETACH PARTITION` followed by `DROP TABLE` -- no row-by-row deletion, no dead tuples, no vacuum pressure. Bulk loads could target a specific partition, and `VACUUM` ran on small, manageable tables instead of one colossal heap.

Within a week, feed queries dropped from seconds to single-digit milliseconds. The nightly archival job went from 45 minutes to under one second. The partition strategy had transformed MingleSphereQL's data architecture.

## Concepts

- **Range partitioning**: Split a table by continuous ranges (e.g., one partition per month on a `timestamptz` column).
- **List partitioning**: Split by discrete values (e.g., one partition per category or status).
- **Hash partitioning**: Distribute rows evenly across N partitions using a hash of the partition key.
- **Partition pruning**: PostgreSQL's optimizer automatically skips irrelevant partitions based on query predicates.
- **Partition DDL**: `CREATE TABLE ... PARTITION BY RANGE (column)` defines the parent; `CREATE TABLE ... PARTITION OF parent FOR VALUES FROM (...) TO (...)` defines each child.
- **DETACH PARTITION**: Instantly removes a partition from the parent table without deleting any data, enabling fast bulk archival.
- **Partition statistics**: Query `pg_class`, `pg_inherits`, and `pg_total_relation_size` to inspect partition metadata.

## Code Examples

### Creating a partitioned table

```sql
CREATE TABLE partitioned_posts (
  id SERIAL,
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
```

### Creating a monthly partition

```sql
CREATE TABLE partitioned_posts_2024_03
  PARTITION OF partitioned_posts
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

### Inserting data (PG routes automatically)

```sql
INSERT INTO partitioned_posts (author_id, content, created_at)
VALUES (1, 'Hello from March!', '2024-03-15T10:00:00Z');
-- PostgreSQL automatically routes this to partitioned_posts_2024_03
```

### Querying with partition pruning

```sql
EXPLAIN (FORMAT JSON)
SELECT * FROM partitioned_posts
WHERE created_at >= '2024-03-01' AND created_at < '2024-04-01';
-- The plan shows only the March partition is scanned
```

### Detaching a partition for instant archival

```sql
ALTER TABLE partitioned_posts DETACH PARTITION partitioned_posts_2024_01;
-- The partition becomes a standalone table; no rows are deleted
DROP TABLE partitioned_posts_2024_01; -- optional: actually remove the data
```

### Listing partitions with sizes

```sql
SELECT
  child.relname AS partition_name,
  pg_total_relation_size(child.oid) AS total_bytes,
  pg_size_pretty(pg_total_relation_size(child.oid)) AS size,
  child.reltuples::bigint AS estimated_rows
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'partitioned_posts'
ORDER BY child.relname;
```

## Practice Goals

1. Create a partitioned posts table using `PARTITION BY RANGE` on a `timestamptz` column.
2. Create monthly partitions with correct boundary values (inclusive start, exclusive end).
3. Insert data into the partitioned table and verify PostgreSQL routes rows to the correct partition.
4. Query with date range predicates and verify partition pruning via `EXPLAIN`.
5. Detach a partition to simulate instant bulk archival of old data.
6. Query partition metadata to list all partitions with their row counts and sizes.

## Tips

- The primary key of a partitioned table **must include the partition key**. If you try `PRIMARY KEY (id)` alone, PostgreSQL will reject it because uniqueness cannot be enforced across partitions without the partition column.
- Partition bounds use the `FROM (inclusive) TO (exclusive)` convention, matching the standard date range pattern.
- `DETACH PARTITION` is near-instant because it only updates catalog metadata. No rows are scanned or deleted.
- After detaching, the partition becomes an independent table. You can query it directly, archive it to cold storage, or drop it.
- Always run `ANALYZE` on new partitions after bulk loading data so the query planner has accurate statistics.
- In production, automate partition creation (e.g., a cron job that creates next month's partition) so you never insert into a nonexistent partition and get a routing error.
