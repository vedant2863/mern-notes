import { getPool } from '../shared/connection.js';

/**
 * Chapter 40: The Outbox Pattern - SOLUTIONS
 *
 * The transactional outbox pattern solves the dual-write problem: when you need
 * to update a database AND notify an external system, you cannot do both
 * atomically without a coordination strategy. The outbox pattern writes the
 * event to an outbox table in the same transaction as the business data,
 * guaranteeing that the event exists if and only if the data was committed.
 *
 * A separate processor reads the outbox table and delivers events to external
 * systems. If the processor crashes, events remain in the table and are picked
 * up on the next poll. If the external system is down, events queue up in the
 * outbox until it recovers.
 *
 * This pattern is used at massive scale by Shopify, Uber, Netflix, and many
 * other companies that need reliable event delivery without distributed transactions.
 */

/**
 * Create the outbox table for storing transactional events.
 *
 * ----- What problem does this solve? -----
 * We need a durable, queryable store for events that must be delivered to
 * external systems. The outbox table lives in the same database as the business
 * data, so we can write to both in a single transaction.
 *
 * ----- Design decisions -----
 * - `aggregate_type` + `aggregate_id`: identifies WHAT entity the event is about
 *   (e.g., post #42, user #7). Useful for filtering, debugging, and CDC routing.
 * - `event_type`: identifies WHAT happened (e.g., 'post.created'). Consumers use
 *   this to decide how to process the event.
 * - `payload` (JSONB): the event data. Contains everything the consumer needs --
 *   consumers should NOT query the database for additional data.
 * - `processed_at`: NULL means unprocessed. Set to NOW() after successful delivery.
 *   This single column drives the entire processing lifecycle.
 * - Partial index on `(created_at) WHERE processed_at IS NULL`: speeds up the
 *   processor's polling query by only indexing unprocessed rows.
 *
 * ----- Why BIGSERIAL for id? -----
 * In high-throughput systems, the outbox can accumulate millions of rows before
 * cleanup runs. BIGSERIAL provides a 64-bit counter, which will not overflow
 * in any practical scenario.
 */
export async function createOutboxTable(): Promise<void> {
  const pool = getPool();

  await pool.query('DROP TABLE IF EXISTS outbox CASCADE');

  await pool.query(`
    CREATE TABLE outbox (
      id              BIGSERIAL PRIMARY KEY,
      aggregate_type  TEXT NOT NULL,
      aggregate_id    INT NOT NULL,
      event_type      TEXT NOT NULL,
      payload         JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at    TIMESTAMPTZ
    )
  `);

  // Partial index: only indexes rows where processed_at IS NULL.
  // This keeps the index small and fast, because processed rows are excluded.
  // The processor's query "WHERE processed_at IS NULL ORDER BY created_at"
  // uses this index efficiently.
  await pool.query(`
    CREATE INDEX idx_outbox_unprocessed
    ON outbox (created_at)
    WHERE processed_at IS NULL
  `);
}

/**
 * Insert a post AND an outbox event in ONE atomic transaction.
 *
 * ----- The dual-write problem -----
 * Consider two broken alternatives:
 *
 * BROKEN APPROACH 1: Insert post, then publish event
 *   BEGIN; INSERT post; COMMIT;  <-- succeeds
 *   publishEvent(...)            <-- app crashes here, event lost forever!
 *
 * BROKEN APPROACH 2: Publish event, then insert post
 *   publishEvent(...)            <-- succeeds, consumers see the event
 *   BEGIN; INSERT post; COMMIT;  <-- fails! Event was published for nonexistent data!
 *
 * ----- The outbox solution -----
 * Write BOTH the post and the event in the SAME transaction:
 *   BEGIN;
 *   INSERT post;        <-- business data
 *   INSERT outbox;      <-- event record
 *   COMMIT;             <-- both succeed or both roll back
 *
 * The event is now guaranteed to exist if and only if the post exists.
 * A background processor will deliver the event later.
 *
 * ----- Why pool.connect() instead of pool.query()? -----
 * pool.query() may use a DIFFERENT connection for each call, which means
 * BEGIN on one connection and INSERT on another -- the transaction is broken.
 * pool.connect() gives us a dedicated client for the entire transaction.
 *
 * ----- Real-world usage -----
 * - E-commerce: INSERT order + outbox event -> payment service processes it
 * - Social media: INSERT post + outbox event -> notification service alerts followers
 * - Banking: INSERT transfer + outbox event -> audit service logs it
 */
export async function createPostWithOutboxEvent(
  authorId: number,
  content: string,
): Promise<any> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Insert the business data (the post)
    const postResult = await client.query(
      `INSERT INTO posts (author_id, content, type)
       VALUES ($1, $2, 'text')
       RETURNING *`,
      [authorId, content],
    );

    const post = postResult.rows[0];

    // Step 2: Insert the outbox event IN THE SAME TRANSACTION
    // The payload contains all data the consumer needs to process this event.
    // We use JSON.stringify because the pg driver requires explicit serialization
    // for JSONB parameterized values.
    await client.query(
      `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
       VALUES ('post', $1, 'post.created', $2::jsonb)`,
      [post.id, JSON.stringify({ authorId, content })],
    );

    // Step 3: COMMIT -- both the post and the outbox event are now durable.
    // If anything above threw, we jump to the catch block and ROLLBACK.
    await client.query('COMMIT');

    return post;
  } catch (err) {
    // ROLLBACK undoes both the post insert AND the outbox insert.
    // This is the atomicity guarantee: neither write is visible to other transactions.
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // ALWAYS release the client back to the pool, even if an error occurred.
    // Failing to release causes connection leaks, which eventually exhaust the pool.
    client.release();
  }
}

/**
 * Process unprocessed outbox events in a batch.
 *
 * ----- How SELECT FOR UPDATE SKIP LOCKED works -----
 *
 * Without SKIP LOCKED:
 *   Processor A: SELECT ... FOR UPDATE -> locks rows 1, 2, 3
 *   Processor B: SELECT ... FOR UPDATE -> BLOCKS, waiting for A to finish
 *   Result: processors run sequentially, defeating the purpose of parallelism
 *
 * With SKIP LOCKED:
 *   Processor A: SELECT ... FOR UPDATE SKIP LOCKED -> locks rows 1, 2, 3
 *   Processor B: SELECT ... FOR UPDATE SKIP LOCKED -> skips 1, 2, 3; locks 4, 5, 6
 *   Result: processors run in parallel, each handling a different batch!
 *
 * This is the same mechanism used by job queue systems like pg-boss and Graphile Worker.
 *
 * ----- Why process in a transaction? -----
 * If the handler throws (external service down), we ROLLBACK. The rows are
 * unlocked and remain unprocessed for the next poll. No events are lost.
 *
 * ----- Idempotency -----
 * Because events can be replayed (processor crash after handler but before
 * marking as processed), consumers MUST be idempotent. Processing the same
 * event twice should produce the same result. Use the outbox event's `id`
 * as an idempotency key on the consumer side.
 *
 * ----- Real-world usage -----
 * Debezium (CDC-based) reads the WAL instead of polling, but the SKIP LOCKED
 * polling approach is simpler to set up and works well up to thousands of
 * events per second.
 */
export async function processOutboxEvents(
  handler: (event: any) => Promise<void>,
  batchSize: number,
): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Claim a batch of unprocessed events.
    // FOR UPDATE: locks these rows so no other processor can claim them.
    // SKIP LOCKED: if another processor already locked some rows, skip them
    //              instead of waiting. This enables parallel processing.
    // ORDER BY created_at: process events in the order they were created (FIFO).
    const claimed = await client.query(
      `SELECT * FROM outbox
       WHERE processed_at IS NULL
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );

    if (claimed.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    // Process each event by calling the handler.
    // In a real system, the handler would publish to Kafka, send an HTTP request,
    // push to a notification service, etc.
    const processedIds: number[] = [];
    for (const event of claimed.rows) {
      await handler(event);
      processedIds.push(event.id);
    }

    // Mark all processed events with a timestamp.
    // Using ANY($1::bigint[]) lets us update all IDs in a single query.
    await client.query(
      `UPDATE outbox SET processed_at = NOW() WHERE id = ANY($1::bigint[])`,
      [processedIds],
    );

    await client.query('COMMIT');

    return processedIds.length;
  } catch (err) {
    // If the handler threw (e.g., notification service down), ROLLBACK.
    // The locked rows are released and remain unprocessed for the next poll.
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Count the number of unprocessed outbox events.
 *
 * ----- Why this matters -----
 * The unprocessed count is a key operational metric. In a healthy system,
 * it should stay near zero. A rising count indicates:
 * - The processor is down or too slow
 * - The external service is rejecting events
 * - The system is producing events faster than it can process them
 *
 * Monitor this metric and alert when it exceeds a threshold.
 *
 * ----- The partial index helps here -----
 * Our idx_outbox_unprocessed index covers exactly the rows where
 * processed_at IS NULL, so this COUNT query is an efficient index-only scan
 * rather than a full table scan.
 */
export async function getUnprocessedEventCount(): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT COUNT(*)::int as count FROM outbox WHERE processed_at IS NULL`,
  );

  return result.rows[0].count;
}

/**
 * Find and reprocess events that appear to be stuck (unprocessed and older
 * than a given threshold).
 *
 * ----- When is this needed? -----
 * If the outbox processor crashed after claiming events but before marking
 * them as processed, those events will have processed_at = NULL but their
 * rows are no longer locked (locks are released on crash/disconnect).
 *
 * By looking for events where processed_at IS NULL AND created_at < threshold,
 * we find events that have been waiting "too long" and are likely stuck.
 *
 * ----- Safety with SKIP LOCKED -----
 * We use SKIP LOCKED here too, so if the normal processor is currently working
 * on some of these events, we do not interfere with it.
 *
 * ----- Idempotency reminder -----
 * Because we are replaying events that may have been partially processed,
 * the handler MUST be idempotent. For example, if the handler sends a
 * notification, it should check whether the notification was already sent
 * (using the outbox event ID as a deduplication key).
 */
export async function replayFailedEvents(
  since: string,
  handler: (event: any) => Promise<void>,
): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find events that are unprocessed and older than the threshold.
    // These are likely stuck -- the original processor may have crashed.
    const stuck = await client.query(
      `SELECT * FROM outbox
       WHERE processed_at IS NULL
         AND created_at < $1::timestamptz
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED`,
      [since],
    );

    if (stuck.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    const replayedIds: number[] = [];
    for (const event of stuck.rows) {
      await handler(event);
      replayedIds.push(event.id);
    }

    await client.query(
      `UPDATE outbox SET processed_at = NOW() WHERE id = ANY($1::bigint[])`,
      [replayedIds],
    );

    await client.query('COMMIT');

    return replayedIds.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete old processed events to keep the outbox table small.
 *
 * ----- Why cleanup matters -----
 * The outbox table is a transient store, not an audit log. Once events have
 * been successfully processed and enough time has passed for any replays or
 * debugging, the rows should be deleted to:
 * - Keep the table small for fast polling queries
 * - Reduce disk usage and vacuum overhead
 * - Maintain the partial index at a small size
 *
 * ----- Retention strategy -----
 * A common retention policy is 7 days for processed events. This gives the
 * team a week to investigate any issues before the evidence is cleaned up.
 * For audit requirements, copy events to a separate archive table or external
 * system before deleting.
 *
 * ----- The interval cast -----
 * ($1 || ' days')::interval dynamically constructs an interval from the
 * parameter. For olderThanDays = 7, this becomes '7 days'::interval.
 * PostgreSQL then computes NOW() - INTERVAL '7 days' to get the cutoff.
 */
export async function cleanupProcessedEvents(
  olderThanDays: number,
): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `DELETE FROM outbox
     WHERE processed_at IS NOT NULL
       AND processed_at < NOW() - ($1 || ' days')::interval`,
    [olderThanDays],
  );

  // result.rowCount is the number of rows deleted by the DELETE statement
  return result.rowCount ?? 0;
}
