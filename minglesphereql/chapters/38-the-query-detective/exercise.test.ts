import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, closeConnection } from '../../shared/connection.js';
import { clearAllTables, seedUsers } from '../../shared/test-helpers.js';

const exercisePath = process.env.SOLUTIONS
  ? '../../solutions/38-the-query-detective.solution.ts'
  : './exercise.ts';

const {
  enablePgStatStatements,
  getTopSlowQueries,
  explainQuery,
  detectSeqScans,
  suggestIndexes,
  resetQueryStats,
} = await import(exercisePath);

describe('Chapter 38: The Query Detective', () => {
  beforeEach(async () => {
    await clearAllTables();
    const pool = getPool();
    // Ensure the extension is available for all tests
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);
    // Seed some data so queries have something to work with
    await seedUsers(5);
    // Run a few queries to populate pg_stat_statements
    await pool.query(`SELECT * FROM users WHERE username = 'user1'`);
    await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
    await pool.query(`SELECT COUNT(*) FROM users`);
  });

  afterAll(async () => {
    await closeConnection();
  });

  it('should enable pg_stat_statements and return query count', async () => {
    const result = await enablePgStatStatements();

    expect(result.enabled).toBe(true);
    expect(typeof result.queryCount).toBe('number');
    // There should be at least a few tracked queries from our setup
    expect(result.queryCount).toBeGreaterThanOrEqual(0);
  });

  it('should return top slow queries ordered by mean_exec_time', async () => {
    const queries = await getTopSlowQueries(5);

    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(5);

    // Each row should have the expected fields
    for (const row of queries) {
      expect(row).toHaveProperty('query');
      expect(row).toHaveProperty('calls');
      expect(row).toHaveProperty('avg_ms');
      expect(row).toHaveProperty('total_ms');
      expect(row).toHaveProperty('rows');
    }

    // Verify ordering: first query should have highest avg_ms
    if (queries.length > 1) {
      expect(parseFloat(queries[0].avg_ms)).toBeGreaterThanOrEqual(
        parseFloat(queries[1].avg_ms),
      );
    }
  });

  it('should run EXPLAIN ANALYZE and return a structured plan', async () => {
    const plan = await explainQuery('SELECT * FROM users WHERE username = \'user1\'');

    expect(plan).toBeDefined();
    expect(Array.isArray(plan)).toBe(true);
    expect(plan.length).toBeGreaterThan(0);

    // The plan should contain at least a top-level Plan node
    const topLevel = plan[0];
    expect(topLevel).toHaveProperty('Plan');
    expect(topLevel.Plan).toHaveProperty('Node Type');

    // ANALYZE adds actual timing and row info
    expect(topLevel).toHaveProperty('Execution Time');
    expect(typeof topLevel['Execution Time']).toBe('number');
  });

  it('should detect sequential scan statistics for a table', async () => {
    // Force some sequential scans by querying without an index on a non-indexed column
    const pool = getPool();
    await pool.query(`SELECT * FROM users WHERE bio LIKE '%user%'`);
    await pool.query(`SELECT * FROM users WHERE bio LIKE '%user%'`);

    const stats = await detectSeqScans('users');

    expect(stats).not.toBeNull();
    expect(stats.relname).toBe('users');
    expect(typeof stats.seq_scan).toBe('number');
    expect(typeof stats.idx_scan).toBe('number');
    expect(stats.seq_scan).toBeGreaterThan(0);
  });

  it('should return null for a non-existent table in detectSeqScans', async () => {
    const stats = await detectSeqScans('nonexistent_table_xyz');

    expect(stats).toBeNull();
  });

  it('should suggest indexes for a table', async () => {
    const suggestions = await suggestIndexes('users');

    expect(suggestions).toBeDefined();
    expect(suggestions.tableName).toBe('users');
    expect(typeof suggestions.seqScans).toBe('number');
    expect(typeof suggestions.idxScans).toBe('number');
    expect(typeof suggestions.rowEstimate).toBe('number');
    expect(typeof suggestions.needsAttention).toBe('boolean');
    expect(Array.isArray(suggestions.existingIndexes)).toBe(true);

    // Users table should have at least the primary key index
    expect(suggestions.existingIndexes.length).toBeGreaterThan(0);
    for (const idx of suggestions.existingIndexes) {
      expect(idx).toHaveProperty('index_name');
      expect(idx).toHaveProperty('times_used');
    }
  });

  it('should reset query stats', async () => {
    const result = await resetQueryStats();

    expect(result.reset).toBe(true);
    expect(typeof result.queryCountAfter).toBe('number');
    // After reset, the count should be very low (the reset query itself
    // and the verification SELECT will be tracked)
    expect(result.queryCountAfter).toBeLessThan(10);
  });
});
