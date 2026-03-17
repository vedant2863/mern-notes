// ============================================================
//  FILE 14 : Goroutines
// ============================================================
//  Topic  : The `go` keyword, lightweight concurrency, WaitGroup,
//           race conditions, Mutex preview, runtime functions,
//           goroutine leaks, closure gotcha.
//
//  WHY THIS MATTERS:
//  Goroutines are Go's killer feature — lightweight concurrent
//  functions (~2-8 KB stack vs ~1 MB OS thread). You can launch
//  millions of them. Mastering goroutines unlocks Go's full
//  power for servers, pipelines, and parallel computation.
// ============================================================

// ============================================================
// STORY: Head Cook Amma runs a highway dhaba. Each cook
// (goroutine) works independently. Amma (main) must WAIT for
// all rotis and sabzi before serving. If she leaves, every
// cook stops mid-flip — the meal is ruined.
// ============================================================

package main

import (
	"fmt"
	"runtime"
	"sync"
	"time"
)

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Basic Goroutines & WaitGroup
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 1.1 — The 'go' keyword
	// ────────────────────────────────────────────────────────────

	fmt.Println("--- Launching goroutines ---")
	go func() {
		fmt.Println("  [goroutine] Chopping onions")
	}()
	time.Sleep(50 * time.Millisecond) // BAD — fixed with WaitGroup below

	// ────────────────────────────────────────────────────────────
	// 1.2 — sync.WaitGroup
	// ────────────────────────────────────────────────────────────
	// Add(n) before launch, Done() in goroutine, Wait() to block.

	fmt.Println("\n--- WaitGroup ---")
	var wg sync.WaitGroup
	cooks := []string{"Raju (tandoor)", "Sita (tawa)", "Govind (sabzi)"}

	for _, cook := range cooks {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			fmt.Printf("  %s cooking\n", name)
			time.Sleep(30 * time.Millisecond)
			fmt.Printf("  %s done!\n", name)
		}(cook)
	}
	wg.Wait()
	fmt.Println("  Amma: Sab kuch taiyaar!")

	// ────────────────────────────────────────────────────────────
	// 1.3 — Goroutines are lightweight
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Weight ---")
	fmt.Println("  OS thread: ~1 MB | Goroutine: ~2-8 KB (dynamic)")

	// ============================================================
	// EXAMPLE BLOCK 2 — Race Conditions & Mutex
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 2.1 — Unsafe counter (race condition)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Unsafe counter ---")
	unsafeCounter := 0
	var wg2 sync.WaitGroup
	for i := 0; i < 1000; i++ {
		wg2.Add(1)
		go func() {
			defer wg2.Done()
			unsafeCounter++ // not atomic — race!
		}()
	}
	wg2.Wait()
	fmt.Printf("  Expected 1000, got: %d\n", unsafeCounter)
	fmt.Println("  Detect with: go run -race 14-goroutines.go")

	// ────────────────────────────────────────────────────────────
	// 2.2 — Safe counter (Mutex)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Safe counter (Mutex) ---")
	safeCounter := 0
	var mu sync.Mutex
	var wg3 sync.WaitGroup
	for i := 0; i < 1000; i++ {
		wg3.Add(1)
		go func() {
			defer wg3.Done()
			mu.Lock()
			safeCounter++
			mu.Unlock()
		}()
	}
	wg3.Wait()
	fmt.Printf("  Safe counter: %d\n", safeCounter)

	// ============================================================
	// EXAMPLE BLOCK 3 — Lifecycle, Runtime, Leaks, Closure Gotcha
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 3.1 — Main exits = all goroutines die
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Lifecycle ---")
	fmt.Println("  When main() returns, all goroutines are killed.")
	fmt.Println("  You MUST synchronize (WaitGroup, channels, etc.).")

	// ────────────────────────────────────────────────────────────
	// 3.2 — runtime functions
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- runtime ---")
	fmt.Printf("  NumGoroutine: %d\n", runtime.NumGoroutine())
	fmt.Printf("  NumCPU: %d\n", runtime.NumCPU())
	fmt.Printf("  GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
	fmt.Printf("  Version: %s\n", runtime.Version())

	// ────────────────────────────────────────────────────────────
	// 3.3 — Goroutine leak demo
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Leak demo ---")
	before := runtime.NumGoroutine()
	leakyChan := make(chan int)
	go func() { <-leakyChan }() // blocks forever
	time.Sleep(10 * time.Millisecond)
	fmt.Printf("  Before: %d, After: %d (+1 leaked)\n", before, runtime.NumGoroutine())

	close(leakyChan) // fix the leak
	time.Sleep(10 * time.Millisecond)
	fmt.Printf("  Fixed: %d\n", runtime.NumGoroutine())

	// ────────────────────────────────────────────────────────────
	// 3.4 — Closure gotcha in loops
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Closure gotcha ---")
	fmt.Println("  Pre-1.22: loop var shared → pass as arg to fix")
	var wg4 sync.WaitGroup
	fmt.Print("  ")
	for i := 0; i < 5; i++ {
		wg4.Add(1)
		go func(n int) {
			defer wg4.Done()
			fmt.Printf("%d ", n)
		}(i) // pass i as argument — safe in all Go versions
	}
	wg4.Wait()
	fmt.Println("\n  Go 1.22+: loop vars are per-iteration by default.")

	// ────────────────────────────────────────────────────────────
	// 3.5 — Scheduling
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Scheduling ---")
	fmt.Println("  M:N scheduling (goroutines on OS threads)")
	fmt.Println("  Cooperative + preemptive since Go 1.14")

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	fmt.Println("\n--- KEY TAKEAWAYS ---")
	fmt.Println(`  1. 'go f()' launches a goroutine (~2-8 KB stack).
  2. WaitGroup: Add before, Done inside, Wait to block.
  3. main() exit kills all goroutines — always synchronize.
  4. Race conditions: use 'go run -race' to detect.
  5. Mutex serializes shared state access.
  6. No goroutine IDs by design — pass context via args.
  7. Leaked goroutines = memory leaks. Ensure they can exit.
  8. Closure gotcha: pass loop vars as args (pre-1.22).
  9. runtime: NumGoroutine, NumCPU, GOMAXPROCS for monitoring.`)
}
