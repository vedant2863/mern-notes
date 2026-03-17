// ============================================================
//  FILE 13 : Packages and Modules
// ============================================================
//  Topic  : package keyword, imports, exported names, init(),
//           go.mod anatomy, module system.
//
//  WHY THIS MATTERS:
//  Go organizes code into packages and manages dependencies
//  through modules. Understanding how packages, imports, and
//  the module system work is fundamental at any scale.
// ============================================================

// ============================================================
// STORY: Commissioner Verma organizes the city into named wards
// (packages). Roads (imports) connect them. PUBLIC buildings
// (Exported) are open to all; private ones (unexported) are
// ward-only. Before the city opens, each ward runs setup (init).
// ============================================================

package main

import (
	"fmt"
	str "strings" // aliased import
	_ "os"        // blank import — side effects only
	"math"
	"unicode"
)

// ============================================================
// init() Functions — run before main(), LIFO within file
// ============================================================

var nagarName string

func init() {
	nagarName = "Gopher Nagar"
	fmt.Println("[init #1] Nagar name set to:", nagarName)
}

func init() {
	fmt.Println("[init #2] Streetlights on in", nagarName)
}

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Package Basics, Imports, Exported Names
	// ============================================================

	fmt.Println("\n--- package keyword ---")
	fmt.Println("This file is 'package main' — an executable.")
	fmt.Println("Libraries use names like 'package http', 'package json'.")

	fmt.Println("\n--- Aliased import ---")
	greeting := "Namaste, Gopher Nagar!"
	fmt.Println("Upper:", str.ToUpper(greeting))
	fmt.Println("Contains 'Nagar':", str.Contains(greeting, "Nagar"))

	// ────────────────────────────────────────────────────────────
	// Exported vs Unexported
	// ────────────────────────────────────────────────────────────
	// Capital letter = exported (public). Lowercase = unexported.

	fmt.Println("\n--- Exported vs Unexported ---")
	fmt.Printf("math.Pi (exported): %.6f\n", math.Pi)
	fmt.Println("unicode.IsUpper('G'):", unicode.IsUpper('G'))
	fmt.Println("unicode.IsUpper('g'):", unicode.IsUpper('g'))

	fmt.Println("\n--- init() recap ---")
	fmt.Println("Nagar from init():", nagarName)
	fmt.Println("Both init() ran BEFORE main().")

	// ============================================================
	// EXAMPLE BLOCK 2 — Module System & Common Patterns
	// ============================================================

	fmt.Println("\n--- go.mod anatomy ---")
	fmt.Println(`  module go-notes         // module path
  go 1.26.0               // minimum Go version
  require (               // dependencies
    github.com/pkg/errors v0.9.1
  )
  replace (               // local overrides
    example.com/old => ../local-fork
  )`)

	fmt.Println("\n--- go.sum ---")
	fmt.Println("Cryptographic hashes for reproducible builds. Always commit it.")

	fmt.Println("\n--- Essential commands ---")
	fmt.Println("  go mod init <path>  → create go.mod")
	fmt.Println("  go mod tidy         → add missing, remove unused")
	fmt.Println("  go get <pkg>@v      → add/update dependency")
	fmt.Println("  go mod vendor       → copy deps into vendor/")

	fmt.Println("\n--- Import path conventions ---")
	fmt.Println(`  Stdlib:    "fmt", "net/http"
  Third-party: "github.com/gorilla/mux"
  Internal:    "mymodule/internal/config"`)

	fmt.Println("\n--- internal packages ---")
	fmt.Println(`  mymodule/internal/config → only importable by mymodule.
  This is Go's built-in encapsulation for modules.`)

	fmt.Println("\n--- Blank imports ---")
	fmt.Println(`  _ "image/png"         → registers PNG decoder via init()
  _ "github.com/lib/pq"  → registers PostgreSQL driver`)

	fmt.Println("\n--- Package design ---")
	fmt.Println("  1. Name by what they PROVIDE (http, auth), not 'utils'")
	fmt.Println("  2. Minimal exported API surface")
	fmt.Println("  3. One clear responsibility per package")

	fmt.Println("\n--- Circular imports ---")
	fmt.Println("  Forbidden. Extract shared types into a third package.")

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	fmt.Println("\n--- KEY TAKEAWAYS ---")
	fmt.Println(`  1. package main + func main() = executable.
  2. Exported = capital letter. Unexported = lowercase.
  3. init() runs before main(). Used for setup/registration.
  4. Blank imports run init() without using exports.
  5. go.mod + go.sum = reproducible builds. Commit both.
  6. 'go mod tidy' — run it often.
  7. internal/ restricts visibility to your module.
  8. Circular imports are forbidden.`)
}
