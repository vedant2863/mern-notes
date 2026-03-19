# Recording Guide — Netra Vision API

## Episode Overview

Build an AI-powered crop disease detection API using Gemini Vision. Upload plant photos, get disease diagnosis and treatment plans. Teach multimodal AI, image processing, and batch operations.

Total estimated recording time: 50-60 minutes

---

## Step 1: config.py (3 min)

**Open:** `config.py`

**Explain:**
- API key configuration, same pattern as previous project
- Image-specific settings: MAX_FILE_SIZE_MB, ALLOWED_IMAGE_TYPES
- MAX_IMAGE_DIMENSION for resizing — Gemini works best with reasonable image sizes
- MongoDB settings

**Key talking point:** "Image APIs need size limits. Large images waste API credits and slow things down."

---

## Step 2: services/image_processor.py (8 min)

**Open:** `services/image_processor.py`

**Explain:**
- `validate_image` — checks content type, file size, and if it's a valid image
- Opens with Pillow to verify it's actually an image (not a renamed file)
- Returns a dict with validation status and image metadata
- `resize_image_if_needed` — maintains aspect ratio, uses LANCZOS filter
- Calculates new dimensions proportionally
- Saves back to bytes (not to disk yet)
- `save_image` — simple file save utility

**Key talking point:** "Always validate uploads server-side. Never trust the client. Pillow also catches corrupted files."

---

## Step 3: services/gemini_vision.py (10 min)

**Open:** `services/gemini_vision.py`

**Explain:**
- The prompt — structured like previous project but for crop analysis
- Walk through the expected JSON structure: crop, severity, diseases, treatments
- `analyze_crop_image` function:
  - Base64 encoding — Gemini expects images as base64 strings
  - The multimodal request body — text + inlineData parts
  - Point out `mimeType` and `data` fields in inlineData
  - Same response parsing pattern: extract text, clean markdown, parse JSON
- Temperature 0.3 for consistent results

**Key talking point:** "The magic is in the request body. We send both the prompt text and the image in the same 'parts' array. This is multimodal AI."

**Compare with Project 14:** "Same Gemini API, but now we're sending images instead of text. The prompt structure changes but the API call pattern is identical."

---

## Step 4: models.py (5 min)

**Open:** `models.py`

**Explain:**
- SeverityLevel enum — healthy through critical
- Disease model — name, confidence score, description
- Treatment model — includes treatment_type (organic/chemical/preventive) and urgency
- CropAnalysis — the main model tying everything together
- Point out how these models match the JSON structure in the prompt

**Key talking point:** "The enum for severity gives us type safety. We can filter by severity in queries later."

---

## Step 5: database.py (2 min)

**Open:** `database.py`

**Explain:**
- Standard Motor setup, single collection
- Three indexes: upload_date (for sorting), crop_detected (for filtering), severity (for filtering)
- These indexes power the query filters in the history endpoint

---

## Step 6: routes/analyze.py (12 min)

**Open:** `routes/analyze.py`

**Explain:**
- Start with `process_single_image` helper — shared between single and batch
- Walk through the pipeline: read bytes, validate, resize, generate filename, save, analyze, store
- POST `/analyze/` — single image endpoint
  - Checks for API key first
  - Calls process_single_image
  - Returns summary (not full analysis)
- POST `/analyze/batch` — multiple images
  - Limit of 5 images per batch
  - Loop through files, try/except per file
  - Collects results and errors separately
  - One bad image doesn't kill the whole batch

**Key talking point:** "The batch endpoint is forgiving. If one image fails, the others still get processed. Always separate results from errors."

---

## Step 7: routes/history.py (8 min)

**Open:** `routes/history.py`

**Explain:**
- GET `/analyses/` — list with filters
  - Query parameters: crop, severity, skip, limit
  - MongoDB regex for case-insensitive crop search
  - Excludes large fields (diseases, treatments) in list view
  - Sorted by upload_date descending (newest first)
- GET `/analyses/{id}` — full details for one analysis
- GET `/analyses/stats/summary` — aggregation pipeline
  - Group by severity for counts
  - Group by crop for top crops
  - This is a MongoDB aggregation pipeline demo

**Key talking point:** "The stats endpoint shows MongoDB aggregation in action. Group, count, sort — all in one query."

---

## Step 8: main.py (3 min)

**Open:** `main.py`

**Explain:**
- Same clean pattern: FastAPI app, startup event, include routers
- Root endpoint with self-documenting routes

**Demo:** Run the server and show:
1. Upload a plant photo via Swagger UI or curl
2. Show the analysis result — crop detected, diseases, treatments
3. Upload a batch of 2-3 images
4. List analyses with crop filter
5. Show stats endpoint

---

## Wrap-Up Talking Points

- Gemini Vision for multimodal analysis (text + image)
- Image validation and preprocessing before sending to AI
- Base64 encoding for API transmission
- Batch processing with per-item error handling
- MongoDB aggregation for analytics
- Same patterns from Project 14 (Gemini text) extended to images
