// ============================================================
//  FILE 23: The time Package
// ============================================================
//  Topic: time.Now, time.Date, Duration, formatting with
//         reference time, parsing, arithmetic, timers, tickers,
//         time zones.
//
//  WHY: Time is everywhere — logging, scheduling, rate limiting,
//  deadlines. Go uses a reference time (Mon Jan 2 15:04:05 MST
//  2006) instead of cryptic format codes.
// ============================================================
//
//  STORY — "The Rajabai Clock Tower"
//  Keeper Govind manages clocks across Mumbai. He sets IST,
//  measures intervals, schedules chimes, and ensures distant
//  clocks show the correct local time.
// ============================================================

package main

import (
	"fmt"
	"time"
)

func main() {
	// ============================================================
	// BLOCK 1 — Now, Date, Formatting, Parsing, Arithmetic
	// ============================================================

	fmt.Println("--- BLOCK 1: Time Basics ---")

	// SECTION: time.Now() and time.Date()
	now := time.Now()
	fmt.Println("Now:", now.Format("2006-01-02 15:04"))
	fmt.Println("Weekday:", now.Weekday())

	republicDay := time.Date(2026, time.January, 26, 9, 0, 0, 0, time.UTC)
	fmt.Println("Republic Day:", republicDay)
	fmt.Println("Unix:", republicDay.Unix())

	// SECTION: Formatting with reference time
	// Mnemonic: 01/02 03:04:05PM '06 -0700
	fmt.Println("\n--- Formatting ---")

	ref := time.Date(2026, time.January, 26, 14, 30, 45, 0, time.UTC)
	fmt.Println("RFC3339:     ", ref.Format(time.RFC3339))
	fmt.Println("Date only:   ", ref.Format("2006-01-02"))
	fmt.Println("Indian style:", ref.Format("02/01/2006"))
	fmt.Println("Full:        ", ref.Format("Monday, January 2, 2006 at 3:04 PM"))
	fmt.Println("24-hour:     ", ref.Format("2006-01-02 15:04:05"))

	// SECTION: Parsing
	fmt.Println("\n--- Parsing ---")

	t1, _ := time.Parse("2006-01-02", "2026-01-26")
	fmt.Println("Parsed:", t1)

	t2, _ := time.Parse(time.RFC3339, "2026-01-26T14:30:00Z")
	fmt.Println("RFC3339:", t2)

	ist, _ := time.LoadLocation("Asia/Kolkata")
	t3, _ := time.ParseInLocation("2006-01-02 15:04", "2026-01-26 09:00", ist)
	fmt.Println("IST:", t3)

	// SECTION: Duration and arithmetic
	fmt.Println("\n--- Duration & Arithmetic ---")

	fmt.Println("5 minutes:", 5*time.Minute)
	d, _ := time.ParseDuration("1h30m45s")
	fmt.Println("Parsed:", d, "=", d.Seconds(), "seconds")

	baseTime := time.Date(2026, 1, 26, 12, 0, 0, 0, time.UTC)
	fmt.Println("Base:      ", baseTime.Format("Jan 2, 15:04"))
	fmt.Println("+72 hours: ", baseTime.Add(72*time.Hour).Format("Jan 2, 15:04"))
	fmt.Println("-24 hours: ", baseTime.Add(-24*time.Hour).Format("Jan 2, 15:04"))

	// Sub, Before, After, Equal
	future := baseTime.Add(72 * time.Hour)
	fmt.Println("Difference:", future.Sub(baseTime))
	fmt.Println("Before?", baseTime.Before(future))

	// ============================================================
	// BLOCK 2 — Timers, Tickers, Timezones
	// ============================================================

	fmt.Println("\n--- BLOCK 2: Timers, Tickers, Timezones ---")

	// SECTION: time.After / time.NewTimer
	fmt.Println("\n--- Timer ---")

	timer := time.NewTimer(50 * time.Millisecond)
	stopped := timer.Stop()
	fmt.Println("Stopped before fire:", stopped)

	timer.Reset(10 * time.Millisecond)
	<-timer.C
	fmt.Println("Timer fired after reset")

	// SECTION: time.NewTicker
	fmt.Println("\n--- Ticker ---")

	ticker := time.NewTicker(20 * time.Millisecond)
	tickCount := 0

	done := make(chan bool)
	go func() {
		for range ticker.C {
			tickCount++
			if tickCount >= 3 {
				done <- true
				return
			}
		}
	}()
	<-done
	ticker.Stop()
	fmt.Println("Stopped after", tickCount, "chimes")

	// SECTION: time.Sleep
	start := time.Now()
	time.Sleep(25 * time.Millisecond)
	fmt.Printf("Slept for %v\n", time.Since(start).Round(time.Millisecond))

	// SECTION: Timezones
	fmt.Println("\n--- Timezones ---")

	utcTime := time.Date(2026, 1, 26, 12, 0, 0, 0, time.UTC)
	kolkata, _ := time.LoadLocation("Asia/Kolkata")
	tokyo, _ := time.LoadLocation("Asia/Tokyo")

	fmt.Println("UTC:    ", utcTime.Format("15:04 MST"))
	fmt.Println("Mumbai: ", utcTime.In(kolkata).Format("15:04 MST"))
	fmt.Println("Tokyo:  ", utcTime.In(tokyo).Format("15:04 MST"))

	// Equal compares the instant, not the representation
	fmt.Println("UTC == IST?", utcTime.Equal(utcTime.In(kolkata)))

	// SECTION: Measure execution time
	fmt.Println("\n--- Measure Execution ---")

	start = time.Now()
	sum := 0
	for i := 0; i < 1_000_000; i++ {
		sum += i
	}
	fmt.Printf("sum=%d in %v\n", sum, time.Since(start))

	// Defer pattern for function timing
	func() {
		defer measureTime("calculation")()
		total := 0
		for i := 0; i < 2_000_000; i++ {
			total += i
		}
		_ = total
	}()

	// SECTION: Timeout pattern with select
	fmt.Println("\n--- Timeout with select ---")

	work := make(chan string, 1)
	go func() {
		time.Sleep(30 * time.Millisecond)
		work <- "result ready"
	}()

	select {
	case result := <-work:
		fmt.Println("Got:", result)
	case <-time.After(100 * time.Millisecond):
		fmt.Println("Timed out!")
	}
}

func measureTime(label string) func() {
	start := time.Now()
	return func() {
		fmt.Printf("  [TIMER] %s took %v\n", label, time.Since(start))
	}
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. time.Now() = current time. time.Date() = specific time.
// 2. Formatting uses REFERENCE TIME: Mon Jan 2 15:04:05 MST 2006.
// 3. Parse/Format use the same reference layout.
// 4. Duration = nanoseconds. Constants: time.Second, Minute, Hour.
// 5. t.Add(d) adds duration, t.Sub(t2) returns duration.
// 6. time.After: one-shot. NewTimer: controllable. NewTicker: repeating.
// 7. Always Stop tickers/timers. Store in UTC, display with t.In(loc).
// 8. Measure: start := time.Now(); elapsed := time.Since(start).
// ============================================================
