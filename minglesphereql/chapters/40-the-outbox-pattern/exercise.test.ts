import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, closeConnection } from '../../shared/connection.js';
import { clearAllTables, seedUsers } from '../../shared/test-helpers.js';

const exercisePath = process.env.SOLUTIONS
  ? '../../solutions/40-the-outbox-pattern.solution.ts'
  : './exercise.ts';

const {
  createOutboxTable,
  createPostWithOutboxEvent,
  processOutboxEvents,
  getUnprocessedEventCount,
  replayFailedEvents,
  cleanupProcessedEvents,
} = await import(exercisePath);

describe('Chapter 40: The Outbox Pattern', () => {
  let users: any[];

  beforeEach(async () => {
    await clearAllTables();
    const pool = getPool();
    await pool.query('DROP TABLE IF EXISTS outbox CASCADE');
    await createOutboxTable();
    users = await seedUsers(2);
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query('DROP TABLE IF EXISTS outbox CASCADE');
    await closeConnection();
  });

  it('should create the outbox table with correct columns', async () => {
    const pool = getPool();
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'outbox'
       ORDER BY ordinal_position`,
    );
    const colNames = cols.rows.map((r: any) => r.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('aggregate_type');
    expect(colNames).toContain('aggregate_id');
    expect(colNames).toContain('event_type');
    expect(colNames).toContain('payload');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('processed_at');

    // processed_at should be nullable
    const processedCol = cols.rows.find((r: any) => r.column_name === 'processed_at');
    expect(processedCol.is_nullable).toBe('YES');
  });

  it('should have a partial index on outbox for unprocessed events', async () => {
    const pool = getPool();
    const indexes = await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'outbox'`,
    );
    const partialIdx = indexes.rows.find((r: any) =>
      r.indexdef.includes('processed_at IS NULL'),
    );
    expect(partialIdx).toBeDefined();
  });

  it('should atomically insert a post and an outbox event', async () => {
    const post = await createPostWithOutboxEvent(users[0].id, 'Hello outbox world!');

    expect(post).toBeDefined();
    expect(post.content).toBe('Hello outbox world!');
    expect(post.author_id).toBe(users[0].id);

    // Verify the outbox event was created
    const pool = getPool();
    const outboxRows = await pool.query(
      `SELECT * FROM outbox WHERE aggregate_type = 'post' AND aggregate_id = $1`,
      [post.id],
    );
    expect(outboxRows.rows.length).toBe(1);
    expect(outboxRows.rows[0].event_type).toBe('post.created');
    expect(outboxRows.rows[0].processed_at).toBeNull();

    const payload = outboxRows.rows[0].payload;
    expect(payload.authorId).toBe(users[0].id);
    expect(payload.content).toBe('Hello outbox world!');
  });

  it('should roll back both post and outbox event on failure', async () => {
    const pool = getPool();

    // Try inserting with an invalid author_id (foreign key violation)
    try {
      await createPostWithOutboxEvent(999999, 'This should fail');
    } catch {
      // Expected to fail
    }

    // Verify no outbox event was created
    const outboxRows = await pool.query(
      `SELECT * FROM outbox WHERE aggregate_type = 'post'`,
    );
    expect(outboxRows.rows.length).toBe(0);
  });

  it('should process outbox events and mark them as processed', async () => {
    // Create several posts with outbox events
    await createPostWithOutboxEvent(users[0].id, 'Post 1');
    await createPostWithOutboxEvent(users[0].id, 'Post 2');
    await createPostWithOutboxEvent(users[1].id, 'Post 3');

    const processedEvents: any[] = [];
    const handler = async (event: any) => {
      processedEvents.push(event);
    };

    const count = await processOutboxEvents(handler, 10);

    expect(count).toBe(3);
    expect(processedEvents.length).toBe(3);
    expect(processedEvents[0].event_type).toBe('post.created');

    // All events should now be marked as processed
    const remaining = await getUnprocessedEventCount();
    expect(remaining).toBe(0);
  });

  it('should process only up to batchSize events', async () => {
    await createPostWithOutboxEvent(users[0].id, 'Post A');
    await createPostWithOutboxEvent(users[0].id, 'Post B');
    await createPostWithOutboxEvent(users[0].id, 'Post C');

    const handler = async () => {};
    const count = await processOutboxEvents(handler, 2);

    expect(count).toBe(2);

    const remaining = await getUnprocessedEventCount();
    expect(remaining).toBe(1);
  });

  it('should return correct unprocessed event count', async () => {
    expect(await getUnprocessedEventCount()).toBe(0);

    await createPostWithOutboxEvent(users[0].id, 'Post 1');
    await createPostWithOutboxEvent(users[0].id, 'Post 2');

    expect(await getUnprocessedEventCount()).toBe(2);

    await processOutboxEvents(async () => {}, 1);

    expect(await getUnprocessedEventCount()).toBe(1);
  });

  it('should replay events that were not processed before the threshold', async () => {
    const pool = getPool();

    // Create a post with outbox event
    await createPostWithOutboxEvent(users[0].id, 'Old unprocessed post');

    // Manually backdate the event's created_at to simulate an old stuck event
    await pool.query(
      `UPDATE outbox SET created_at = NOW() - INTERVAL '2 hours' WHERE processed_at IS NULL`,
    );

    // Set threshold to 1 hour ago -- events older than this should be replayed
    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const replayedEvents: any[] = [];
    const handler = async (event: any) => {
      replayedEvents.push(event);
    };

    const count = await replayFailedEvents(threshold, handler);

    expect(count).toBe(1);
    expect(replayedEvents.length).toBe(1);

    // Event should now be marked as processed
    const remaining = await getUnprocessedEventCount();
    expect(remaining).toBe(0);
  });

  it('should clean up old processed events', async () => {
    const pool = getPool();

    // Create and process some events
    await createPostWithOutboxEvent(users[0].id, 'Old post');
    await processOutboxEvents(async () => {}, 10);

    // Backdate the processed_at to simulate old events
    await pool.query(
      `UPDATE outbox SET processed_at = NOW() - INTERVAL '30 days'`,
    );

    // Also create a recent processed event (should NOT be deleted)
    await createPostWithOutboxEvent(users[0].id, 'Recent post');
    await processOutboxEvents(async () => {}, 10);

    const deleted = await cleanupProcessedEvents(7);

    expect(deleted).toBe(1);

    // The recent event should still exist
    const total = await pool.query('SELECT COUNT(*)::int as count FROM outbox');
    expect(total.rows[0].count).toBe(1);
  });
});
