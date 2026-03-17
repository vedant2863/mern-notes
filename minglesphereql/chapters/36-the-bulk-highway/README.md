# Chapter 36: The Bulk Highway

## Story

The email arrived on a Monday morning: "We've acquired SocialBuzz. Need to migrate their 100,000 user profiles into MingleSphere by end of week." The data team exported a massive CSV file and handed it to the backend team. "Just INSERT them," they said. Easy enough, right?

Priya, the data engineer, wrote a quick script: loop through the CSV, INSERT each row, commit. She kicked it off and checked the progress after five minutes. It had imported 5,000 rows. At that rate, 100,000 rows would take over an hour and a half. "We can do better," she muttered.

She started optimizing. First, she batched the INSERTs -- instead of one row per statement, she used Drizzle's batch insert to send 1,000 rows in a single query. The time dropped to about 15 minutes. Better, but still slow for a pipeline that would need to run regularly as more SocialBuzz data trickled in.

Then she discovered PostgreSQL's `COPY` command. Unlike INSERT, which goes through the full query parser, planner, and executor for each statement, COPY streams data directly into the table's storage layer. It skips most of the overhead that makes INSERT safe for general-purpose use. On the same 100,000 rows, COPY finished in under 10 seconds.

For the staging step, Priya used an `UNLOGGED TABLE` -- a PostgreSQL table that skips write-ahead logging. Since the staging data was temporary and could be re-imported if lost, the WAL overhead was unnecessary. Writes to the unlogged table were nearly twice as fast. She loaded the CSV into the staging table, validated the data, and then copied the clean rows into the real users table in a single INSERT...SELECT.

The team also built bulk UPDATE and DELETE utilities. Updating 50,000 user statuses used the `ANY()` array operator instead of a massive IN clause. Bulk soft-deletes ran in batches of 5,000 to avoid holding long-running locks that would block other queries. Finally, they wrote a benchmark function that compared single-row INSERT, batch INSERT, and COPY side by side -- the numbers told the whole story.

By Wednesday, the migration was complete. What started as a 90-minute ordeal became a 10-second pipeline.

## Concepts

- **Batch INSERT**: Send multiple rows in a single INSERT statement using a VALUES list. Reduces round trips and per-statement overhead.
- **COPY command**: PostgreSQL's high-speed bulk loading mechanism. Streams data directly into table storage, bypassing the query planner.
- **COPY FROM STDIN**: Variant of COPY that accepts data from the client connection rather than a server-side file.
- **UNLOGGED TABLE**: A table that does not write to the write-ahead log (WAL). Faster writes, but data is lost on crash. Ideal for temporary staging data.
- **Bulk UPDATE with ANY()**: Update many rows efficiently by passing an array of IDs with `WHERE id = ANY($1::int[])` instead of expanding a massive IN list.
- **Batched DELETE**: Delete rows in fixed-size batches to avoid long-held locks and reduce transaction log pressure.
- **Benchmarking**: Measure and compare different approaches to find the right trade-off between speed, safety, and complexity.

## Code Examples

### Batch INSERT with Drizzle

```ts
import { getDb, schema } from '../../shared/connection.js';

const db = getDb();
const rows = Array.from({ length: 1000 }, (_, i) => ({
  username: `import_user_${i}`,
  email: `import_${i}@example.com`,
  displayName: `Imported User ${i}`,
}));
await db.insert(schema.users).values(rows);
```

### COPY FROM STDIN with raw pg

```ts
import { getPool } from '../../shared/connection.js';
import { from as copyFrom } from 'pg-copy-streams';
import { Readable } from 'stream';

const pool = getPool();
const client = await pool.connect();
const stream = client.query(copyFrom(
  "COPY users (username, email, display_name) FROM STDIN WITH (FORMAT csv)"
));
const readable = Readable.from(csvData);
readable.pipe(stream);
await new Promise((resolve, reject) => {
  stream.on('finish', resolve);
  stream.on('error', reject);
});
client.release();
```

### UNLOGGED TABLE for staging

```sql
CREATE UNLOGGED TABLE IF NOT EXISTS staging_users (
  username TEXT,
  email TEXT,
  display_name TEXT
);
-- Load fast, then copy to real table:
INSERT INTO users (username, email, display_name)
SELECT username, email, display_name FROM staging_users;
DROP TABLE staging_users;
```

### Bulk UPDATE with ANY()

```ts
await pool.query(
  `UPDATE users SET status = $1 WHERE id = ANY($2::int[])`,
  ['offline', [1, 2, 3, 4, 5]]
);
```

### Batched DELETE

```ts
let deleted = 0;
do {
  const result = await pool.query(`
    DELETE FROM users
    WHERE id IN (
      SELECT id FROM users
      WHERE updated_at < NOW() - INTERVAL '90 days'
      LIMIT 5000
    )
  `);
  deleted = result.rowCount || 0;
} while (deleted > 0);
```

## Practice Goals

1. Insert a large number of rows efficiently using batch INSERT with Drizzle.
2. Use PostgreSQL's COPY command to stream CSV data directly into a table.
3. Create an unlogged staging table for high-speed temporary writes.
4. Update many rows at once using the ANY() array operator.
5. Delete old records in safe, fixed-size batches to avoid lock contention.
6. Benchmark and compare the performance of different bulk insertion methods.

## Tips

- Batch INSERT with Drizzle's `.values([...])` is the easiest optimization. Going from 1 row per INSERT to 1,000 rows per INSERT can give a 10-50x speedup.
- COPY is the fastest way to load data into PostgreSQL. It bypasses the query planner entirely and writes directly to the table's heap storage.
- `pg-copy-streams` is the Node.js library for using COPY with the `pg` driver. Install it with `npm install pg-copy-streams`.
- UNLOGGED tables are great for staging data, but never use them for data you cannot afford to lose -- they are emptied after a crash recovery.
- When using `ANY($1::int[])`, PostgreSQL can use index scans just like with a regular `WHERE id = $1` query. It is more efficient than `IN (1, 2, 3, ...)` for large lists because it avoids parsing a massive SQL string.
- Batched DELETEs prevent long-running transactions that block autovacuum and hold locks. Always use `LIMIT` in a subquery to cap the batch size.
- When benchmarking, run each method multiple times and discard the first run (cold cache). Use `performance.now()` for sub-millisecond precision.
