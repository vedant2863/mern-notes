// ============================================================
//  FILE 6 : Maps
// ============================================================
//  Topic  : Map creation (literal, make, nil), comma-ok idiom,
//           delete, iteration (random order), reference semantics,
//           nested maps, counting/grouping, maps package, sets
//
//  WHY THIS MATTERS:
//  Maps are Go's hash table — the go-to for key-value lookups,
//  caching, counting, and grouping. Iteration order is random.
//  Understanding nil maps, comma-ok, and reference semantics
//  prevents the most common map bugs.
// ============================================================

// ============================================================
// STORY: Operator Meena at the UIDAI center maintains the
// Aadhaar register. Each citizen has a unique key and record.
// Handing the register to another operator means they BOTH
// look at the same book — changes by one affect the other.
// ============================================================

package main

import (
	"fmt"
	"maps"
	"slices"
	"sort"
	"strings"
)

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Create, Access, Delete & Iterate
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 1 — Creating Maps
	// ──────────────────────────────────────────────────────────────

	fmt.Println("--- Creating Maps ---")

	// Map literal
	population := map[string]int{
		"Mumbai":    12440000,
		"Delhi":     11030000,
		"Bangalore": 8440000,
	}
	fmt.Printf("Population: %v\n", population)

	// make() with optional capacity hint
	enrollment := make(map[string]string)
	enrollment["1234-5678-9012"] = "Meena Kumari"
	fmt.Printf("Enrollment: %v\n", enrollment)

	// nil map — reads return zero value, writes PANIC
	var nilMap map[string]int
	fmt.Printf("nil map: nil? %v, len=%d\n", nilMap == nil, len(nilMap))

	// ──────────────────────────────────────────────────────────────
	// SECTION 2 — nil Map Gotcha
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- nil Map Gotcha ---")
	var safeRead map[string]int
	fmt.Printf("Read from nil: %d (no panic)\n", safeRead["missing"])
	// safeRead["key"] = 1  → PANIC: assignment to entry in nil map

	safeRead = make(map[string]int)
	safeRead["key"] = 1
	fmt.Printf("After init: %v\n", safeRead)

	// ──────────────────────────────────────────────────────────────
	// SECTION 3 — Comma-Ok Idiom
	// ──────────────────────────────────────────────────────────────
	// Distinguishes "key missing" from "key exists with zero value."

	fmt.Println("\n--- Comma-Ok Idiom ---")
	ages := map[string]int{"Meena": 32, "Gita": 0}

	if age, ok := ages["Gita"]; ok {
		fmt.Printf("Gita exists, age=%d\n", age)
	}
	if _, ok := ages["Unknown"]; !ok {
		fmt.Println("Unknown not found")
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 4 — delete() and len()
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- delete and len ---")
	states := map[string]string{"MH": "Maharashtra", "KA": "Karnataka", "TN": "Tamil Nadu"}
	fmt.Printf("Before: len=%d\n", len(states))
	delete(states, "KA")
	fmt.Printf("After delete: len=%d\n", len(states))
	delete(states, "nonexistent") // no panic — silent no-op

	// ──────────────────────────────────────────────────────────────
	// SECTION 5 — Iteration (Random Order!)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Sorted Iteration ---")
	capitals := map[string]string{
		"India": "New Delhi", "Nepal": "Kathmandu", "Sri Lanka": "Colombo",
	}
	keys := make([]string, 0, len(capitals))
	for k := range capitals {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		fmt.Printf("  %s: %s\n", k, capitals[k])
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 6 — Maps are Reference Types
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Reference Semantics ---")
	original := map[string]int{"a": 1, "b": 2}
	alias := original
	alias["c"] = 3
	fmt.Printf("Original sees 'c': %v\n", original)
	// Both point to the same map

	// ============================================================
	// EXAMPLE BLOCK 2 — Nested Maps, Patterns & maps Package
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 7 — Nested Maps
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Nested Maps ---")
	registry := map[string]map[string]int{
		"North Delhi": {"Meena": 32, "Rajan": 28},
	}
	fmt.Printf("North Delhi/Meena: %d\n", registry["North Delhi"]["Meena"])

	// Inner map must be initialized before writing
	if registry["East Delhi"] == nil {
		registry["East Delhi"] = make(map[string]int)
	}
	registry["East Delhi"]["Priya"] = 22

	// ──────────────────────────────────────────────────────────────
	// SECTION 8 — Counting Pattern
	// ──────────────────────────────────────────────────────────────
	// Zero value of int (0) makes counting trivial.

	fmt.Println("\n--- Counting Pattern ---")
	words := strings.Fields("chai pani chai roti chai pani dal roti")
	wordCount := make(map[string]int)
	for _, word := range words {
		wordCount[word]++
	}
	sortedWords := make([]string, 0, len(wordCount))
	for w := range wordCount {
		sortedWords = append(sortedWords, w)
	}
	sort.Strings(sortedWords)
	for _, w := range sortedWords {
		fmt.Printf("  %q: %d\n", w, wordCount[w])
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 9 — Grouping Pattern
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Grouping Pattern ---")
	type Item struct{ Name, Category string }
	inventory := []Item{
		{"Rasgulla", "Bengali"}, {"Sandesh", "Bengali"},
		{"Jalebi", "North Indian"}, {"Mysore Pak", "South Indian"},
	}
	grouped := make(map[string][]string)
	for _, item := range inventory {
		grouped[item.Category] = append(grouped[item.Category], item.Name)
	}
	for cat, items := range grouped {
		fmt.Printf("  %s: %v\n", cat, items)
	}

	// ──────────────────────────────────────────────────────────────
	// SECTION 10 — maps Package (Go 1.21+)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- maps Package ---")
	scores := map[string]int{"Meena": 95, "Rajan": 88, "Gita": 92}

	scoresCopy := maps.Clone(scores)
	scoresCopy["Meena"] = 100
	fmt.Printf("Original Meena: %d, Copy Meena: %d\n", scores["Meena"], scoresCopy["Meena"])

	m1 := map[string]int{"a": 1, "b": 2}
	m2 := map[string]int{"a": 1, "b": 2}
	fmt.Printf("Equal: %v\n", maps.Equal(m1, m2))

	keySlice := slices.Sorted(maps.Keys(scores))
	fmt.Printf("Sorted keys: %v\n", keySlice)

	// ──────────────────────────────────────────────────────────────
	// SECTION 11 — Set Implementation with map[T]struct{}
	// ──────────────────────────────────────────────────────────────
	// struct{} takes zero bytes — more efficient than map[T]bool.

	fmt.Println("\n--- Set Implementation ---")
	type StringSet map[string]struct{}

	pincodes := StringSet{}
	pincodes["110001"] = struct{}{}
	pincodes["400001"] = struct{}{}
	pincodes["110001"] = struct{}{} // duplicate — no effect
	fmt.Printf("Set size: %d\n", len(pincodes))

	if _, exists := pincodes["400001"]; exists {
		fmt.Println("400001 is in the set")
	}
	delete(pincodes, "400001")

	// Intersection
	setA := StringSet{"110001": {}, "400001": {}, "600001": {}}
	setB := StringSet{"400001": {}, "600001": {}, "500001": {}}
	intersection := StringSet{}
	for k := range setA {
		if _, ok := setB[k]; ok {
			intersection[k] = struct{}{}
		}
	}
	interKeys := make([]string, 0, len(intersection))
	for k := range intersection {
		interKeys = append(interKeys, k)
	}
	sort.Strings(interKeys)
	fmt.Printf("Intersection: %v\n", interKeys)
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. nil map reads return zero value but writes PANIC.
// 2. Comma-ok idiom: val, ok := m[key] — always use it when
//    zero values are valid data.
// 3. Iteration order is intentionally RANDOM. Sort keys first.
// 4. Maps are reference types. Use maps.Clone() for copies.
// 5. Maps are NOT safe for concurrent access — use sync.Mutex.
// 6. Counting: m[key]++ works because zero value is 0.
// 7. Set pattern: map[T]struct{} — zero bytes per value.
// 8. maps package: Clone, Equal, Keys, Values, DeleteFunc.
// ============================================================
