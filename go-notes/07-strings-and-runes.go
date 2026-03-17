// ============================================================
//  FILE 7 : Strings and Runes
// ============================================================
//  Topic  : String internals, byte vs rune iteration, UTF-8
//           encoding, strings package, strconv conversions,
//           string builder, practical patterns.
//
//  WHY THIS MATTERS:
//  Go strings are UTF-8 byte slices. Understanding byte vs rune
//  is critical for handling international text, emojis, and CJK
//  characters without corrupting data.
// ============================================================

// ============================================================
// STORY: Subtitle editor Lakshmi at DD's broadcast center
// decodes scripts in Hindi, Tamil, Bengali, and English. Each
// glyph may occupy different bytes — Go gives her the tools
// to handle them all correctly.
// ============================================================

package main

import (
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"
)

func main() {

	// ──────────────────────────────────────────────────────────────
	// EXAMPLE BLOCK 1 — String Basics, Byte vs Rune, Builder
	// ──────────────────────────────────────────────────────────────

	// ────────────────────────────────────────────────────────────
	// 1.1 — String Internals: Immutable Byte Slices
	// ────────────────────────────────────────────────────────────

	message := "Hello, Lakshmi!"
	fmt.Println("Original:", message)
	fmt.Println("len() returns bytes:", len(message))
	// message[0] = 'h' → compile error (immutable)

	rawPath := `C:\Users\Lakshmi\subtitles`
	fmt.Println("Raw string:", rawPath)

	// ────────────────────────────────────────────────────────────
	// 1.2 — len() Returns Bytes, NOT Characters
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Byte Count vs Rune Count ---")
	ascii := "Go"
	hindi := "हिंदी"

	fmt.Printf("%-8s len=%d  runes=%d\n", ascii, len(ascii), utf8.RuneCountInString(ascii))
	fmt.Printf("%-8s len=%d  runes=%d\n", hindi, len(hindi), utf8.RuneCountInString(hindi))

	// ────────────────────────────────────────────────────────────
	// 1.3 — Byte vs Rune Iteration
	// ────────────────────────────────────────────────────────────
	// Byte loop can split multi-byte chars. for-range iterates
	// by rune — always prefer it for text.

	word := "café"
	fmt.Println("\n--- Rune-by-rune (for range) ---")
	for i, r := range word {
		fmt.Printf("  index=%d rune=%c (U+%04X)\n", i, r, r)
	}
	// 'é' is 2 bytes — index jumps from 3 past 4

	// ────────────────────────────────────────────────────────────
	// 1.4 — Multi-byte Characters: Devanagari
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Multi-byte Characters ---")
	devanagari := "नमस्ते"
	fmt.Printf("String: %s (bytes: %d, runes: %d)\n",
		devanagari, len(devanagari), utf8.RuneCountInString(devanagari))
	for i, r := range devanagari {
		fmt.Printf("  [%2d] U+%04X %c (%d bytes)\n", i, r, r, utf8.RuneLen(r))
	}

	// ────────────────────────────────────────────────────────────
	// 1.5 — Rune Type and Conversions
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Rune Basics ---")
	var r rune = 'अ'
	fmt.Printf("Rune: %c  Unicode: U+%04X  Int: %d\n", r, r, r)

	original := "नमस्ते दुनिया"
	runes := []rune(original)
	fmt.Printf("Back to string: %s\n", string(runes))

	// ────────────────────────────────────────────────────────────
	// 1.6 — strings.Builder for Efficient Concatenation
	// ────────────────────────────────────────────────────────────
	// + creates a new string each time. Builder avoids that.

	fmt.Println("\n--- strings.Builder ---")
	var b strings.Builder
	for i, g := range []string{"Namaste", "Vanakkam", "Namaskar"} {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(g)
	}
	fmt.Println("Built:", b.String())

	// ──────────────────────────────────────────────────────────────
	// EXAMPLE BLOCK 2 — strings Package, strconv, Patterns
	// ──────────────────────────────────────────────────────────────

	// ────────────────────────────────────────────────────────────
	// 2.1 — strings: Searching
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- strings: Searching ---")
	msg := "Doordarshan brings news to every household"
	fmt.Println("Contains 'news':", strings.Contains(msg, "news"))
	fmt.Println("HasPrefix 'Door':", strings.HasPrefix(msg, "Door"))
	fmt.Println("Index 'brings':", strings.Index(msg, "brings"))

	// ────────────────────────────────────────────────────────────
	// 2.2 — strings: Transforming
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- strings: Transforming ---")
	raw := "  Lakshmi's Subtitle Desk  "
	fmt.Printf("TrimSpace: %q\n", strings.TrimSpace(raw))
	fmt.Printf("ToUpper:   %q\n", strings.ToUpper(strings.TrimSpace(raw)))
	fmt.Printf("Replace:   %q\n", strings.Replace(raw, "Subtitle", "Caption", 1))

	// ────────────────────────────────────────────────────────────
	// 2.3 — Split, Join, Fields
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Split, Join, Fields ---")
	csv := "Hindi,Tamil,Bengali,English"
	parts := strings.Split(csv, ",")
	fmt.Println("Split:", parts)
	fmt.Println("Join:", strings.Join(parts, " | "))

	// Fields splits on any whitespace (better than Split for words)
	sentence := "  Doordarshan   is   timeless  "
	fmt.Println("Fields:", strings.Fields(sentence))

	// ────────────────────────────────────────────────────────────
	// 2.4 — strconv: Number-String Conversions
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- strconv ---")
	ageStr := strconv.Itoa(42)
	fmt.Printf("Itoa: %q\n", ageStr)

	parsed, err := strconv.Atoi("256")
	if err == nil {
		fmt.Println("Atoi:", parsed)
	}

	_, err2 := strconv.Atoi("not_a_number")
	if err2 != nil {
		fmt.Println("Atoi error:", err2)
	}

	piStr := strconv.FormatFloat(3.14159, 'f', 2, 64)
	fmt.Println("FormatFloat:", piStr)

	// ────────────────────────────────────────────────────────────
	// 2.5 — Practical: Reverse String (rune-safe)
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Reverse String ---")
	reverseStr := func(s string) string {
		runes := []rune(s)
		for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
			runes[i], runes[j] = runes[j], runes[i]
		}
		return string(runes)
	}
	fmt.Println("Reverse 'Hello':", reverseStr("Hello"))
	fmt.Println("Reverse 'नमस्ते':", reverseStr("नमस्ते"))

	// ────────────────────────────────────────────────────────────
	// 2.6 — Practical: Palindrome Check
	// ────────────────────────────────────────────────────────────

	fmt.Println("\n--- Palindrome ---")
	isPalindrome := func(s string) bool {
		s = strings.ToLower(strings.TrimSpace(s))
		runes := []rune(s)
		for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
			if runes[i] != runes[j] {
				return false
			}
		}
		return true
	}
	fmt.Println("'racecar':", isPalindrome("racecar"))
	fmt.Println("'hello':", isPalindrome("hello"))

	// ============================================================
	// KEY TAKEAWAYS
	// ============================================================
	// 1. Strings are immutable UTF-8 byte slices.
	// 2. len() returns BYTES. Use utf8.RuneCountInString() for chars.
	// 3. for-range iterates by rune; indexed for iterates by byte.
	// 4. Convert to []rune for character-level operations.
	// 5. strings.Builder for efficient loop concatenation.
	// 6. strings.Fields > Split(" ") for word splitting.
	// 7. strconv bridges strings and numbers — always check errors.
}
