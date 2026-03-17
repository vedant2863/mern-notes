import { getPool } from '../shared/connection.js';
import PgBoss from 'pg-boss';

/**
 * Chapter 35: The Queue Masters (pgboss) - SOLUTIONS
 *
 * This chapter demonstrates how to use pgboss for background job processing
 * using PostgreSQL as the only infrastructure dependency. Every function below
 * includes a detailed explanation of the problem, the traditional approach,
 * and why the PostgreSQL-native approach is superior.
 */

/**
 * Initialize and start a pgboss instance.
 *
 * ━━━ What problem we're solving ━━━
 * MingleSphere needs to run background tasks (emails, feed generation,
 * cleanup) without blocking the HTTP request/response cycle. We need a
 * job queue that is durable (survives crashes), supports concurrency
 * (multiple workers), and handles retries automatically.
 *
 * ━━━ Regular way (without pgboss) ━━━
 * Install Redis + BullMQ. Configure a Redis connection, set up a Bull
 * queue, create separate worker processes, and manage two stateful
 * systems (PostgreSQL + Redis) in production. Redis needs its own
 * backup strategy, monitoring, and failover configuration.
 *
 * ━━━ PostgreSQL way (with pgboss) ━━━
 * pgboss stores all job data in PostgreSQL tables under the `pgboss`
 * schema. It uses `SELECT ... FOR UPDATE SKIP LOCKED` to dequeue jobs
 * without contention, and advisory locks for coordination. No Redis
 * needed -- your existing PostgreSQL instance IS the queue.
 *
 * ━━━ Why PG way is better ━━━
 * - One fewer system to operate, monitor, and back up
 * - Jobs are ACID-compliant -- they participate in transactions
 * - If the database is backed up, your job queue is backed up
 * - No split-brain between "data in PG" and "jobs in Redis"
 * - Simpler deployment: one connection string, one failure domain
 *
 * @example
 *   // In your application bootstrap:
 *   const boss = await setupPgBoss();
 *   // ... register workers ...
 *   // On shutdown:
 *   await boss.stop({ graceful: true });
 */
export async function setupPgBoss(): Promise<PgBoss> {
  // Use the same connection string as the rest of the application.
  // pgboss will create its schema (pgboss.*) on first start.
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/minglesphereql_test';

  const boss = new PgBoss({
    connectionString,
    // noScheduling: false — allow cron-based scheduling (default)
    // noSupervisor: false — allow maintenance operations (default)
  });

  // start() creates the pgboss schema if it doesn't exist,
  // runs any pending migrations, and begins polling for jobs.
  await boss.start();

  return boss;
}

/**
 * Enqueue a welcome email job with a 30-second delay.
 *
 * ━━━ What problem we're solving ━━━
 * When a user signs up, we want to send a welcome email -- but not
 * immediately. We delay 30 seconds so the user has time to verify
 * their account. The job must survive server restarts.
 *
 * ━━━ Regular way (without pgboss) ━━━
 * Use setTimeout() in memory (lost on crash), or set up Redis + Bull
 * with a `delay` option. Either way, you need extra infrastructure
 * or accept data loss.
 *
 * ━━━ PostgreSQL way (with pgboss) ━━━
 * boss.send() inserts a row into pgboss.job with a `startAfter`
 * timestamp. The job sits in 'created' state until the delay expires,
 * then becomes eligible for workers to pick up.
 *
 * ━━━ Why PG way is better ━━━
 * - The delayed job is persisted in PostgreSQL immediately
 * - If the server crashes during the 30-second wait, the job is safe
 * - No in-memory timers to manage or lose
 * - The delay is stored as a database timestamp, not a volatile timer
 *
 * @example
 *   const jobId = await enqueueWelcomeEmail(boss, 42, 'alice@example.com');
 *   // Job will be processable 30 seconds from now
 */
export async function enqueueWelcomeEmail(
  boss: PgBoss,
  userId: number,
  email: string,
): Promise<string | null> {
  // boss.send() returns the job UUID or null if the queue is throttled.
  // The first argument is the queue name, second is the job payload (stored as JSONB),
  // and third is the options object.
  const jobId = await boss.send(
    'welcome-email',        // Queue name — workers subscribe to this
    { userId, email },      // Payload — accessible as job.data in the worker
    { startAfter: 30 },     // Options — delay 30 seconds before processing
  );

  return jobId;
}

/**
 * Subscribe a handler function to process welcome email jobs.
 *
 * ━━━ What problem we're solving ━━━
 * Jobs are sitting in the queue. We need a worker that continuously
 * polls for new jobs and processes them. The worker should handle
 * one job at a time (by default), and if the handler throws, the
 * job should be marked as failed (and retried if configured).
 *
 * ━━━ Regular way (without pgboss) ━━━
 * Create a BullMQ Worker with a Redis connection, define a processor
 * function, manage concurrency settings, and handle Redis reconnection
 * logic. The worker is a separate process that connects to Redis.
 *
 * ━━━ PostgreSQL way (with pgboss) ━━━
 * boss.work() registers a handler for a queue name. pgboss polls the
 * pgboss.job table using `SELECT ... FOR UPDATE SKIP LOCKED`, which
 * means multiple workers can safely run in parallel without processing
 * the same job twice.
 *
 * ━━━ Why PG way is better ━━━
 * - SKIP LOCKED is a built-in PostgreSQL feature for exactly this pattern
 * - No need for Redis pub/sub or Lua scripts for atomic dequeuing
 * - Failed jobs stay in the same database as your application data
 * - You can query job status with standard SQL (JOINs, aggregations, etc.)
 *
 * @example
 *   await processWelcomeEmails(boss, async (job) => {
 *     await emailService.send(job.data.email, 'Welcome!');
 *   });
 */
export async function processWelcomeEmails(
  boss: PgBoss,
  handler: (job: PgBoss.Job<{ userId: number; email: string }>) => Promise<void>,
): Promise<string> {
  // boss.work() returns a worker ID string that can be used to
  // unsubscribe later with boss.offWork(workerId).
  // It starts polling immediately and calls `handler` for each job.
  const workerId = await boss.work(
    'welcome-email',  // Queue name to subscribe to
    handler,          // Async function called for each dequeued job
  );

  return workerId;
}

/**
 * Schedule a recurring session cleanup job using cron syntax.
 *
 * ━━━ What problem we're solving ━━━
 * Expired user sessions accumulate in the database. We need a periodic
 * job that runs every N hours to clean them up. This must be reliable
 * (runs even if the server was restarted) and not produce duplicate
 * jobs if multiple app instances are running.
 *
 * ━━━ Regular way (without pgboss) ━━━
 * Use node-cron or setInterval() in the application process. Problems:
 * - Lost on restart (unless you add persistence)
 * - Multiple instances = multiple triggers = duplicate work
 * - No visibility into whether the job actually ran
 *
 * ━━━ PostgreSQL way (with pgboss) ━━━
 * boss.schedule() stores the cron expression in the pgboss.schedule
 * table. pgboss's internal supervisor creates jobs on schedule. Even
 * with multiple app instances, only one job is created per schedule
 * tick (pgboss uses advisory locks to coordinate).
 *
 * ━━━ Why PG way is better ━━━
 * - Schedule survives restarts (it's a database row)
 * - Deduplication is automatic (advisory locks prevent double-scheduling)
 * - Full audit trail: every scheduled run is a job row you can query
 * - Cron syntax is standard and well-understood
 *
 * @example
 *   // Run cleanup every 6 hours
 *   await scheduleSessionCleanup(boss, '0 *​/6 * * *');
 *   // Run cleanup every midnight UTC
 *   await scheduleSessionCleanup(boss, '0 0 * * *');
 */
export async function scheduleSessionCleanup(
  boss: PgBoss,
  cronExpression: string,
): Promise<void> {
  // boss.schedule() upserts a row in pgboss.schedule.
  // If the schedule already exists, it updates the cron expression.
  await boss.schedule(
    'session-cleanup',  // Queue name for the recurring job
    cronExpression,     // Standard cron syntax (minute hour day month weekday)
    {},                 // Job data payload (empty for cleanup tasks)
    { tz: 'UTC' },      // Options — specify timezone for cron evaluation
  );
}

/**
 * Enqueue a job with retry configuration.
 *
 * ━━━ What problem we're solving ━━━
 * Some jobs interact with unreliable external services (email APIs,
 * third-party webhooks). These can fail transiently. We need automatic
 * retries with a cooldown between attempts, and a hard expiration so
 * jobs don't run forever.
 *
 * ━━━ Regular way (without pgboss) ━━━
 * Implement retry logic manually: wrap the handler in a try/catch,
 * maintain a retry counter in Redis or in-memory, add setTimeout for
 * backoff, and track maximum attempts. Or use Bull's built-in retry
 * (which still requires Redis).
 *
 * ━━━ PostgreSQL way (with pgboss) ━━━
 * Pass retryLimit, retryDelay, and expireInMinutes as job options.
 * pgboss handles everything: when a job fails, it increments the
 * retry count, waits retryDelay seconds, and re-enqueues. After
 * retryLimit failures, the job moves to 'failed' state permanently.
 *
 * ━━━ Why PG way is better ━━━
 * - Retry state is persisted (survives crashes mid-retry)
 * - retrycount is a column you can query: "show me all jobs that retried 3+ times"
 * - expireInMinutes prevents zombie jobs from running indefinitely
 * - No custom retry logic to maintain or debug
 *
 * @example
 *   // Enqueue a feed generation job that retries up to 3 times
 *   const jobId = await enqueueWithRetry(boss, 'generate-feed', { userId: 42 }, 3);
 */
export async function enqueueWithRetry(
  boss: PgBoss,
  queueName: string,
  data: Record<string, any>,
  retryLimit: number,
): Promise<string | null> {
  const jobId = await boss.send(
    queueName,
    data,
    {
      retryLimit,          // Max number of retry attempts after initial failure
      retryDelay: 1,       // Seconds to wait between retry attempts
      expireInMinutes: 5,  // Hard timeout — job fails if not completed within 5 min
    },
  );

  return jobId;
}

/**
 * Get queue health metrics: count of jobs in each state.
 *
 * ━━━ What problem we're solving ━━━
 * In production, we need observability into our job queue. How many
 * jobs are waiting? How many are actively processing? Are any stuck
 * in a failed state? This is critical for alerting and capacity planning.
 *
 * ━━━ Regular way (without pgboss) ━━━
 * With Redis + Bull, you call queue.getJobCounts() which internally
 * reads multiple Redis keys (sorted sets for each state). To build
 * dashboards, you need Bull Board or a custom UI that connects to Redis.
 *
 * ━━━ PostgreSQL way (with pgboss) ━━━
 * Since jobs are just rows in pgboss.job, you can query them with
 * standard SQL. Use FILTER (WHERE ...) to count jobs by state in a
 * single query. You can also JOIN with your application tables for
 * rich reporting (e.g., "how many welcome emails are pending for
 * users who signed up today?").
 *
 * ━━━ Why PG way is better ━━━
 * - Standard SQL — no Redis-specific tooling needed
 * - Can JOIN job data with application data in a single query
 * - Existing PostgreSQL monitoring tools (pg_stat, Grafana) just work
 * - FILTER (WHERE ...) is a powerful PostgreSQL aggregate for multi-state counts
 *
 * @example
 *   const health = await getQueueHealth(boss, 'welcome-email');
 *   if (health.failed > 100) alertOpsTeam('welcome-email queue has 100+ failures');
 */
export async function getQueueHealth(
  boss: PgBoss,
  queueName: string,
): Promise<{ created: number; active: number; completed: number; failed: number }> {
  const pool = getPool();

  // Query the pgboss.job table directly using FILTER for per-state counts.
  // This is a standard PostgreSQL aggregate pattern — COUNT with FILTER
  // lets us compute multiple conditional counts in a single table scan.
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE state = 'created')::int   AS created,
       COUNT(*) FILTER (WHERE state = 'active')::int    AS active,
       COUNT(*) FILTER (WHERE state = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE state = 'failed')::int    AS failed
     FROM pgboss.job
     WHERE name = $1`,
    [queueName],
  );

  return result.rows[0];
}
