# Chapter 35: The Queue Masters (pgboss)

## Story

MingleSphereQL was growing fast. New users were signing up every minute, and with each signup came a cascade of side effects: a welcome email needed to be sent, a feed recommendation had to be generated, and expired sessions had to be cleaned up. At first, the team handled everything synchronously inside the request handler -- send the email, compute the feed, then respond. But as traffic climbed, response times ballooned. Users were staring at spinners while the server processed background work that had nothing to do with their request.

Kai, the backend lead, proposed adding a job queue. "We need to decouple the request from the work," he said. "When a user signs up, we drop a job on the queue and respond immediately. A separate worker picks up the job and processes it in the background." The team's first instinct was to reach for Redis and BullMQ -- the industry standard. But Mara from the infrastructure team pushed back. "We already have PostgreSQL. Do we really need to operate a second stateful system just for job queues?"

That is when they discovered pgboss. It is a job queue that runs entirely inside PostgreSQL. No Redis, no extra infrastructure, no new failure modes. Under the hood, pgboss uses `SKIP LOCKED` to dequeue jobs without contention, advisory locks for coordination, and standard PostgreSQL tables for persistence. Jobs survive crashes, support retries, and can be scheduled with cron expressions -- all without leaving the database.

The team built six capabilities: initializing the pgboss instance, enqueuing welcome email jobs with a delay, processing those jobs with a handler function, scheduling recurring session cleanup with cron syntax, configuring jobs with retry limits, and monitoring queue health by counting jobs in each state.

When the migration was complete, Kai ran the numbers. Signup response time dropped by 80%. Background jobs ran reliably with automatic retries. And the operations team was thrilled -- one less system to monitor, back up, and keep alive at 3 AM.

## Concepts

- **Job queues**: Decouple work from the request/response cycle by placing tasks on a queue for asynchronous processing.
- **pgboss**: A PostgreSQL-native job queue library that uses `SKIP LOCKED` and advisory locks for safe, concurrent job dequeuing.
- **Job lifecycle**: Jobs move through states: `created` (waiting), `active` (being processed), `completed` (succeeded), `failed` (errored out).
- **Delayed jobs**: Jobs that wait a specified duration before becoming eligible for processing.
- **Retry configuration**: Automatic re-enqueuing of failed jobs with configurable limits and backoff.
- **Cron scheduling**: Recurring jobs defined with cron expressions (e.g., `0 */6 * * *` for every 6 hours).
- **Dead letter queues**: Failed jobs that exhaust their retries land in a dead letter queue for inspection.
- **SKIP LOCKED**: A PostgreSQL row-locking strategy that allows concurrent workers to dequeue different jobs without blocking each other.

## Code Examples

### Initializing pgboss

```ts
import PgBoss from 'pg-boss';

const boss = new PgBoss({
  connectionString: 'postgresql://localhost:5432/minglesphereql',
});
await boss.start();
```

### Enqueuing a job

```ts
const jobId = await boss.send('welcome-email', {
  userId: 42,
  email: 'alice@example.com',
}, {
  startAfter: 30, // delay 30 seconds
});
```

### Processing jobs

```ts
await boss.work('welcome-email', async (job) => {
  const { userId, email } = job.data;
  await sendEmail(email, 'Welcome!');
});
```

### Scheduling recurring jobs

```ts
await boss.schedule('session-cleanup', '0 */6 * * *', {}, {
  tz: 'UTC',
});
```

### Jobs with retry configuration

```ts
await boss.send('generate-feed', { userId: 42 }, {
  retryLimit: 3,
  retryDelay: 60,   // wait 60 seconds between retries
  expireInMinutes: 5 // job expires if not completed in 5 min
});
```

### Checking queue health

```ts
const counts = await boss.getQueueSize('welcome-email');
// Returns the number of jobs in 'created' state
```

## Practice Goals

1. Initialize and start a pgboss instance connected to the database.
2. Enqueue a delayed job to a named queue with structured payload data.
3. Subscribe a worker handler to process jobs from a queue.
4. Schedule a recurring job using cron syntax.
5. Configure jobs with retry limits and expiration settings.
6. Query queue health metrics to monitor job states.

## Tips

- pgboss creates its own schema and tables on first start. Call `boss.start()` once during application bootstrap -- it handles migrations automatically.
- `SKIP LOCKED` is the secret sauce: when multiple workers poll the same queue, each one locks a different row, so jobs are never processed twice.
- Use `startAfter` (in seconds) for one-time delays, and `boss.schedule()` with a cron string for recurring patterns.
- The `retryLimit` controls how many times a failed job is retried. Set `retryDelay` to add a cooldown between attempts (useful for rate-limited APIs).
- pgboss stores job data as JSONB, so you can query and filter jobs using standard PostgreSQL JSON operators.
- In production, call `boss.stop()` during graceful shutdown to finish active jobs before the process exits.
- For testing, you can use `boss.getJobById(jobId)` to inspect a job's current state, output, and retry count.
