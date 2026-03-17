// ============================================================
//  FILE 27: Reflection
// ============================================================
//  Topic: reflect.TypeOf, ValueOf, Kind vs Type, struct fields,
//         struct tags, setting values, DeepEqual, validation.
//
//  WHY: Reflection lets a program examine types at runtime.
//  JSON, ORMs, and validators rely on it. But it's slow and
//  bypasses compile-time safety — use sparingly.
// ============================================================
//
//  STORY — "Ayushman X-Ray Lab"
//  The X-ray lab examines patients (structs) without knowing
//  their type in advance. TypeOf = reading the chart. ValueOf =
//  looking at the X-ray. Powerful, but don't X-ray just to
//  check a name badge.
// ============================================================

package main

import (
	"fmt"
	"reflect"
	"strings"
)

// ── Types ──

type AadhaarNumber int

type Patient struct {
	Name    string `json:"name"  validate:"required"`
	Email   string `json:"email" validate:"required,email"`
	Age     int    `json:"age"   validate:"min=0,max=150"`
	Village string `json:"village"`
}

// Inspect prints type info for any value.
func Inspect(x interface{}) {
	t := reflect.TypeOf(x)
	v := reflect.ValueOf(x)
	fmt.Printf("  Type: %v, Kind: %v\n", t, t.Kind())

	if t.Kind() == reflect.Struct {
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			fmt.Printf("    %s (%s) = %v  [json:%q validate:%q]\n",
				f.Name, f.Type, v.Field(i), f.Tag.Get("json"), f.Tag.Get("validate"))
		}
	}
}

// SetField sets a struct field by name via reflection.
func SetField(target interface{}, name string, val interface{}) error {
	v := reflect.ValueOf(target)
	if v.Kind() != reflect.Pointer || v.Elem().Kind() != reflect.Struct {
		return fmt.Errorf("need pointer to struct")
	}
	field := v.Elem().FieldByName(name)
	if !field.IsValid() {
		return fmt.Errorf("no field %q", name)
	}
	if !field.CanSet() {
		return fmt.Errorf("field %q not settable", name)
	}
	newVal := reflect.ValueOf(val)
	if field.Type() != newVal.Type() {
		return fmt.Errorf("type mismatch: %s vs %s", field.Type(), newVal.Type())
	}
	field.Set(newVal)
	return nil
}

// ── Validator ──

type ValidationError struct {
	Field, Message string
}

func (e ValidationError) Error() string { return e.Field + ": " + e.Message }

func Validate(s interface{}) []ValidationError {
	var errs []ValidationError
	v := reflect.ValueOf(s)
	t := reflect.TypeOf(s)
	if t.Kind() == reflect.Pointer {
		v = v.Elem()
		t = t.Elem()
	}
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		value := v.Field(i)
		tag := field.Tag.Get("validate")
		if tag == "" {
			continue
		}
		for _, rule := range strings.Split(tag, ",") {
			rule = strings.TrimSpace(rule)
			switch {
			case rule == "required" && isZero(value):
				errs = append(errs, ValidationError{field.Name, "is required"})
			case rule == "email" && value.Kind() == reflect.String:
				if s := value.String(); s != "" && !strings.Contains(s, "@") {
					errs = append(errs, ValidationError{field.Name, "invalid email"})
				}
			case strings.HasPrefix(rule, "min=") && value.Kind() == reflect.Int:
				var min int
				fmt.Sscanf(rule, "min=%d", &min)
				if int(value.Int()) < min {
					errs = append(errs, ValidationError{field.Name, fmt.Sprintf("must be >= %d", min)})
				}
			case strings.HasPrefix(rule, "max=") && value.Kind() == reflect.Int:
				var max int
				fmt.Sscanf(rule, "max=%d", &max)
				if int(value.Int()) > max {
					errs = append(errs, ValidationError{field.Name, fmt.Sprintf("must be <= %d", max)})
				}
			}
		}
	}
	return errs
}

func isZero(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.String:
		return v.String() == ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Slice, reflect.Map:
		return v.IsNil() || v.Len() == 0
	case reflect.Pointer, reflect.Interface:
		return v.IsNil()
	default:
		return false
	}
}

func main() {
	fmt.Println("===== FILE 27: Reflection =====\n")

	// ── Block 1: Examining Types and Values ──
	fmt.Println("--- TypeOf / ValueOf ---")

	fmt.Printf("  42 -> Type: %v, Kind: %v\n", reflect.TypeOf(42), reflect.TypeOf(42).Kind())

	var a AadhaarNumber = 123456789012
	t := reflect.TypeOf(a)
	fmt.Printf("  AadhaarNumber -> Type: %v, Kind: %v\n", t, t.Kind())
	// Type = main.AadhaarNumber, Kind = int

	fmt.Println("\n--- Inspecting struct ---")
	p := Patient{Name: "Ramesh", Email: "ramesh@hospital.in", Age: 45, Village: "Sultanpur"}
	Inspect(p)

	// ── Block 2: Setting Values ──
	fmt.Println("\n--- Setting values ---")

	target := &Patient{Name: "Suresh", Age: 35}
	fmt.Printf("  Before: %+v\n", *target)
	SetField(target, "Name", "Suresh Kumar")
	SetField(target, "Age", 36)
	fmt.Printf("  After:  %+v\n", *target)

	fmt.Println("  Set missing:", SetField(target, "Nope", "x"))
	fmt.Println("  Wrong type:", SetField(target, "Age", "string"))

	// Must pass pointer for CanSet
	fmt.Println("\n--- Addressability ---")
	fmt.Println("  Non-ptr CanSet:", reflect.ValueOf(Patient{}).Field(0).CanSet())
	fmt.Println("  Ptr CanSet:    ", reflect.ValueOf(&Patient{}).Elem().Field(0).CanSet())

	// ── DeepEqual ──
	fmt.Println("\n--- DeepEqual ---")
	fmt.Println("  [1,2,3]==[1,2,3]:", reflect.DeepEqual([]int{1, 2, 3}, []int{1, 2, 3}))
	fmt.Println("  [1,2,3]==[1,2,4]:", reflect.DeepEqual([]int{1, 2, 3}, []int{1, 2, 4}))

	// ── Validator ──
	fmt.Println("\n--- Validator ---")

	valid := Patient{Name: "Ramesh", Email: "r@h.in", Age: 45}
	if errs := Validate(valid); len(errs) == 0 {
		fmt.Println("  Valid: no errors")
	}

	bad := Patient{Name: "", Email: "nope", Age: -5}
	for _, e := range Validate(bad) {
		fmt.Println("  ERROR:", e)
	}

	fmt.Println("\n--- When to use reflection ---")
	fmt.Println("  DO: serialization, ORM mapping, validation, test utilities")
	fmt.Println("  DON'T: business logic, anything solvable with generics/interfaces")
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. TypeOf = type info, ValueOf = runtime value. Two entry points.
// 2. Kind = underlying category (int, struct). Type = declared name.
// 3. Iterate fields: NumField(), Field(i). Read tags: Tag.Get("json").
// 4. Setting values requires a pointer. CanSet() = false for non-ptrs.
// 5. DeepEqual: recursive comparison for slices, maps, structs.
// 6. Struct tags + reflection = metadata system (validation, JSON, ORM).
// 7. Reflection bypasses compile safety. Use only when static types can't.
// ============================================================
