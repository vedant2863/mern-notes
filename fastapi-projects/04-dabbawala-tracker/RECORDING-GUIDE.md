# Recording Guide: Dabbawala Tracker API

Total estimated recording time: 30-35 minutes

---

## Step 1: models.py — Order model and status enum (7 min)

**Why this file first:** Define the states an order can be in before writing any logic. The enum is the backbone of this project.

**What to create:** `OrderStatus` enum with four values (preparing, picked_up, in_transit, delivered). `Order` SQLModel table with customer_name, delivery_address, items, status, created_at, and updated_at. Schema classes: `OrderCreate`, `OrderUpdate`, and `StatusLog`.

**What to explain on camera:**
- `str, Enum` — making it a string enum means it serializes nicely to JSON
- The four statuses represent real-world checkpoints in tiffin delivery
- `default=OrderStatus.preparing` — every new order starts at preparing
- `updated_at` tracks when the status last changed
- `OrderUpdate` has optional fields — PATCH only sends what changes
- `StatusLog` shows the before/after of a status change — useful for tracking

**Key moment:** Explain why Enum over plain strings — typo prevention, auto-complete in docs, and Swagger shows a dropdown.

---

## Step 2: database.py — Engine and session (3 min)

**Why this file:** Same pattern as the reviews project. Quick setup since the audience has seen this before.

**What to create:** SQLite engine, `create_tables` function, `get_session` dependency.

**What to explain on camera:**
- Same pattern as project 3 — reinforce the muscle memory
- Keep it brief, the audience knows this now

**Key moment:** Mention that this identical pattern works with PostgreSQL — just change the URL.

---

## Step 3: routes/orders.py — CRUD with filters and PATCH (12 min)

**Why this file:** The order endpoints are the core business logic. Build them one at a time.

**What to create:** A router with POST (create order), GET list (filter by status AND date), GET by id, and PATCH (update status).

**What to explain on camera:**

1. **POST /orders/** — Create an order
   - New orders always start as "preparing"
   - Quick create-and-test cycle

2. **GET /orders/** — List with multi-param filtering
   - `status` filter uses the Enum — Swagger shows a dropdown
   - `created_date` filter uses Python's `date` type — FastAPI parses "YYYY-MM-DD" automatically
   - `datetime.combine()` to create start/end of day for date range filtering
   - Show how both filters can work together

3. **GET /orders/{order_id}** — Single order lookup
   - Simple `session.get()` pattern

4. **PATCH /orders/{order_id}** — Status update
   - Save the old status before updating
   - `exclude_unset=True` for partial updates
   - Update `updated_at` timestamp manually
   - Return a `StatusLog` showing old vs new status — the delivery staff sees confirmation

**Key moment:** The PATCH endpoint returning a StatusLog is the highlight. Show updating an order from "preparing" to "picked_up" and the response showing both statuses.

---

## Step 4: routes/stats.py — Daily summary (5 min)

**Why this file:** Real apps need dashboards. This endpoint powers a "how's today going?" view for the operations team.

**What to create:** A single `GET /stats/daily` endpoint that counts orders by status for a given date.

**What to explain on camera:**
- Default to today's date if no date parameter is given
- Loop through all enum values and count orders for each status
- `func.count()` with `.where()` for filtered aggregation
- The response is a clean summary: total orders and breakdown by status

**Key moment:** Create several orders, update some to different statuses, then hit the stats endpoint. Show the real-time summary.

---

## Step 5: main.py — Wire the routers (3 min)

**Why this file last:** With both routers built and tested individually, wiring them into the app is the final step.

**What to create:** Lifespan context manager for table creation. FastAPI app. Include both routers.

**What to explain on camera:**
- Two routers, one app — each router owns its URL prefix
- `include_router` keeps main.py clean
- Show the final `/docs` page with both "orders" and "stats" tag groups

**Key moment:** The final Swagger UI showing all endpoints organized by tags — orders and stats.

---

## Wrap-up checklist
- [ ] App creates `dabbawala.db` on startup
- [ ] Can create orders (they start as "preparing")
- [ ] Can list orders filtered by status and/or date
- [ ] PATCH updates status and returns old/new status log
- [ ] Swagger shows enum dropdown for status fields
- [ ] `/stats/daily` shows correct counts after creating and updating orders
- [ ] Both routers appear as separate sections in `/docs`
