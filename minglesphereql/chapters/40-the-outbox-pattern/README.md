# Chapter 40: The Outbox Pattern

## Story

It happened on a Tuesday afternoon. MingleSphere had just shipped a notification system: every time a user published a post, a notification was sent to their followers. The code was straightforward -- insert the post, then call the notification service. Clean, simple, and fundamentally broken.

The first bug report came within hours. A user published a post, the notification service was momentarily down, and the entire post creation failed. The user saw an error, retried, and eventually gave up. The post was never saved, even though the database was perfectly healthy. The notification service had become a single point of failure for post creation.

The team tried the obvious fix: insert the post first, commit the transaction, then send the notification. Now posts were always saved. But a new problem appeared. Sometimes the application crashed between the commit and the notification call. The post existed in the database, but no notification was ever sent. Followers never saw it.

This is the dual-write problem. When you need to update two systems (a database and an external service) in a single logical operation, there is no way to make both succeed or both fail without a coordination protocol. The database has transactions, but the notification service does not participate in them.

The solution is the transactional outbox pattern. Instead of calling the notification service directly, the application writes an event record to an `outbox` table in the same transaction as the post insert. Because both writes go to the same database, they are atomic -- both succeed or both roll back. A separate background processor reads the outbox table, sends the notifications, and marks the events as processed.

The outbox processor uses `SELECT FOR UPDATE SKIP LOCKED` to claim events. This means multiple processors can run concurrently without double-processing the same event. If a processor crashes mid-batch, the unclaimed events remain in the table for the next processor to pick up.

The team deployed the outbox pattern on Wednesday. On Thursday, the notification service went down for twenty minutes. When it came back, the outbox processor caught up on all pending events within seconds. No posts were lost. No notifications were missed. The dual-write problem was solved.

## Concepts

- **The dual-write problem**: When an operation must update both a database and an external system (message queue, API, notification service), there is no atomic guarantee across the two. One can succeed while the other fails.
- **Insert-then-publish failure**: If the application crashes after the database commit but before publishing to the external service, the event is lost.
- **Publish-then-insert failure**: If the external service receives the event but the database insert fails, the event was published for data that does not exist.
- **Transactional outbox**: Write the event to an `outbox` table in the same database transaction as the business data. This guarantees atomicity -- the event exists if and only if the data exists.
- **Outbox processor**: A background worker that polls the outbox table for unprocessed events, delivers them to the external service, and marks them as processed.
- **SELECT FOR UPDATE SKIP LOCKED**: A PostgreSQL locking strategy that lets multiple processors poll the same outbox table concurrently. Each processor locks the rows it claims, and other processors skip those locked rows, preventing double-processing.
- **Idempotency keys**: Unique identifiers on each event that allow the consumer to safely process the same event twice without side effects, enabling at-least-once delivery with exactly-once semantics.
- **Change Data Capture (CDC)**: An alternative to polling where a tool like Debezium reads the PostgreSQL Write-Ahead Log (WAL) to detect new outbox rows. More efficient than polling for high-throughput systems.

## Code Examples

### The outbox table

```sql
CREATE TABLE outbox (
  id             BIGSERIAL PRIMARY KEY,
  aggregate_type TEXT NOT NULL,         -- e.g., 'post', 'user', 'order'
  aggregate_id   INT NOT NULL,          -- e.g., the post's id
  event_type     TEXT NOT NULL,         -- e.g., 'post.created', 'user.registered'
  payload        JSONB NOT NULL,        -- event data for the consumer
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at   TIMESTAMPTZ           -- NULL until successfully processed
);
```

### Atomic insert: business data + outbox event

```ts
const pool = getPool();
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. Insert business data
  const post = await client.query(
    `INSERT INTO posts (author_id, content, type) VALUES ($1, $2, 'text') RETURNING *`,
    [authorId, content],
  );

  // 2. Insert outbox event IN THE SAME TRANSACTION
  await client.query(
    `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
     VALUES ('post', $1, 'post.created', $2)`,
    [post.rows[0].id, JSON.stringify({ authorId, content })],
  );

  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Processing outbox events with SKIP LOCKED

```sql
-- Claim a batch of unprocessed events (locked, so no other processor grabs them)
SELECT * FROM outbox
WHERE processed_at IS NULL
ORDER BY created_at
LIMIT 10
FOR UPDATE SKIP LOCKED;

-- After successful processing, mark them as done
UPDATE outbox SET processed_at = NOW() WHERE id = ANY($1::bigint[]);
```

### Cleanup old processed events

```sql
DELETE FROM outbox
WHERE processed_at IS NOT NULL
  AND processed_at < NOW() - INTERVAL '7 days';
```

## What You Will Practice

1. Create an outbox table with the standard schema for transactional event capture.
2. Insert business data and an outbox event in a single atomic transaction.
3. Process outbox events using `SELECT FOR UPDATE SKIP LOCKED` to prevent double-processing.
4. Count unprocessed events to monitor outbox backlog.
5. Replay failed events that have not been processed within a time threshold.
6. Clean up old processed events to keep the outbox table small and fast.

## Tips

- Always use a dedicated client from the pool (via `pool.connect()`) when you need explicit transaction control (`BEGIN` / `COMMIT` / `ROLLBACK`). Do not use `pool.query()` for transactions -- each call might use a different connection.
- `SKIP LOCKED` is the key to concurrent processing. Without it, two processors claiming the same batch would block each other. With it, the second processor instantly skips rows locked by the first.
- The `payload` column should contain all the information the consumer needs to process the event. Do not force the consumer to query back into the database.
- Idempotency is critical when using at-least-once delivery. Design consumers so that processing the same event twice produces the same result.
- In production, consider adding an index on `(processed_at) WHERE processed_at IS NULL` to speed up the outbox processor's polling query.
- The outbox pattern is used by major platforms: Shopify, Uber, and Airbnb all use variations of this pattern for reliable event delivery.
- For very high throughput, consider Change Data Capture (Debezium + Kafka) instead of polling. CDC reads the WAL directly, so the outbox processor does not need to poll at all.
