// ============================================================
//  FILE 22: JSON
// ============================================================
//  Topic: json.Marshal/Unmarshal, struct tags, omitempty,
//         Encoder/Decoder, custom MarshalJSON/UnmarshalJSON,
//         json.RawMessage, map[string]any, MarshalIndent.
//
//  WHY: JSON is the lingua franca of web APIs. Go's encoding/json
//  handles translation between structs and JSON text.
// ============================================================
//
//  STORY — "The RTI Data Translator"
//  Officer Sharma translates between the Land of Structs (Go)
//  and the Land of Curly Braces (JSON) — renaming fields,
//  hiding classified info, handling unknown shapes.
// ============================================================

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

func main() {
	// ============================================================
	// BLOCK 1 — Marshal/Unmarshal, Struct Tags, Omitempty
	// ============================================================

	fmt.Println("--- BLOCK 1: Marshal/Unmarshal Basics ---")

	// SECTION: json.Marshal (struct -> JSON)
	type TaggedRTIRequest struct {
		From       string `json:"from"`
		To         string `json:"to"`
		Department string `json:"department"`
		Urgent     bool   `json:"urgent"`
	}

	tagged := TaggedRTIRequest{"Sharma", "District Collector", "Revenue Department", true}
	jsonBytes, _ := json.Marshal(tagged)
	fmt.Println("Marshal:", string(jsonBytes))

	// SECTION: json.Unmarshal (JSON -> struct)
	// Extra JSON fields are silently ignored. Missing fields get zero values.
	fmt.Println("\n--- Unmarshal ---")

	var received TaggedRTIRequest
	json.Unmarshal([]byte(`{"from":"Verma","to":"Sharma","department":"Public Works","urgent":false}`), &received)
	fmt.Printf("Unmarshaled: From=%s, Dept=%s\n", received.From, received.Department)

	// SECTION: omitempty and json:"-"
	fmt.Println("\n--- omitempty and json:\"-\" ---")

	type GovOfficer struct {
		Name       string `json:"name"`
		Grade      int    `json:"grade,omitempty"` // omit if zero
		Email      string `json:"email,omitempty"`
		AadhaarNum string `json:"-"` // NEVER in JSON
	}

	officer := GovOfficer{Name: "Sharma", Email: "sharma@rti.gov.in", AadhaarNum: "1234-5678-9012"}
	jsonBytes, _ = json.Marshal(officer)
	fmt.Println("With omitempty:", string(jsonBytes))
	// Grade (0) omitted, AadhaarNum hidden

	// SECTION: Nested structs
	fmt.Println("\n--- Nested structs ---")

	type RTIOfficer struct {
		Name    string   `json:"name"`
		Address struct {
			Street string `json:"street"`
			City   string `json:"city"`
		} `json:"address"`
		Departments []string `json:"departments"`
	}

	rtiOfficer := RTIOfficer{Name: "Sharma"}
	rtiOfficer.Address.Street = "123 Janpath Road"
	rtiOfficer.Address.City = "New Delhi"
	rtiOfficer.Departments = []string{"Revenue", "Public Works"}
	jsonBytes, _ = json.Marshal(rtiOfficer)
	fmt.Println("Nested:", string(jsonBytes))

	// ============================================================
	// BLOCK 2 — Custom Marshaling, Dynamic JSON
	// ============================================================

	fmt.Println("\n--- BLOCK 2: Custom Marshaling, Dynamic JSON ---")

	// SECTION: Custom MarshalJSON/UnmarshalJSON
	fmt.Println("\n--- Custom marshal ---")

	notification := GovNotification{
		Name: "Republic Day Parade",
		When: time.Date(2026, 1, 26, 9, 0, 0, 0, time.UTC),
	}
	jsonBytes, _ = json.Marshal(notification)
	fmt.Println("Custom:", string(jsonBytes))
	// Output: {"name":"Republic Day Parade","when":"2026-01-26"}

	var parsed GovNotification
	json.Unmarshal([]byte(`{"name":"Budget Session","when":"2026-02-01"}`), &parsed)
	fmt.Printf("Parsed: %s on %s\n", parsed.Name, parsed.When.Format("Jan 2, 2006"))

	// SECTION: json.RawMessage for delayed parsing
	fmt.Println("\n--- RawMessage ---")

	type RTIEnvelope struct {
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}

	for _, raw := range []string{
		`{"type":"text","payload":{"content":"Road budget request"}}`,
		`{"type":"number","payload":{"value":42}}`,
	} {
		var env RTIEnvelope
		json.Unmarshal([]byte(raw), &env)
		switch env.Type {
		case "text":
			var p struct{ Content string `json:"content"` }
			json.Unmarshal(env.Payload, &p)
			fmt.Println("  Text:", p.Content)
		case "number":
			var p struct{ Value int `json:"value"` }
			json.Unmarshal(env.Payload, &p)
			fmt.Println("  Number:", p.Value)
		}
	}

	// SECTION: Dynamic JSON with map[string]any
	// Numbers -> float64, arrays -> []any, objects -> map[string]any
	fmt.Println("\n--- map[string]any ---")

	var dynamic map[string]any
	json.Unmarshal([]byte(`{"department":"Education","budget":7,"active":true}`), &dynamic)
	fmt.Printf("  department=%v (type %T)\n", dynamic["department"], dynamic["department"])
	fmt.Printf("  budget=%v (type %T)\n", dynamic["budget"], dynamic["budget"])

	// SECTION: Streaming Encoder/Decoder
	fmt.Println("\n--- Encoder/Decoder ---")

	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.Encode(TaggedRTIRequest{"Sharma", "Collector", "Revenue", false})
	encoder.Encode(TaggedRTIRequest{"Sharma", "Collector", "Education", true})

	decoder := json.NewDecoder(strings.NewReader(buf.String()))
	for decoder.More() {
		var m TaggedRTIRequest
		decoder.Decode(&m)
		fmt.Printf("  From=%s, Urgent=%v\n", m.From, m.Urgent)
	}

	// SECTION: Pretty printing
	fmt.Println("\n--- MarshalIndent ---")

	pretty, _ := json.MarshalIndent(map[string]any{
		"officer": "Sharma", "applications": 3,
	}, "", "  ")
	fmt.Println(string(pretty))
}

// ── Custom type with date-only format ──

type GovNotification struct {
	Name string    `json:"name"`
	When time.Time `json:"when"`
}

func (g GovNotification) MarshalJSON() ([]byte, error) {
	type Alias GovNotification
	return json.Marshal(&struct {
		When string `json:"when"`
		*Alias
	}{
		When:  g.When.Format("2006-01-02"),
		Alias: (*Alias)(&g),
	})
}

func (g *GovNotification) UnmarshalJSON(data []byte) error {
	type Alias GovNotification
	aux := &struct {
		When string `json:"when"`
		*Alias
	}{Alias: (*Alias)(g)}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	t, err := time.Parse("2006-01-02", aux.When)
	if err != nil {
		return err
	}
	g.When = t
	return nil
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Marshal: struct->JSON. Unmarshal: JSON->struct.
// 2. Struct tags control names: `json:"field_name"`.
// 3. omitempty omits zero-values. json:"-" hides completely.
// 4. Encoder/Decoder stream to/from io.Writer/Reader.
// 5. MarshalJSON/UnmarshalJSON for custom formats (dates, enums).
// 6. RawMessage delays parsing of unknown-shape payloads.
// 7. map[string]any for dynamic JSON. Numbers are always float64.
// 8. MarshalIndent for human-readable output.
// ============================================================
