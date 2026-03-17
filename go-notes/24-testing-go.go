// ============================================================
//  FILE 24: Testing in Go
// ============================================================
//  Topic: testing patterns, table-driven tests, sub-tests,
//         benchmarks, fixtures, testing.T methods.
//
//  WHY: Go has testing built into its toolchain. Table-driven
//  tests are the idiomatic pattern — adding a new case is a
//  one-line change. No third-party framework needed.
//
//  NOTE: This file demonstrates patterns inside main(). In a
//  real project, use *_test.go files and `go test`.
// ============================================================
//
//  STORY — "The ISI Quality Lab"
//  Inspector Deshmukh runs every product through quality checks
//  before the ISI mark. Tables of expected results, grouped
//  checks, stress tests, and organized fixtures.
// ============================================================

package main

import (
	"fmt"
	"strings"
	"time"
)

func main() {
	// ============================================================
	// BLOCK 1 — Unit Tests, Table-Driven, Sub-Tests
	// ============================================================

	fmt.Println("--- BLOCK 1: Unit Tests, Table-Driven, Sub-Tests ---")

	// SECTION: Simple assertion helpers
	passed, failed := 0, 0

	assertEqual := func(name string, got, want any) {
		if fmt.Sprintf("%v", got) == fmt.Sprintf("%v", want) {
			passed++
			fmt.Printf("  PASS: %s\n", name)
		} else {
			failed++
			fmt.Printf("  FAIL: %s — got %v, want %v\n", name, got, want)
		}
	}

	assertTrue := func(name string, cond bool) {
		if cond {
			passed++
		} else {
			failed++
			fmt.Printf("  FAIL: %s\n", name)
		}
	}

	// SECTION: Basic function tests
	assertEqual("Add(2,3)", Add(2, 3), 5)
	assertEqual("Add(-1,1)", Add(-1, 1), 0)
	assertEqual("Greet(Deshmukh)", Greet("Deshmukh"), "Hello, Deshmukh!")

	// SECTION: Table-driven tests
	fmt.Println("\n--- Table-driven tests ---")

	palindromeTests := []struct {
		name  string
		input string
		want  bool
	}{
		{"simple", "racecar", true},
		{"single", "a", true},
		{"empty", "", true},
		{"not palindrome", "hello", false},
		{"even length", "abba", true},
		{"case sensitive", "Racecar", false},
	}

	for _, tc := range palindromeTests {
		assertEqual(fmt.Sprintf("IsPalindrome(%q)", tc.input), IsPalindrome(tc.input), tc.want)
	}

	// SECTION: Sub-tests (simulating t.Run)
	fmt.Println("\n--- Sub-tests ---")

	run := func(group, name string, fn func()) {
		fmt.Printf("  [%s/%s] ", group, name)
		fn()
	}

	run("StringUtils", "Reverse", func() {
		assertEqual("Reverse(hello)", Reverse("hello"), "olleh")
	})
	run("StringUtils", "CountVowels", func() {
		assertEqual("CountVowels(hello)", CountVowels("hello"), 2)
	})

	// SECTION: Testing errors
	fmt.Println("\n--- Error tests ---")

	result, err := Divide(10, 3)
	assertTrue("Divide(10,3) no error", err == nil)
	assertEqual("Divide(10,3)", fmt.Sprintf("%.4f", result), "3.3333")

	_, err = Divide(10, 0)
	assertTrue("Divide(10,0) returns error", err != nil)
	assertEqual("Divide error msg", err.Error(), "division by zero")

	// ============================================================
	// BLOCK 2 — Benchmarks, Fixtures, Best Practices
	// ============================================================

	fmt.Println("\n--- BLOCK 2: Benchmarks, Fixtures, Practices ---")

	// SECTION: Benchmark simulation
	fmt.Println("\n--- Benchmark ---")

	benchmark := func(name string, n int, fn func()) {
		start := time.Now()
		for i := 0; i < n; i++ {
			fn()
		}
		nsPerOp := float64(time.Since(start).Nanoseconds()) / float64(n)
		fmt.Printf("  %-30s %d ops\t%.0f ns/op\n", name, n, nsPerOp)
	}

	benchmark("Reverse(short)", 100_000, func() { Reverse("hello") })
	benchmark("IsPalindrome(short)", 100_000, func() { IsPalindrome("racecar") })

	// SECTION: Fixtures
	fmt.Println("\n--- Fixtures ---")

	type Product struct {
		Name, Category string
		Grade          int
	}

	newFixture := func() Product {
		return Product{"Portland Cement Grade 53", "cement", 53}
	}

	p := newFixture()
	assertEqual("Fixture name", p.Name, "Portland Cement Grade 53")

	// SECTION: testing.T methods reference
	fmt.Println("\n--- testing.T Reference ---")
	fmt.Println("  t.Error/Fatal — log + mark fail (Fatal stops test)")
	fmt.Println("  t.Run(name, fn) — sub-test")
	fmt.Println("  t.Parallel() — parallel execution")
	fmt.Println("  t.Helper() — mark as helper for better line numbers")
	fmt.Println("  t.Cleanup(fn) — teardown after test")
	fmt.Println("  t.TempDir() — auto-cleaned temp directory")

	// SECTION: Best practices
	fmt.Println("\n--- Best Practices ---")
	fmt.Println("  1. Table-driven tests for multiple inputs")
	fmt.Println("  2. Test BOTH happy path and error cases")
	fmt.Println("  3. Use t.Helper() in assertion helpers")
	fmt.Println("  4. Files: foo.go -> foo_test.go (same package)")
	fmt.Println("  5. Run: go test ./... -v -race -count=1")
	fmt.Println("  6. Coverage: go test -cover")

	// Final tally
	fmt.Printf("\n=====================================\n")
	fmt.Printf("  PASSED: %d  FAILED: %d  TOTAL: %d\n", passed, failed, passed+failed)
	if failed == 0 {
		fmt.Println("  ISI MARK APPROVED")
	}
}

// ── Functions under test ──

func Add(a, b int) int { return a + b }

func Greet(name string) string { return fmt.Sprintf("Hello, %s!", name) }

func IsPalindrome(s string) bool {
	for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
		if s[i] != s[j] {
			return false
		}
	}
	return true
}

func Reverse(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

func CountVowels(s string) int {
	count := 0
	for _, r := range strings.ToLower(s) {
		if r == 'a' || r == 'e' || r == 'i' || r == 'o' || r == 'u' {
			count++
		}
	}
	return count
}

func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, fmt.Errorf("division by zero")
	}
	return a / b, nil
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Tests live in *_test.go. Functions start with Test, take *testing.T.
// 2. Table-driven: slice of structs with name, input, expected. One loop.
// 3. t.Run("name", fn) for sub-tests. Run with -run TestFoo/subname.
// 4. t.Error (continues) vs t.Fatal (stops). t.Helper() for helpers.
// 5. Benchmarks: testing.B, b.N. Run with `go test -bench=.`
// 6. Example functions (ExampleFoo) = docs + verified tests.
// 7. t.Cleanup for teardown, t.TempDir for temp files.
// 8. go test ./... -v -race -count=1 for full test run.
// ============================================================
