# Recording Guide: Chai Point Menu API

Total estimated recording time: 20-25 minutes

---

## Step 1: main.py — Create the skeleton app (5 min)

**Why this file first:** We want to show the audience a working FastAPI app immediately. Start with the smallest possible app so they see results in the browser right away.

**What to create:** Import FastAPI, create the app instance with a title and description, add just the root `/` endpoint that returns a welcome message.

**What to explain on camera:**
- What FastAPI is and why it's popular (async, auto-docs, type hints)
- The `app = FastAPI()` object is the core of everything
- Show `uvicorn main:app --reload` in the terminal
- Open the browser to `/docs` — highlight the auto-generated Swagger UI

**Key moment:** First time the audience sees the app running and the `/docs` page.

---

## Step 2: data.py — Add menu items (5 min)

**Why this file:** Before building endpoints, we need data to serve. Keeping data separate from the app is a clean pattern the audience should learn early.

**What to create:** A list of dictionaries called `menu_items` with 10 items across three categories — chai, snacks, and combos. Each item has id, name, category, price, description, and available fields.

**What to explain on camera:**
- Why we keep data in its own file (separation of concerns)
- In production this would be a database, but dicts work great for learning
- Point out the three categories — we'll filter by these later
- One item has `available: False` — we might use that for filtering

**Key moment:** Explain that this file is a stand-in for a database and this pattern scales well.

---

## Step 3: models.py — Define Pydantic models (5 min)

**Why this file:** Pydantic models tell FastAPI what shape our responses should be. This gives us automatic validation and clean documentation.

**What to create:** Two models — `MenuItem` with all the fields matching our data, and `MenuResponse` that wraps a list of items with a status and count.

**What to explain on camera:**
- Pydantic BaseModel and how it validates data automatically
- How `response_model` in FastAPI uses these to shape output
- The `MenuResponse` wrapper pattern — APIs usually return metadata alongside data
- Type hints are not just decoration; FastAPI uses them for docs and validation

**Key moment:** Show how the types map directly to what appears in the Swagger docs.

---

## Step 4: main.py — Wire up the real endpoints (7 min)

**Why back to this file:** Now we have data and models, so we can build the actual API endpoints that bring everything together.

**What to add:** Import data and models. Add `GET /menu` with an optional `category` query parameter. Add `GET /menu/{item_id}` with a path parameter.

**What to explain on camera:**
- `Query(None)` makes the parameter optional — explain the difference between path and query params
- List comprehension to filter by category — simple and readable
- `response_model=MenuResponse` tells FastAPI to validate and document the response
- `HTTPException(404)` for missing items — proper error handling from day one
- Walk through each endpoint in the Swagger UI, test with different inputs

**Key moment:** Show filtering by category in `/docs`, then try an invalid ID to show the 404 error.

---

## Wrap-up checklist
- [ ] App runs with `uvicorn main:app --reload`
- [ ] `/docs` shows all three endpoints
- [ ] `/menu` returns all 10 items
- [ ] `/menu?category=chai` returns only chai items
- [ ] `/menu/1` returns Masala Chai
- [ ] `/menu/99` returns a 404 error
