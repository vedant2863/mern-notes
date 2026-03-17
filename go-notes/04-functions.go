// ============================================================
//  FILE 4 : Functions
// ============================================================
//  Topic  : Function declarations, multiple returns, named
//           returns, variadic functions, first-class functions,
//           function types, anonymous functions, closures,
//           defer basics, higher-order functions
//
//  WHY THIS MATTERS:
//  Functions are Go's primary building block. They return
//  multiple values (the error pattern depends on this), can be
//  assigned to variables, and created inline as closures. Go
//  has no classes — functions and methods organize all behavior.
// ============================================================

// ============================================================
// STORY: Halwai Govind ji runs a mithai shop. Each function is
// a recipe: ingredients in, sweets out. Some produce two outputs
// (sweet + error). Closures are family recipes that remember
// spice ratios from when they were first created.
// ============================================================

package main

import (
	"fmt"
	"math"
	"strings"
)

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Basic Functions, Multiple Returns & Errors
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 1 — Basic Function Calls
	// ──────────────────────────────────────────────────────────────

	greet("Govind ji")

	result := add(10, 25)
	fmt.Printf("add(10, 25) = %d\n", result)

	// ──────────────────────────────────────────────────────────────
	// SECTION 2 — Multiple Return Values
	// ──────────────────────────────────────────────────────────────
	// Foundation of Go's error handling: (value, error).

	fmt.Println("\n--- Multiple Return Values ---")
	quotient, remainder := divide(17, 5)
	fmt.Printf("17 / 5 = %d remainder %d\n", quotient, remainder)

	mn, mx := minMax([]int{3, 1, 4, 1, 5, 9, 2, 6})
	fmt.Printf("min=%d, max=%d\n", mn, mx)

	// ──────────────────────────────────────────────────────────────
	// SECTION 3 — The Error Pattern (value, error)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Error Pattern ---")
	val, err := safeDivide(10, 3)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("10 / 3 = %.4f\n", val)
	}

	_, err = safeDivide(10, 0)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 4 — Named Return Values
	// ──────────────────────────────────────────────────────────────
	// Use sparingly — can reduce clarity in long functions.

	fmt.Println("\n--- Named Returns ---")
	w, h, a := dimensions(10, 5)
	fmt.Printf("width=%d, height=%d, area=%d\n", w, h, a)

	// ============================================================
	// EXAMPLE BLOCK 2 — Variadic & First-Class Functions
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 5 — Variadic Functions (...T)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Variadic Functions ---")
	fmt.Printf("sum() = %d\n", sum())
	fmt.Printf("sum(1,2,3) = %d\n", sum(1, 2, 3))

	numbers := []int{10, 20, 30, 40}
	fmt.Printf("sum(slice...) = %d\n", sum(numbers...))

	fmt.Println(joinWith(", ", "rasgulla", "gulab jamun", "jalebi"))

	// ──────────────────────────────────────────────────────────────
	// SECTION 6 — Functions as Values & Function Types
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Functions as Values ---")
	operation := add
	fmt.Printf("operation(3, 4) = %d\n", operation(3, 4))
	operation = multiply
	fmt.Printf("operation(3, 4) = %d\n", operation(3, 4))

	var op mathFunc = add
	fmt.Printf("mathFunc add: %d\n", op(10, 20))

	// ──────────────────────────────────────────────────────────────
	// SECTION 7 — Higher-Order Functions
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Higher-Order Functions ---")
	fmt.Printf("apply(add, 5, 3) = %d\n", apply(add, 5, 3))

	nums := []int{1, 2, 3, 4, 5}
	doubled := transform(nums, func(n int) int { return n * 2 })
	squared := transform(nums, func(n int) int { return n * n })
	fmt.Printf("Doubled: %v\nSquared: %v\n", doubled, squared)

	// ============================================================
	// EXAMPLE BLOCK 3 — Closures, Defer & Patterns
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 8 — Anonymous Functions & Closures
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Anonymous Functions ---")
	double := func(n int) int { return n * 2 }
	fmt.Printf("double(21) = %d\n", double(21))

	// IIFE
	result2 := func(a, b int) int { return a*a + b*b }(3, 4)
	fmt.Printf("IIFE: 3² + 4² = %d\n", result2)

	fmt.Println("\n--- Closures ---")
	counter := makeCounter()
	fmt.Printf("counter() = %d, %d, %d\n", counter(), counter(), counter())

	// Independent closures
	cA := makeCounter()
	cB := makeCounter()
	fmt.Printf("A=%d, A=%d, B=%d, A=%d\n", cA(), cA(), cB(), cA())

	// ──────────────────────────────────────────────────────────────
	// SECTION 9 — defer Basics
	// ──────────────────────────────────────────────────────────────
	// defer runs cleanup when function returns, LIFO order.
	// Arguments evaluated at defer time, not execution time.

	fmt.Println("\n--- defer Basics ---")
	demoDefer()

	fmt.Println("\n--- defer Argument Evaluation ---")
	demoDeferArgs()

	// ──────────────────────────────────────────────────────────────
	// SECTION 10 — Practical Patterns
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Multiplier Factory ---")
	triple := multiplier(3)
	fmt.Printf("triple(10) = %d\n", triple(10))

	fmt.Println("\n--- Math Pipeline ---")
	value := 16.0
	ops := []struct {
		name string
		fn   func(float64) float64
	}{
		{"sqrt", math.Sqrt},
		{"double", func(x float64) float64 { return x * 2 }},
		{"negate", func(x float64) float64 { return -x }},
	}
	for _, op := range ops {
		value = op.fn(value)
		fmt.Printf("  After %s: %.2f\n", op.name, value)
	}
}

// ============================================================
// Function Declarations
// ============================================================

func greet(name string) {
	fmt.Printf("Hello, %s! Welcome to the Mithai Shop.\n", name)
}

func add(a, b int) int      { return a + b }
func multiply(a, b int) int { return a * b }

func divide(a, b int) (int, int) { return a / b, a % b }

func minMax(nums []int) (int, int) {
	mn, mx := nums[0], nums[0]
	for _, n := range nums[1:] {
		if n < mn {
			mn = n
		}
		if n > mx {
			mx = n
		}
	}
	return mn, mx
}

func safeDivide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, fmt.Errorf("division by zero")
	}
	return a / b, nil
}

func dimensions(w, h int) (width, height, area int) {
	width = w
	height = h
	area = w * h
	return // naked return
}

func sum(nums ...int) int {
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

func joinWith(sep string, items ...string) string {
	return strings.Join(items, sep)
}

type mathFunc func(int, int) int

func apply(fn func(int, int) int, a, b int) int { return fn(a, b) }

func transform(nums []int, fn func(int) int) []int {
	result := make([]int, len(nums))
	for i, n := range nums {
		result[i] = fn(n)
	}
	return result
}

func makeCounter() func() int {
	count := 0
	return func() int {
		count++
		return count
	}
}

func multiplier(factor int) func(int) int {
	return func(n int) int { return n * factor }
}

func demoDefer() {
	defer fmt.Println("  First defer (cleanup)")
	defer fmt.Println("  Second defer")
	defer fmt.Println("  Third defer")
	fmt.Println("  Opening resource")
	fmt.Println("  Working with resource")
}

func demoDeferArgs() {
	x := 10
	defer fmt.Printf("  deferred x = %d (captured at defer time)\n", x)
	x = 20
	fmt.Printf("  x is now: %d\n", x)
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Return types come AFTER parameters: func add(a, b int) int
// 2. Multiple returns enable the (value, error) pattern.
// 3. Named returns enable naked return. Use sparingly.
// 4. Variadic: ...T syntax. Expand slice with slice...
// 5. Functions are first-class: assign, pass, return them.
// 6. Closures capture variables from enclosing scope.
// 7. defer runs cleanup in LIFO order; args evaluated at
//    defer time, not execution time.
// ============================================================
