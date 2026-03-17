// ============================================================
//  FILE 18: CONTEXT
// ============================================================
//  Topic: context.Background, WithCancel, WithTimeout,
//         WithDeadline, WithValue, propagation, patterns.
//
//  WHY: Context is Go's standard for cancellation, timeouts,
//  and request-scoped values. Every production server passes
//  context through its call chain.
// ============================================================
//
//  STORY — "ISRO Mission Control"
//  Director Sivan runs launch control. WithCancel = manual
//  abort button. WithTimeout = auto-abort timer. WithDeadline =
//  scheduled end. WithValue = mission briefcase with IDs.
//  Cancellation flows DOWN the chain, never up.
// ============================================================

package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	// ============================================================
	//  EXAMPLE BLOCK 1 — WithCancel, WithTimeout, WithDeadline
	// ============================================================

	fmt.Println("============================================================")
	fmt.Println("  BLOCK 1: WithCancel, WithTimeout & WithDeadline")
	fmt.Println("============================================================")

	// SECTION: context.Background() — the root context
	fmt.Println("\n--- Background and TODO ---")
	fmt.Printf("  Background: %v (never cancelled)\n", context.Background())
	fmt.Printf("  TODO: %v (placeholder)\n", context.TODO())

	// SECTION: context.WithCancel — manual cancellation
	fmt.Println("\n--- WithCancel ---")

	ctx, cancel := context.WithCancel(context.Background())

	missionComplete := make(chan string, 1)
	go func(ctx context.Context) {
		for i := 1; ; i++ {
			select {
			case <-ctx.Done():
				fmt.Printf("  Subsystem aborted at step %d: %v\n", i, ctx.Err())
				missionComplete <- "scrubbed"
				return
			default:
				time.Sleep(20 * time.Millisecond)
			}
		}
	}(ctx)

	time.Sleep(55 * time.Millisecond)
	cancel()
	fmt.Println("  Mission result:", <-missionComplete)
	// Always call cancel() — safe to call multiple times. Use defer cancel().

	// SECTION: context.WithTimeout
	fmt.Println("\n--- WithTimeout ---")

	fuelCheck := func(ctx context.Context) error {
		select {
		case <-time.After(200 * time.Millisecond):
			return nil
		case <-ctx.Done():
			fmt.Println("  Fuel check timed out:", ctx.Err())
			return ctx.Err()
		}
	}

	timeoutCtx, timeoutCancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer timeoutCancel()

	if err := fuelCheck(timeoutCtx); err != nil {
		fmt.Println("  Error:", err)
	}

	// SECTION: context.WithDeadline
	fmt.Println("\n--- WithDeadline ---")

	deadline := time.Now().Add(60 * time.Millisecond)
	deadlineCtx, deadlineCancel := context.WithDeadline(context.Background(), deadline)
	defer deadlineCancel()

	select {
	case <-time.After(200 * time.Millisecond):
		fmt.Println("  Finished before deadline")
	case <-deadlineCtx.Done():
		fmt.Println("  Deadline reached:", deadlineCtx.Err())
	}

	// SECTION: Cancellation propagation
	fmt.Println("\n--- Parent cancels all children ---")

	parentCtx, parentCancel := context.WithCancel(context.Background())
	child1Ctx, child1Cancel := context.WithCancel(parentCtx)
	child2Ctx, child2Cancel := context.WithTimeout(parentCtx, 5*time.Second)
	defer child1Cancel()
	defer child2Cancel()

	parentCancel()
	time.Sleep(5 * time.Millisecond)
	fmt.Println("  Parent:", parentCtx.Err())
	fmt.Println("  Child1:", child1Ctx.Err())
	fmt.Println("  Child2:", child2Ctx.Err())
	fmt.Println("  Cancelling a child does NOT cancel the parent.")

	// ============================================================
	//  EXAMPLE BLOCK 2 — WithValue & Practical Patterns
	// ============================================================

	fmt.Println("\n============================================================")
	fmt.Println("  BLOCK 2: WithValue, Propagation & Patterns")
	fmt.Println("============================================================")

	// SECTION: context.WithValue
	// Use custom key types to avoid collisions. For request-scoped data only.
	fmt.Println("\n--- WithValue ---")

	type contextKey string
	const missionIDKey contextKey = "missionID"

	valCtx := context.WithValue(context.Background(), missionIDKey, "CHANDRAYAAN-3")

	if id, ok := valCtx.Value(missionIDKey).(string); ok {
		fmt.Println("  Mission ID:", id)
	}
	fmt.Println("  Missing key:", valCtx.Value(contextKey("nope")))

	// SECTION: Context propagation through call chain
	fmt.Println("\n--- Propagation through call chain ---")

	type MissionKey string
	const reqIDKey MissionKey = "missionID"

	queryTelemetry := func(ctx context.Context, query string) (string, error) {
		reqID, _ := ctx.Value(reqIDKey).(string)
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("[telemetry] %s cancelled: %w", reqID, ctx.Err())
		case <-time.After(20 * time.Millisecond):
			return fmt.Sprintf("[telemetry] data for '%s' (mission: %s)", query, reqID), nil
		}
	}

	handleLaunchCheck := func(missionID string) {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		ctx = context.WithValue(ctx, reqIDKey, missionID)

		result, err := queryTelemetry(ctx, "SELECT subsystem WHERE id=NAV-01")
		if err != nil {
			fmt.Println("  Error:", err)
			return
		}
		fmt.Println("  Response:", result)
	}

	handleLaunchCheck("MANGALYAAN-2")

	// SECTION: Graceful shutdown pattern
	fmt.Println("\n--- Graceful shutdown ---")

	stationCtx, stationCancel := context.WithCancel(context.Background())
	workerDone := make(chan struct{})

	go func() {
		defer close(workerDone)
		ticker := time.NewTicker(15 * time.Millisecond)
		defer ticker.Stop()
		ticks := 0
		for {
			select {
			case <-stationCtx.Done():
				fmt.Printf("  Worker: shutdown after %d ticks\n", ticks)
				return
			case <-ticker.C:
				ticks++
			}
		}
	}()

	time.Sleep(60 * time.Millisecond)
	stationCancel()
	<-workerDone
	fmt.Println("  Ground station shut down cleanly.")

	// SECTION: context.AfterFunc (Go 1.21+)
	fmt.Println("\n--- AfterFunc (Go 1.21+) ---")

	afterCtx, afterCancel := context.WithCancel(context.Background())
	afterDone := make(chan struct{})

	context.AfterFunc(afterCtx, func() {
		fmt.Println("  [AfterFunc] Cleanup on cancel!")
		close(afterDone)
	})

	afterCancel()
	<-afterDone

	// SECTION: Best practices
	fmt.Println("\n--- Best practices ---")
	fmt.Println("  1. ctx is ALWAYS the first parameter")
	fmt.Println("  2. Never store context in a struct")
	fmt.Println("  3. Always defer cancel()")
	fmt.Println("  4. Use Background() in main/tests, TODO() as placeholder")
	fmt.Println("  5. Check ctx.Done() in long-running operations")

	// ============================================================
	//  KEY TAKEAWAYS
	// ============================================================
	fmt.Println("\n============================================================")
	fmt.Println("  KEY TAKEAWAYS")
	fmt.Println("============================================================")
	fmt.Println(`
  1. Background() is the root context. TODO() is a placeholder.
  2. WithCancel: call cancel() to signal all listeners. Always defer it.
  3. WithTimeout/WithDeadline auto-cancel. Both return cancel functions.
  4. Cancellation propagates DOWN: parent cancels all children. Never up.
  5. ctx.Done() closes on cancel. ctx.Err() = Canceled or DeadlineExceeded.
  6. WithValue: request-scoped data only. Custom key types, immutable values.
  7. Convention: func DoWork(ctx context.Context, ...) error
  8. Never store context in a struct — pass explicitly through calls.`)
}
