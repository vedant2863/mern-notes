import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, closeConnection } from '../../shared/connection.js';
import { clearAllTables, seedUsers } from '../../shared/test-helpers.js';

const exercisePath = process.env.SOLUTIONS
  ? '../../solutions/36-the-bulk-highway.solution.ts'
  : './exercise.ts';

const {
  bulkInsertUsers,
  copyInsertFromCsv,
  createUnloggedStagingTable,
  bulkUpdateUserStatus,
  bulkSoftDelete,
  compareBulkMethods,
} = await import(exercisePath);

describe('Chapter 36: The Bulk Highway', () => {
  beforeEach(async () => {
    await clearAllTables();
  });

  afterAll(async () => {
    await closeConnection();
  });

  it('should bulk insert users using batch VALUES', async () => {
    const count = await bulkInsertUsers(50);

    expect(count).toBe(50);

    // Verify rows actually exist
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*)::int as count FROM users WHERE username LIKE 'bulk_user_%'`,
    );
    expect(result.rows[0].count).toBe(50);
  });

  it('should insert users via COPY FROM STDIN with CSV data', async () => {
    const csvRows = [];
    for (let i = 1; i <= 20; i++) {
      csvRows.push(`copy_user_${i},copy_user_${i}@test.com,Copy User ${i}`);
    }
    const csvData = csvRows.join('\n') + '\n';

    const rowCount = await copyInsertFromCsv(csvData);

    expect(rowCount).toBe(20);

    // Verify rows exist
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*)::int as count FROM users WHERE username LIKE 'copy_user_%'`,
    );
    expect(result.rows[0].count).toBe(20);
  });

  it('should create an unlogged staging table and copy data to the real table', async () => {
    const rowCount = await createUnloggedStagingTable();

    expect(rowCount).toBe(100);

    // Verify rows exist in the real users table
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*)::int as count FROM users WHERE username LIKE 'staged_user_%'`,
    );
    expect(result.rows[0].count).toBe(100);

    // Verify the staging table was dropped
    const tableCheck = await pool.query(
      `SELECT COUNT(*)::int as count FROM information_schema.tables
       WHERE table_name = 'staging_users' AND table_schema = 'public'`,
    );
    expect(tableCheck.rows[0].count).toBe(0);
  });

  it('should bulk update user status using ANY()', async () => {
    const users = await seedUsers(5);
    const userIds = users.map((u: any) => u.id);

    const updated = await bulkUpdateUserStatus(userIds.slice(0, 3), 'offline');

    expect(updated).toBe(3);

    // Verify the status was updated
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, status FROM users WHERE id = ANY($1::int[]) ORDER BY id`,
      [userIds],
    );
    // First 3 should be offline, last 2 should be online
    expect(result.rows[0].status).toBe('offline');
    expect(result.rows[1].status).toBe('offline');
    expect(result.rows[2].status).toBe('offline');
    expect(result.rows[3].status).toBe('online');
    expect(result.rows[4].status).toBe('online');
  });

  it('should soft-delete old records in batches', async () => {
    const pool = getPool();

    // Insert users with old created_at timestamps
    for (let i = 1; i <= 10; i++) {
      await pool.query(
        `INSERT INTO users (username, email, display_name, created_at)
         VALUES ($1, $2, $3, NOW() - INTERVAL '100 days')`,
        [`old_user_${i}`, `old_${i}@test.com`, `Old User ${i}`],
      );
    }
    // Insert some recent users
    await seedUsers(3);

    const totalDeleted = await bulkSoftDelete(90, 5);

    expect(totalDeleted).toBe(10);

    // Verify recent users still exist
    const result = await pool.query(
      `SELECT COUNT(*)::int as count FROM users`,
    );
    expect(result.rows[0].count).toBe(3);
  });

  it('should benchmark and compare bulk insertion methods', async () => {
    const results = await compareBulkMethods(50);

    expect(results).toBeDefined();
    expect(typeof results.singleInsertMs).toBe('number');
    expect(typeof results.batchInsertMs).toBe('number');
    expect(typeof results.copyMs).toBe('number');

    // All timings should be non-negative
    expect(results.singleInsertMs).toBeGreaterThanOrEqual(0);
    expect(results.batchInsertMs).toBeGreaterThanOrEqual(0);
    expect(results.copyMs).toBeGreaterThanOrEqual(0);

    // Batch should generally be faster than single (not strictly enforced for small N)
    // Just verify all methods completed successfully
  });
});
