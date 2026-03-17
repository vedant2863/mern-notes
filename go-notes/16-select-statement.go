// ============================================================
//  FILE 16: THE SELECT STATEMENT
// ============================================================
//  Topic: Multiplexing channel operations with select, timeouts,
//         non-blocking ops, done channels, fan-in, tickers.
//
//  WHY: select lets a goroutine wait on MULTIPLE channel
//  operations simultaneously — enabling timeouts, cancellation,
//  fan-in, and priority patterns.
// ============================================================
//
//  STORY — "Mumbai ATC"
//  ATC Officer Kapoor watches multiple runways (channels) at
//  CSIA. select lets him respond to whichever runway has activity
//  first, set timeout alarms, and prioritize emergencies.
// ============================================================

package main

import (
	"fmt"
	"math/rand"
	"time"
)

func main() {
	// ============================================================
	//  EXAMPLE BLOCK 1 — Basic Select, Timeout, Non-blocking
	// ============================================================

	fmt.Println("============================================================")
	fmt.Println("  BLOCK 1: Basic Select, Timeout & Non-blocking")
	fmt.Println("============================================================")

	// SECTION: Basic select — first channel wins
	fmt.Println("\n--- Basic select ---")

	runway1 := make(chan string, 1)
	runway2 := make(chan string, 1)

	go func() {
		time.Sleep(20 * time.Millisecond)
		runway1 <- "Flight AI-101"
	}()
	go func() {
		time.Sleep(10 * time.Millisecond)
		runway2 <- "Flight 6E-302"
	}()

	select {
	case flight := <-runway1:
		fmt.Println("  Runway 1:", flight)
	case flight := <-runway2:
		fmt.Println("  Runway 2:", flight)
	}
	// Output: Runway 2: Flight 6E-302 (arrives first)

	time.Sleep(20 * time.Millisecond)

	// SECTION: Random selection when multiple ready
	// When multiple cases are ready, Go picks one uniformly at random.
	fmt.Println("\n--- Random selection ---")

	ch1 := make(chan string, 1)
	ch2 := make(chan string, 1)
	counts := map[string]int{"ch1": 0, "ch2": 0}

	for i := 0; i < 100; i++ {
		ch1 <- "A"
		ch2 <- "B"
		select {
		case <-ch1:
			counts["ch1"]++
		case <-ch2:
			counts["ch2"]++
		}
		select {
		case <-ch1:
		case <-ch2:
		default:
		}
	}
	fmt.Printf("  ch1: %d, ch2: %d (roughly 50/50)\n", counts["ch1"], counts["ch2"])

	// SECTION: Timeout with time.After
	fmt.Println("\n--- Timeout with time.After ---")

	slowRunway := make(chan string)
	go func() {
		time.Sleep(200 * time.Millisecond)
		slowRunway <- "Flight SG-205"
	}()

	select {
	case flight := <-slowRunway:
		fmt.Println("  Landed:", flight)
	case <-time.After(50 * time.Millisecond):
		fmt.Println("  TIMEOUT: No flight in 50ms, diverting!")
	}

	// SECTION: Non-blocking with default
	fmt.Println("\n--- Non-blocking select ---")

	radar := make(chan string)
	select {
	case signal := <-radar:
		fmt.Println("  Signal:", signal)
	default:
		fmt.Println("  No signal right now (non-blocking).")
	}

	// SECTION: Non-blocking send
	fmt.Println("\n--- Non-blocking send ---")

	logCh := make(chan string, 1)
	logCh <- "existing message"

	select {
	case logCh <- "new message":
		fmt.Println("  Sent to log.")
	default:
		fmt.Println("  Log channel full, dropped (back-pressure).")
	}

	// select {} blocks forever — useful for keeping main alive.

	// ============================================================
	//  EXAMPLE BLOCK 2 — Done Channel, Fan-In, Ticker, Priority
	// ============================================================

	fmt.Println("\n============================================================")
	fmt.Println("  BLOCK 2: Done Channel, Fan-In, Ticker & Priority")
	fmt.Println("============================================================")

	// SECTION: Done channel pattern
	fmt.Println("\n--- Done channel for cancellation ---")

	done := make(chan struct{})
	results := make(chan string, 10)

	go func() {
		i := 0
		for {
			select {
			case <-done:
				fmt.Println("  Kapoor: shutting down.")
				return
			default:
				i++
				results <- fmt.Sprintf("result-%d", i)
				time.Sleep(15 * time.Millisecond)
			}
		}
	}()

	time.Sleep(60 * time.Millisecond)
	close(done)

	close(results)
	count := 0
	for range results {
		count++
	}
	fmt.Printf("  Collected %d results before cancellation.\n", count)
	time.Sleep(20 * time.Millisecond)

	// SECTION: Fan-in pattern
	fmt.Println("\n--- Fan-in: merging channels ---")

	fanIn := func(ch1, ch2 <-chan string) <-chan string {
		merged := make(chan string)
		go func() {
			defer close(merged)
			c1Done, c2Done := false, false
			for !c1Done || !c2Done {
				select {
				case v, ok := <-ch1:
					if !ok {
						c1Done = true
						ch1 = nil // disable case
					} else {
						merged <- v
					}
				case v, ok := <-ch2:
					if !ok {
						c2Done = true
						ch2 = nil
					} else {
						merged <- v
					}
				}
			}
		}()
		return merged
	}

	source1 := make(chan string, 2)
	source2 := make(chan string, 3)
	source1 <- "Runway-27: AI-101"
	source1 <- "Runway-27: 6E-302"
	close(source1)
	source2 <- "Runway-09: SG-205"
	source2 <- "Runway-09: UK-831"
	source2 <- "Runway-09: AI-445"
	close(source2)

	for msg := range fanIn(source1, source2) {
		fmt.Println("  Merged:", msg)
	}

	// SECTION: Ticker for periodic operations
	fmt.Println("\n--- Ticker ---")

	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()

	tickDone := make(chan struct{})
	go func() {
		time.Sleep(90 * time.Millisecond)
		close(tickDone)
	}()

	tickCount := 0
tickLoop:
	for {
		select {
		case <-ticker.C:
			tickCount++
		case <-tickDone:
			break tickLoop
		}
	}
	fmt.Printf("  Received %d ticks in ~90ms\n", tickCount)

	// SECTION: Priority select pattern
	fmt.Println("\n--- Priority select ---")

	emergency := make(chan string, 5)
	regular := make(chan string, 5)

	regular <- "Normal: 6E-302"
	regular <- "Normal: SG-205"
	emergency <- "MAYDAY: AI-101 engine failure!"
	regular <- "Normal: UK-831"
	emergency <- "MAYDAY: AI-445 fuel critical!"
	regular <- "Normal: 6E-888"

	processed := 0
	for processed < 6 {
		select {
		case msg := <-emergency:
			fmt.Println("  [PRIORITY]", msg)
			processed++
			continue
		default:
		}
		select {
		case msg := <-emergency:
			fmt.Println("  [PRIORITY]", msg)
		case msg := <-regular:
			fmt.Println("  [NORMAL]  ", msg)
		}
		processed++
	}

	// SECTION: Timeout with retries
	fmt.Println("\n--- Timeout with retries ---")

	unreliableService := func() <-chan string {
		ch := make(chan string, 1)
		go func() {
			delay := time.Duration(rand.Intn(80)+10) * time.Millisecond
			time.Sleep(delay)
			ch <- fmt.Sprintf("response (took %dms)", delay/time.Millisecond)
		}()
		return ch
	}

	timeout := 50 * time.Millisecond
	for attempt := 1; attempt <= 3; attempt++ {
		select {
		case resp := <-unreliableService():
			fmt.Printf("  Attempt %d: SUCCESS — %s\n", attempt, resp)
			goto selectDone
		case <-time.After(timeout):
			fmt.Printf("  Attempt %d: TIMEOUT, retrying...\n", attempt)
		}
	}
	fmt.Println("  All retries exhausted!")
selectDone:

	// ============================================================
	//  KEY TAKEAWAYS
	// ============================================================
	fmt.Println("\n============================================================")
	fmt.Println("  KEY TAKEAWAYS")
	fmt.Println("============================================================")
	fmt.Println(`
  1. select waits on multiple channels. If multiple ready, picks RANDOM.
  2. time.After(d) creates a timeout case in select.
  3. default makes select non-blocking. Great for polling/back-pressure.
  4. Done channel: close(done) unblocks ALL listeners. Use chan struct{}.
  5. Fan-in merges channels. Set channel to nil to disable a drained case.
  6. time.NewTicker fires periodically. Always defer ticker.Stop().
  7. Priority select: nested selects — check high-priority first with default.
  8. select {} (empty) blocks forever.`)
}
