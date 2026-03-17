// ============================================================
//  FILE 37 : AI — Embeddings & Semantic Search
// ============================================================
//  Topic  : text embeddings, cosine similarity, vector store,
//           semantic search, batch embedding, applications
//
//  WHY: Keyword search fails when users and docs use different
//  words for the same concept. Embeddings convert text into
//  vectors that capture MEANING — the foundation of modern
//  search, recommendations, and RAG (Chapter 38).
// ============================================================

// ============================================================
// STORY: IRCTC FAQ Semantic Search
// IRCTC serves 25M+ passengers daily. Keyword search fails:
// "how to cancel tatkal ticket" misses FAQ titled "Tatkal
// Booking Cancellation & Refund Policy." Embedding both texts
// as vectors finds the match — they're close in vector space.
// ============================================================

package main

import (
	"fmt"
	"math"
	"os"
	"sort"
	"strings"
)

// ============================================================
// SIMULATED MODE
// ============================================================

var geminiAPIKey37 = os.Getenv("GEMINI_API_KEY")
var simulatedMode37 = geminiAPIKey37 == ""

func init() {
	if simulatedMode37 {
		fmt.Println("  SIMULATED MODE — embeddings via keyword hashing.")
		fmt.Println()
	}
}

// ============================================================
// SECTION 1 — What Are Embeddings?
// ============================================================
// An embedding is a vector (list of numbers) representing text
// MEANING. Similar meanings -> nearby vectors (small angle).
// Dimensions: typically 768 floats for text-embedding-004.

func demoEmbeddingConcept() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 1: What Are Embeddings?")
	fmt.Println("============================================================")
	fmt.Println("  Text -> numbers capturing meaning")
	fmt.Println("  'train ticket' and 'railway booking' -> nearby vectors")
	fmt.Println("  'train ticket' and 'pizza recipe'    -> distant vectors")
	fmt.Println()

	pairs := []struct{ a, b string }{
		{"cancel tatkal ticket", "tatkal booking cancellation refund"},
		{"train PNR status", "check PNR number railway"},
		{"cancel tatkal ticket", "best pizza in Delhi"},
	}
	for _, p := range pairs {
		sim := cosineSimilarity(simulateEmbedding(p.a), simulateEmbedding(p.b))
		fmt.Printf("  '%.20s' vs '%.20s' = %.4f\n", p.a, p.b, sim)
	}
	fmt.Println()
}

// ============================================================
// SECTION 2 — Generating Embeddings (Simulated)
// ============================================================
// Keyword hashing produces deterministic vectors where related
// texts get similar vectors. Real: text-embedding-004 (768D).

const embeddingDim = 64

func simulateEmbedding(text string) []float32 {
	vec := make([]float32, embeddingDim)
	text = strings.ToLower(text)
	words := strings.Fields(text)

	keywordGroups := map[string][]int{
		"train": {0, 1, 2}, "railway": {0, 1, 3}, "ticket": {1, 4, 5},
		"booking": {4, 5, 6}, "pnr": {8, 9, 10}, "status": {9, 10, 11},
		"cancel": {13, 14, 15}, "cancellation": {13, 14, 16}, "refund": {14, 15, 17},
		"tatkal": {19, 20, 21}, "waitlist": {24, 25}, "rac": {25, 26},
		"payment": {31, 32}, "irctc": {36, 37},
		"how": {38, 39}, "check": {10, 11, 12}, "number": {9, 44},
		"food": {50, 51, 52}, "pizza": {50, 53}, "recipe": {51, 54},
		"best": {56, 57}, "delhi": {58, 59},
		"seat": {28, 30}, "berth": {28, 29}, "confirm": {26, 27},
		"old": {42, 43}, "senior": {42, 43}, "person": {42, 44},
		"discount": {14, 43}, "concession": {14, 43},
		"order": {50, 51}, "catering": {50, 52},
	}

	for _, word := range words {
		if dims, ok := keywordGroups[word]; ok {
			for _, d := range dims {
				vec[d] += 1.0
			}
		}
		hash := uint32(0)
		for _, ch := range word {
			hash = hash*31 + uint32(ch)
		}
		vec[int(hash%uint32(embeddingDim))] += 0.3
	}

	// L2 normalize
	var mag float64
	for _, v := range vec {
		mag += float64(v) * float64(v)
	}
	mag = math.Sqrt(mag)
	if mag > 0 {
		for i := range vec {
			vec[i] = float32(float64(vec[i]) / mag)
		}
	}
	return vec
}

func demoEmbeddingGeneration() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 2: Generating Embeddings")
	fmt.Println("============================================================")
	text := "How to cancel tatkal ticket on IRCTC?"
	vec := simulateEmbedding(text)
	fmt.Printf("  Text: %q -> %dD vector\n", text, len(vec))
	fmt.Printf("  First 8: [%.3f, %.3f, %.3f, %.3f, %.3f, %.3f, %.3f, %.3f, ...]\n",
		vec[0], vec[1], vec[2], vec[3], vec[4], vec[5], vec[6], vec[7])
	// Real: model.EmbedContent(ctx, genai.Text(text)) -> []float32, 768D
	fmt.Println()
}

// ============================================================
// SECTION 3 — Cosine Similarity
// ============================================================
// cos(theta) = (A.B) / (||A|| * ||B||)
// 1.0=identical, 0.0=unrelated, -1.0=opposite

func cosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) {
		panic("vectors must have same length")
	}
	var dot, magA, magB float64
	for i := range a {
		ai, bi := float64(a[i]), float64(b[i])
		dot += ai * bi
		magA += ai * ai
		magB += bi * bi
	}
	magA, magB = math.Sqrt(magA), math.Sqrt(magB)
	if magA == 0 || magB == 0 {
		return 0.0
	}
	return dot / (magA * magB)
}

func demoCosineSimilarity() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 3: Cosine Similarity")
	fmt.Println("============================================================")

	// 3D example
	fmt.Printf("  [1,0,0] vs [1,0,0] = %.2f (identical)\n", cosineSimilarity([]float32{1, 0, 0}, []float32{1, 0, 0}))
	fmt.Printf("  [1,0,0] vs [0,1,0] = %.2f (orthogonal)\n", cosineSimilarity([]float32{1, 0, 0}, []float32{0, 1, 0}))

	// Text pairs
	pairs := []struct{ a, b, expect string }{
		{"cancel tatkal ticket", "tatkal booking cancellation refund policy", "HIGH"},
		{"train PNR status check", "check PNR number railway", "HIGH"},
		{"cancel tatkal ticket", "best pizza recipe in Delhi", "LOW"},
	}
	fmt.Println("\n  IRCTC text pairs:")
	for _, p := range pairs {
		sim := cosineSimilarity(simulateEmbedding(p.a), simulateEmbedding(p.b))
		fmt.Printf("  '%.25s' vs '%.25s' = %.4f (%s)\n", p.a, p.b, sim, p.expect)
	}
	fmt.Println()
}

// ============================================================
// SECTION 4 — In-Memory Vector Store
// ============================================================
// Insert stores vectors; Search finds nearest neighbors.
// Production: Pinecone, Weaviate, pgvector.

type VectorEntry struct {
	ID, Text string
	Vector   []float32
}

type SearchResult struct {
	Entry      VectorEntry
	Similarity float64
}

type VectorStore struct {
	entries []VectorEntry
}

func NewVectorStore() *VectorStore {
	return &VectorStore{entries: make([]VectorEntry, 0)}
}

func (vs *VectorStore) Insert(id, text string, vector []float32) {
	vs.entries = append(vs.entries, VectorEntry{ID: id, Text: text, Vector: vector})
}

// Search: O(n) brute-force. Production uses ANN (HNSW, IVF, ScaNN).
func (vs *VectorStore) Search(queryVec []float32, topK int) []SearchResult {
	results := make([]SearchResult, 0, len(vs.entries))
	for _, e := range vs.entries {
		results = append(results, SearchResult{Entry: e, Similarity: cosineSimilarity(queryVec, e.Vector)})
	}
	sort.Slice(results, func(i, j int) bool { return results[i].Similarity > results[j].Similarity })
	if topK > len(results) {
		topK = len(results)
	}
	return results[:topK]
}

func (vs *VectorStore) Size() int { return len(vs.entries) }

// ============================================================
// SECTION 5 — IRCTC FAQ Search Demo
// ============================================================

type FAQ struct {
	ID, Question, Answer, Category string
}

func getIRCTCFAQs() []FAQ {
	return []FAQ{
		{"FAQ-001", "How to book train tickets online on IRCTC?", "Visit irctc.co.in, register, search trains, fill details, pay.", "Booking"},
		{"FAQ-002", "Tatkal ticket booking timing and rules", "Opens 10AM (AC) / 11AM (non-AC), one day before. Max 4 per PNR.", "Tatkal"},
		{"FAQ-003", "Tatkal booking cancellation and refund policy", "Confirmed tatkal: non-refundable. RAC/waitlisted: refund minus clerkage.", "Cancellation"},
		{"FAQ-004", "How to check PNR status of railway ticket", "Visit indianrail.gov.in/pnr_enquiry or SMS 'PNR <number>' to 139.", "PNR"},
		{"FAQ-005", "What is waitlist and RAC in Indian Railways?", "Waitlist: no seat yet. RAC: shared berth. Both can confirm.", "Waitlist"},
		{"FAQ-006", "How to cancel train ticket and get refund online", "IRCTC -> Booked History -> Cancel. Refund in 5-7 working days.", "Cancellation"},
		{"FAQ-008", "IRCTC payment failed but money deducted", "Auto-refunded in 3-5 days. File complaint with transaction ID if not.", "Payment"},
		{"FAQ-009", "How to order food on train via IRCTC e-catering", "ecatering.irctc.co.in, enter PNR, pick restaurant, food at your seat.", "Food"},
		{"FAQ-010", "Senior citizen concession on train booking", "Male 60+, female 58+ get up to 50% off. Select during booking.", "Booking"},
	}
}

func demoFAQSearch() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 5: IRCTC FAQ Semantic Search")
	fmt.Println("============================================================")

	faqs := getIRCTCFAQs()
	store := NewVectorStore()
	for _, f := range faqs {
		store.Insert(f.ID, f.Question, simulateEmbedding(f.Question+" "+f.Answer))
	}
	fmt.Printf("  Indexed %d FAQs (%dD vectors)\n\n", store.Size(), embeddingDim)

	queries := []string{
		"how to cancel tatkal ticket",
		"money deducted but ticket not booked",
		"ordering food during train journey",
		"old person discount on railway ticket",
	}

	for _, q := range queries {
		fmt.Printf("  QUERY: %q\n", q)
		results := store.Search(simulateEmbedding(q), 3)
		for i, r := range results {
			marker := "  "
			if i == 0 {
				marker = "->"
			}
			fmt.Printf("  %s %d. [%.4f] %s\n", marker, i+1, r.Similarity, r.Entry.Text)
		}
		fmt.Println()
	}
}

// ============================================================
// SECTION 6 — Batch Embedding
// ============================================================
// Send 100 texts in one API call instead of one-by-one.

func demoBatchEmbedding() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 6: Batch Embedding")
	fmt.Println("============================================================")
	texts := []string{
		"How to book Rajdhani Express tickets",
		"Shatabdi Express schedule Delhi to Agra",
		"Vande Bharat Express route and stops",
	}
	for i, t := range texts {
		vec := simulateEmbedding(t)
		fmt.Printf("  T%d: %q -> %dD\n", i+1, t, len(vec))
	}
	// Real: model.BatchEmbedContents(ctx, batch)
	fmt.Println()
}

// ============================================================
// SECTION 7 — Applications: Dedup & Recommendation
// ============================================================

func demoApplications() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 7: Applications (Dedup + Recommendation)")
	fmt.Println("============================================================")

	// Deduplication
	fmt.Println("  --- Deduplication (threshold > 0.65) ---")
	pairs := []struct{ a, b string }{
		{"How to cancel train ticket online", "Cancel railway ticket on IRCTC website"},
		{"How to cancel train ticket online", "Best restaurants near Delhi station"},
	}
	for _, p := range pairs {
		sim := cosineSimilarity(simulateEmbedding(p.a), simulateEmbedding(p.b))
		dup := "NOT DUP"
		if sim > 0.65 {
			dup = "DUPLICATE"
		}
		fmt.Printf("  %.4f %s: '%s' vs '%s'\n", sim, dup, p.a, p.b)
	}

	// Recommendation
	fmt.Println("\n  --- Recommendation ---")
	store := NewVectorStore()
	recs := []string{
		"Tatkal booking timing and rules",
		"Tatkal cancellation and refund policy",
		"How to order food on train",
	}
	for i, r := range recs {
		store.Insert(fmt.Sprintf("rec-%d", i), r, simulateEmbedding(r))
	}
	results := store.Search(simulateEmbedding("How to book tatkal ticket"), 3)
	for i, r := range results {
		fmt.Printf("  %d. [%.4f] %s\n", i+1, r.Similarity, r.Entry.Text)
	}
	fmt.Println()
}

// ============================================================
// SECTION 8 — Key Takeaways
// ============================================================

func printEmbeddingTakeaways() {
	fmt.Println("============================================================")
	fmt.Println("KEY TAKEAWAYS — Embeddings & Semantic Search")
	fmt.Println("============================================================")
	fmt.Println("  1. Embeddings = meaning as numbers (768 floats)")
	fmt.Println("  2. Cosine similarity: 1.0=identical, 0.0=unrelated")
	fmt.Println("  3. Vector store: insert + nearest-neighbor search")
	fmt.Println("  4. Batch embed for efficiency (100 texts per call)")
	fmt.Println("  5. Apps: search, dedup, clustering, recommendation")
	fmt.Println("  NEXT: Ch 38 — RAG (embeddings + generation)")
	fmt.Println()
}

// ============================================================
// MAIN
// ============================================================

func main() {
	fmt.Println()
	fmt.Println("============================================================")
	fmt.Println("  FILE 37 : AI — Embeddings & Semantic Search (IRCTC FAQ)")
	fmt.Println("============================================================")
	fmt.Println()

	demoEmbeddingConcept()
	demoEmbeddingGeneration()
	demoCosineSimilarity()
	demoFAQSearch()
	demoBatchEmbedding()
	demoApplications()
	printEmbeddingTakeaways()
}
