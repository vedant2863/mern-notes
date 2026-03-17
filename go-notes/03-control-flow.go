// ============================================================
//  FILE 3 : Control Flow
// ============================================================
//  Topic  : if/else with init statements, for loops (Go's only
//           loop), switch (expression, tagless, type, fallthrough),
//           break, continue, labeled loops, goto
//
//  WHY THIS MATTERS:
//  Go has one loop keyword: `for`. Switch breaks automatically
//  (opposite of C/Java). Fewer keywords, more power.
// ============================================================

// ============================================================
// STORY: Postmaster Brijesh routes letters through chutes at
// India Post's sorting office. Each if/else is a gate, each
// for loop a conveyor belt, each switch a multi-way chute.
// ============================================================

package main

import "fmt"

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — if/else Patterns & for Loop Variants
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 1 — Basic if/else
	// ──────────────────────────────────────────────────────────────
	// No parentheses around condition, braces always required.

	temperature := 72
	if temperature > 80 {
		fmt.Println("Too hot — open the windows!")
	} else if temperature < 60 {
		fmt.Println("Too cold — turn on the heater!")
	} else {
		fmt.Println("Temperature is just right.")
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 2 — if with Init Statement
	// ──────────────────────────────────────────────────────────────
	// Variable scoped to the if/else block only.

	fmt.Println("\n--- if with Init Statement ---")
	letters := []string{"letter", "parcel", "postcard", "registered", "speedpost"}

	if letterCount := len(letters); letterCount > 3 {
		fmt.Printf("Heavy load: %d items\n", letterCount)
	} else {
		fmt.Printf("Light load: %d items\n", letterCount)
	}
	// letterCount NOT accessible here — scoped to if/else

	if val, ok := mockLookup("registered"); ok {
		fmt.Printf("Found: %s\n", val)
	} else {
		fmt.Println("Not found")
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 3 — for Loop: Classic (C-style)
	// ──────────────────────────────────────────────────────────────
	// Go has ONE loop keyword: for.

	fmt.Println("\n--- Classic for Loop ---")
	fmt.Print("Count: ")
	for i := 0; i < 5; i++ {
		fmt.Printf("%d ", i)
	}
	fmt.Println()

	// ──────────────────────────────────────────────────────────────
	// SECTION 4 — for range (foreach-style)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- for range (slice) ---")
	parcels := []string{"letter", "parcel", "postcard", "registered"}
	for i, item := range parcels {
		fmt.Printf("  Chute %d: %s\n", i, item)
	}

	// Range over a map — order is random
	fmt.Println("\n--- for range (map) ---")
	pincodeCount := map[string]int{"110001": 100, "400001": 80, "600001": 25}
	for pincode, qty := range pincodeCount {
		fmt.Printf("  %s: %d\n", pincode, qty)
	}

	// Range over integers (Go 1.22+)
	fmt.Print("\nRange int: ")
	for i := range 5 {
		fmt.Printf("%d ", i)
	}
	fmt.Println()

	// ──────────────────────────────────────────────────────────────
	// SECTION 5 — for Loop: while-style & Infinite with break
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- while-style for ---")
	count := 0
	for count < 3 {
		fmt.Printf("  Batch %d\n", count)
		count++
	}

	fmt.Println("\n--- Infinite loop with break ---")
	attempts := 0
	for {
		attempts++
		if attempts >= 3 {
			fmt.Printf("  Stopped after %d attempts\n", attempts)
			break
		}
		fmt.Printf("  Attempt %d...\n", attempts)
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 6 — break and continue
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- continue (skip damaged) ---")
	batch := []string{"good", "good", "damaged", "good", "damaged"}
	passed := 0
	for _, item := range batch {
		if item == "damaged" {
			continue
		}
		passed++
		fmt.Printf("  Passed: %s (#%d)\n", item, passed)
	}

	// ============================================================
	// EXAMPLE BLOCK 2 — switch, Labeled Loops & Advanced Control
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 7 — Expression switch
	// ──────────────────────────────────────────────────────────────
	// Breaks automatically — NO fall-through by default.

	fmt.Println("\n--- Expression switch ---")
	zone := "red"
	switch zone {
	case "red":
		fmt.Println("Fragile parcels section")
	case "blue":
		fmt.Println("Standard letters section")
	default:
		fmt.Println("Manual inspection")
	}

	// Multi-case
	day := "Saturday"
	switch day {
	case "Monday", "Tuesday", "Wednesday", "Thursday", "Friday":
		fmt.Println("Workday — office running")
	case "Saturday", "Sunday":
		fmt.Println("Weekend — office closed")
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 8 — Tagless switch (replaces if-else chains)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Tagless switch ---")
	score := 85
	switch {
	case score >= 90:
		fmt.Println("Grade: A")
	case score >= 80:
		fmt.Println("Grade: B")
	case score >= 70:
		fmt.Println("Grade: C")
	default:
		fmt.Println("Grade: F")
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 9 — switch with init & fallthrough
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- switch with init ---")
	switch size := len(parcels); {
	case size > 10:
		fmt.Println("Large batch")
	case size > 3:
		fmt.Printf("Medium batch (%d items)\n", size)
	default:
		fmt.Println("Small batch")
	}

	fmt.Println("\n--- fallthrough ---")
	level := 1
	fmt.Print("Access levels: ")
	switch level {
	case 1:
		fmt.Print("basic ")
		fallthrough
	case 2:
		fmt.Print("standard ")
		fallthrough
	case 3:
		fmt.Print("premium")
	}
	fmt.Println()

	// ──────────────────────────────────────────────────────────────
	// SECTION 10 — Type switch (preview)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Type switch ---")
	describe := func(val interface{}) string {
		switch v := val.(type) {
		case int:
			return fmt.Sprintf("integer: %d", v)
		case string:
			return fmt.Sprintf("string: %q", v)
		case bool:
			return fmt.Sprintf("boolean: %v", v)
		default:
			return fmt.Sprintf("unknown: %T", v)
		}
	}
	fmt.Println(describe(42))
	fmt.Println(describe("pincode"))
	fmt.Println(describe(3.14))

	// ──────────────────────────────────────────────────────────────
	// SECTION 11 — Labeled break (nested loop escape)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Labeled break ---")
	matrix := [][]int{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}
	target := 5

outer:
	for row, cols := range matrix {
		for col, val := range cols {
			if val == target {
				fmt.Printf("Found %d at [%d][%d]\n", target, row, col)
				break outer
			}
		}
	}

	// Labeled continue
	fmt.Println("\n--- Labeled continue ---")
rows:
	for i, row := range [][]int{{1, 2}, {3, -1}, {4, 5}} {
		for _, val := range row {
			if val < 0 {
				fmt.Printf("  Row %d has negative — skipping\n", i)
				continue rows
			}
		}
		fmt.Printf("  Row %d: all positive\n", i)
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 12 — goto (exists but discouraged)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- goto (discouraged) ---")
	n := 0
loop:
	if n < 3 {
		fmt.Printf("  goto iteration: %d\n", n)
		n++
		goto loop
	}
	// Use a for loop instead — goto is rarely warranted.
}

// Helper for if-with-init demo
func mockLookup(name string) (string, bool) {
	registry := map[string]string{
		"letter":     "ordinary dak",
		"registered": "registered dak",
		"speedpost":  "express dak",
	}
	val, ok := registry[name]
	return val, ok
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. ONE loop keyword: `for` — covers classic, while, infinite,
//    and range (foreach) patterns.
// 2. if/else and switch support init statements that scope
//    variables to the block.
// 3. switch breaks automatically. Use `fallthrough` explicitly.
// 4. Tagless switch replaces long if-else chains.
// 5. Labeled break/continue escape nested loops without flags.
// 6. range over strings iterates by rune; over maps is random.
// 7. goto exists but is rarely needed.
// ============================================================
