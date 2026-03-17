// ============================================================
//  FILE 5 : Arrays & Slices
// ============================================================
//  Topic  : Arrays (fixed size, value semantics), slices
//           (dynamic, reference semantics), make, append, copy,
//           slice expressions [low:high:max], capacity growth,
//           nil vs empty, multi-dimensional, slices package
//
//  WHY THIS MATTERS:
//  Slices are Go's workhorse. Understanding the backing array
//  model and capacity growth prevents subtle bugs where
//  mutations unexpectedly affect other slices.
// ============================================================

// ============================================================
// STORY: Godown Manager Pandey organizes grain at the FCI
// warehouse. Arrays are fixed shelves bolted to the wall.
// Slices are flexible sacks on wheels — they grow, but share
// the same floor (backing array). Move one and another shifts.
// ============================================================

package main

import (
	"fmt"
	"slices"
)

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Arrays & Slice Fundamentals
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 1 — Arrays: Fixed Size, Value Semantics
	// ──────────────────────────────────────────────────────────────

	fmt.Println("--- Arrays ---")
	var rack [5]int
	fmt.Printf("Empty rack: %v\n", rack)

	grains := [4]string{"wheat", "rice", "bajra", "jowar"}
	fmt.Printf("Grains: %v\n", grains)

	seasons := [...]string{"kharif", "rabi", "zaid"}
	fmt.Printf("Seasons: %v (len=%d)\n", seasons, len(seasons))

	// Arrays are values — assignment copies
	original := [3]int{1, 2, 3}
	copied := original
	copied[0] = 999
	fmt.Printf("Original: %v (unchanged), Copied: %v\n", original, copied)

	// Arrays are comparable
	fmt.Printf("[1,2,3]==[1,2,3]: %v\n", [3]int{1, 2, 3} == [3]int{1, 2, 3})

	// ──────────────────────────────────────────────────────────────
	// SECTION 2 — Slices: Dynamic, Reference Semantics
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Slices ---")
	sacks := []string{"wheat sack", "rice sack", "maize sack"}
	fmt.Printf("Sacks: %v (len=%d, cap=%d)\n", sacks, len(sacks), cap(sacks))

	// make() — create with specified length and capacity
	buffer := make([]int, 3, 10)
	fmt.Printf("Buffer: %v (len=%d, cap=%d)\n", buffer, len(buffer), cap(buffer))

	// ──────────────────────────────────────────────────────────────
	// SECTION 3 — nil vs Empty Slice
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- nil vs Empty Slice ---")
	var nilSlice []int
	emptySlice := []int{}
	fmt.Printf("nil:   len=%d, nil? %v\n", len(nilSlice), nilSlice == nil)
	fmt.Printf("empty: len=%d, nil? %v\n", len(emptySlice), emptySlice == nil)

	// Both work with append
	nilSlice = append(nilSlice, 1, 2, 3)
	fmt.Printf("After append to nil: %v\n", nilSlice)

	// ============================================================
	// EXAMPLE BLOCK 2 — Append, Copy, Slice Expressions & Growth
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 4 — append()
	// ──────────────────────────────────────────────────────────────
	// ALWAYS reassign: s = append(s, elem)

	fmt.Println("\n--- append ---")
	items := []string{"wheat"}
	items = append(items, "rice")
	items = append(items, "bajra", "jowar", "maize")
	fmt.Printf("Items: %v (len=%d)\n", items, len(items))

	extras := []string{"ragi", "barley"}
	items = append(items, extras...)
	fmt.Printf("With extras: %v\n", items)

	// ──────────────────────────────────────────────────────────────
	// SECTION 5 — copy()
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- copy ---")
	src := []int{10, 20, 30, 40, 50}
	dst := make([]int, 3)
	n := copy(dst, src)
	fmt.Printf("Copied %d elements: %v\n", n, dst)

	dst[0] = 999
	fmt.Printf("src unchanged: %v, dst modified: %v\n", src, dst)

	// ──────────────────────────────────────────────────────────────
	// SECTION 6 — Slice Expressions [low:high:max]
	// ──────────────────────────────────────────────────────────────
	// Three-index slice controls capacity, preventing accidental
	// access beyond intended range.

	fmt.Println("\n--- Slice Expressions ---")
	data := []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9}

	s1 := data[2:5]
	fmt.Printf("data[2:5]:   %v (len=%d, cap=%d)\n", s1, len(s1), cap(s1))

	s2 := data[2:5:6]
	fmt.Printf("data[2:5:6]: %v (len=%d, cap=%d)\n", s2, len(s2), cap(s2))

	// ──────────────────────────────────────────────────────────────
	// SECTION 7 — Capacity Growth
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Capacity Growth ---")
	var growing []int
	prevCap := 0
	for i := 0; i < 20; i++ {
		growing = append(growing, i)
		if cap(growing) != prevCap {
			fmt.Printf("  len=%2d, cap=%2d\n", len(growing), cap(growing))
			prevCap = cap(growing)
		}
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 8 — Gotcha: Shared Backing Array
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Shared Backing Array ---")
	orig := []int{1, 2, 3, 4, 5}
	sub := orig[1:3]
	sub[0] = 999
	fmt.Printf("orig: %v, sub: %v (shared memory!)\n", orig, sub)

	// Fix: use copy to decouple
	safe := make([]int, 2)
	copy(safe, orig[1:3])
	safe[0] = 888
	fmt.Printf("orig: %v, safe: %v (independent)\n", orig, safe)

	// ============================================================
	// EXAMPLE BLOCK 3 — Multi-Dimensional, slices Package, Patterns
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 9 — Multi-Dimensional Slices
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Multi-Dimensional ---")
	rows, cols := 3, 4
	matrix := make([][]int, rows)
	for i := range matrix {
		matrix[i] = make([]int, cols)
		for j := range matrix[i] {
			matrix[i][j] = i*cols + j
		}
	}
	fmt.Printf("Matrix: %v\n", matrix)

	// ──────────────────────────────────────────────────────────────
	// SECTION 10 — slices Package (Go 1.21+)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- slices Package ---")
	nums := []int{5, 3, 8, 1, 9, 2, 7}

	fmt.Printf("Contains 8? %v\n", slices.Contains(nums, 8))
	fmt.Printf("Index of 9: %d\n", slices.Index(nums, 9))
	fmt.Printf("Min: %d, Max: %d\n", slices.Min(nums), slices.Max(nums))

	sorted := slices.Clone(nums)
	slices.Sort(sorted)
	fmt.Printf("Sorted: %v\n", sorted)

	fmt.Printf("Equal: %v\n", slices.Equal([]int{1, 2}, []int{1, 2}))

	// ──────────────────────────────────────────────────────────────
	// SECTION 11 — Common Patterns
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Common Patterns ---")

	// Filter
	allNums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	evens := filter(allNums, func(n int) bool { return n%2 == 0 })
	fmt.Printf("Evens: %v\n", evens)

	// Stack (LIFO)
	var stack []string
	stack = append(stack, "wheat", "rice", "bajra")
	top := stack[len(stack)-1]
	stack = stack[:len(stack)-1]
	fmt.Printf("Popped: %s, Stack: %v\n", top, stack)

	// Remove at index (order-preserving)
	grainList := []string{"wheat", "rice", "bajra", "jowar", "maize"}
	idx := 2
	grainList = append(grainList[:idx], grainList[idx+1:]...)
	fmt.Printf("After removing index 2: %v\n", grainList)
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

func filter(nums []int, predicate func(int) bool) []int {
	var result []int
	for _, n := range nums {
		if predicate(n) {
			result = append(result, n)
		}
	}
	return result
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Arrays are fixed-size VALUE types. [3]int != [4]int.
// 2. Slices are dynamic REFERENCE types backed by an array.
// 3. Always reassign append: s = append(s, elem).
// 4. Slicing does NOT copy — shared backing array. Use copy().
// 5. nil and empty slices both have len=0; both work with append.
// 6. Three-index slice [low:high:max] limits capacity.
// 7. slices package: Sort, Contains, Index, Min, Max, Equal.
// 8. Common patterns: filter, stack, queue, remove at index.
// ============================================================
