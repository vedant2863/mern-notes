import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, closeConnection } from '../../shared/connection.js';
import { clearAllTables, seedUsers } from '../../shared/test-helpers.js';
import PgBoss from 'pg-boss';

const exercisePath = process.env.SOLUTIONS
  ? '../../solutions/35-the-queue-masters-pgboss.solution.ts'
  : './exercise.ts';

const {
  setupPgBoss,
  enqueueWelcomeEmail,
  processWelcomeEmails,
  scheduleSessionCleanup,
  enqueueWithRetry,
  getQueueHealth,
} = await import(exercisePath);

describe('Chapter 35: The Queue Masters (pgboss)', () => {
  let boss: PgBoss;

  beforeEach(async () => {
    await clearAllTables();
  });

  afterAll(async () => {
    if (boss) {
      await boss.stop({ graceful: false });
    }
    await closeConnection();
  });

  it('should initialize and start pgboss', async () => {
    boss = await setupPgBoss();

    expect(boss).toBeDefined();
    expect(boss).toBeInstanceOf(PgBoss);
  });

  it('should enqueue a welcome email job with delay', async () => {
    if (!boss) boss = await setupPgBoss();

    const jobId = await enqueueWelcomeEmail(boss, 42, 'alice@example.com');

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');

    // Verify the job exists and has correct data
    const job = await boss.getJobById(jobId!);
    expect(job).toBeDefined();
    expect(job!.data).toEqual({ userId: 42, email: 'alice@example.com' });
  });

  it('should register a worker to process welcome emails', async () => {
    if (!boss) boss = await setupPgBoss();

    const processedJobs: any[] = [];
    const handler = async (job: PgBoss.Job<{ userId: number; email: string }>) => {
      processedJobs.push(job.data);
    };

    const workerId = await processWelcomeEmails(boss, handler);

    expect(workerId).toBeDefined();
    expect(typeof workerId).toBe('string');
  });

  it('should schedule a recurring session cleanup job', async () => {
    if (!boss) boss = await setupPgBoss();

    // Should not throw
    await scheduleSessionCleanup(boss, '0 */6 * * *');

    // Verify the schedule was created by checking pgboss.schedule table
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM pgboss.schedule WHERE name = 'session-cleanup'`,
    );
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].cron).toBe('0 */6 * * *');
  });

  it('should enqueue a job with retry configuration', async () => {
    if (!boss) boss = await setupPgBoss();

    const jobId = await enqueueWithRetry(boss, 'feed-generation', { userId: 99 }, 3);

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');

    // Verify the job has retry config
    const job = await boss.getJobById(jobId!);
    expect(job).toBeDefined();
    expect(job!.data).toEqual({ userId: 99 });
    expect(job!.retrylimit).toBe(3);
  });

  it('should return queue health metrics', async () => {
    if (!boss) boss = await setupPgBoss();

    // Enqueue a few jobs to the test queue
    await boss.send('health-check-queue', { test: 1 });
    await boss.send('health-check-queue', { test: 2 });
    await boss.send('health-check-queue', { test: 3 });

    const health = await getQueueHealth(boss, 'health-check-queue');

    expect(health).toBeDefined();
    expect(typeof health.created).toBe('number');
    expect(typeof health.active).toBe('number');
    expect(typeof health.completed).toBe('number');
    expect(typeof health.failed).toBe('number');
    expect(health.created).toBeGreaterThanOrEqual(3);
  });
});
