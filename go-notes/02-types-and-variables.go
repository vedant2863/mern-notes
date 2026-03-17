// ============================================================
//  FILE 2 : Types & Variables
// ============================================================
//  Topic  : Integer types, float32/float64, bool, string, byte,
//           rune, explicit type conversions, custom types, type
//           aliases, overflow behavior, comparison rules
//
//  WHY THIS MATTERS:
//  Go is statically typed with NO implicit conversions. You
//  cannot add an int32 to an int64 without casting. This
//  strictness catches bugs at compile time that other languages
//  only discover at runtime.
// ============================================================

// ============================================================
// STORY: Suresh works at the Reserve Bank's printing press.
// Every denomination has a specific plate — feed a 500-plate
// into a 100-press and the machine refuses. No shortcuts.
// ============================================================

package main

import (
	"fmt"
	"math"
	"strings"
	"unicode/utf8"
	"unsafe"
)

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Numeric Types, Conversions & Overflow
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 1 — Integer Types: Signed
	// ──────────────────────────────────────────────────────────────

	var i8 int8 = 127
	var i64 int64 = 9223372036854775807

	fmt.Println("--- Signed Integer Types ---")
	fmt.Printf("int8:  %d  (size: %d byte,  range: %d to %d)\n",
		i8, unsafe.Sizeof(i8), math.MinInt8, math.MaxInt8)
	fmt.Printf("int64: %d  (size: %d bytes)\n", i64, unsafe.Sizeof(i64))

	var platformInt int = 42
	fmt.Printf("int:   %d  (size: %d bytes on this platform)\n",
		platformInt, unsafe.Sizeof(platformInt))

	// ──────────────────────────────────────────────────────────────
	// SECTION 2 — Integer Types: Unsigned
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Unsigned Integer Types ---")
	var u8 uint8 = 255
	var u64 uint64 = 18446744073709551615

	fmt.Printf("uint8:  %d  (max: %d)\n", u8, math.MaxUint8)
	fmt.Printf("uint64: %d  (size: %d bytes)\n", u64, unsafe.Sizeof(u64))

	// ──────────────────────────────────────────────────────────────
	// SECTION 3 — Float Types
	// ──────────────────────────────────────────────────────────────
	// float64 is default. float32 saves memory but loses precision.

	fmt.Println("\n--- Float Types ---")
	var f32 float32 = 3.14159265358979
	var f64 float64 = 3.14159265358979

	fmt.Printf("float32: %.15f  (precision loss after ~7 digits)\n", f32)
	fmt.Printf("float64: %.15f  (~15 digits precision)\n", f64)

	nan := math.NaN()
	fmt.Printf("NaN == NaN? %v (never equal to anything!)\n", nan == nan)

	// ──────────────────────────────────────────────────────────────
	// SECTION 4 — Type Conversions (Explicit Only!)
	// ──────────────────────────────────────────────────────────────
	// Go has ZERO implicit conversions.

	fmt.Println("\n--- Type Conversions ---")

	var intVal int = 42
	var floatVal float64 = float64(intVal)
	fmt.Printf("int -> float64: %d -> %f\n", intVal, floatVal)

	var pi float64 = 3.99
	fmt.Printf("float64 -> int: %f -> %d (truncates, NOT rounds!)\n", pi, int(pi))

	// Overflow on size conversion
	var big int64 = 1000
	var small int8 = int8(big)
	fmt.Printf("int64 -> int8: %d -> %d (overflow wraps silently!)\n", big, small)

	// ──────────────────────────────────────────────────────────────
	// SECTION 5 — Overflow Behavior
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Overflow Behavior ---")

	var maxU8 uint8 = 255
	maxU8++
	fmt.Printf("uint8 255 + 1 = %d (wraps to 0)\n", maxU8)

	var maxI8 int8 = 127
	maxI8++
	fmt.Printf("int8 127 + 1 = %d (wraps to -128)\n", maxI8)

	// ============================================================
	// EXAMPLE BLOCK 2 — Strings, Bytes, Runes, Custom Types
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 6 — bool
	// ──────────────────────────────────────────────────────────────
	// Strictly true/false. No truthy/falsy like JavaScript.

	fmt.Println("\n--- bool ---")
	var isPressRunning bool = true
	var isInkDry bool // zero value: false
	fmt.Printf("Running: %v, Ink dry: %v\n", isPressRunning, isInkDry)
	// if 1 { }  → COMPILE ERROR: non-bool used as condition

	// ──────────────────────────────────────────────────────────────
	// SECTION 7 — Strings, Bytes, and Runes
	// ──────────────────────────────────────────────────────────────
	// Strings are immutable byte sequences. For Unicode, use runes.

	fmt.Println("\n--- Strings ---")
	first := "Suresh"
	last := "Sharma"
	fmt.Printf("Full name: %s\n", first+" "+last)

	blueprint := `Line 1: ₹10 note plate
Line 2: ₹500 note plate`
	fmt.Println(blueprint)

	// ──────────────────────────────────────────────────────────────
	// SECTION 8 — byte (uint8) vs rune (int32)
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Bytes vs Runes ---")
	emoji := "Go🔥"
	fmt.Printf("%q: len=%d bytes, %d runes\n",
		emoji, len(emoji), utf8.RuneCountInString(emoji))
	// "Go🔥": len=6 bytes, 3 runes — 🔥 is 4 bytes, 1 rune

	fmt.Println("\nRune iteration over 'Go🔥':")
	for i, r := range emoji {
		fmt.Printf("  index=%d, rune=%c (U+%04X)\n", i, r, r)
	}
	// range iterates by rune, not byte

	// Converting between strings, bytes, and runes
	byteSlice := []byte("Hello")
	runeSlice := []rune("Hello🔥")
	fmt.Printf("[]byte: %v → %s\n", byteSlice, string(byteSlice))
	fmt.Printf("[]rune: %v → %s\n", runeSlice, string(runeSlice))

	// ──────────────────────────────────────────────────────────────
	// SECTION 9 — Custom Types and Type Aliases
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Custom Types ---")

	type Celsius float64
	type Fahrenheit float64

	var boiling Celsius = 100.0
	var bodyTemp Fahrenheit = 98.6
	fmt.Printf("Boiling: %.1f°C, Body: %.1f°F\n", boiling, bodyTemp)
	// var mixed = boiling + bodyTemp → COMPILE ERROR: mismatched types

	// Custom type vs type alias
	type MyInt int      // NEW type — cannot mix with int
	type AliasInt = int // SAME as int — fully interchangeable

	var a1 MyInt = 10
	var a2 AliasInt = 20
	fmt.Printf("MyInt: %d (%T), AliasInt: %d (%T)\n", a1, a1, a2, a2)

	// ──────────────────────────────────────────────────────────────
	// SECTION 10 — Comparison Rules
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Comparison Rules ---")

	type Point struct{ X, Y int }
	p1 := Point{1, 2}
	p2 := Point{1, 2}
	fmt.Printf("Point{1,2} == Point{1,2}: %v\n", p1 == p2)

	arr1 := [3]int{1, 2, 3}
	arr2 := [3]int{1, 2, 3}
	fmt.Printf("[1,2,3] == [1,2,3]: %v\n", arr1 == arr2)

	// Slices, maps, functions — NOT comparable with ==
	// []int{1} == []int{1}  → COMPILE ERROR

	fmt.Println("\n--- Bonus: strings package ---")
	fmt.Printf("Contains: %v\n", strings.Contains("currency", "curr"))
	fmt.Printf("ToUpper: %s\n", strings.ToUpper("currency"))
	fmt.Printf("Split: %v\n", strings.Split("a,b,c", ","))
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Specific-width integers (int8–int64, uint8–uint64).
//    `int` is platform-dependent (usually 64-bit).
// 2. float64 (~15 digits) is default. float32 (~7 digits).
// 3. ZERO implicit conversions. Must cast explicitly.
// 4. Integer overflow wraps silently at runtime.
// 5. len() returns bytes, not characters. Use
//    utf8.RuneCountInString() for runes.
// 6. Custom types create type safety; aliases are alternate names.
// 7. Slices/maps/functions cannot be compared with ==.
// ============================================================
