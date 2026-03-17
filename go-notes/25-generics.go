// ============================================================
//  FILE 25: Generics
// ============================================================
//  Topic: type parameters, constraints, any, comparable,
//         custom constraints, type sets, generic functions/types.
//
//  WHY: Before Go 1.18, reusable algorithms meant duplicating
//  code or sacrificing type safety. Generics let you write one
//  function for many types with full compile-time checking.
// ============================================================
//
//  STORY — "Jugaad Universal Machine"
//  Munna bhai builds one machine that adapts to any material.
//  That's generics: one design, many materials, zero surprises.
// ============================================================

package main

import (
	"cmp"
	"fmt"
	"strings"
)

// ============================================================
// SECTION 1 — Basic Generic Functions
// ============================================================

// Min returns the smaller of two ordered values.
func Min[T cmp.Ordered](a, b T) T {
	if a < b {
		return a
	}
	return b
}

// Contains reports whether needle is in haystack.
func Contains[T comparable](haystack []T, needle T) bool {
	for _, v := range haystack {
		if v == needle {
			return true
		}
	}
	return false
}

// Map applies fn to every element.
func Map[T any, U any](s []T, fn func(T) U) []U {
	result := make([]U, len(s))
	for i, v := range s {
		result[i] = fn(v)
	}
	return result
}

// Filter returns elements where predicate is true.
func Filter[T any](s []T, pred func(T) bool) []T {
	var result []T
	for _, v := range s {
		if pred(v) {
			result = append(result, v)
		}
	}
	return result
}

// ============================================================
// SECTION 2 — Custom Constraints & Type Sets
// ============================================================

// Number constrains T to numeric types. ~ means "underlying type".
type Number interface {
	~int | ~int8 | ~int16 | ~int32 | ~int64 | ~float32 | ~float64
}

// Sum adds all numbers in a slice.
func Sum[T Number](nums []T) T {
	var total T
	for _, n := range nums {
		total += n
	}
	return total
}

// Rupees is a named type — works with Number because of ~float64.
type Rupees float64

// Reduce folds a slice into a single value.
func Reduce[T any, U any](s []T, initial U, fn func(U, T) U) U {
	acc := initial
	for _, v := range s {
		acc = fn(acc, v)
	}
	return acc
}

// ============================================================
// SECTION 3 — Generic Types
// ============================================================

// Stack is a LIFO stack for any type T.
type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(v T)        { s.items = append(s.items, v) }
func (s *Stack[T]) Size() int       { return len(s.items) }

func (s *Stack[T]) Pop() (T, bool) {
	if len(s.items) == 0 {
		var zero T
		return zero, false
	}
	top := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return top, true
}

// Pair holds two values of potentially different types.
type Pair[T, U any] struct {
	First  T
	Second U
}

func NewPair[T, U any](first T, second U) Pair[T, U] {
	return Pair[T, U]{First: first, Second: second}
}

// Keys returns all keys from a map.
func Keys[K comparable, V any](m map[K]V) []K {
	keys := make([]K, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func main() {
	fmt.Println("===== FILE 25: Generics =====\n")

	// ── Block 1: Basic Generic Functions ──
	fmt.Println("--- Basic Generic Functions ---")

	fmt.Println("Min(3, 7)      =", Min(3, 7))
	fmt.Println("Min(3.14, 2.71)=", Min(3.14, 2.71))
	fmt.Println("Min(aam, kela) =", Min("aam", "kela"))

	prices := []int{10, 20, 30, 40, 50}
	fmt.Println("Contains(30):", Contains(prices, 30))
	fmt.Println("Contains(99):", Contains(prices, 99))

	doubled := Map(prices, func(n int) int { return n * 2 })
	fmt.Println("Map(*2):", doubled)

	evens := Filter(prices, func(n int) bool { return n%2 == 0 })
	fmt.Println("Filter(even):", evens)

	// ── Block 2: Custom Constraints ──
	fmt.Println("\n--- Custom Constraints ---")

	ints := []int{1, 2, 3, 4, 5}
	fmt.Println("Sum(ints):", Sum(ints))

	bills := []Rupees{499.0, 150.0, 75.50}
	fmt.Printf("Sum(Rupees): Rs %.1f\n", Sum(bills))

	product := Reduce(ints, 1, func(acc, n int) int { return acc * n })
	fmt.Println("Reduce(*1):", product)

	items := []string{"atta", "dal", "chawal"}
	csv := Reduce(items, "", func(acc, s string) string {
		if acc == "" {
			return s
		}
		return acc + "," + s
	})
	fmt.Println("Reduce(join):", csv)

	// ── Block 3: Generic Types ──
	fmt.Println("\n--- Generic Types ---")

	var s Stack[int]
	s.Push(10)
	s.Push(20)
	s.Push(30)
	v, _ := s.Pop()
	fmt.Println("Pop:", v, "Size:", s.Size())

	p := NewPair("aadhaar", 123456789012)
	fmt.Printf("Pair: {%s, %d}\n", p.First, p.Second)

	scores := map[string]int{"Munna": 95, "Raju": 87}
	fmt.Println("Keys count:", len(Keys(scores)))

	// ── Transform pipeline ──
	fmt.Println("\n--- Pipeline ---")
	raw := []string{"  Munna ", "RAJU", " baburao "}
	cleaned := Map(raw, func(s string) string { return strings.TrimSpace(strings.ToLower(s)) })
	short := Filter(cleaned, func(s string) bool { return len(s) <= 5 })
	fmt.Println("Cleaned:", cleaned)
	fmt.Println("Short:", short)

	// ── When NOT to use generics ──
	fmt.Println("\n--- When NOT to use generics ---")
	fmt.Println("1. One concrete type is enough? Skip generics.")
	fmt.Println("2. An interface (io.Reader) already works? Use it.")
	fmt.Println("3. Rule: Write it three times, THEN generalize.")
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Type params in []: func F[T any](x T). Constraint limits ops on T.
// 2. Go infers type args: Min(3, 7) works without Min[int](3, 7).
// 3. cmp.Ordered = supports < > <= >=. comparable = supports == !=.
// 4. Custom constraints: type Number interface { ~int | ~float64 }.
//    ~ means "underlying type" so named types like Rupees also match.
// 5. Generic types (Stack[T], Pair[T,U]) are compile-time type-safe.
// 6. Map, Filter, Reduce: classic generic trio for data pipelines.
// 7. Don't over-generalize. Use generics only when you'd duplicate code.
// ============================================================
