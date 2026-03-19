# Recording Guide — Vakeel Contracts API

## Episode Overview

Build an AI-powered contract analysis API. Upload legal documents, extract text, send to Gemini for structured analysis, and get risk assessments. Teach Gemini integration, prompt engineering, and file handling.

Total estimated recording time: 55-65 minutes

---

## Step 1: config.py (3 min)

**Open:** `config.py`

**Explain:**
- Start with configuration — API key, upload settings, MongoDB URI
- Show ALLOWED_EXTENSIONS and MAX_FILE_SIZE_MB
- Mention that GEMINI_API_KEY is required for this project
- Show how dotenv loads from .env file

**Key talking point:** "Config first — we need to know what external services we're connecting to."

---

## Step 2: services/document_parser.py (6 min)

**Open:** `services/document_parser.py`

**Explain:**
- Two functions: one for PDF, one for TXT
- Walk through PDF extraction — PdfReader, iterate pages, join text
- Show the returned dict: text, page_count, word_count
- The `extract_text` router function picks the right parser by extension
- Mention that PyPDF2 handles most standard PDFs

**Key talking point:** "This is the bridge between uploaded files and AI — we need clean text to send to Gemini."

---

## Step 3: services/prompt_templates.py (8 min)

**Open:** `services/prompt_templates.py`

**Explain:**
- This is the heart of getting good AI output
- Walk through CONTRACT_ANALYSIS_PROMPT line by line
- Point out the JSON structure we're asking for — this is our "schema"
- Show the rules at the bottom — they guide the AI's behavior
- Briefly show the other prompts (clause extraction, risk assessment, summary)
- Explain why we say "Return ONLY the JSON" — prevents markdown wrapping

**Key talking point:** "Prompt engineering is about being specific. We tell Gemini exactly what JSON shape we want back."

---

## Step 4: services/gemini_analyzer.py (10 min)

**Open:** `services/gemini_analyzer.py`

**Explain:**
- The Gemini API URL — using gemini-2.0-flash model
- Walk through the API call: httpx.AsyncClient, POST request
- Show the request body structure (contents, generationConfig)
- Temperature 0.3 — we want consistent, focused output
- Text extraction from the response JSON
- The cleanup step — removing markdown code blocks Gemini sometimes adds
- JSON parsing and building AnalysisResult from the parsed data
- Error handling considerations

**Key talking point:** "The trick with LLM APIs is handling the output. We clean up the response and parse it into our Pydantic models."

---

## Step 5: models.py (5 min)

**Open:** `models.py`

**Explain:**
- RiskLevel enum — low, medium, high, critical
- Contract model — represents an uploaded document
- ClauseAnalysis and RiskFlag — individual analysis pieces
- AnalysisResult — the complete AI output, linked to a contract
- Show model_post_init for auto-setting dates

**Key talking point:** "These models mirror what we asked Gemini to return. The prompt and the models must match."

---

## Step 6: database.py (3 min)

**Open:** `database.py`

**Explain:**
- Standard Motor setup — async MongoDB driver
- Two collections: contracts and analyses
- Index on filename (unique) and contract_id (for lookups)

---

## Step 7: routes/contracts.py (10 min)

**Open:** `routes/contracts.py`

**Explain:**
- POST /upload — the file upload endpoint
- Walk through validation: extension check, size check
- File saving with UUID name (prevents conflicts)
- Text extraction using our document_parser service
- Creating the Contract record and saving to MongoDB
- Error handling — delete file if parsing fails
- GET endpoints — list all, get by ID
- Show the text_preview trick (return 500 chars instead of full text)

**Key talking point:** "File uploads need careful validation. Check the type, check the size, then process."

---

## Step 8: routes/analysis.py (8 min)

**Open:** `routes/analysis.py`

**Explain:**
- POST /analyze/{contract_id} — the main AI endpoint
- First check: is GEMINI_API_KEY configured?
- Find the contract, check it has text content
- Status management: uploaded -> analyzing -> analyzed (or error)
- Call gemini_analyzer service
- Save result to analyses collection
- Return a summary (not the full analysis — that's in GET)
- GET endpoints — full analysis by ID, all analyses for a contract

**Key talking point:** "Status tracking lets the frontend show progress. The user knows their contract is being analyzed."

**Demo tip:** Upload the sample_nda.txt, then run analysis. Show the structured output.

---

## Step 9: main.py (3 min)

**Open:** `main.py`

**Explain:**
- FastAPI app with startup event for database indexes
- Two routers: contracts and analysis
- Root endpoint lists all available routes

**Demo:** Run the server and walk through the full flow:
1. Upload sample_nda.txt
2. List contracts
3. Run analysis
4. View full analysis result
5. Show Swagger docs

---

## Wrap-Up Talking Points

- Gemini API for structured text analysis
- Prompt engineering — be specific about output format
- File upload validation and processing pipeline
- Service layer keeps AI logic separate from HTTP handling
- Status tracking for long-running operations
- The same pattern works for any document type — invoices, resumes, etc.
