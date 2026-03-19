# Recording Guide: Pincode Lookup API

Total estimated recording time: 25-30 minutes

---

## Step 1: main.py — Create the skeleton app (3 min)

**Why this file first:** Same pattern as before — get a running app immediately so the audience sees results fast.

**What to create:** Import FastAPI, create the app with title and description, add a root endpoint.

**What to explain on camera:**
- Briefly recap FastAPI app creation (this is project 2, so keep it quick)
- Mention the client use case: auto-fill city/state during checkout
- Run the app and show `/docs`

**Key moment:** Mention that this project will focus on validation and error handling.

---

## Step 2: data.py — Pincode dictionary (5 min)

**Why this file:** We need a lookup table of real Indian pincodes. A dictionary is perfect because pincode lookup is a key-value operation.

**What to create:** A dictionary called `pincode_db` with 15 real Indian pincodes as keys, each mapping to city, state, and district info.

**What to explain on camera:**
- Why a dict instead of a list — O(1) lookup by pincode
- These are real pincodes for real cities (audience can verify)
- In production this would be a database or external API

**Key moment:** Point out that the pincode is the key AND inside the value — explain why (the value needs to be a complete response).

---

## Step 3: models.py — Pydantic models with validators (7 min)

**Why this file:** This is where the project gets interesting. We'll add input validation that goes beyond basic type checking.

**What to create:** `PincodeRequest` with a `field_validator` that checks 6-digit format. `LocationResponse` for output. `BulkRequest` with list validation. `BulkResponse` with found/missing counts.

**What to explain on camera:**
- `field_validator` decorator — runs custom logic before the data reaches your endpoint
- `@classmethod` is required by Pydantic v2 for validators
- Why validate in the model, not in the endpoint (single source of truth)
- The bulk models — show how lists get validated element by element
- `BulkResponse` returns both found results AND missing pincodes — good API design

**Key moment:** Show what happens when you send an invalid pincode — Pydantic returns a 422 with a clear error message automatically.

---

## Step 4: exceptions.py — Custom error handling (5 min)

**Why this file:** FastAPI's default HTTPException works, but custom exceptions give you structured, consistent error responses that frontend devs love.

**What to create:** Two exception classes (`PincodeNotFoundError`, `InvalidPincodeError`) and their handler functions that return formatted JSON responses.

**What to explain on camera:**
- Why custom exceptions over generic HTTPException — cleaner code, consistent error format
- Exception handlers are async functions that take `request` and `exc`
- The handler returns a `JSONResponse` with a custom status code and body
- This pattern scales well — add more exception types as your API grows

**Key moment:** Show the clean error JSON structure with `error`, `message`, and `pincode` fields.

---

## Step 5: main.py — Wire everything together (7 min)

**Why back to this file:** Now we connect data, models, and exceptions into working endpoints.

**What to add:** Import everything. Register exception handlers with `app.add_exception_handler()`. Add `GET /pincode/{code}` that validates and looks up. Add `POST /pincode/bulk` that handles multiple pincodes.

**What to explain on camera:**
- `app.add_exception_handler()` connects our custom exceptions to their handlers
- The GET endpoint validates format first, then checks if pincode exists
- The POST endpoint accepts a JSON body (Pydantic model = automatic parsing)
- Walk through the bulk endpoint logic — separate found and missing pincodes
- Demo in Swagger: try a valid pincode, an invalid format, a valid-but-missing pincode

**Key moment:** Demo all three error scenarios live — invalid format (400), not found (404), and Pydantic validation error (422).

---

## Wrap-up checklist
- [ ] App runs with `uvicorn main:app --reload`
- [ ] `GET /pincode/110001` returns Delhi info
- [ ] `GET /pincode/abc` returns 400 with custom error
- [ ] `GET /pincode/999999` returns 404 with custom error
- [ ] `POST /pincode/bulk` with mixed pincodes returns found and missing
- [ ] Swagger docs show all models and error responses
