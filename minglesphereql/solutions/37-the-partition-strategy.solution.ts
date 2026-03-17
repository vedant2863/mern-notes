import { getPool } from '../shared/connection.js';

/**
 * Chapter 37: The Partition Strategy - SOLUTIONS
 *
 * Table partitioning is one of PostgreSQL's most powerful features for
 * managing large datasets. Instead of storing all rows in a single heap,
 * partitioning splits one logical table into many physical child tables.
 * The query planner automatically prunes irrelevant partitions, making
 * queries on large tables dramatically faster.
 */

/**
 * Create a posts table partitioned by RANGE on created_at.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   When a table grows to tens of millions of rows, even indexed queries
 *   slow down because indexes grow deep, VACUUM takes longer, and bulk
 *   deletes create massive amounts of dead tuples.
 *
 * THE REGULAR WAY:
 *   Keep one massive table, add more indexes, run VACUUM more aggressively,
 *   accept slow bulk deletes. Eventually, manually archive old rows with
 *   DELETE + INSERT INTO archive_table, which is I/O-intensive.
 *
 * THE POSTGRESQL WAY:
 *   Declare the table as PARTITION BY RANGE (created_at). Each month gets
 *   its own physical table. PostgreSQL routes inserts automatically, prunes
 *   partitions on reads, and allows instant bulk archival via DETACH.
 *
 * WHY PG IS BETTER:
 *   - Partition pruning means queries only scan relevant time ranges
 *   - VACUUM runs on small tables instead of one massive heap
 *   - Bulk deletes become instant DETACH + DROP operations
 *   - No application code changes needed — partitioning is transparent
 *
 * REAL-WORLD USAGE:
 *   Time-series data (logs, events, metrics), audit trails, social media
 *   posts — any table that grows unboundedly and where old data has a
 *   clear retention policy.
 */
export async function createPartitionedPostsTable(): Promise<{ created: boolean }> {
  const pool = getPool();

  // Drop any existing partitioned_posts table to start fresh.
  // CASCADE drops all child partitions too.
  await pool.query(`DROP TABLE IF EXISTS partitioned_posts CASCADE`);

  // Create the partitioned parent table.
  // CRITICAL: The primary key MUST include the partition key (created_at).
  // PostgreSQL cannot enforce uniqueness across partitions without the
  // partition column in the PK, because each partition is a separate
  // physical table with its own index.
  await pool.query(`
    CREATE TABLE partitioned_posts (
      id SERIAL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at)
  `);

  return { created: true };
}

/**
 * Create a monthly partition for the partitioned_posts table.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   A partitioned table needs child partitions to actually store data.
 *   Without a partition covering the target date range, INSERTs will fail
 *   with "no partition of relation found for row".
 *
 * THE REGULAR WAY:
 *   Manually create archive tables and write routing logic in the app.
 *
 * THE POSTGRESQL WAY:
 *   Use PARTITION OF with FOR VALUES FROM (...) TO (...). The bounds
 *   are inclusive-start, exclusive-end — matching standard date range
 *   conventions. PostgreSQL handles all routing automatically.
 *
 * WHY PG IS BETTER:
 *   - Zero application-level routing logic
 *   - Bounds are checked at DDL time — overlapping ranges are rejected
 *   - Each partition can have its own indexes, tablespace, and storage
 *
 * REAL-WORLD USAGE:
 *   Typically automated with a cron job or pg_partman extension that
 *   pre-creates partitions for upcoming months.
 */
export async function createMonthlyPartition(
  year: number,
  month: number,
): Promise<{ partitionName: string; created: boolean }> {
  const pool = getPool();

  // Build the partition name: partitioned_posts_YYYY_MM
  const monthStr = String(month).padStart(2, '0');
  const partitionName = `partitioned_posts_${year}_${monthStr}`;

  // Calculate the start and end bounds.
  // Start: first day of the given month.
  // End: first day of the NEXT month (exclusive upper bound).
  // Handle December -> January year rollover.
  const startDate = `${year}-${monthStr}-01`;

  let endYear = year;
  let endMonth = month + 1;
  if (endMonth > 12) {
    endMonth = 1;
    endYear = year + 1;
  }
  const endMonthStr = String(endMonth).padStart(2, '0');
  const endDate = `${endYear}-${endMonthStr}-01`;

  // CREATE TABLE ... PARTITION OF defines this as a child partition.
  // FOR VALUES FROM (start) TO (end) sets the inclusive-exclusive range.
  // If the partition already exists, this will error — in production you'd
  // add IF NOT EXISTS or catch the error.
  await pool.query(`
    CREATE TABLE ${partitionName}
      PARTITION OF partitioned_posts
      FOR VALUES FROM ('${startDate}') TO ('${endDate}')
  `);

  return { partitionName, created: true };
}

/**
 * Insert posts into the partitioned table. PG routes each row
 * to the correct partition based on its created_at value.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   Developers worry that partitioning adds INSERT complexity. It does not.
 *   You INSERT into the parent table exactly as before, and PostgreSQL
 *   examines the partition key to route the row.
 *
 * THE REGULAR WAY:
 *   Application code decides which table to write to (error-prone, leaky).
 *
 * THE POSTGRESQL WAY:
 *   INSERT INTO the parent table. PostgreSQL's tuple routing checks the
 *   partition key against all child bounds and writes to the matching one.
 *   If no partition matches, you get a clear error.
 *
 * WHY PG IS BETTER:
 *   - Application code is partition-unaware — no routing logic needed
 *   - Constraint violations (no matching partition) are caught at DB level
 *   - Bulk inserts (COPY, multi-row INSERT) work unchanged
 */
export async function insertIntoPartitionedTable(
  posts: Array<{ author_id: number; content: string; created_at: string }>,
): Promise<any[]> {
  const pool = getPool();
  const inserted: any[] = [];

  for (const post of posts) {
    // INSERT into the parent table — PG routes to the correct partition
    // based on the created_at value. The RETURNING clause works normally.
    const result = await pool.query(
      `INSERT INTO partitioned_posts (author_id, content, created_at)
       VALUES ($1, $2, $3::timestamptz)
       RETURNING *`,
      [post.author_id, post.content, post.created_at],
    );
    inserted.push(result.rows[0]);
  }

  return inserted;
}

/**
 * Query with a date range and return both the data and the EXPLAIN plan
 * to demonstrate partition pruning.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   On a non-partitioned 50M-row table, a date range query must scan
 *   the entire index (or worse, do a sequential scan). With partitioning,
 *   PostgreSQL skips partitions outside the date range entirely.
 *
 * THE REGULAR WAY:
 *   Add a B-tree index on created_at. The index helps, but it still
 *   covers all 50M rows, making it deep and memory-hungry.
 *
 * THE POSTGRESQL WAY:
 *   Partition pruning. The planner sees `created_at >= '2024-02-01'`
 *   and `created_at < '2024-03-01'`, determines only the February
 *   partition is relevant, and generates a plan that only touches
 *   that one small table. The other partitions are never opened.
 *
 * WHY PG IS BETTER:
 *   - I/O is proportional to the RELEVANT data, not the total data
 *   - Works with both static pruning (at plan time) and dynamic pruning
 *     (at execution time with parameterized queries)
 *   - EXPLAIN output shows exactly which partitions are scanned
 *
 * REAL-WORLD USAGE:
 *   Dashboard queries ("show me this month's posts"), compliance queries
 *   ("find all data from Q3 2023"), analytics pipelines that process
 *   one time window at a time.
 */
export async function queryWithPartitionPruning(
  startDate: string,
  endDate: string,
): Promise<{ rows: any[]; plan: any }> {
  const pool = getPool();

  // Step 1: Execute the actual data query.
  const dataResult = await pool.query(
    `SELECT id, author_id, content, created_at
     FROM partitioned_posts
     WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
     ORDER BY created_at`,
    [startDate, endDate],
  );

  // Step 2: Run EXPLAIN (FORMAT JSON) to get the query execution plan.
  // The plan will show which partitions are scanned (Append node with
  // only the relevant child). Pruned partitions will not appear.
  const planResult = await pool.query(
    `EXPLAIN (FORMAT JSON)
     SELECT id, author_id, content, created_at
     FROM partitioned_posts
     WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
     ORDER BY created_at`,
    [startDate, endDate],
  );

  // EXPLAIN (FORMAT JSON) returns a single row with a 'QUERY PLAN' key
  // containing an array of plan node objects.
  const plan = planResult.rows[0]['QUERY PLAN'];

  return { rows: dataResult.rows, plan };
}

/**
 * Detach a monthly partition from the parent table.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   Deleting old data with `DELETE FROM posts WHERE created_at < cutoff`
 *   on a 50M-row table is devastating: it generates millions of dead
 *   tuples, bloats the table, triggers autovacuum storms, and holds
 *   row-level locks for the entire duration.
 *
 * THE REGULAR WAY:
 *   Run DELETE in batches (DELETE ... LIMIT 10000 in a loop), which
 *   takes hours and still creates vacuum pressure.
 *
 * THE POSTGRESQL WAY:
 *   ALTER TABLE ... DETACH PARTITION is a metadata-only operation.
 *   It removes the partition from the parent's inheritance tree in
 *   milliseconds, regardless of how many rows the partition contains.
 *   The partition becomes a standalone table that you can archive or DROP.
 *
 * WHY PG IS BETTER:
 *   - O(1) time complexity — instant regardless of row count
 *   - No dead tuples, no VACUUM pressure, no I/O spike
 *   - The detached table remains queryable for archival/export
 *   - DROP TABLE on the detached partition reclaims disk instantly
 *
 * REAL-WORLD USAGE:
 *   Data retention policies ("keep 24 months of data"), GDPR compliance
 *   (detach + archive), cost optimization (move old partitions to
 *   cheaper storage via tablespaces).
 */
export async function detachOldPartition(
  year: number,
  month: number,
): Promise<{ detached: boolean; remainingRows: number }> {
  const pool = getPool();

  const monthStr = String(month).padStart(2, '0');
  const partitionName = `partitioned_posts_${year}_${monthStr}`;

  // DETACH PARTITION removes the child from the parent's partition tree.
  // This is a catalog-only operation — no data is moved or deleted.
  // After this, the partition is a standalone regular table.
  await pool.query(
    `ALTER TABLE partitioned_posts DETACH PARTITION ${partitionName}`,
  );

  // The detached table still exists and is fully queryable.
  // Count its rows to prove the data is still intact.
  const countResult = await pool.query(
    `SELECT COUNT(*)::int as count FROM ${partitionName}`,
  );

  return {
    detached: true,
    remainingRows: countResult.rows[0].count,
  };
}

/**
 * List all current partitions of partitioned_posts with metadata.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   Operations teams need visibility into partition health: how many
 *   partitions exist, how large each one is, and whether any are
 *   growing unexpectedly.
 *
 * THE REGULAR WAY:
 *   Manually track table names in application config or a metadata table.
 *
 * THE POSTGRESQL WAY:
 *   Query the system catalog. pg_inherits links parent to child tables.
 *   pg_class has the table metadata (name, estimated row count).
 *   pg_total_relation_size() includes the table, indexes, and TOAST data.
 *
 * WHY PG IS BETTER:
 *   - Always accurate — the catalog IS the source of truth
 *   - No external tracking needed
 *   - pg_size_pretty() gives human-readable sizes
 *   - reltuples is updated by ANALYZE and gives fast estimates
 *
 * REAL-WORLD USAGE:
 *   Monitoring dashboards, alerting on partition size thresholds,
 *   automated partition lifecycle management scripts.
 */
export async function getPartitionStats(): Promise<any[]> {
  const pool = getPool();

  // pg_inherits stores the parent-child relationship between
  // the partitioned table and its partitions.
  // pg_class stores metadata about every relation (table, index, etc.).
  // pg_total_relation_size() returns bytes including indexes and TOAST.
  // reltuples is a float estimate updated by ANALYZE — we cast to bigint.
  const result = await pool.query(`
    SELECT
      child.relname AS partition_name,
      pg_total_relation_size(child.oid)::bigint AS total_bytes,
      pg_size_pretty(pg_total_relation_size(child.oid)) AS size,
      child.reltuples::bigint AS estimated_rows
    FROM pg_inherits
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
    WHERE parent.relname = 'partitioned_posts'
    ORDER BY child.relname
  `);

  return result.rows;
}
