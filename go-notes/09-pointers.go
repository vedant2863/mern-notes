// ============================================================
//  FILE 9 : Pointers
// ============================================================
//  Topic  : Address-of (&), dereference (*), new(), pointer to
//           struct, value vs pointer semantics, nil pointers,
//           no pointer arithmetic, when to use pointers.
//
//  WHY THIS MATTERS:
//  Go is pass-by-value for everything. Pointers let you share
//  data, mutate across function boundaries, and avoid copying
//  large structs. Go prevents C-style pointer arithmetic.
// ============================================================

// ============================================================
// STORY: Postman Lakhan delivers letters using house addresses
// (pointers). Some carry the actual content (value), others
// carry the address of a letterbox (pointer). Knowing when to
// send the chithi vs the address matters.
// ============================================================

package main

import "fmt"

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Basic Pointers, nil, Pointer to Struct
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 1.1 — & (Address-of) and * (Dereference)
	// ────────────────────────────────────────────────────────────

	fmt.Println("--- & and * Basics ---")
	dabba := 42
	ptr := &dabba

	fmt.Println("dabba:", dabba)
	fmt.Println("address:", ptr)
	fmt.Println("dereferenced:", *ptr)

	*ptr = 100
	fmt.Println("After *ptr = 100, dabba:", dabba)

	// ────────────────────────────────────────────────────────────
	// 1.2 — Pointer Types & nil
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Pointer Types ---")
	var intPtr *int // nil by default
	fmt.Println("nil pointer:", intPtr)

	num := 7
	intPtr = &num
	fmt.Printf("Type: %T, Points to: %d\n", intPtr, *intPtr)

	// ────────────────────────────────────────────────────────────
	// 1.3 — new() Function
	// ────────────────────────────────────────────────────────────
	// new(T) allocates zeroed memory, returns *T. Rarely used.

	fmt.Println("\n--- new() ---")
	p := new(int)
	fmt.Println("new(int):", *p)
	*p = 99
	fmt.Println("After *p = 99:", *p)

	// ────────────────────────────────────────────────────────────
	// 1.4 — Nil Pointer Safety
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Nil Safety ---")
	safeDeref := func(p *string) string {
		if p == nil {
			return "(nil)"
		}
		return *p
	}
	fmt.Println("Nil:", safeDeref(nil))
	greeting := "Namaste, Lakhan!"
	fmt.Println("Valid:", safeDeref(&greeting))

	// ────────────────────────────────────────────────────────────
	// 1.5 — Pointer to Struct (Auto-Dereferencing)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Pointer to Struct ---")
	type Chithi struct {
		From, To, Content string
	}
	chithi := &Chithi{From: "Ramesh", To: "Suresh", Content: "Shaadi mein aana"}

	fmt.Println("To (auto-deref):", chithi.To)     // syntactic sugar
	fmt.Println("To (explicit):", (*chithi).To)     // same thing

	chithi.Content = "Shaadi 3 baje hai"
	fmt.Println("Updated:", chithi.Content)

	// ────────────────────────────────────────────────────────────
	// 1.6 — No Pointer Arithmetic
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- No Pointer Arithmetic ---")
	fmt.Println("Go forbids ptr++ or ptr+offset — memory-safe by design")

	// ============================================================
	// EXAMPLE BLOCK 2 — Value vs Pointer Semantics, Patterns
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 2.1 — Value Semantics: Pass by Value
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Value Semantics ---")
	doubleValue := func(n int) { n *= 2 }
	x := 10
	doubleValue(x)
	fmt.Println("After value func, x:", x) // unchanged

	// ────────────────────────────────────────────────────────────
	// 2.2 — Pointer Semantics: Pass by Pointer
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Pointer Semantics ---")
	doublePointer := func(n *int) { *n *= 2 }
	y := 10
	doublePointer(&y)
	fmt.Println("After pointer func, y:", y) // changed

	// ────────────────────────────────────────────────────────────
	// 2.3 — Struct: Value vs Pointer
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Struct Value vs Pointer ---")
	type Parcel struct {
		Recipient string
		Weight    float64
	}

	stampValue := func(pkg Parcel) { pkg.Weight += 0.1 }
	stampPointer := func(pkg *Parcel) { pkg.Weight += 0.1 }

	pkg := Parcel{Recipient: "Lakhan", Weight: 2.0}
	stampValue(pkg)
	fmt.Printf("After value func: %.1f kg\n", pkg.Weight) // 2.0
	stampPointer(&pkg)
	fmt.Printf("After pointer func: %.1f kg\n", pkg.Weight) // 2.1

	// ────────────────────────────────────────────────────────────
	// 2.4 — Returning Pointers (Escape Analysis)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Returning Pointers ---")
	createChithi := func(from, to string) *Chithi {
		return &Chithi{From: from, To: to, Content: "Default"}
	}
	newC := createChithi("Lakhan", "Post Office")
	fmt.Printf("Created: from=%s to=%s\n", newC.From, newC.To)
	// Safe — Go's escape analysis moves to heap

	// ────────────────────────────────────────────────────────────
	// 2.5 — Optional Values with Pointers
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Optional Values ---")
	type Config struct {
		Host    string
		Port    int
		Timeout *int // nil means "use default"
	}
	printConfig := func(c Config) {
		timeout := 30
		if c.Timeout != nil {
			timeout = *c.Timeout
		}
		fmt.Printf("  %s:%d timeout=%ds\n", c.Host, c.Port, timeout)
	}

	custom := 60
	printConfig(Config{Host: "api.gov.in", Port: 443, Timeout: &custom})
	printConfig(Config{Host: "localhost", Port: 8080}) // nil Timeout → default

	// ────────────────────────────────────────────────────────────
	// 2.6 — When to Use Pointers
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- When to Use Pointers ---")
	fmt.Println("POINTERS: mutation, large structs, optional values (nil)")
	fmt.Println("VALUES:   small data, immutability, map keys, concurrency")

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	// 1. & gets address, * dereferences.
	// 2. Go is always pass-by-value; pointers share data.
	// 3. new(T) allocates zeroed memory; &T{} is more idiomatic.
	// 4. Nil dereference = panic. Always check first.
	// 5. Auto-dereference: p.Field == (*p).Field.
	// 6. No pointer arithmetic — memory-safe by design.
	// 7. Returning &localVar is safe (escape analysis).
	// 8. Pointers for mutation/large structs/optionals.
	//    Values for small data/immutability/map keys.
}
