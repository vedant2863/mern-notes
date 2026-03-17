import { getPool } from '../shared/connection.js';

/**
 * Chapter 39: The Integrity Guardians - SOLUTIONS
 *
 * This chapter demonstrates three of PostgreSQL's most powerful data integrity
 * features: generated columns, exclusion constraints, and domain types. Together
 * they move validation from application code into the database, where it is
 * enforced for every client, every transaction, and every race condition.
 */

/**
 * Create an `events` table with a GENERATED ALWAYS AS ... STORED column.
 *
 * ----- What problem does this solve? -----
 * We need a `duration_hours` column derived from `starts_at` and `ends_at`.
 * The regular approach is to compute it in application code on every insert
 * and update. But if a developer updates `ends_at` and forgets to recalculate
 * the duration, the data becomes inconsistent.
 *
 * ----- The PostgreSQL way -----
 * A generated column tells PostgreSQL: "this value is always computed from
 * these other columns." The database recalculates it on every INSERT and UPDATE
 * automatically. You cannot set it manually -- the database owns it.
 *
 * ----- Why is the PG approach better? -----
 * - Impossible to forget: the database always recalculates.
 * - Impossible to set a wrong value: direct writes are rejected.
 * - No application code needed: works from any client, any language.
 * - Stored on disk: no runtime cost to read the value.
 *
 * ----- Real-world usage -----
 * - E-commerce: `total_price` generated from `unit_price * quantity`
 * - HR systems: `full_name` generated from `first_name || ' ' || last_name`
 * - Scheduling: `duration` generated from `end_time - start_time`
 */
export async function createEventTableWithGeneratedColumn(): Promise<void> {
  const pool = getPool();

  // Drop first to make the function idempotent (safe to call repeatedly)
  await pool.query('DROP TABLE IF EXISTS events CASCADE');

  await pool.query(`
    CREATE TABLE events (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      starts_at   TIMESTAMPTZ NOT NULL,
      ends_at     TIMESTAMPTZ NOT NULL,
      -- GENERATED ALWAYS AS ... STORED:
      --   EXTRACT(EPOCH FROM ...) gives us the difference in seconds,
      --   dividing by 3600.0 converts to fractional hours.
      --   STORED means the value is written to disk (not computed on read).
      duration_hours NUMERIC GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (ends_at - starts_at)) / 3600.0
      ) STORED
    )
  `);
}

/**
 * Create a `venue_bookings` table with an EXCLUSION constraint that prevents
 * overlapping time ranges for the same venue.
 *
 * ----- What problem does this solve? -----
 * Two users try to book the same venue for overlapping time slots. With
 * application-level checking, a race condition (TOCTOU) allows both bookings
 * to succeed because each check runs before the other's insert commits.
 *
 * ----- The PostgreSQL way -----
 * An exclusion constraint is like a UNIQUE constraint but generalized. Instead
 * of requiring exact equality, it can enforce that no two rows have overlapping
 * ranges (using the && operator) for the same venue (using the = operator).
 *
 * The constraint uses a GiST index, which efficiently indexes range types.
 * We need the `btree_gist` extension to combine btree operators (= for int)
 * with GiST operators (&& for ranges) in the same index.
 *
 * ----- Why is the PG approach better? -----
 * - Atomic: enforced at the transaction level, immune to race conditions.
 * - Declarative: the constraint reads like a business rule.
 * - Efficient: backed by a GiST index, so lookups are fast.
 * - Universal: works regardless of which client inserts the data.
 *
 * ----- Real-world usage -----
 * - Meeting room booking systems
 * - Hotel/rental reservation platforms
 * - Scheduling and shift management
 * - IP address range allocation (using inet ranges)
 */
export async function createBookingTableWithExclusion(): Promise<void> {
  const pool = getPool();

  // btree_gist is required to use equality (=) operators inside a GiST index.
  // Without it, we cannot combine venue_id WITH = alongside a range WITH &&.
  await pool.query('CREATE EXTENSION IF NOT EXISTS btree_gist');

  await pool.query('DROP TABLE IF EXISTS venue_bookings CASCADE');

  await pool.query(`
    CREATE TABLE venue_bookings (
      id         SERIAL PRIMARY KEY,
      venue_id   INT NOT NULL,
      starts_at  TIMESTAMPTZ NOT NULL,
      ends_at    TIMESTAMPTZ NOT NULL,
      booked_by  INT NOT NULL,

      -- EXCLUDE USING GIST:
      --   venue_id WITH =       -> same venue
      --   tstzrange(...) WITH && -> overlapping time range
      -- Together: "no two rows may have the same venue_id AND overlapping time"
      EXCLUDE USING GIST (
        venue_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
      )
    )
  `);
}

/**
 * Test that PostgreSQL's exclusion constraint prevents overlapping bookings.
 *
 * ----- How it works -----
 * We insert two bookings for the same venue. If the time ranges overlap,
 * PostgreSQL raises error code 23P01 (exclusion_violation). We catch it
 * and report whether the second booking was blocked.
 *
 * This is the key advantage over application-level checks: even if two
 * transactions run concurrently, one will fail. There is no window for
 * a race condition.
 *
 * ----- Regular approach (broken) -----
 * 1. SELECT to check for overlaps -> none found
 * 2. (Meanwhile, another transaction inserts an overlapping booking)
 * 3. INSERT the booking -> succeeds, double booking!
 *
 * ----- PG approach (correct) -----
 * 1. INSERT the booking
 * 2. PostgreSQL checks the exclusion constraint atomically
 * 3. If overlap exists, the INSERT fails with 23P01
 */
export async function testOverlapPrevention(
  venueId: number,
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): Promise<{ blocked: boolean; errorCode?: string }> {
  const pool = getPool();

  // First booking -- should always succeed (assuming clean table state for this venue/time)
  await pool.query(
    `INSERT INTO venue_bookings (venue_id, starts_at, ends_at, booked_by)
     VALUES ($1, $2, $3, 1)`,
    [venueId, start1, end1],
  );

  try {
    // Second booking -- may be blocked by the exclusion constraint
    await pool.query(
      `INSERT INTO venue_bookings (venue_id, starts_at, ends_at, booked_by)
       VALUES ($1, $2, $3, 2)`,
      [venueId, start2, end2],
    );
    // If we reach here, the ranges did not overlap
    return { blocked: false };
  } catch (error: any) {
    // 23P01 = exclusion_violation: PostgreSQL rejected the overlapping range
    return { blocked: true, errorCode: error.code };
  }
}

/**
 * Create three reusable domain types with CHECK constraints.
 *
 * ----- What problem does this solve? -----
 * Many tables need the same validation: "amount must be positive",
 * "email must contain @", "text must be short". Without domains, you
 * copy-paste CHECK constraints across tables. If the rule changes, you
 * must update every table individually.
 *
 * ----- The PostgreSQL way -----
 * A DOMAIN is a named type with built-in constraints. Define it once,
 * use it in any column. The constraint is enforced everywhere.
 *
 * ----- Why is the PG approach better? -----
 * - DRY: define the rule once, reuse everywhere.
 * - Centralized: change the domain, and all columns using it are updated.
 * - Self-documenting: `positive_amount` is more expressive than `NUMERIC`.
 * - Enforced universally: no client can bypass the check.
 *
 * ----- Real-world usage -----
 * - `email_address` domain for all email columns across the schema
 * - `currency_amount` domain ensuring positive values in financial systems
 * - `us_zip_code` domain with a regex pattern check
 * - `percentage` domain constrained between 0 and 100
 */
export async function createDomainTypes(): Promise<void> {
  const pool = getPool();

  // DROP CASCADE removes any columns that depend on these domains.
  // In production, be very careful with CASCADE on domains!
  await pool.query('DROP DOMAIN IF EXISTS positive_amount CASCADE');
  await pool.query('DROP DOMAIN IF EXISTS email_address CASCADE');
  await pool.query('DROP DOMAIN IF EXISTS short_text CASCADE');

  // positive_amount: any numeric value strictly greater than zero
  await pool.query(`
    CREATE DOMAIN positive_amount AS NUMERIC
      CHECK (VALUE > 0)
  `);

  // email_address: must contain an @ symbol (simple validation)
  // In production you'd use a more robust regex, but @ is the minimum
  await pool.query(`
    CREATE DOMAIN email_address AS TEXT
      CHECK (VALUE ~ '@')
  `);

  // short_text: enforces a maximum length of 280 characters
  // Similar to Twitter/X's character limit
  await pool.query(`
    CREATE DOMAIN short_text AS TEXT
      CHECK (LENGTH(VALUE) <= 280)
  `);
}

/**
 * Create a table using domain types and verify that invalid data is rejected.
 *
 * ----- How it works -----
 * We create a `donations` table whose columns use our custom domains instead
 * of plain types. Then we attempt four inserts:
 *   1. Valid data   -> should succeed
 *   2. Negative amount -> rejected by positive_amount domain
 *   3. Invalid email    -> rejected by email_address domain
 *   4. Text > 280 chars -> rejected by short_text domain
 *
 * Each failed insert throws a PostgreSQL error with code 23514 (check_violation).
 * The domain's CHECK constraint is what triggers the error -- not application code.
 *
 * ----- Comparison to application-level validation -----
 * App-level: `if (amount <= 0) throw new Error(...)` -- easy to forget, easy to bypass
 * DB-level:  Domain CHECK constraint -- impossible to bypass from any client
 */
export async function useDomainsInTable(): Promise<{
  validInserted: boolean;
  negativeFailed: boolean;
  emailFailed: boolean;
  longTextFailed: boolean;
}> {
  const pool = getPool();

  await pool.query('DROP TABLE IF EXISTS donations CASCADE');

  await pool.query(`
    CREATE TABLE donations (
      id      SERIAL PRIMARY KEY,
      amount  positive_amount NOT NULL,
      email   email_address NOT NULL,
      note    short_text
    )
  `);

  const result = {
    validInserted: false,
    negativeFailed: false,
    emailFailed: false,
    longTextFailed: false,
  };

  // 1. Valid insert -- should succeed
  try {
    await pool.query(
      `INSERT INTO donations (amount, email, note) VALUES ($1, $2, $3)`,
      [10, 'a@b.com', 'Thanks'],
    );
    result.validInserted = true;
  } catch {
    result.validInserted = false;
  }

  // 2. Negative amount -- should fail (positive_amount CHECK: VALUE > 0)
  try {
    await pool.query(
      `INSERT INTO donations (amount, email, note) VALUES ($1, $2, $3)`,
      [-5, 'a@b.com', 'Bad amount'],
    );
    result.negativeFailed = false;
  } catch {
    result.negativeFailed = true;
  }

  // 3. Invalid email -- should fail (email_address CHECK: VALUE ~ '@')
  try {
    await pool.query(
      `INSERT INTO donations (amount, email, note) VALUES ($1, $2, $3)`,
      [10, 'invalid', 'No at sign'],
    );
    result.emailFailed = false;
  } catch {
    result.emailFailed = true;
  }

  // 4. Note too long -- should fail (short_text CHECK: LENGTH(VALUE) <= 280)
  try {
    const longText = 'x'.repeat(281);
    await pool.query(
      `INSERT INTO donations (amount, email, note) VALUES ($1, $2, $3)`,
      [10, 'a@b.com', longText],
    );
    result.longTextFailed = false;
  } catch {
    result.longTextFailed = true;
  }

  return result;
}

/**
 * Insert an event and return the row with auto-computed duration_hours.
 *
 * ----- How it works -----
 * We INSERT only the source columns (title, starts_at, ends_at).
 * PostgreSQL automatically computes duration_hours using the GENERATED
 * ALWAYS AS expression. The RETURNING * clause gives us the full row
 * including the generated value.
 *
 * ----- Key insight -----
 * You CANNOT include duration_hours in an INSERT or UPDATE statement.
 * PostgreSQL will reject it with:
 *   "column duration_hours can only be updated to DEFAULT"
 * This is intentional -- the database owns the computed value.
 *
 * ----- Real-world example -----
 * In a time-tracking app, you store clock_in and clock_out times.
 * The hours_worked column is generated, so managers always see the
 * correct duration without relying on the application to calculate it.
 */
export async function getGeneratedColumnValues(
  eventTitle: string,
  startsAt: string,
  endsAt: string,
): Promise<any> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO events (title, starts_at, ends_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [eventTitle, startsAt, endsAt],
  );

  return result.rows[0];
}
