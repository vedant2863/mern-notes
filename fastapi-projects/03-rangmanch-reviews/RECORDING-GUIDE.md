# Recording Guide: Rangmanch Reviews API

Total estimated recording time: 30-35 minutes

---

## Step 1: models.py — Define the Review table (7 min)

**Why this file first:** Always start with "what are we storing?" The model defines the shape of your data and drives everything else.

**What to create:** The `Review` SQLModel table class with id, play_name, reviewer_name, rating (1-5), comment, and created_at. Plus three schema classes: `ReviewCreate` (input), `ReviewRead` (output), `ReviewUpdate` (partial update).

**What to explain on camera:**
- SQLModel combines SQLAlchemy (database) and Pydantic (validation) into one class
- `table=True` makes it a database table, without it, it's just a Pydantic model
- `Field(ge=1, le=5)` adds validation — rating must be 1 to 5
- `Optional[int]` with `primary_key=True` — the database auto-generates the id
- Why separate Create/Read/Update schemas — the client sends different data than they receive
- `ReviewUpdate` has all optional fields because PATCH means "update only what's sent"

**Key moment:** Draw the distinction between the table model and the schema models. Same library, different purposes.

---

## Step 2: database.py — Engine and session (5 min)

**Why this file:** The engine connects to SQLite, and the session dependency will be injected into every route that needs the database.

**What to create:** Database URL for SQLite, engine with `echo=True`, a `create_tables` function, and a `get_session` generator dependency.

**What to explain on camera:**
- SQLite needs no setup — the file is created automatically
- `echo=True` prints SQL to the console, great for learning (disable in production)
- `get_session` is a generator with `yield` — FastAPI calls it per request and cleans up after
- This is dependency injection — routes don't create sessions, they receive them

**Key moment:** Explain the `yield` pattern — everything before yield is setup, everything after is cleanup.

---

## Step 3: main.py — Lifespan and app setup (5 min)

**Why this file:** We need the app to create database tables on startup. The lifespan context manager is the modern way to do this in FastAPI.

**What to create:** An async context manager for lifespan that calls `create_tables()` on startup. Create the FastAPI app with the lifespan. Include the reviews router.

**What to explain on camera:**
- `@asynccontextmanager` — code before `yield` runs on startup, after `yield` on shutdown
- This replaces the old `@app.on_event("startup")` pattern
- `app.include_router()` keeps main.py clean — routes live in their own files
- Run the app and show "Database tables created" in the terminal

**Key moment:** Show the terminal output confirming tables were created, and point out the new `rangmanch.db` file.

---

## Step 4: routes/reviews.py — CRUD endpoints one by one (15 min)

**Why this file:** This is the core of the project. Build each endpoint one at a time and test it before moving to the next.

**What to create:** A router with all CRUD operations: POST (create), GET list (with filter + pagination), GET by id, PATCH (update), DELETE. Plus a special GET endpoint for average rating per play.

**What to explain on camera (build each endpoint and test):**

1. **POST /reviews/** — Create a review
   - `Review(**review.model_dump())` converts the Pydantic model to a DB object
   - `session.add()`, `session.commit()`, `session.refresh()` — the three-step pattern
   - Test: create 3-4 reviews for different plays

2. **GET /reviews/** — List with filter and pagination
   - `Query` parameters for play_name, skip, and limit
   - Building the query step by step with `.where()`, `.offset()`, `.limit()`
   - Test: list all, filter by play, try skip/limit

3. **GET /reviews/average/{play_name}** — Aggregation
   - `func.avg()` and `func.count()` — SQL functions via SQLModel
   - Return a custom dict (no model needed for one-off responses)
   - Test: check average for a play with multiple reviews

4. **GET /reviews/{review_id}** — Single review
   - `session.get()` is the simplest way to fetch by primary key
   - 404 if not found

5. **PATCH /reviews/{review_id}** — Partial update
   - `model_dump(exclude_unset=True)` — only fields the client actually sent
   - `setattr()` to update dynamically
   - Test: update just the rating, then just the comment

6. **DELETE /reviews/{review_id}** — Remove a review
   - `session.delete()` and commit

**Key moment:** The PATCH endpoint with `exclude_unset=True` is the star of this file. Show how sending `{"rating": 5}` updates only the rating and leaves the comment unchanged.

---

## Wrap-up checklist
- [ ] App creates `rangmanch.db` on startup
- [ ] Can create reviews via POST
- [ ] Can list and filter reviews with pagination
- [ ] Average rating endpoint works
- [ ] PATCH updates only the fields you send
- [ ] DELETE removes a review
- [ ] 404 errors for missing reviews
