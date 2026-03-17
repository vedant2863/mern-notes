import { getPool } from '../shared/connection.js';

/**
 * Chapter 38: The Query Detective - SOLUTIONS
 *
 * PostgreSQL includes powerful self-monitoring capabilities that most
 * developers never use. pg_stat_statements tracks every query
 * automatically, and EXPLAIN ANALYZE reveals exactly how the database
 * executes each one. Together, they turn you into a query detective
 * who can find and fix performance problems systematically.
 */

/**
 * Enable pg_stat_statements and verify it is active.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   When a database-backed application is slow, developers typically
 *   guess which queries are the culprits. They add console.time()
 *   around database calls, but this measures application-level latency
 *   (including network + connection pool wait), not actual DB execution.
 *
 * THE REGULAR WAY:
 *   Instrument every query call site with timing code. Parse logs.
 *   Build custom monitoring. Miss the queries you forgot to instrument.
 *
 * THE POSTGRESQL WAY:
 *   `CREATE EXTENSION pg_stat_statements` — one command, and PG starts
 *   tracking EVERY query automatically: execution count, total time,
 *   mean time, rows returned, buffer hits vs. disk reads.
 *
 * WHY PG IS BETTER:
 *   - Zero code changes — the database does all the tracking
 *   - Catches ALL queries, including those from ORMs, migrations, cron jobs
 *   - Tracks normalized queries (parameters replaced with $1, $2, etc.)
 *     so `SELECT * FROM users WHERE id = 5` and `... WHERE id = 99`
 *     are grouped as one query pattern
 *   - Minimal overhead (~2% in typical workloads)
 *
 * REAL-WORLD USAGE:
 *   Every production PostgreSQL database should have pg_stat_statements
 *   enabled. Monitoring tools like pganalyze, Datadog, and pgwatch2 all
 *   read from it. It is the foundation of database performance monitoring.
 */
export async function enablePgStatStatements(): Promise<{
  enabled: boolean;
  queryCount: number;
}> {
  const pool = getPool();

  // CREATE EXTENSION IF NOT EXISTS is idempotent — safe to run repeatedly.
  // pg_stat_statements ships with PostgreSQL but must be explicitly enabled.
  // On some managed services, it requires setting shared_preload_libraries
  // in postgresql.conf (usually pre-configured on RDS, Cloud SQL, etc.).
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);

  // Verify the extension is working by querying it.
  // The view pg_stat_statements contains one row per unique query pattern.
  const result = await pool.query(
    `SELECT COUNT(*)::int as query_count FROM pg_stat_statements`,
  );

  return {
    enabled: true,
    queryCount: result.rows[0].query_count,
  };
}

/**
 * Find the slowest queries by mean execution time.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   In a system with thousands of query patterns, you need to know
 *   which ones consume the most database time. A query that runs
 *   1000 times at 50ms each is worse than a query that runs once at
 *   2 seconds — and pg_stat_statements reveals both.
 *
 * THE REGULAR WAY:
 *   Enable slow query logging (log_min_duration_statement), parse the
 *   CSV logs, aggregate manually. Misses queries that are individually
 *   fast but collectively expensive due to high call frequency.
 *
 * THE POSTGRESQL WAY:
 *   Query pg_stat_statements directly. Sort by mean_exec_time to find
 *   the slowest individual queries, or by total_exec_time to find the
 *   queries consuming the most cumulative database time.
 *
 * WHY PG IS BETTER:
 *   - Pre-aggregated — no log parsing needed
 *   - Normalized query text groups identical patterns
 *   - Shows buffer statistics (shared_blks_hit vs shared_blks_read)
 *     to distinguish CPU-bound from I/O-bound queries
 *   - Available in real-time, not delayed by log rotation
 *
 * REAL-WORLD USAGE:
 *   Run this weekly to catch regression. Sort by total_exec_time to
 *   find the biggest optimization opportunities. Sort by calls to
 *   find the N+1 queries (extremely high call count).
 */
export async function getTopSlowQueries(limit: number): Promise<any[]> {
  const pool = getPool();

  // mean_exec_time: average execution time in milliseconds per call.
  // total_exec_time: cumulative time across all calls.
  // calls: how many times this query pattern was executed.
  // rows: total rows returned across all calls.
  //
  // We cast mean_exec_time and total_exec_time to numeric(10,2) for
  // readable output. We cast calls and rows to int for JS compatibility.
  const result = await pool.query(
    `SELECT
       query,
       calls::int as calls,
       mean_exec_time::numeric(10,2) as avg_ms,
       total_exec_time::numeric(10,2) as total_ms,
       rows::int as rows
     FROM pg_stat_statements
     ORDER BY mean_exec_time DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows;
}

/**
 * Run EXPLAIN ANALYZE on a query and return the structured plan.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   Knowing a query is slow (from pg_stat_statements) is step 1.
 *   Understanding WHY it is slow requires seeing the execution plan:
 *   which tables are scanned, which join strategy is used, how many
 *   rows are processed at each step, and where time is actually spent.
 *
 * THE REGULAR WAY:
 *   Stare at the query. Guess that it needs an index. Add the index.
 *   Hope it helps. (It often does not, because the real bottleneck
 *   was a bad join strategy or stale statistics.)
 *
 * THE POSTGRESQL WAY:
 *   EXPLAIN ANALYZE actually executes the query and annotates each
 *   plan node with real timing and row counts. FORMAT JSON makes the
 *   output machine-parseable. BUFFERS adds buffer/cache statistics.
 *
 * WHY PG IS BETTER:
 *   - Shows the ACTUAL execution path, not a guess
 *   - Compares estimated rows vs actual rows to detect stale stats
 *   - BUFFERS reveals whether data came from shared_buffers (fast)
 *     or disk (slow)
 *   - Nested nodes show exactly where in the plan time is spent
 *
 * REAL-WORLD USAGE:
 *   Always run EXPLAIN ANALYZE before and after an optimization to
 *   prove the fix worked. Save the before/after plans in your PR
 *   description. Use tools like explain.dalibo.com to visualize complex
 *   plans.
 *
 * READING THE PLAN:
 *   - "Node Type": "Seq Scan" — scanning every row (often bad on large tables)
 *   - "Node Type": "Index Scan" — using an index (usually good)
 *   - "Node Type": "Hash Join" — building a hash table for the join (good for large sets)
 *   - "Node Type": "Nested Loop" — looping through inner table per outer row (good for small sets)
 *   - "Actual Rows" vs "Plan Rows" — if these differ wildly, run ANALYZE
 *   - "Shared Hit Blocks" vs "Shared Read Blocks" — hit = from cache, read = from disk
 */
export async function explainQuery(query: string): Promise<any> {
  const pool = getPool();

  // EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) runs the query and returns
  // the execution plan as a JSON array.
  //
  // ANALYZE: actually execute the query (not just estimate)
  // BUFFERS: include buffer usage statistics (cache hits vs disk reads)
  // FORMAT JSON: structured output instead of text
  //
  // WARNING: EXPLAIN ANALYZE executes the query for real! For INSERT,
  // UPDATE, DELETE, wrap in a transaction and ROLLBACK if you only want
  // the plan without side effects.
  const result = await pool.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
  );

  // The result has a single row with a 'QUERY PLAN' key containing
  // the JSON plan array. The array has one element with the top-level
  // plan node, execution time, planning time, and triggers info.
  return result.rows[0]['QUERY PLAN'];
}

/**
 * Detect sequential scans on a specific table.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   Sequential scans on large tables are the most common cause of slow
 *   queries. A seq scan reads every row in the table, regardless of
 *   how many rows match the WHERE clause. On a 50M-row table, even
 *   a query returning 1 row will read all 50M if no index exists.
 *
 * THE REGULAR WAY:
 *   Run EXPLAIN on individual queries one by one to check for seq scans.
 *   Time-consuming and misses queries you did not think to check.
 *
 * THE POSTGRESQL WAY:
 *   pg_stat_user_tables tracks cumulative scan statistics per table.
 *   seq_scan counts how many sequential scans have occurred.
 *   idx_scan counts how many index scans have occurred.
 *   If seq_scan >> idx_scan on a large table, indexes are missing or
 *   not being used.
 *
 * WHY PG IS BETTER:
 *   - One query gives you the scan profile for any table
 *   - Cumulative counts reveal patterns over time
 *   - seq_tup_read shows how many rows were read by seq scans
 *   - No need to analyze individual queries — the table-level stats
 *     point you to the right table, then EXPLAIN pinpoints the query
 *
 * REAL-WORLD USAGE:
 *   Set up alerts when seq_scan grows rapidly on large tables.
 *   Review pg_stat_user_tables weekly to catch tables that have
 *   grown beyond the "seq scan is fine" threshold (~1000 rows).
 */
export async function detectSeqScans(tableName: string): Promise<any> {
  const pool = getPool();

  // pg_stat_user_tables contains one row per user table with cumulative
  // statistics since the last stats reset (pg_stat_reset()).
  //
  // Key columns:
  //   seq_scan: number of sequential scans initiated on this table
  //   seq_tup_read: rows fetched by sequential scans
  //   idx_scan: number of index scans initiated on this table
  //   idx_tup_fetch: rows fetched by index scans
  const result = await pool.query(
    `SELECT
       schemaname,
       relname,
       seq_scan::int as seq_scan,
       seq_tup_read::bigint as seq_tup_read,
       idx_scan::int as idx_scan,
       idx_tup_fetch::bigint as idx_tup_fetch
     FROM pg_stat_user_tables
     WHERE relname = $1`,
    [tableName],
  );

  // Return null if the table does not exist in the stats view
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Analyze a table's query patterns and suggest whether it needs
 * better indexing.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   Developers add indexes reactively — after users complain about
 *   slowness. By then, the damage is done. Proactive index analysis
 *   catches missing indexes before they become production incidents.
 *
 * THE REGULAR WAY:
 *   Review every query in the codebase, cross-reference with existing
 *   indexes, manually decide what is missing. Error-prone and does not
 *   account for ORM-generated queries or ad-hoc queries from admin tools.
 *
 * THE POSTGRESQL WAY:
 *   Combine pg_stat_user_tables (scan statistics) with
 *   pg_stat_user_indexes (index usage statistics) to get a complete
 *   picture. If a table has many seq scans, few index scans, and many
 *   rows, it almost certainly needs better indexes.
 *
 * WHY PG IS BETTER:
 *   - Data-driven: decisions based on actual usage patterns
 *   - Catches ORM-generated queries you might not know about
 *   - pg_stat_user_indexes shows which existing indexes are actually
 *     used (so you can also drop unused ones)
 *   - No code changes — just query the system catalogs
 *
 * REAL-WORLD USAGE:
 *   Run this analysis during capacity planning reviews. Combine with
 *   pg_stat_statements to identify which specific queries are causing
 *   the sequential scans, then add targeted indexes for those patterns.
 */
export async function suggestIndexes(tableName: string): Promise<any> {
  const pool = getPool();

  // Step 1: Get the table's scan statistics.
  // seq_scan vs idx_scan tells us the ratio of full scans to indexed scans.
  // n_live_tup is the estimated number of live (non-deleted) rows.
  const statsResult = await pool.query(
    `SELECT seq_scan::int, idx_scan::int, n_live_tup::bigint as row_estimate
     FROM pg_stat_user_tables
     WHERE relname = $1`,
    [tableName],
  );

  const stats = statsResult.rows[0] || { seq_scan: 0, idx_scan: 0, row_estimate: 0 };

  // Step 2: Get existing index information.
  // pg_stat_user_indexes shows each index, how many times it was used
  // (idx_scan), and how many tuples it fetched (idx_tup_fetch).
  // Indexes with idx_scan = 0 are unused and candidates for removal.
  const indexResult = await pool.query(
    `SELECT indexrelname as index_name, idx_scan::int as times_used
     FROM pg_stat_user_indexes
     WHERE relname = $1
     ORDER BY idx_scan DESC`,
    [tableName],
  );

  // Step 3: Determine if the table needs attention.
  // Heuristic: if seq_scan exceeds idx_scan AND the table has more
  // than 100 rows, it likely needs better indexing. Small tables
  // (< 100 rows) are fine with seq scans because the overhead of
  // index traversal outweighs the savings.
  const needsAttention =
    stats.seq_scan > stats.idx_scan && Number(stats.row_estimate) > 100;

  return {
    tableName,
    seqScans: stats.seq_scan,
    idxScans: stats.idx_scan,
    rowEstimate: Number(stats.row_estimate),
    needsAttention,
    existingIndexes: indexResult.rows,
  };
}

/**
 * Reset pg_stat_statements counters for fresh monitoring.
 *
 * WHAT PROBLEM THIS SOLVES:
 *   After deploying a fix (e.g., adding an index), you want to measure
 *   the impact from a clean baseline. Old statistics from before the
 *   fix would skew the averages.
 *
 * THE REGULAR WAY:
 *   Wait for the old data to "dilute" as new queries come in. Or
 *   restart the database (losing all stats). Neither is great.
 *
 * THE POSTGRESQL WAY:
 *   pg_stat_statements_reset() clears all tracked query statistics
 *   instantly. The extension immediately starts collecting fresh data.
 *   You can also selectively reset stats for a specific user or
 *   database by passing optional parameters.
 *
 * WHY PG IS BETTER:
 *   - Instant, non-disruptive reset
 *   - Can reset selectively (per user, per database, or globally)
 *   - No restart needed
 *   - New data starts accumulating immediately
 *
 * REAL-WORLD USAGE:
 *   Reset after major deployments or schema changes. Some teams reset
 *   weekly and export the old stats to a time-series database for
 *   historical trending. This gives you both fresh short-term data
 *   and long-term historical data.
 */
export async function resetQueryStats(): Promise<{
  reset: boolean;
  queryCountAfter: number;
}> {
  const pool = getPool();

  // pg_stat_statements_reset() clears all query statistics.
  // It returns void. Requires superuser or pg_read_all_stats role.
  //
  // Optional parameters (PG 12+):
  //   pg_stat_statements_reset(userid, dbid, queryid)
  //   Pass 0/0/0 to reset everything (same as no args).
  await pool.query(`SELECT pg_stat_statements_reset()`);

  // Verify the reset worked by counting remaining entries.
  // There will be a few entries because the reset() call itself and
  // this SELECT are new queries that get tracked immediately.
  const result = await pool.query(
    `SELECT COUNT(*)::int as query_count FROM pg_stat_statements`,
  );

  return {
    reset: true,
    queryCountAfter: result.rows[0].query_count,
  };
}
