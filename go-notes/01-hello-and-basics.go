// ============================================================
//  FILE 1 : Hello World & Basics
// ============================================================
//  Topic  : package main, import, func main, fmt output,
//           variables, short declarations, constants, iota,
//           zero values, type inference
//
//  WHY THIS MATTERS:
//  Every Go program begins with these building blocks. Go
//  requires a main package and a main function, enforcing
//  structure from day one. Understanding declarations,
//  constants, and zero values prevents "undefined" bugs.
// ============================================================

// ============================================================
// STORY: Ramesh bhaiya labels vessels, sets out kettles, and
// carves prices in stone each morning at his chai tapri. Every
// variable is a vessel; every constant, a price in stone.
// ============================================================

package main

import "fmt"

// ============================================================
// EXAMPLE BLOCK 1 — Hello World, Variables & Declarations
// ============================================================

// ──────────────────────────────────────────────────────────────
// SECTION 1 — Hello, World!
// ──────────────────────────────────────────────────────────────

func main() {
	fmt.Println("Hello, World!")
	fmt.Println("Ramesh bhaiya opens the chai tapri doors.")

	// ──────────────────────────────────────────────────────────────
	// SECTION 2 — fmt.Println, fmt.Printf, fmt.Sprintf
	// ──────────────────────────────────────────────────────────────
	// Println adds a newline, Printf uses format verbs,
	// Sprintf returns a formatted string without printing.

	name := "Ramesh"
	age := 45

	fmt.Println("Chaiwala:", name, "| Age:", age)
	// Output: Chaiwala: Ramesh | Age: 45

	fmt.Printf("Name: %s, Age: %d, Type: %T\n", name, age, name)
	// Output: Name: Ramesh, Age: 45, Type: string

	greeting := fmt.Sprintf("Welcome to the chai tapri, %s!", name)
	fmt.Println(greeting)

	// ──────────────────────────────────────────────────────────────
	// SECTION 3 — Variables: var keyword
	// ──────────────────────────────────────────────────────────────
	// var declarations are explicit about type and always initialize
	// to the zero value if no value is given.

	var glassCount int   // zero value: 0
	var tapriName string // zero value: ""
	var isOpen bool      // zero value: false

	fmt.Printf("glassCount: %d, tapriName: %q, isOpen: %v\n",
		glassCount, tapriName, isOpen)

	// var with initialization and type inference
	var kettleCount int = 15
	var temperature = 22.5 // inferred as float64
	fmt.Printf("Kettles: %d, Temp: %.1f (%T)\n", kettleCount, temperature, temperature)

	// ──────────────────────────────────────────────────────────────
	// SECTION 4 — Short Declaration :=
	// ──────────────────────────────────────────────────────────────
	// := infers the type. ONLY usable inside functions.

	orderName := "Festival Order"
	cups := 12
	pricePerCup := 10.50

	fmt.Printf("Order: %s, Cups: %d, Price: ₹%.2f\n",
		orderName, cups, pricePerCup)

	// ──────────────────────────────────────────────────────────────
	// SECTION 5 — Multiple Assignment & Swapping
	// ──────────────────────────────────────────────────────────────

	x, y, label := 10, 20, "origin"
	fmt.Printf("x=%d, y=%d, label=%s\n", x, y, label)

	// Swapping — no temp variable needed
	a, b := "left", "right"
	a, b = b, a
	fmt.Printf("After swap: a=%s, b=%s\n", a, b)

	// Grouped var block
	var (
		tapriFloor  = "cement"
		tapriArea   = 200
		tapriRating = 4.8
	)
	fmt.Printf("Floor: %s, Area: %d sqft, Rating: %.1f\n",
		tapriFloor, tapriArea, tapriRating)

	// ============================================================
	// EXAMPLE BLOCK 2 — Constants, Iota & Zero Values
	// ============================================================

	// ──────────────────────────────────────────────────────────────
	// SECTION 6 — Constants
	// ──────────────────────────────────────────────────────────────
	// Immutable values fixed at compile time.

	const tapriMotto = "Pehle chai, phir kaam"
	const maxCapacity = 50

	fmt.Println("Motto:", tapriMotto)
	fmt.Printf("Max capacity: %d\n", maxCapacity)

	const (
		appName    = "Tapri Manager"
		appVersion = "1.0.0"
		maxRetries = 3
	)
	fmt.Printf("%s v%s (max retries: %d)\n", appName, appVersion, maxRetries)

	// ──────────────────────────────────────────────────────────────
	// SECTION 7 — iota for Enumerations
	// ──────────────────────────────────────────────────────────────
	// iota auto-increments within a const block, starting at 0.

	fmt.Println("\n--- Days of the Week (iota) ---")
	fmt.Printf("Sunday=%d, Monday=%d, Saturday=%d\n",
		Sunday, Monday, Saturday)

	// File permissions using iota with bit shifting
	fmt.Println("\n--- File Permissions (iota + bit shift) ---")
	fmt.Printf("Read: %03b (%d), Write: %03b (%d), Execute: %03b (%d)\n",
		Read, Read, Write, Write, Execute, Execute)

	readWrite := Read | Write
	fmt.Printf("Read+Write: %03b (%d)\n", readWrite, readWrite)

	// ──────────────────────────────────────────────────────────────
	// SECTION 8 — Zero Values Demo
	// ──────────────────────────────────────────────────────────────
	// Every variable has a zero value. No "undefined" in Go.

	fmt.Println("\n--- Zero Values ---")
	var zeroInt int
	var zeroBool bool
	var zeroString string

	fmt.Printf("int: %d, bool: %v, string: %q\n", zeroInt, zeroBool, zeroString)

	// Reference types are nil
	var zeroSlice []int
	var zeroMap map[string]int
	var zeroPtr *int
	fmt.Printf("slice nil? %v, map nil? %v, pointer nil? %v\n",
		zeroSlice == nil, zeroMap == nil, zeroPtr == nil)

	// ──────────────────────────────────────────────────────────────
	// SECTION 9 — Printf Formatting Cheat Sheet
	// ──────────────────────────────────────────────────────────────

	fmt.Println("\n--- Printf Formatting ---")
	val := 42
	fmt.Printf("%%v=%v  %%d=%d  %%b=%b  %%x=%x  %%T=%T\n", val, val, val, val, val)
	fmt.Printf("%%f=%.2f  %%e=%e\n", 3.14, 3.14)
	fmt.Printf("%%s=%s  %%q=%q  %%p=%p\n", "Ramesh", "Ramesh", &val)
	fmt.Printf("[%10d] [%-10d] [%010d]\n", val, val, val)
}

// ──────────────────────────────────────────────────────────────
// Package-level constants (must be outside func main)
// ──────────────────────────────────────────────────────────────

const (
	Sunday    = iota // 0
	Monday           // 1
	Tuesday          // 2
	Wednesday        // 3
	Thursday         // 4
	Friday           // 5
	Saturday         // 6
)

const (
	Execute = 1 << iota // 001
	Write               // 010
	Read                // 100
)

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Every Go program needs `package main` and `func main()`.
// 2. fmt.Println (newline), fmt.Printf (format verbs),
//    fmt.Sprintf (returns string).
// 3. `var` declares with explicit type; `:=` infers type
//    (functions only).
// 4. Multiple assignment and swap: a, b = b, a.
// 5. Constants are compile-time; `iota` auto-increments in
//    const blocks — Go's enum pattern.
// 6. Every type has a zero value: 0, false, "", nil.
//    No "undefined" in Go.
// ============================================================
