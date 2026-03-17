import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, closeConnection } from '../../shared/connection.js';
import { clearAllTables } from '../../shared/test-helpers.js';

const exercisePath = process.env.SOLUTIONS
  ? '../../solutions/39-the-integrity-guardians.solution.ts'
  : './exercise.ts';

const {
  createEventTableWithGeneratedColumn,
  createBookingTableWithExclusion,
  testOverlapPrevention,
  createDomainTypes,
  useDomainsInTable,
  getGeneratedColumnValues,
} = await import(exercisePath);

describe('Chapter 39: The Integrity Guardians', () => {
  beforeEach(async () => {
    await clearAllTables();
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query('DROP TABLE IF EXISTS events CASCADE');
    await pool.query('DROP TABLE IF EXISTS venue_bookings CASCADE');
    await pool.query('DROP TABLE IF EXISTS donations CASCADE');
    await pool.query('DROP DOMAIN IF EXISTS positive_amount CASCADE');
    await pool.query('DROP DOMAIN IF EXISTS email_address CASCADE');
    await pool.query('DROP DOMAIN IF EXISTS short_text CASCADE');
    await closeConnection();
  });

  it('should create an events table with a generated duration_hours column', async () => {
    await createEventTableWithGeneratedColumn();

    const pool = getPool();
    // Verify the table exists and has the expected columns
    const cols = await pool.query(
      `SELECT column_name, is_generated
       FROM information_schema.columns
       WHERE table_name = 'events'
       ORDER BY ordinal_position`,
    );
    const colNames = cols.rows.map((r: any) => r.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('title');
    expect(colNames).toContain('starts_at');
    expect(colNames).toContain('ends_at');
    expect(colNames).toContain('duration_hours');

    // duration_hours should be a generated column
    const durationCol = cols.rows.find((r: any) => r.column_name === 'duration_hours');
    expect(durationCol.is_generated).toBe('ALWAYS');
  });

  it('should create a venue_bookings table with an exclusion constraint', async () => {
    await createBookingTableWithExclusion();

    const pool = getPool();
    // Verify exclusion constraint exists
    const constraints = await pool.query(
      `SELECT conname, contype
       FROM pg_constraint
       WHERE conrelid = 'venue_bookings'::regclass AND contype = 'x'`,
    );
    expect(constraints.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('should block overlapping bookings for the same venue', async () => {
    await createBookingTableWithExclusion();

    // Overlapping times for the same venue
    const result = await testOverlapPrevention(
      1,
      '2025-06-01 09:00:00+00',
      '2025-06-01 12:00:00+00',
      '2025-06-01 11:00:00+00',
      '2025-06-01 14:00:00+00',
    );

    expect(result.blocked).toBe(true);
    expect(result.errorCode).toBe('23P01'); // exclusion_violation
  });

  it('should allow non-overlapping bookings for the same venue', async () => {
    await createBookingTableWithExclusion();

    // Non-overlapping times
    const result = await testOverlapPrevention(
      1,
      '2025-06-01 09:00:00+00',
      '2025-06-01 12:00:00+00',
      '2025-06-01 13:00:00+00',
      '2025-06-01 16:00:00+00',
    );

    expect(result.blocked).toBe(false);
  });

  it('should allow overlapping bookings for different venues', async () => {
    await createBookingTableWithExclusion();

    const pool = getPool();
    // Insert for venue 1
    await pool.query(
      `INSERT INTO venue_bookings (venue_id, starts_at, ends_at, booked_by)
       VALUES (1, '2025-06-01 09:00:00+00', '2025-06-01 12:00:00+00', 1)`,
    );
    // Insert overlapping time for venue 2 -- should succeed
    const result = await pool.query(
      `INSERT INTO venue_bookings (venue_id, starts_at, ends_at, booked_by)
       VALUES (2, '2025-06-01 10:00:00+00', '2025-06-01 13:00:00+00', 2)
       RETURNING *`,
    );
    expect(result.rows.length).toBe(1);
  });

  it('should create domain types with proper validation', async () => {
    await createDomainTypes();

    const pool = getPool();
    // Verify domains exist
    const domains = await pool.query(
      `SELECT typname FROM pg_type WHERE typtype = 'd' AND typname IN ('positive_amount', 'email_address', 'short_text')`,
    );
    const domainNames = domains.rows.map((r: any) => r.typname).sort();
    expect(domainNames).toEqual(['email_address', 'positive_amount', 'short_text']);
  });

  it('should use domain types in a table and reject invalid data', async () => {
    await createDomainTypes();
    const result = await useDomainsInTable();

    expect(result.validInserted).toBe(true);
    expect(result.negativeFailed).toBe(true);
    expect(result.emailFailed).toBe(true);
    expect(result.longTextFailed).toBe(true);
  });

  it('should auto-compute generated column values on insert', async () => {
    await createEventTableWithGeneratedColumn();

    const row = await getGeneratedColumnValues(
      'Morning Workshop',
      '2025-06-01 09:00:00+00',
      '2025-06-01 12:00:00+00',
    );

    expect(row.title).toBe('Morning Workshop');
    expect(parseFloat(row.duration_hours)).toBeCloseTo(3.0, 1);
  });

  it('should auto-recompute generated column after update', async () => {
    await createEventTableWithGeneratedColumn();

    const pool = getPool();
    // Insert an event
    const inserted = await pool.query(
      `INSERT INTO events (title, starts_at, ends_at)
       VALUES ('Session', '2025-06-01 10:00:00+00', '2025-06-01 12:00:00+00')
       RETURNING *`,
    );
    expect(parseFloat(inserted.rows[0].duration_hours)).toBeCloseTo(2.0, 1);

    // Update end time
    const updated = await pool.query(
      `UPDATE events SET ends_at = '2025-06-01 15:00:00+00' WHERE id = $1 RETURNING *`,
      [inserted.rows[0].id],
    );
    expect(parseFloat(updated.rows[0].duration_hours)).toBeCloseTo(5.0, 1);
  });
});
