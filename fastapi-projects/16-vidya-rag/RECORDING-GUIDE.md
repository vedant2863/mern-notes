# Vidya RAG — Recording Guide

## Episode Overview
**Duration:** ~45-55 minutes
**Theme:** Building a real RAG system — the most important AI architecture pattern in production today
**Hook:** "Every AI company uses RAG. Today we build one from scratch."

---

## Pre-Recording Checklist
- [ ] Gemini API key ready and working
- [ ] Python virtual environment activated
- [ ] All dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file configured
- [ ] Empty `chroma_data/` directory
- [ ] `sample_docs/sample_chapter.txt` file present
- [ ] Swagger UI ready to demo at the end

---

## Recording Order

### 1. services/chunker.py (5-6 min)
**Open with:** "Before an AI can answer questions about a document, it needs to read it. But here's the problem — documents are too long to send to an AI all at once. So we break them into small, overlapping pieces."

**Key points to explain:**
- Why we chunk (context window limits, precision of retrieval)
- Why overlap matters (a concept might span two chunks — overlap ensures we don't lose it)
- The recursive strategy: try paragraphs first, then sentences, then words
- Walk through the splitting logic step by step

**Highlight moment:** Show how a paragraph boundary is preferred over cutting mid-sentence

---

### 2. services/embedder.py (3-4 min)
**Open with:** "Now we have text chunks. But computers can't search by meaning in text — they need numbers. Embeddings convert text into arrays of numbers where similar meanings are close together."

**Key points to explain:**
- What embeddings are (text to number arrays)
- Why similar concepts end up near each other in vector space
- Single text vs batch embedding
- The Gemini embedding API call

**Highlight moment:** "The word 'fundamental rights' and 'basic freedoms' would have very similar embeddings even though the words are different"

---

### 3. services/vector_store.py (4-5 min)
**Open with:** "We have numbers representing our chunks. Now we need a special database that can search by similarity — not exact matching like SQL, but meaning matching."

**Key points to explain:**
- ChromaDB as a vector database (persistent storage)
- Collections are like tables, but for vectors
- Adding documents with metadata (we track which document each chunk came from)
- Querying by similarity (nearest neighbor search)
- Deleting by document ID (cleanup)

**Highlight moment:** "When you search a regular database, you find exact matches. When you search a vector database, you find similar meanings."

---

### 4. services/prompt_templates.py (3-4 min)
**Open with:** "We can find relevant chunks. Now we need to tell the AI exactly how to use them. This is prompt engineering for RAG — the secret to getting good, cited answers."

**Key points to explain:**
- System prompt sets the persona and rules
- The RAG prompt template has three parts: context, question, instructions
- Why we number the chunks (so the AI can cite them)
- The grounding instruction: "ONLY use information from the context"
- Building the context string with metadata

**Highlight moment:** "This prompt template is what separates a hallucinating chatbot from a reliable study tool"

---

### 5. services/rag_engine.py (6-7 min)
**Open with:** "This is the brain — the pipeline that connects everything. Embed the question, search for relevant chunks, build the prompt, generate, and extract citations."

**Key points to explain:**
- Walk through the 5-step pipeline (this is the most important file)
- Step 1: Question embedding (same process as document chunks)
- Step 2: Vector search (find chunks close to the question)
- Step 3: Build context with metadata
- Step 4: Send to Gemini with the grounded prompt
- Step 5: Create citation objects from the chunks used
- Handle the empty case (no documents uploaded yet)

**Highlight moment:** "This is the RAG pattern used by ChatGPT's file search, Google's AI search, and every enterprise AI tool. You just built it."

---

### 6. models.py (3-4 min)
**Open with:** "Now let's define the shape of our data — what a document looks like, what a question looks like, what an answer with citations looks like."

**Key points to explain:**
- DocumentCreate vs DocumentResponse
- Chunk model (internal representation)
- QuestionRequest and AnswerResponse
- Citation model — the key innovation (document title, chunk index, page estimate, relevant text)
- UploadResponse for feedback

---

### 7. database.py (3-4 min)
**Open with:** "ChromaDB stores vectors, but we also need regular SQL storage for document metadata and analytics."

**Key points to explain:**
- SQLite for document metadata tracking
- Questions log for analytics
- Simple CRUD operations
- Why two databases (vectors in ChromaDB, metadata in SQLite)

---

### 8. routes/documents.py (5-6 min)
**Open with:** "Time for the API. This is where users upload their study materials and the whole ingestion pipeline kicks off."

**Key points to explain:**
- File upload with multipart form
- The upload pipeline: read file, chunk text, embed chunks, store in both databases
- Generating chunk IDs and metadata
- Page number estimation
- List and delete endpoints
- Delete must clean up BOTH databases

**Highlight moment:** "One API call triggers the entire ingestion pipeline — chunk, embed, store. That's the power of good architecture."

---

### 9. routes/questions.py (3-4 min)
**Open with:** "The moment of truth — students ask questions and get cited answers."

**Key points to explain:**
- Simple endpoint that delegates to the RAG engine
- The request takes a question and optional top_k
- Response includes answer AND citations
- We log every question for analytics

**Highlight moment:** Show how the response structure gives traceability

---

### 10. main.py (2-3 min)
**Open with:** "Wire everything together."

**Key points to explain:**
- FastAPI app with metadata
- Router inclusion
- Database init on startup
- Health check with vector store stats

---

### 11. config.py (1-2 min)
**Open with:** "Finally, all our configuration in one place."

**Key points to explain:**
- Environment variables for secrets
- Chunking parameters (size and overlap)
- Model names as constants
- Why config is separate from code

---

## Live Demo (5-7 min)
1. Start the server
2. Open Swagger UI
3. Upload the sample chapter
4. Show the response (chunk count)
5. Ask: "What are the six fundamental rights?"
6. Walk through the citations in the response
7. Ask: "What did Ambedkar say about Article 32?"
8. Show how different questions retrieve different chunks
9. Delete the document, show ChromaDB cleanup

## Closing Remarks
- "You just built a production RAG system — the same architecture behind enterprise AI tools"
- "Next steps: PDF parsing, multi-document search, answer quality scoring"
- "This is Project 16 — the capstone. RAG is the most valuable AI skill you can learn."
