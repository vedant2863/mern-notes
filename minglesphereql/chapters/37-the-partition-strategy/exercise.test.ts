import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, closeConnection } from '../../shared/connection.js';
import { clearAllTables, seedUsers } from '../../shared/test-helpers.js';

const exercisePath = process.env.SOLUTIONS
  ? '../../solutions/37-the-partition-strategy.solution.ts'
  : './exercise.ts';

const {
  createPartitionedPostsTable,
  createMonthlyPartition,
  insertIntoPartitionedTable,
  queryWithPartitionPruning,
  detachOldPartition,
  getPartitionStats,
} = await import(exercisePath);

describe('Chapter 37: The Partition Strategy', () => {
  beforeEach(async () => {
    const pool = getPool();
    // Drop the partitioned table and any lingering partitions
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_01 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_02 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_03 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_04 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_12 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2025_01 CASCADE`);
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_01 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_02 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_03 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_04 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2024_12 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS partitioned_posts_2025_01 CASCADE`);
    await closeConnection();
  });

  it('should create a partitioned posts table', async () => {
    const result = await createPartitionedPostsTable();

    expect(result.created).toBe(true);

    // Verify the table exists and is partitioned
    const pool = getPool();
    const check = await pool.query(`
      SELECT relname, relkind
      FROM pg_class
      WHERE relname = 'partitioned_posts'
    `);
    expect(check.rows.length).toBe(1);
    // 'p' means partitioned table
    expect(check.rows[0].relkind).toBe('p');
  });

  it('should create a monthly partition with correct bounds', async () => {
    await createPartitionedPostsTable();

    const result = await createMonthlyPartition(2024, 3);

    expect(result.partitionName).toBe('partitioned_posts_2024_03');
    expect(result.created).toBe(true);

    // Verify partition exists as a child of partitioned_posts
    const pool = getPool();
    const check = await pool.query(`
      SELECT child.relname
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child ON pg_inherits.inhrelid = child.oid
      WHERE parent.relname = 'partitioned_posts'
    `);
    expect(check.rows.map((r: any) => r.relname)).toContain('partitioned_posts_2024_03');
  });

  it('should handle year rollover when creating December partition', async () => {
    await createPartitionedPostsTable();

    const result = await createMonthlyPartition(2024, 12);

    expect(result.partitionName).toBe('partitioned_posts_2024_12');
    expect(result.created).toBe(true);

    // Verify we can insert a December date into this partition
    const pool = getPool();
    await pool.query(
      `INSERT INTO partitioned_posts (author_id, content, created_at)
       VALUES (1, 'December post', '2024-12-15T12:00:00Z')`,
    );
    const rows = await pool.query(
      `SELECT * FROM partitioned_posts_2024_12`,
    );
    expect(rows.rows.length).toBe(1);
  });

  it('should insert data and route to the correct partition', async () => {
    await createPartitionedPostsTable();
    await createMonthlyPartition(2024, 1);
    await createMonthlyPartition(2024, 2);

    const posts = [
      { author_id: 1, content: 'January post', created_at: '2024-01-15T10:00:00Z' },
      { author_id: 2, content: 'February post', created_at: '2024-02-20T14:00:00Z' },
    ];

    const inserted = await insertIntoPartitionedTable(posts);

    expect(inserted.length).toBe(2);
    expect(inserted[0].content).toBe('January post');
    expect(inserted[1].content).toBe('February post');

    // Verify routing: query each partition directly
    const pool = getPool();
    const janRows = await pool.query(`SELECT * FROM partitioned_posts_2024_01`);
    const febRows = await pool.query(`SELECT * FROM partitioned_posts_2024_02`);
    expect(janRows.rows.length).toBe(1);
    expect(janRows.rows[0].content).toBe('January post');
    expect(febRows.rows.length).toBe(1);
    expect(febRows.rows[0].content).toBe('February post');
  });

  it('should query with partition pruning and return a plan', async () => {
    await createPartitionedPostsTable();
    await createMonthlyPartition(2024, 1);
    await createMonthlyPartition(2024, 2);
    await createMonthlyPartition(2024, 3);

    // Insert test data across months
    const posts = [
      { author_id: 1, content: 'Jan post', created_at: '2024-01-10T10:00:00Z' },
      { author_id: 1, content: 'Feb post', created_at: '2024-02-10T10:00:00Z' },
      { author_id: 1, content: 'Mar post', created_at: '2024-03-10T10:00:00Z' },
    ];
    await insertIntoPartitionedTable(posts);

    // Query only February
    const result = await queryWithPartitionPruning('2024-02-01', '2024-03-01');

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].content).toBe('Feb post');
    // The plan should exist and be a valid JSON structure
    expect(result.plan).toBeDefined();
    expect(Array.isArray(result.plan) || typeof result.plan === 'object').toBe(true);
  });

  it('should detach a partition instantly', async () => {
    await createPartitionedPostsTable();
    await createMonthlyPartition(2024, 1);
    await createMonthlyPartition(2024, 2);

    // Insert data into both partitions
    await insertIntoPartitionedTable([
      { author_id: 1, content: 'Jan post 1', created_at: '2024-01-05T10:00:00Z' },
      { author_id: 1, content: 'Jan post 2', created_at: '2024-01-20T10:00:00Z' },
      { author_id: 2, content: 'Feb post', created_at: '2024-02-10T10:00:00Z' },
    ]);

    const result = await detachOldPartition(2024, 1);

    expect(result.detached).toBe(true);
    expect(result.remainingRows).toBe(2); // 2 rows still in the detached standalone table

    // Verify the detached partition is no longer part of the parent
    const pool = getPool();
    const parentRows = await pool.query(`SELECT * FROM partitioned_posts`);
    expect(parentRows.rows.length).toBe(1); // Only Feb post remains
    expect(parentRows.rows[0].content).toBe('Feb post');

    // The detached table should still be queryable directly
    const detachedRows = await pool.query(`SELECT * FROM partitioned_posts_2024_01`);
    expect(detachedRows.rows.length).toBe(2);
  });

  it('should list partition stats', async () => {
    await createPartitionedPostsTable();
    await createMonthlyPartition(2024, 1);
    await createMonthlyPartition(2024, 2);
    await createMonthlyPartition(2024, 3);

    const stats = await getPartitionStats();

    expect(stats.length).toBe(3);
    expect(stats[0].partition_name).toBe('partitioned_posts_2024_01');
    expect(stats[1].partition_name).toBe('partitioned_posts_2024_02');
    expect(stats[2].partition_name).toBe('partitioned_posts_2024_03');
    // Each stat row should have size info
    for (const row of stats) {
      expect(row).toHaveProperty('total_bytes');
      expect(row).toHaveProperty('size');
      expect(row).toHaveProperty('estimated_rows');
    }
  });
});
