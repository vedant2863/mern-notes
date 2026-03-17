// ============================================================
//  FILE 11 : Error Handling
// ============================================================
//  Topic  : The error interface, errors.New, fmt.Errorf, error
//           wrapping with %w, errors.Is, errors.As, custom
//           error types, sentinel errors, errors.Join
//
//  WHY THIS MATTERS:
//  Go rejects exceptions for explicit error values. Every
//  function that can fail returns an error. This makes error
//  paths visible, testable, and impossible to accidentally
//  ignore. Mastering Go error patterns is non-negotiable.
// ============================================================

// ============================================================
// STORY: Inspector Sharma checks every railway system. Every
// anomaly is logged, classified, and either fixed or escalated.
// "No defect unchecked, no failure unrecorded."
// ============================================================

package main

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// ────────────────────────────────────────────────────────────
// Sentinel Errors
// ────────────────────────────────────────────────────────────

var (
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrTimeout      = errors.New("operation timed out")
)

// ────────────────────────────────────────────────────────────
// Custom Error Types
// ────────────────────────────────────────────────────────────

type ValidationError struct {
	Field, Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed on %q: %s", e.Field, e.Message)
}

type InspectionError struct {
	System  string
	Code    int
	Message string
	Err     error
}

func (e *InspectionError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] error %d: %s (caused by: %v)", e.System, e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] error %d: %s", e.System, e.Code, e.Message)
}

func (e *InspectionError) Unwrap() error { return e.Err }

func main() {

	// ============================================================
	// EXAMPLE BLOCK 1 — Basic Errors & The Value+Error Pattern
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 1.1 — errors.New
	// ────────────────────────────────────────────────────────────

	fmt.Println("--- errors.New ---")
	inspect := func(psi float64) (string, error) {
		if psi < 0 {
			return "", errors.New("pressure cannot be negative")
		}
		if psi > 100 {
			return "", errors.New("pressure exceeds safe limit")
		}
		return fmt.Sprintf("%.1f PSI — safe", psi), nil
	}

	if result, err := inspect(75.0); err != nil {
		fmt.Println("ERROR:", err)
	} else {
		fmt.Println("OK:", result)
	}

	if _, err := inspect(150.0); err != nil {
		fmt.Println("ERROR:", err)
	}

	// ────────────────────────────────────────────────────────────
	// 1.2 — fmt.Errorf
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- fmt.Errorf ---")
	checkTemp := func(name string, temp float64) error {
		if temp > 200 {
			return fmt.Errorf("signal %q overheating: %.1f°C", name, temp)
		}
		return nil
	}
	if err := checkTemp("Signal-Patna-Jn", 250.3); err != nil {
		fmt.Println("ERROR:", err)
	}

	// ────────────────────────────────────────────────────────────
	// 1.3 — Value+Error Pattern
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Value+Error Pattern ---")
	parseReading := func(input string) (float64, error) {
		val, err := strconv.ParseFloat(input, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid reading %q: %v", input, err)
		}
		return val, nil
	}
	for _, r := range []string{"42.5", "bad", "98.6"} {
		if val, err := parseReading(r); err != nil {
			fmt.Printf("  FAIL: %v\n", err)
		} else {
			fmt.Printf("  OK:   %.1f\n", val)
		}
	}

	// ============================================================
	// EXAMPLE BLOCK 2 — Wrapping, errors.Is, errors.As
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 2.1 — Error Wrapping with %w
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Wrapping with %w ---")
	findCoach := func(name string) error {
		if name != "Coach-S1" {
			return ErrNotFound
		}
		return nil
	}
	inspectCoach := func(name string) error {
		if err := findCoach(name); err != nil {
			return fmt.Errorf("inspecting %q: %w", name, err)
		}
		return nil
	}
	auditCoach := func(name string) error {
		if err := inspectCoach(name); err != nil {
			return fmt.Errorf("audit: %w", err)
		}
		return nil
	}

	err := auditCoach("Coach-B2")
	fmt.Println("Wrapped:", err)

	// ────────────────────────────────────────────────────────────
	// 2.2 — errors.Is
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- errors.Is ---")
	fmt.Println("Is ErrNotFound?", errors.Is(err, ErrNotFound))
	fmt.Println("Is ErrTimeout?", errors.Is(err, ErrTimeout))

	// ────────────────────────────────────────────────────────────
	// 2.3 — errors.As
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- errors.As ---")
	valErr := fmt.Errorf("check: %w",
		&ValidationError{Field: "brake-pressure", Message: "exceeds safe range"})

	var ve *ValidationError
	if errors.As(valErr, &ve) {
		fmt.Printf("Field: %q, Message: %q\n", ve.Field, ve.Message)
	}

	// ────────────────────────────────────────────────────────────
	// 2.4 — Unwrapping Chain
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Unwrap Chain ---")
	chain := fmt.Errorf("L3: %w", fmt.Errorf("L2: %w", fmt.Errorf("L1: %w", ErrTimeout)))
	current := error(chain)
	for depth := 0; current != nil; depth++ {
		fmt.Printf("  depth %d: %v\n", depth, current)
		current = errors.Unwrap(current)
	}

	// ============================================================
	// EXAMPLE BLOCK 3 — Custom Errors, Sentinels, errors.Join
	// ============================================================

	// ────────────────────────────────────────────────────────────
	// 3.1 — Custom Error Type with Unwrap
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Custom Error Types ---")
	trackErr := &InspectionError{
		System: "Track-Rajdhani", Code: 5001,
		Message: "crack near km 42", Err: ErrTimeout,
	}
	fmt.Println("Error:", trackErr)
	fmt.Println("Caused by timeout?", errors.Is(trackErr, ErrTimeout))

	var ie *InspectionError
	if errors.As(trackErr, &ie) {
		fmt.Printf("System: %s, Code: %d\n", ie.System, ie.Code)
	}

	// ────────────────────────────────────────────────────────────
	// 3.2 — Sentinel Errors in Practice
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Sentinel Errors ---")
	lookup := func(id int) (string, error) {
		db := map[int]string{1: "Sharma", 2: "Pappu"}
		if name, ok := db[id]; ok {
			return name, nil
		}
		return "", fmt.Errorf("employee %d: %w", id, ErrNotFound)
	}
	if _, err := lookup(99); errors.Is(err, ErrNotFound) {
		fmt.Println("Lookup:", err)
	}

	// ────────────────────────────────────────────────────────────
	// 3.3 — errors.Join (Go 1.20+)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- errors.Join ---")
	validate := func(name, badge string) error {
		var errs []error
		if strings.TrimSpace(name) == "" {
			errs = append(errs, &ValidationError{Field: "name", Message: "required"})
		}
		if !strings.Contains(badge, "-") {
			errs = append(errs, &ValidationError{Field: "badge", Message: "invalid format"})
		}
		if len(errs) > 0 {
			return errors.Join(errs...)
		}
		return nil
	}
	if err := validate("", "BADBADGE"); err != nil {
		fmt.Println("Validation errors:\n ", err)
	}

	// ────────────────────────────────────────────────────────────
	// 3.4 — Decision Guide
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Decision Guide ---")
	fmt.Println("  Simple message?   → errors.New()")
	fmt.Println("  Dynamic context?  → fmt.Errorf(\"%v\")")
	fmt.Println("  Preserve cause?   → fmt.Errorf(\"%w\")")
	fmt.Println("  Check identity?   → errors.Is()")
	fmt.Println("  Extract type?     → errors.As()")
	fmt.Println("  Multiple errors?  → errors.Join()")

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	// 1. error interface: { Error() string }
	// 2. Return (value, error) — check error FIRST.
	// 3. errors.New for simple; fmt.Errorf for formatted.
	// 4. %w wraps errors for Is/As/Unwrap.
	// 5. errors.Is checks identity through wrap chain.
	// 6. errors.As extracts specific error types.
	// 7. Sentinel errors: package-level comparison targets.
	// 8. Custom errors carry structured data + Unwrap().
	// 9. errors.Join combines multiple errors (Go 1.20+).
	// 10. Never ignore errors.
}
