import { getDb, getPool, schema } from '../shared/connection.js';
import { Readable } from 'stream';
import { from as copyFrom } from 'pg-copy-streams';

/**
 * Chapter 36: The Bulk Highway - SOLUTIONS
 *
 * This chapter demonstrates high-performance bulk data operations in PostgreSQL.
 * Every function includes a detailed explanation of the problem, the naive approach,
 * and why the optimized approach is superior — with real-world performance context.
 */

/**
 * Insert N users using batch INSERT with Drizzle's values([...]).
 *
 * ━━━ What problem we're solving ━━━
 * MingleSphere needs to import thousands of user profiles from a partner
 * acquisition. We need to insert them as fast as possible without
 * overwhelming the database or causing timeouts.
 *
 * ━━━ Regular way (single INSERT per row) ━━━
 * Loop through each row and execute INSERT one at a time:
 *   for (const user of users) await db.insert(schema.users).values(user);
 * This sends N separate SQL statements, each requiring a network round
 * trip, query parse, plan, and execute cycle. For 10,000 rows, that's
 * 10,000 round trips — typically ~1,000 rows/sec on localhost, much
 * slower over a network.
 *
 * ━━━ PostgreSQL way (batch VALUES) ━━━
 * Send all rows in a single INSERT with a multi-row VALUES clause:
 *   INSERT INTO users (username, email, ...) VALUES (...), (...), (...);
 * Drizzle's .values([...]) generates this automatically. One round trip,
 * one parse, one plan, one execute. For 10,000 rows: ~10,000-50,000 rows/sec.
 *
 * ━━━ Why PG way is better ━━━
 * - 1 network round trip instead of N
 * - 1 transaction instead of N (reduced WAL overhead)
 * - PostgreSQL optimizes multi-row VALUES internally
 * - 10-50x faster for typical batch sizes (1,000-10,000 rows)
 *
 * @example
 *   const count = await bulkInsertUsers(10000);
 *   // Inserts 10,000 users in a single statement — takes ~200ms
 */
export async function bulkInsertUsers(count: number): Promise<number> {
  const db = getDb();

  // Build the array of row objects for Drizzle's batch insert.
  // Drizzle will generate: INSERT INTO users (...) VALUES (...), (...), ...
  const rows = Array.from({ length: count }, (_, i) => ({
    username: `bulk_user_${i + 1}`,
    email: `bulk_user_${i + 1}@minglesphereql.dev`,
    displayName: `Bulk User ${i + 1}`,
  }));

  // Single INSERT with multi-row VALUES clause.
  // This is dramatically faster than looping because:
  // 1. Only one network round trip to the database
  // 2. PostgreSQL parses and plans the query once
  // 3. All rows are written in a single transaction (less WAL pressure)
  await db.insert(schema.users).values(rows);

  return count;
}

/**
 * Use PostgreSQL's COPY FROM STDIN to load CSV data into the users table.
 *
 * ━━━ What problem we're solving ━━━
 * We have a CSV file with 100,000+ rows. Even batch INSERT has limits —
 * PostgreSQL must parse the entire VALUES clause as SQL text, which gets
 * slow for very large batches. We need the fastest possible data loading.
 *
 * ━━━ Regular way (batch INSERT) ━━━
 * Chunk the CSV into groups of 1,000 and batch-insert each chunk.
 * For 100,000 rows, that's 100 INSERT statements. Fast, but not the
 * fastest. The SQL parser still processes each VALUES list as text.
 *
 * ━━━ PostgreSQL way (COPY) ━━━
 * COPY FROM STDIN streams raw data directly into the table's storage
 * layer (heap). It bypasses the SQL parser, planner, and executor
 * entirely. The data goes through a specialized bulk-loading path
 * that is optimized for throughput: ~100,000 rows/sec or more.
 *
 * ━━━ Why PG way is better ━━━
 * - 100x faster than single INSERT, 5-10x faster than batch INSERT
 * - Minimal WAL overhead (fewer WAL records per row)
 * - Streaming: data is sent as a continuous byte stream, not SQL text
 * - Native CSV parsing built into PostgreSQL (no client-side parsing)
 * - Used by pg_dump/pg_restore for exactly this reason
 *
 * @example
 *   const csv = "alice,alice@test.com,Alice\nbob,bob@test.com,Bob\n";
 *   const count = await copyInsertFromCsv(csv);
 *   // count === 2
 */
export async function copyInsertFromCsv(csvData: string): Promise<number> {
  const pool = getPool();

  // We need a dedicated client (not a pool query) because COPY
  // operates as a streaming protocol that holds the connection
  // for the duration of the transfer.
  const client = await pool.connect();

  try {
    // copyFrom() creates a writable stream that sends data to PostgreSQL
    // using the COPY protocol. FORMAT csv tells PG to parse the input
    // as comma-separated values.
    const stream = client.query(
      copyFrom(
        `COPY users (username, email, display_name) FROM STDIN WITH (FORMAT csv)`,
      ),
    );

    // Create a readable stream from the CSV string.
    // In production, this would be a file stream (fs.createReadStream)
    // or an HTTP response stream — COPY handles backpressure automatically.
    const readable = Readable.from(csvData);

    // Pipe the CSV data into the COPY stream.
    readable.pipe(stream);

    // Wait for the stream to finish. The COPY protocol sends a
    // completion message with the row count when done.
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // stream.rowCount contains the number of rows successfully copied
    return (stream as any).rowCount || 0;
  } finally {
    // Always release the client back to the pool, even on error.
    // Failing to release causes connection pool exhaustion.
    client.release();
  }
}

/**
 * Create an UNLOGGED staging table for high-speed temporary writes.
 *
 * ━━━ What problem we're solving ━━━
 * Before inserting imported data into the production table, we want to
 * stage it for validation (check for duplicates, fix formatting, etc.).
 * But staging into a regular table still writes to WAL, which is
 * unnecessary for temporary data we can re-import.
 *
 * ━━━ Regular way (temporary data in a regular table) ━━━
 * Create a regular table, insert staging data, validate, copy to
 * production table, drop the staging table. Every write goes through
 * WAL (write-ahead log), which provides crash recovery but adds I/O
 * overhead we don't need for throwaway data.
 *
 * ━━━ PostgreSQL way (UNLOGGED TABLE) ━━━
 * UNLOGGED tables skip WAL writes entirely. Data is written directly
 * to the heap without journaling. This makes writes ~2x faster. The
 * trade-off: data is lost on crash. But for staging data that can be
 * re-imported, this is an excellent trade-off.
 *
 * ━━━ Why PG way is better ━━━
 * - ~2x faster writes (no WAL overhead)
 * - Reduces WAL volume (less I/O pressure on the WAL disk)
 * - Ideal for ETL staging, temporary aggregation tables, caches
 * - Still supports indexes, constraints, and queries like a normal table
 * - Explicitly signals intent: "this data is expendable"
 *
 * @example
 *   const rowsCopied = await createUnloggedStagingTable();
 *   // Stages 100 rows in an unlogged table, then copies to the real table
 */
export async function createUnloggedStagingTable(): Promise<number> {
  const pool = getPool();

  // Step 1: Create an UNLOGGED table for staging.
  // UNLOGGED skips WAL writes — data is lost on crash but writes are ~2x faster.
  // IF NOT EXISTS makes this idempotent (safe to call multiple times).
  await pool.query(`
    CREATE UNLOGGED TABLE IF NOT EXISTS staging_users (
      username TEXT,
      email TEXT,
      display_name TEXT
    )
  `);

  // Step 2: Insert test data into the staging table.
  // In production, this would be a COPY or batch INSERT from a CSV file.
  // We build a multi-row VALUES clause for speed.
  const values: string[] = [];
  const params: string[] = [];
  for (let i = 1; i <= 100; i++) {
    const offset = (i - 1) * 3;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
    params.push(`staged_user_${i}`, `staged_${i}@test.com`, `Staged User ${i}`);
  }
  await pool.query(
    `INSERT INTO staging_users (username, email, display_name) VALUES ${values.join(', ')}`,
    params,
  );

  // Step 3: Copy validated data from staging to the real table.
  // INSERT INTO ... SELECT is atomic — either all rows copy or none do.
  // This is the "validate then promote" pattern common in ETL pipelines.
  const result = await pool.query(`
    INSERT INTO users (username, email, display_name)
    SELECT username, email, display_name FROM staging_users
  `);

  // Step 4: Drop the staging table. It served its purpose.
  await pool.query(`DROP TABLE staging_users`);

  return result.rowCount || 0;
}

/**
 * Update the status of many users at once using ANY().
 *
 * ━━━ What problem we're solving ━━━
 * An admin action sets 5,000 users to "offline" status (e.g., after
 * a maintenance window). We need to update all of them efficiently.
 *
 * ━━━ Regular way (loop of single UPDATEs) ━━━
 * Loop through userIds and execute UPDATE for each:
 *   for (const id of userIds) await pool.query('UPDATE users SET status = $1 WHERE id = $2', [...]);
 * This sends N separate statements. Slow and wasteful.
 *
 * ━━━ PostgreSQL way (ANY() with array parameter) ━━━
 * Pass the entire ID array as a single parameter:
 *   UPDATE users SET status = $1 WHERE id = ANY($2::int[])
 * PostgreSQL expands the array internally and uses an index scan.
 * One round trip, one transaction, one lock acquisition.
 *
 * ━━━ Why PG way is better ━━━
 * - 1 round trip instead of N
 * - ANY($1::int[]) uses index scans (same as WHERE id = X)
 * - No massive SQL string to parse (unlike IN (1, 2, 3, ..., 5000))
 * - Array is sent as a binary parameter, not SQL text
 * - PostgreSQL handles the array-to-set expansion internally
 *
 * @example
 *   const updated = await bulkUpdateUserStatus([1, 2, 3, 4, 5], 'offline');
 *   // updated === 5
 */
export async function bulkUpdateUserStatus(
  userIds: number[],
  newStatus: string,
): Promise<number> {
  const pool = getPool();

  // ANY($2::int[]) tells PostgreSQL: "match any value in this integer array."
  // The ::int[] cast is required so PG knows the parameter type.
  // Under the hood, PostgreSQL converts this to an index scan — it does NOT
  // do a sequential scan even for large arrays.
  const result = await pool.query(
    `UPDATE users SET status = $1 WHERE id = ANY($2::int[])`,
    [newStatus, userIds],
  );

  return result.rowCount || 0;
}

/**
 * Soft-delete old records in batches to avoid long locks.
 *
 * ━━━ What problem we're solving ━━━
 * We need to delete 50,000 old user accounts. A single DELETE that
 * matches 50,000 rows holds an exclusive lock on all those rows for
 * the entire transaction duration. This blocks other queries that
 * need those rows and prevents autovacuum from cleaning up.
 *
 * ━━━ Regular way (single massive DELETE) ━━━
 *   DELETE FROM users WHERE created_at < NOW() - INTERVAL '90 days';
 * If this matches 50,000 rows, the transaction holds locks on all of
 * them until COMMIT. Other queries block. Autovacuum waits. If the
 * DELETE takes 30 seconds, that's 30 seconds of degraded performance.
 *
 * ━━━ PostgreSQL way (batched DELETE with LIMIT subquery) ━━━
 * Delete in fixed-size batches using a subquery with LIMIT:
 *   DELETE FROM users WHERE id IN (SELECT id FROM users WHERE ... LIMIT 5000)
 * Each batch holds locks only briefly. Between batches, other queries
 * can proceed and autovacuum can do its work.
 *
 * ━━━ Why PG way is better ━━━
 * - Short-lived locks: each batch locks only 5,000 rows for milliseconds
 * - Autovacuum can run between batches (prevents table bloat)
 * - Other queries are not blocked for the entire delete duration
 * - If the process crashes mid-way, only the current batch is lost
 * - Progress is visible: you can log "deleted batch 7 of ~10"
 *
 * @example
 *   const deleted = await bulkSoftDelete(90, 5000);
 *   // Deletes all users older than 90 days, 5000 at a time
 */
export async function bulkSoftDelete(
  olderThanDays: number,
  batchSize: number = 5000,
): Promise<number> {
  const pool = getPool();
  let totalDeleted = 0;
  let batchDeleted: number;

  // Loop until no more rows match the criteria.
  // Each iteration deletes at most `batchSize` rows, then commits
  // (implicit commit — each pool.query is auto-committed).
  do {
    const result = await pool.query(
      `DELETE FROM users
       WHERE id IN (
         SELECT id FROM users
         WHERE created_at < NOW() - ($1 || ' days')::interval
         LIMIT $2
       )`,
      [olderThanDays.toString(), batchSize],
    );

    batchDeleted = result.rowCount || 0;
    totalDeleted += batchDeleted;

    // In production, you might add a small delay here:
    //   await new Promise(r => setTimeout(r, 100));
    // This gives other queries and autovacuum a chance to breathe.
  } while (batchDeleted > 0);

  return totalDeleted;
}

/**
 * Benchmark three bulk insertion methods and return timing results.
 *
 * ━━━ What problem we're solving ━━━
 * The team needs to choose the right bulk insertion strategy. The answer
 * depends on the data volume: for 100 rows, the difference is negligible;
 * for 100,000 rows, the difference is massive. This benchmark provides
 * concrete numbers to guide the decision.
 *
 * ━━━ Method 1: Single INSERT (baseline) ━━━
 * One INSERT per row. N round trips, N parses, N plans.
 * Performance: ~500-2,000 rows/sec depending on network latency.
 * Use case: fine for <100 rows, never for bulk operations.
 *
 * ━━━ Method 2: Batch INSERT (practical default) ━━━
 * One INSERT with multi-row VALUES clause. 1 round trip.
 * Performance: ~10,000-50,000 rows/sec.
 * Use case: best balance of speed, simplicity, and safety. Works
 * with Drizzle/ORM, supports RETURNING, triggers fire per row.
 *
 * ━━━ Method 3: COPY (maximum speed) ━━━
 * Streams raw data into table storage, bypassing the SQL layer.
 * Performance: ~100,000-500,000 rows/sec.
 * Use case: large imports (>10,000 rows), ETL pipelines, migrations.
 * Trade-offs: no RETURNING, triggers don't fire, no per-row defaults.
 *
 * ━━━ When to use each ━━━
 * - < 100 rows: single INSERT is fine, readability wins
 * - 100 - 10,000 rows: batch INSERT (Drizzle .values([...]))
 * - > 10,000 rows: COPY for maximum throughput
 * - Staging/ETL: COPY into UNLOGGED table, then INSERT...SELECT to production
 *
 * @example
 *   const results = await compareBulkMethods(1000);
 *   console.log(`Single: ${results.singleInsertMs}ms`);
 *   console.log(`Batch:  ${results.batchInsertMs}ms`);
 *   console.log(`COPY:   ${results.copyMs}ms`);
 */
export async function compareBulkMethods(
  rowCount: number,
): Promise<{ singleInsertMs: number; batchInsertMs: number; copyMs: number }> {
  const pool = getPool();
  const db = getDb();

  // ── Method 1: Single INSERT (one row at a time) ──
  const singleStart = performance.now();
  for (let i = 1; i <= rowCount; i++) {
    await pool.query(
      `INSERT INTO users (username, email, display_name) VALUES ($1, $2, $3)`,
      [`bench_single_${i}`, `bench_single_${i}@test.com`, `Bench Single ${i}`],
    );
  }
  const singleInsertMs = Math.round((performance.now() - singleStart) * 100) / 100;

  // Clean up between methods so each starts with the same baseline
  await pool.query(`DELETE FROM users WHERE username LIKE 'bench_%'`);

  // ── Method 2: Batch INSERT (one statement, many rows) ──
  const batchStart = performance.now();
  const batchRows = Array.from({ length: rowCount }, (_, i) => ({
    username: `bench_batch_${i + 1}`,
    email: `bench_batch_${i + 1}@test.com`,
    displayName: `Bench Batch ${i + 1}`,
  }));
  await db.insert(schema.users).values(batchRows);
  const batchInsertMs = Math.round((performance.now() - batchStart) * 100) / 100;

  // Clean up
  await pool.query(`DELETE FROM users WHERE username LIKE 'bench_%'`);

  // ── Method 3: COPY (streaming bulk load) ──
  const copyStart = performance.now();
  const csvLines: string[] = [];
  for (let i = 1; i <= rowCount; i++) {
    csvLines.push(`bench_copy_${i},bench_copy_${i}@test.com,Bench Copy ${i}`);
  }
  const csvData = csvLines.join('\n') + '\n';

  const client = await pool.connect();
  try {
    const stream = client.query(
      copyFrom(
        `COPY users (username, email, display_name) FROM STDIN WITH (FORMAT csv)`,
      ),
    );
    const readable = Readable.from(csvData);
    readable.pipe(stream);
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  } finally {
    client.release();
  }
  const copyMs = Math.round((performance.now() - copyStart) * 100) / 100;

  // Final cleanup
  await pool.query(`DELETE FROM users WHERE username LIKE 'bench_%'`);

  return { singleInsertMs, batchInsertMs, copyMs };
}
