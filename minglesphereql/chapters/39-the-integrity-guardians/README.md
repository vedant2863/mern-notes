# Chapter 39: The Integrity Guardians

## Story

It started with a double booking. Two users -- Priya and Luca -- both reserved the downtown community center for the same Saturday afternoon. Priya was hosting a photography workshop, Luca a weekend coding jam. When they both showed up, neither was happy, and the engineering team got an earful.

The root cause was painfully simple. The application checked for overlapping bookings before inserting, but between Priya's availability check and her confirmed insert, Luca's booking slipped through. A classic race condition. The code was correct in isolation but broken under concurrency.

Then came a second problem. MingleSphere had added a `duration_hours` column to events, computed by subtracting the start time from the end time. A developer updated the event's end time but forgot to recalculate the duration. The dashboard showed a three-hour workshop with a duration of one hour. Users lost trust.

The team realized they had been guarding data integrity in the wrong place. Application-level validation is essential for user experience -- showing friendly error messages, guiding input -- but it cannot be the last line of defense. Race conditions, bugs in business logic, and direct database access can all bypass application checks.

PostgreSQL offered three powerful tools to fix these problems permanently. Generated columns would make `duration_hours` a computed value that the database recalculates automatically whenever the source columns change -- no application code needed, no way to forget. Exclusion constraints would make overlapping bookings physically impossible at the database level, rejecting the second insert with an error even if two transactions race. Domain types would let the team define reusable validation rules -- like "a positive amount" or "a valid email format" -- that PostgreSQL enforces everywhere the type is used.

After deploying these changes, the team slept better. The database itself had become the guardian of data integrity. Application bugs could no longer corrupt the data, because the constraints were enforced at the lowest level -- where they belong.

## Concepts

- **Generated columns (STORED)**: Columns whose values are automatically computed from other columns in the same row. The value is calculated on INSERT and UPDATE, stored on disk, and cannot be set directly. Ideal for derived values like durations, totals, and formatted strings.
- **Exclusion constraints**: A generalization of unique constraints that can prevent overlapping ranges, not just duplicate values. Combined with range types (`tsrange`, `daterange`) and the overlap operator (`&&`), they make double bookings impossible at the database level.
- **Domain types**: Named types built on top of existing types with added CHECK constraints. They let you define validation rules once (e.g., "positive integer", "email address") and reuse them across multiple tables. Changes to the domain propagate everywhere.
- **Application-level validation vs. database-level constraints**: Application validation provides user-friendly feedback. Database constraints provide correctness guarantees. Use both -- application checks for UX, database constraints for integrity.

## Code Examples

### Generated column (STORED)

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (ends_at - starts_at)) / 3600.0
  ) STORED
);

-- duration_hours is auto-computed; you cannot set it manually
INSERT INTO events (title, starts_at, ends_at)
VALUES ('Workshop', '2025-06-01 09:00', '2025-06-01 12:00');
-- duration_hours = 3.0
```

### Exclusion constraint with tsrange

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE venue_bookings (
  id SERIAL PRIMARY KEY,
  venue_id INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  booked_by INT NOT NULL,
  EXCLUDE USING GIST (
    venue_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
);

-- First booking succeeds
INSERT INTO venue_bookings (venue_id, starts_at, ends_at, booked_by)
VALUES (1, '2025-06-01 09:00', '2025-06-01 12:00', 100);

-- Overlapping booking for same venue is rejected by PostgreSQL
INSERT INTO venue_bookings (venue_id, starts_at, ends_at, booked_by)
VALUES (1, '2025-06-01 11:00', '2025-06-01 14:00', 200);
-- ERROR: conflicting key value violates exclusion constraint
```

### Domain types

```sql
CREATE DOMAIN positive_amount AS NUMERIC
  CHECK (VALUE > 0);

CREATE DOMAIN email_address AS TEXT
  CHECK (VALUE ~ '@');

CREATE DOMAIN short_text AS TEXT
  CHECK (LENGTH(VALUE) <= 280);

-- Use in tables just like built-in types
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  amount positive_amount NOT NULL,
  recipient_email email_address NOT NULL,
  note short_text
);
```

## What You Will Practice

1. Create a table with a generated (STORED) column that auto-computes a derived value.
2. Create a table with an exclusion constraint that prevents overlapping time ranges per venue.
3. Verify that PostgreSQL rejects overlapping bookings at the database level.
4. Define reusable domain types with CHECK constraints for common validation patterns.
5. Use domain types in a table and verify that invalid data is rejected.
6. Confirm that generated column values are always correct, even after updates.

## Tips

- Generated columns require the `STORED` keyword in PostgreSQL. The `VIRTUAL` option (compute on read, do not store) is not yet supported.
- Exclusion constraints require the `btree_gist` extension for combining equality (`=`) with range overlap (`&&`). Always run `CREATE EXTENSION IF NOT EXISTS btree_gist` first.
- Use `tstzrange(starts_at, ends_at)` (with timezone) rather than `tsrange` when your timestamps include timezone information.
- Domain types are schema-level objects. Dropping a domain that is in use requires `CASCADE`, which will drop the dependent columns. Be careful in production.
- You cannot INSERT or UPDATE a generated column directly. Attempting to do so will produce an error. Only the source columns can be written.
- Exclusion constraints are enforced at the transaction level, so even concurrent inserts are safe -- one will succeed and the other will fail.
