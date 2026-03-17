// ============================================================
//  FILE 38 : AI — RAG (Retrieval-Augmented Generation)
// ============================================================
//  Topic  : RAG pipeline, document chunking, knowledge base,
//           retrieval, prompt augmentation, grounded generation
//
//  WHY: LLMs hallucinate. RAG solves this by retrieving real
//  documents, augmenting the prompt with context, so the model
//  generates answers grounded in actual data with citations.
// ============================================================

// ============================================================
// STORY: NDLI — National Digital Library of India
// IIT Kharagpur's NDLI hosts 90M+ academic resources. A
// researcher asking about "ISRO's Mars mission fuel efficiency"
// gets an intelligent answer synthesized from multiple papers,
// with citations to exact paragraphs. No hallucinated facts.
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

var geminiAPIKey38 = os.Getenv("GEMINI_API_KEY")
var simulatedMode38 = geminiAPIKey38 == ""

func init() {
	if simulatedMode38 {
		fmt.Println("  SIMULATED MODE — pre-written demo data.")
		fmt.Println()
	}
}

// ============================================================
// SECTION 1 — What Is RAG?
// ============================================================
// Without RAG: LLM answers from training memory (may hallucinate).
// With RAG: Retrieve docs -> Augment prompt -> Generate grounded answer.
// The LLM becomes a REASONING engine over YOUR data.

func demoRAGConcept() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 1: What Is RAG?")
	fmt.Println("============================================================")
	fmt.Println("  Without RAG: Question -> LLM (memory) -> Maybe correct")
	fmt.Println("  With RAG:    Question -> Retrieve docs -> LLM+context -> Grounded answer")
	fmt.Println("  Key: answer is anchored to real documents with citations.")
	fmt.Println()
}

// ============================================================
// SECTION 2 — Document Chunking
// ============================================================
// Three strategies: fixed-size, sentence-based, overlap.

type Document struct {
	ID, Title, Content, Source string
}

type Chunk struct {
	ID, DocID, DocTitle, Text string
	Vector                    []float32
}

func chunkByFixedSize(text string, size, overlap int) []string {
	if size <= 0 {
		return nil
	}
	if overlap >= size {
		overlap = size / 4
	}
	var chunks []string
	for start := 0; start < len(text); start += size - overlap {
		end := start + size
		if end > len(text) {
			end = len(text)
		}
		chunks = append(chunks, strings.TrimSpace(text[start:end]))
	}
	return chunks
}

func chunkBySentence(text string, maxSize int) []string {
	sentences := splitSentences(text)
	var chunks []string
	var current strings.Builder
	for _, s := range sentences {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if current.Len() > 0 && current.Len()+len(s)+1 > maxSize {
			chunks = append(chunks, strings.TrimSpace(current.String()))
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteString(" ")
		}
		current.WriteString(s)
	}
	if current.Len() > 0 {
		chunks = append(chunks, strings.TrimSpace(current.String()))
	}
	return chunks
}

func splitSentences(text string) []string {
	var sentences []string
	var cur strings.Builder
	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		cur.WriteRune(runes[i])
		if (runes[i] == '.' || runes[i] == '!' || runes[i] == '?') &&
			(i+1 >= len(runes) || runes[i+1] == ' ' || runes[i+1] == '\n') {
			sentences = append(sentences, cur.String())
			cur.Reset()
		}
	}
	if cur.Len() > 0 {
		sentences = append(sentences, cur.String())
	}
	return sentences
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func demoChunking() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 2: Chunking Strategies")
	fmt.Println("============================================================")

	text := `ISRO was founded in 1969 by Dr. Vikram Sarabhai. Aryabhata launched April 19, 1975. In 1980 India achieved orbital capability with SLV-3. Mangalyaan launched November 5, 2013, making India first Asian nation to reach Mars. Chandrayaan-3 landed near the Moon's south pole on August 23, 2023.`

	fmt.Println("\n  Fixed-size (150 chars, no overlap):")
	for i, c := range chunkByFixedSize(text, 150, 0) {
		fmt.Printf("  %d: %q\n", i+1, truncate(c, 60))
	}
	fmt.Println("\n  Sentence-based (200 chars max):")
	for i, c := range chunkBySentence(text, 200) {
		fmt.Printf("  %d: %q\n", i+1, truncate(c, 60))
	}
	fmt.Println()
}

// ============================================================
// SECTION 3 — Knowledge Base (Chunk -> Embed -> Store)
// ============================================================

type RAGVectorEntry struct {
	ChunkID, DocID, DocTitle, Text string
	Vector                         []float32
}

type RAGSearchResult struct {
	Entry      RAGVectorEntry
	Similarity float64
}

type KnowledgeBase struct {
	entries      []RAGVectorEntry
	chunkCounter int
}

func NewKnowledgeBase() *KnowledgeBase {
	return &KnowledgeBase{entries: make([]RAGVectorEntry, 0)}
}

func (kb *KnowledgeBase) Ingest(docs []Document) {
	for _, doc := range docs {
		for _, chunk := range chunkBySentence(doc.Content, 200) {
			kb.chunkCounter++
			kb.entries = append(kb.entries, RAGVectorEntry{
				ChunkID: fmt.Sprintf("chunk-%04d", kb.chunkCounter),
				DocID: doc.ID, DocTitle: doc.Title, Text: chunk,
				Vector: ragSimulateEmbedding(chunk),
			})
		}
	}
}

func (kb *KnowledgeBase) Retrieve(query string, topK int) []RAGSearchResult {
	qVec := ragSimulateEmbedding(query)
	results := make([]RAGSearchResult, 0, len(kb.entries))
	for _, e := range kb.entries {
		results = append(results, RAGSearchResult{Entry: e, Similarity: ragCosineSimilarity(qVec, e.Vector)})
	}
	sort.Slice(results, func(i, j int) bool { return results[i].Similarity > results[j].Similarity })
	if topK > len(results) {
		topK = len(results)
	}
	return results[:topK]
}

func (kb *KnowledgeBase) Size() int { return len(kb.entries) }

// ============================================================
// SECTION 4 — Embedding & Similarity (RAG-specific)
// ============================================================

const ragEmbeddingDim = 64

func ragSimulateEmbedding(text string) []float32 {
	vec := make([]float32, ragEmbeddingDim)
	text = strings.ToLower(text)
	groups := map[string][]int{
		"isro": {0, 1, 2}, "space": {0, 1, 3}, "satellite": {1, 4, 5},
		"launch": {2, 5, 6}, "mars": {9, 10, 11}, "mangalyaan": {9, 10, 12},
		"moon": {13, 14, 15}, "chandrayaan": {13, 14, 16}, "mission": {5, 8, 19},
		"pslv": {6, 20, 21}, "sarabhai": {0, 18, 23},
		"iit": {24, 25, 26}, "kharagpur": {24, 25, 27}, "research": {26, 28, 29},
		"ayurveda": {36, 37, 38}, "turmeric": {41, 44, 45}, "neem": {41, 44, 46},
		"medicine": {37, 38, 39}, "health": {39, 42, 43},
		"india": {47, 48}, "indian": {47, 48}, "cost": {11, 55}, "budget": {55, 56},
		"fuel": {10, 54}, "efficiency": {11, 54}, "founded": {23, 33},
	}
	for _, w := range strings.Fields(text) {
		if dims, ok := groups[w]; ok {
			for _, d := range dims {
				vec[d] += 1.0
			}
		}
		h := uint32(0)
		for _, ch := range w {
			h = h*31 + uint32(ch)
		}
		vec[int(h%uint32(ragEmbeddingDim))] += 0.3
	}
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

func ragCosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) {
		return 0.0
	}
	var dot, mA, mB float64
	for i := range a {
		ai, bi := float64(a[i]), float64(b[i])
		dot += ai * bi
		mA += ai * ai
		mB += bi * bi
	}
	mA, mB = math.Sqrt(mA), math.Sqrt(mB)
	if mA == 0 || mB == 0 {
		return 0.0
	}
	return dot / (mA * mB)
}

// ============================================================
// SECTION 5 — Prompt Augmentation
// ============================================================

func buildAugmentedPrompt(question string, chunks []RAGSearchResult) string {
	var b strings.Builder
	b.WriteString("You are an NDLI research assistant. Answer ONLY from provided context.\n")
	b.WriteString("Cite sources as [Source: DocTitle]. Say if context is insufficient.\n\n")
	b.WriteString("=== CONTEXT ===\n")
	for i, r := range chunks {
		b.WriteString(fmt.Sprintf("[Doc %d: %s (%.2f)] %s\n\n", i+1, r.Entry.DocTitle, r.Similarity, r.Entry.Text))
	}
	b.WriteString("=== QUESTION ===\n" + question + "\n")
	return b.String()
}

func demoPromptAugmentation() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 3: Prompt Augmentation")
	fmt.Println("============================================================")
	question := "When did ISRO's Mars mission launch?"
	fakeResults := []RAGSearchResult{
		{Entry: RAGVectorEntry{DocTitle: "ISRO Mars Orbiter", Text: "Mangalyaan launched November 5, 2013."}, Similarity: 0.94},
	}
	prompt := buildAugmentedPrompt(question, fakeResults)
	fmt.Printf("  Question: %s\n  Augmented prompt (%d chars) includes context + grounding rules.\n\n", question, len(prompt))
}

// ============================================================
// SECTION 6 — Complete RAG Pipeline
// ============================================================

type Citation struct {
	DocTitle, ChunkText string
	Relevance           float64
}

type RAGResponse struct {
	Question string
	Answer   string
	Sources  []Citation
}

type RAGPipeline struct {
	KB        *KnowledgeBase
	ModelName string
}

func NewRAGPipeline(model string) *RAGPipeline {
	return &RAGPipeline{KB: NewKnowledgeBase(), ModelName: model}
}

func (rp *RAGPipeline) Ingest(docs []Document) { rp.KB.Ingest(docs) }

func (rp *RAGPipeline) Query(question string, topK int) RAGResponse {
	retrieved := rp.KB.Retrieve(question, topK)
	answer := rp.simulateGeneration(question, retrieved)
	citations := make([]Citation, 0, len(retrieved))
	for _, r := range retrieved {
		citations = append(citations, Citation{DocTitle: r.Entry.DocTitle, ChunkText: r.Entry.Text, Relevance: r.Similarity})
	}
	return RAGResponse{Question: question, Answer: answer, Sources: citations}
}

func (rp *RAGPipeline) simulateGeneration(question string, retrieved []RAGSearchResult) string {
	q := strings.ToLower(question)
	switch {
	case strings.Contains(q, "mars"):
		return `Mangalyaan launched November 5, 2013. Cost Rs 450 crore ($74M) — cheapest Mars mission ever. India became first Asian nation to reach Mars orbit on its maiden attempt. [Source: ISRO Mars Orbiter Mission]`
	case strings.Contains(q, "chandrayaan") || strings.Contains(q, "moon"):
		return `Chandrayaan-3 landed near the Moon's south pole on August 23, 2023, making India the fourth country to soft-land on the Moon. [Source: ISRO History and Milestones]`
	case strings.Contains(q, "iit") && strings.Contains(q, "kharagpur"):
		return `IIT Kharagpur was established August 18, 1951 as India's first IIT, on the site of the Hijli Detention Camp. [Source: IIT Kharagpur History]`
	case strings.Contains(q, "ayurveda") || strings.Contains(q, "turmeric"):
		return `Curcumin in turmeric shows significant anti-inflammatory properties in clinical trials at AIIMS and IIT Delhi. [Source: Ayurveda Research in Modern India]`
	default:
		if len(retrieved) > 0 {
			return fmt.Sprintf("Based on documents: %s [Source: %s]", truncate(retrieved[0].Entry.Text, 150), retrieved[0].Entry.DocTitle)
		}
		return "Insufficient context to answer this question."
	}
}

// ============================================================
// SECTION 7 — End-to-End Demo
// ============================================================

func getNDLIDocuments() []Document {
	return []Document{
		{ID: "NDLI-001", Title: "ISRO History and Milestones", Source: "ISRO, 2024",
			Content: `ISRO was founded August 15, 1969 by Dr. Vikram Sarabhai. Aryabhata launched April 19, 1975. Rohini satellite launched 1980 using SLV-3. PSLV became one of the most reliable rockets. Chandrayaan-1 (2008) discovered water on the Moon. Chandrayaan-3 landed near the Moon's south pole August 23, 2023.`},
		{ID: "NDLI-002", Title: "ISRO Mars Orbiter Mission", Source: "Journal of Spacecraft Technology, 2014",
			Content: `Mangalyaan launched November 5, 2013 from Sriharikota using PSLV-C25. Entered Mars orbit September 24, 2014. India became first Asian nation to reach Mars, first to do so on maiden attempt. Carried five instruments including methane sensor. Operated over eight years.`},
		{ID: "NDLI-003", Title: "ISRO Budget and Cost Efficiency", Source: "Economic Analysis, 2023",
			Content: `Mars Orbiter Mission cost Rs 450 crore ($74M), cheapest Mars mission ever. Hollywood's Gravity cost $100M — more than India's Mars mission. Chandrayaan-3 cost Rs 615 crore. Cost efficiency from frugal engineering, indigenous components, gravity-assist maneuvers.`},
		{ID: "NDLI-004", Title: "IIT Kharagpur History", Source: "IIT KGP Publication",
			Content: `IIT Kharagpur established August 18, 1951 as first IIT. Located on site of Hijli Detention Camp. First batch: 224 students. Campus spans 2,100 acres. Alumni: Sundar Pichai, Arvind Krishna, Raghuram Rajan.`},
		{ID: "NDLI-005", Title: "Ayurveda Research in Modern India", Source: "Indian J Traditional Knowledge, 2023",
			Content: `Curcumin in turmeric has 12,000+ published studies showing anti-inflammatory and antioxidant properties. Neem extracts effective against 200+ insect species. Ashwagandha shows adaptogenic properties in RCTs. Ministry of AYUSH (2014) promotes research.`},
	}
}

func demoEndToEnd() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 4: End-to-End RAG (NDLI Academic Search)")
	fmt.Println("============================================================")

	rag := NewRAGPipeline("gemini-1.5-pro")
	docs := getNDLIDocuments()
	rag.Ingest(docs)
	fmt.Printf("  Ingested %d docs -> %d chunks\n\n", len(docs), rag.KB.Size())

	queries := []string{
		"When did ISRO's Mars mission launch and what made it special?",
		"Tell me about Chandrayaan-3 Moon landing",
		"What is the history of IIT Kharagpur?",
		"What does modern research say about turmeric?",
	}

	for i, q := range queries {
		resp := rag.Query(q, 3)
		fmt.Printf("  Q%d: %s\n  A: %s\n", i+1, q, truncate(resp.Answer, 120))
		for j, c := range resp.Sources {
			fmt.Printf("  [%d] %s (%.4f)\n", j+1, c.DocTitle, c.Relevance)
		}
		fmt.Println()
	}
}

// wordWrap splits text at word boundaries.
func wordWrap(text string, maxWidth int) []string {
	words := strings.Fields(text)
	var lines []string
	var cur strings.Builder
	for _, w := range words {
		if cur.Len() > 0 && cur.Len()+1+len(w) > maxWidth {
			lines = append(lines, cur.String())
			cur.Reset()
		}
		if cur.Len() > 0 {
			cur.WriteString(" ")
		}
		cur.WriteString(w)
	}
	if cur.Len() > 0 {
		lines = append(lines, cur.String())
	}
	return lines
}

// ============================================================
// SECTION 8 — Key Takeaways
// ============================================================

func printRAGTakeaways() {
	fmt.Println("============================================================")
	fmt.Println("KEY TAKEAWAYS — RAG")
	fmt.Println("============================================================")
	fmt.Println("  1. RAG = Retrieve + Augment + Generate")
	fmt.Println("  2. Chunking: fixed-size, sentence-based, or overlap")
	fmt.Println("  3. KB pipeline: Doc -> Chunk -> Embed -> Store (offline)")
	fmt.Println("  4. Prompt: system instruction + context + question")
	fmt.Println("  5. Grounding prevents hallucination — cite sources")
	fmt.Println("  6. Production: vector DB, re-ranking, hybrid search")
	fmt.Println()
}

// ============================================================
// MAIN
// ============================================================

func main() {
	fmt.Println()
	fmt.Println("============================================================")
	fmt.Println("  FILE 38 : AI — RAG Basics (NDLI Academic Search)")
	fmt.Println("============================================================")
	fmt.Println()

	demoRAGConcept()
	demoChunking()
	demoPromptAugmentation()
	demoEndToEnd()
	printRAGTakeaways()
}
