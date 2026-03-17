// ============================================================
//  FILE 8 : Structs
// ============================================================
//  Topic  : Struct declaration, initialization, field access,
//           zero values, methods (value vs pointer receiver),
//           constructor pattern, anonymous structs, embedding,
//           struct as map key, tags preview.
//
//  WHY THIS MATTERS:
//  Structs replace classes from OOP. Combined with methods,
//  they give encapsulation and behavior without inheritance.
//  Value vs pointer receivers is essential for correct Go code.
// ============================================================

// ============================================================
// STORY: Architect Iyer draws Vastu-compliant house plans.
// Each plan is a struct, filled with specifics, and modified
// through approved procedures (methods). Some changes need the
// original (pointer receiver); others work on a photocopy.
// ============================================================

package main

import (
	"fmt"
	"math"
)

// ────────────────────────────────────────────────────────────
// Package-level types (needed for method declarations)
// ────────────────────────────────────────────────────────────

type Circle struct{ Radius float64 }

func (c Circle) Area() float64         { return math.Pi * c.Radius * c.Radius }
func (c Circle) Circumference() float64 { return 2 * math.Pi * c.Radius }

type Room struct{ Width, Height float64 }

func (r Room) Area() float64 { return r.Width * r.Height }
func (r *Room) Scale(factor float64) {
	r.Width *= factor
	r.Height *= factor
}

type Counter struct{ count int }

func (c Counter) GetCount() int { return c.count }
func (c *Counter) Increment()   { c.count++ }

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Declaration, Init, Zero Values, Comparison
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 1.1 — Struct Declaration & Initialization
	// ────────────────────────────────────────────────────────────

	type House struct {
		Name     string
		Floors   int
		Height   float64
		HasPooja bool
	}

	fmt.Println("--- Initialization Patterns ---")
	bungalow := House{
		Name: "Shanti Nivas", Floors: 2, Height: 7.5, HasPooja: true,
	}
	fmt.Println("Named init:", bungalow)

	// Partial initialization — unset fields get zero values
	storeroom := House{Name: "Store Room", Floors: 1}
	fmt.Println("Partial:", storeroom)

	// ────────────────────────────────────────────────────────────
	// 1.2 — Zero-Value Struct & Field Access
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Zero Value & Field Access ---")
	var empty House
	fmt.Printf("Zero: Name=%q Floors=%d HasPooja=%t\n",
		empty.Name, empty.Floors, empty.HasPooja)

	bungalow.Floors = 3
	fmt.Println("Updated floors:", bungalow.Floors)

	// ────────────────────────────────────────────────────────────
	// 1.3 — Value Semantics & Comparison
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Value Semantics ---")
	orig := House{Name: "Original", Floors: 10}
	cp := orig
	cp.Name = "Copy"
	fmt.Printf("Original: %s, Copy: %s (independent)\n", orig.Name, cp.Name)

	fmt.Println("\n--- Comparison ---")
	a := House{Name: "Kutir", Floors: 10}
	b := House{Name: "Kutir", Floors: 10}
	fmt.Println("a == b:", a == b)

	// ============================================================
	// EXAMPLE BLOCK 2 — Methods, Constructor, Method Sets
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 2.1 — Value Receiver
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Value Receiver ---")
	c := Circle{Radius: 5.0}
	fmt.Printf("Circle r=%.1f area=%.2f circumference=%.2f\n",
		c.Radius, c.Area(), c.Circumference())

	// ────────────────────────────────────────────────────────────
	// 2.2 — Pointer Receiver
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Pointer Receiver ---")
	poojaRoom := Room{Width: 10, Height: 5}
	fmt.Println("Before:", poojaRoom)
	poojaRoom.Scale(2.0)
	fmt.Printf("After Scale(2): %v, Area: %.0f\n", poojaRoom, poojaRoom.Area())

	// ────────────────────────────────────────────────────────────
	// 2.3 — Constructor Pattern (NewXxx)
	// ────────────────────────────────────────────────────────────

	type Server struct {
		Host string
		Port int
	}
	newServer := func(host string, port int) *Server {
		if host == "" {
			host = "localhost"
		}
		if port <= 0 || port > 65535 {
			port = 8080
		}
		return &Server{Host: host, Port: port}
	}

	fmt.Println("\n--- Constructor Pattern ---")
	fmt.Printf("Server 1: %s:%d\n", newServer("api.gov.in", 443).Host, 443)
	s2 := newServer("", -1)
	fmt.Printf("Server 2: %s:%d (defaults applied)\n", s2.Host, s2.Port)

	// ────────────────────────────────────────────────────────────
	// 2.4 — Method Set Rules
	// ────────────────────────────────────────────────────────────
	// Value receiver → callable on value AND pointer
	// Pointer receiver → callable ONLY on pointer (or addressable value)

	fmt.Println("\n--- Method Set Rules ---")
	ctr := Counter{}
	ctr.Increment()
	ctr.Increment()
	ctr.Increment()
	fmt.Println("Count:", ctr.GetCount())

	// ============================================================
	// EXAMPLE BLOCK 3 — Anonymous Structs, Embedding, Map Keys, Tags
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 3.1 — Anonymous Structs
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Anonymous Structs ---")
	point := struct{ X, Y int }{10, 20}
	fmt.Printf("Point: (%d, %d)\n", point.X, point.Y)

	// Great for test cases
	tests := []struct {
		input    string
		expected int
	}{
		{"hello", 5}, {"Go", 2}, {"", 0},
	}
	for _, tc := range tests {
		fmt.Printf("  len(%q)=%d pass=%t\n",
			tc.input, len(tc.input), len(tc.input) == tc.expected)
	}

	// ────────────────────────────────────────────────────────────
	// 3.2 — Struct Embedding (Composition)
	// ────────────────────────────────────────────────────────────

	type Address struct {
		Street, City string
	}
	type Office struct {
		Address
		Company string
	}

	fmt.Println("\n--- Embedding ---")
	office := Office{
		Address: Address{Street: "14 Vastu Marg", City: "Chennai"},
		Company: "Iyer & Associates",
	}
	fmt.Println("Street:", office.Street) // promoted field
	fmt.Println("City:", office.City)

	// ────────────────────────────────────────────────────────────
	// 3.3 — Struct as Map Key
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Struct as Map Key ---")
	type Coord struct{ X, Y int }
	grid := map[Coord]string{
		{0, 0}: "pooja room", {1, 0}: "kitchen",
	}
	fmt.Println("Grid[0,0]:", grid[Coord{0, 0}])

	// ────────────────────────────────────────────────────────────
	// 3.4 — Struct Tags (Preview — full coverage in file 22)
	// ────────────────────────────────────────────────────────────

	type Resident struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Age   int    `json:"age,omitempty"`
	}
	fmt.Println("\n--- Struct Tags ---")
	u := Resident{Name: "Iyer", Email: "iyer@vastu.in", Age: 55}
	fmt.Printf("%+v\n", u) // %+v prints field names

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	// 1. Structs are value types — assignment copies all fields.
	// 2. Use named field initialization; avoid positional.
	// 3. Value receiver = copy, cannot mutate.
	//    Pointer receiver = original, can mutate.
	// 4. NewXxx constructor functions for validation/defaults.
	// 5. Anonymous structs for one-off groupings and tests.
	// 6. Embedding promotes inner fields/methods (composition).
	// 7. Comparable structs can be map keys.
	// 8. Struct tags attach metadata for serialization.
}
