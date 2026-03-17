// ============================================================
//  FILE 10 : Interfaces
// ============================================================
//  Topic  : Implicit implementation, interface declaration,
//           method sets, empty interface (any), type assertions,
//           type switches, common stdlib interfaces, composition,
//           nil interface trap.
//
//  WHY THIS MATTERS:
//  Interfaces are Go's core abstraction. They are satisfied
//  IMPLICITLY — no "implements" keyword. This enables powerful
//  decoupling and polymorphism while keeping code simple.
// ============================================================

// ============================================================
// STORY: Electrician Pappu builds jugaad universal chargers.
// Every appliance has different plugs, but his connectors work
// with ANY appliance that has the right shape — no registration
// required. If it fits, it works.
// ============================================================

package main

import (
	"fmt"
	"io"
	"math"
	"strings"
)

// ────────────────────────────────────────────────────────────
// Types (must be at package level for methods)
// ────────────────────────────────────────────────────────────

type Shape interface {
	Area() float64
	Perimeter() float64
}

type Rect struct{ Width, Height float64 }

func (r Rect) Area() float64      { return r.Width * r.Height }
func (r Rect) Perimeter() float64 { return 2 * (r.Width + r.Height) }

type Circle struct{ Radius float64 }

func (c Circle) Area() float64      { return math.Pi * c.Radius * c.Radius }
func (c Circle) Perimeter() float64 { return 2 * math.Pi * c.Radius }

type Appliance struct {
	Name  string
	Watts int
}

func (a Appliance) String() string {
	return fmt.Sprintf("%s (%dW)", a.Name, a.Watts)
}

type AppError struct {
	Code    int
	Message string
}

func (e *AppError) Error() string {
	return fmt.Sprintf("error %d: %s", e.Code, e.Message)
}

type Reader interface{ Read() string }
type Writer interface{ Write(data string) }
type ReadWriter interface {
	Reader
	Writer
}

type FileDevice struct {
	name, content string
}

func (f *FileDevice) Read() string      { return f.content }
func (f *FileDevice) Write(data string) { f.content += data }

type Animal interface{ Speak() string }
type Dog struct{ Name string }

func (d *Dog) Speak() string { return d.Name + " says: Woof!" }

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Implicit Implementation & Polymorphism
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 1.1 — Implicit Implementation
	// ────────────────────────────────────────────────────────────
	// Rect and Circle implement Shape without declaring it.

	fmt.Println("--- Implicit Implementation ---")
	var s Shape

	s = Rect{Width: 10, Height: 5}
	fmt.Printf("Rect:   area=%.2f perimeter=%.2f\n", s.Area(), s.Perimeter())

	s = Circle{Radius: 7}
	fmt.Printf("Circle: area=%.2f perimeter=%.2f\n", s.Area(), s.Perimeter())

	// ────────────────────────────────────────────────────────────
	// 1.2 — Polymorphism
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Polymorphism ---")
	shapes := []Shape{
		Rect{Width: 3, Height: 4},
		Circle{Radius: 5},
	}

	totalArea := 0.0
	for _, sh := range shapes {
		fmt.Printf("  area=%.2f perimeter=%.2f\n", sh.Area(), sh.Perimeter())
		totalArea += sh.Area()
	}
	fmt.Printf("  Total area: %.2f\n", totalArea)

	// ============================================================
	// EXAMPLE BLOCK 2 — Type Assertions, Type Switches, any
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 2.1 — Empty Interface: any
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- any (empty interface) ---")
	var box any
	box = 42
	fmt.Printf("int: %v (%T)\n", box, box)
	box = "hello"
	fmt.Printf("string: %v (%T)\n", box, box)

	mixed := []any{42, "Go", true, 3.14, nil}
	fmt.Println("Mixed:", mixed)

	// ────────────────────────────────────────────────────────────
	// 2.2 — Type Assertions (comma-ok pattern)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Type Assertions ---")
	var item any = "Pappu's charger"
	strVal, ok := item.(string)
	fmt.Printf("String? ok=%t val=%q\n", ok, strVal)

	intVal, ok := item.(int)
	fmt.Printf("Int? ok=%t val=%d\n", ok, intVal)

	// ────────────────────────────────────────────────────────────
	// 2.3 — Type Switches
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Type Switches ---")
	describeType := func(val any) string {
		switch v := val.(type) {
		case int:
			return fmt.Sprintf("integer: %d", v)
		case string:
			return fmt.Sprintf("string: %q", v)
		case bool:
			return fmt.Sprintf("bool: %t", v)
		default:
			return fmt.Sprintf("unknown: %T", v)
		}
	}
	for _, v := range []any{42, "Go", true, 3.14} {
		fmt.Printf("  %v → %s\n", v, describeType(v))
	}

	// ────────────────────────────────────────────────────────────
	// 2.4 — fmt.Stringer & error
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- fmt.Stringer ---")
	a := Appliance{Name: "Desert Cooler", Watts: 150}
	fmt.Println("Appliance:", a) // calls String() automatically

	fmt.Println("\n--- error Interface ---")
	var err error = &AppError{Code: 404, Message: "not found"}
	fmt.Println("Error:", err)

	// ============================================================
	// EXAMPLE BLOCK 3 — Composition, Nil Trap, io.Reader/Writer
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 3.1 — Interface Composition
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Interface Composition ---")
	file := &FileDevice{name: "config.txt"}
	file.Write("host=localhost\n")
	file.Write("port=8080\n")

	var rw ReadWriter = file
	fmt.Println("ReadWriter:", rw.Read())

	// ────────────────────────────────────────────────────────────
	// 3.2 — The Nil Interface Trap
	// ────────────────────────────────────────────────────────────
	// Interface = (type, value). Nil interface != interface with nil value.

	fmt.Println("\n--- Nil Interface Trap ---")
	var a1 Animal // truly nil — both type and value nil
	fmt.Println("Nil interface == nil?", a1 == nil) // true

	var dogPtr *Dog
	var a2 Animal = dogPtr // has type *Dog but value nil
	fmt.Println("Interface with nil value == nil?", a2 == nil) // false!

	fmt.Println("  a1 = (nil, nil) → nil")
	fmt.Println("  a2 = (*Dog, nil) → NOT nil! Has type info")

	// ────────────────────────────────────────────────────────────
	// 3.3 — io.Reader / io.Writer Demo
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- io.Reader / io.Writer ---")
	sr := strings.NewReader("Namaste from Pappu!")
	buf := make([]byte, 8)
	for {
		n, readErr := sr.Read(buf)
		if n > 0 {
			fmt.Printf("  Read %d bytes: %q\n", n, string(buf[:n]))
		}
		if readErr == io.EOF {
			break
		}
	}

	var writer strings.Builder
	fmt.Fprintf(&writer, "Status: %s", "Chalu")
	fmt.Println("Builder:", writer.String())

	// ────────────────────────────────────────────────────────────
	// 3.4 — Compile-time Interface Check
	// ────────────────────────────────────────────────────────────

	var _ Shape = Rect{}
	var _ Shape = Circle{}
	var _ fmt.Stringer = Appliance{}
	var _ error = &AppError{}
	var _ ReadWriter = &FileDevice{}

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	// 1. Implicit satisfaction — no "implements" keyword.
	// 2. any (empty interface) accepts all types; needs assertions.
	// 3. Comma-ok type assertions prevent panics.
	// 4. Type switches > assertion chains.
	// 5. fmt.Stringer and error — implement for custom types.
	// 6. Compose small interfaces into larger ones.
	// 7. NIL TRAP: interface with nil value != nil interface.
	// 8. io.Reader/io.Writer are everywhere. Keep interfaces small.
}
