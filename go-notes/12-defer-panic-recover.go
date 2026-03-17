// ============================================================
//  FILE 12 : Defer, Panic, and Recover
// ============================================================
//  Topic  : defer (LIFO, argument evaluation), practical defer
//           patterns (close, unlock, timing), panic (runtime vs
//           deliberate), recover, converting panic to error.
//
//  WHY THIS MATTERS:
//  defer ensures cleanup always happens. panic and recover
//  handle truly exceptional situations (not normal errors).
//  These three make Go code robust and leak-free.
// ============================================================

// ============================================================
// STORY: Commander Rathore leads NDRF disaster response. Every
// rescue zone schedules cleanup (defer). If an earthquake hits
// (panic), the recovery unit (recover) prevents total collapse.
// But you don't trigger the alarm for a broken window.
// ============================================================

package main

import (
	"fmt"
	"strings"
	"sync"
)

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Defer Basics & Practical Patterns
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 1.1 — Defer LIFO Order
	// ────────────────────────────────────────────────────────────

	fmt.Println("--- Defer LIFO ---")
	func() {
		fmt.Println("  Start")
		defer fmt.Println("  Deferred 1")
		defer fmt.Println("  Deferred 2")
		defer fmt.Println("  Deferred 3")
		fmt.Println("  End")
	}()
	// Output: Start, End, 3, 2, 1

	// ────────────────────────────────────────────────────────────
	// 1.2 — Argument Evaluation: At Defer Time!
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Argument Evaluation ---")
	func() {
		x := 10
		defer fmt.Printf("  Deferred x = %d (captured at defer time)\n", x)
		x = 20
		fmt.Printf("  Current x = %d\n", x)
	}()

	// To capture FINAL value, use a closure:
	fmt.Println("\n--- Closure Captures Final Value ---")
	func() {
		x := 10
		defer func() { fmt.Printf("  Closure x = %d\n", x) }()
		x = 20
	}()

	// ────────────────────────────────────────────────────────────
	// 1.3 — Defer in Loops: Wrap in Anonymous Func
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Defer in Loops (correct) ---")
	for i := 0; i < 3; i++ {
		func(n int) {
			defer fmt.Printf("  Cleanup %d\n", n)
			fmt.Printf("  Process %d\n", n)
		}(i)
	}

	// ────────────────────────────────────────────────────────────
	// 1.4 — Practical: File Close Pattern
	// ────────────────────────────────────────────────────────────
	// Open resource, immediately defer cleanup.

	fmt.Println("\n--- File Close Pattern ---")
	type MockFile struct{ Name string }

	processFile := func(name string) {
		f := &MockFile{Name: name}
		fmt.Printf("  Opened %s\n", f.Name)
		defer fmt.Printf("  Closed %s\n", f.Name)
		fmt.Printf("  Processing %s\n", f.Name)
	}
	processFile("report.txt")

	// ────────────────────────────────────────────────────────────
	// 1.5 — Practical: Mutex Unlock
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Mutex Unlock ---")
	var mu sync.Mutex
	counter := 0
	inc := func() {
		mu.Lock()
		defer mu.Unlock()
		counter++
	}
	inc()
	inc()
	inc()
	fmt.Println("  Counter:", counter)

	// ────────────────────────────────────────────────────────────
	// 1.6 — Practical: Trace Enter/Exit
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Trace Enter/Exit ---")
	trace := func(name string) func() {
		fmt.Printf("  ENTER %s\n", name)
		return func() { fmt.Printf("  EXIT  %s\n", name) }
	}
	func() {
		defer trace("rescue")()
		fmt.Println("  ... conducting operation ...")
	}()

	// ============================================================
	// EXAMPLE BLOCK 2 — Panic, Recover, Panic-to-Error
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 2.1 — Runtime Panics (recovered safely)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Runtime Panics ---")
	safeDemo := func(name string, fn func()) {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("  RECOVERED [%s]: %v\n", name, r)
			}
		}()
		fn()
	}

	safeDemo("out of bounds", func() { _ = []int{1}[10] })
	safeDemo("nil pointer", func() { var p *int; _ = *p })
	safeDemo("nil map", func() { var m map[string]int; m["k"] = 1 })

	// ────────────────────────────────────────────────────────────
	// 2.2 — Deliberate Panic (programmer errors only)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Deliberate Panic ---")
	mustParse := func(s string) map[string]string {
		if s == "" {
			panic("config string cannot be empty")
		}
		cfg := make(map[string]string)
		for _, line := range strings.Split(s, "\n") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				cfg[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
			}
		}
		return cfg
	}
	fmt.Println("  Config:", mustParse("zone=4\nseverity=high"))

	func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("  Caught:", r)
			}
		}()
		mustParse("")
	}()

	// ────────────────────────────────────────────────────────────
	// 2.3 — Converting Panic to Error (Production Pattern)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Panic to Error ---")
	safeExecute := func(fn func()) (err error) {
		defer func() {
			if r := recover(); r != nil {
				switch v := r.(type) {
				case error:
					err = fmt.Errorf("panic (error): %w", v)
				case string:
					err = fmt.Errorf("panic (string): %s", v)
				default:
					err = fmt.Errorf("panic: %v", v)
				}
			}
		}()
		fn()
		return nil
	}

	err := safeExecute(func() { panic("earthquake zone 4") })
	fmt.Println("  Recovered:", err)

	err = safeExecute(func() { fmt.Println("  Normal operation") })
	fmt.Println("  Error:", err)

	// ────────────────────────────────────────────────────────────
	// 2.4 — Defers Run During Panic
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Defers Run During Panic ---")
	func() {
		defer func() { recover() }()
		defer fmt.Println("  Cleanup 1: evacuating")
		defer fmt.Println("  Cleanup 2: securing perimeter")
		panic("aftershock!")
	}()

	// ────────────────────────────────────────────────────────────
	// 2.5 — Safe Handler Pattern
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Safe Handler ---")
	type Request struct{ Path string }
	type Response struct {
		Status int
		Body   string
	}

	safeHandler := func(handler func(Request) Response) func(Request) Response {
		return func(req Request) (resp Response) {
			defer func() {
				if r := recover(); r != nil {
					resp = Response{500, "Internal Server Error"}
				}
			}()
			return handler(req)
		}
	}

	ok := safeHandler(func(r Request) Response { return Response{200, "OK"} })
	bad := safeHandler(func(r Request) Response { panic("bug") })

	fmt.Printf("  /health → %d\n", ok(Request{"/health"}).Status)
	fmt.Printf("  /buggy  → %d\n", bad(Request{"/buggy"}).Status)

	// ────────────────────────────────────────────────────────────
	// 2.6 — When to Panic vs Return Error
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Panic vs Error ---")
	fmt.Println("PANIC: init failure, programmer error, MustXxx funcs")
	fmt.Println("ERROR: I/O, user input, any expected failure")
	fmt.Println("RULE: If in doubt, return an error.")

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	// 1. defer executes in LIFO order when function returns.
	// 2. Args evaluated at defer time. Use closures for final values.
	// 3. Defer in loops: wrap in anonymous func.
	// 4. Common: close files, unlock mutexes, log entry/exit.
	// 5. panic stops execution and unwinds the stack.
	// 6. recover() only works inside a deferred function.
	// 7. Defers run even during panic — cleanup is reliable.
	// 8. Convert panics to errors in library/handler code.
	// 9. Panic for programmer errors only. Return errors otherwise.
}
