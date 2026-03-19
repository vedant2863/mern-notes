# Recording Guide - Kirana POS

## Episode Overview
Build a POS system with PostgreSQL, Alembic migrations, and atomic transactions. This is the first project using a relational database instead of MongoDB.

## Estimated Duration: 50-60 minutes

---

## Step 1: docker-compose.yml — Start PostgreSQL (3 min)
- Show the docker-compose file — just PostgreSQL, not the app
- Run docker-compose up -d
- Explain why Docker for the database: consistent environment, easy cleanup
- Quick check: connect to postgres to verify it is running

## Step 2: config.py (3 min)
- DATABASE_URL from environment variable with a default
- Explain the PostgreSQL connection string format
- Show .env.example — this is what developers copy to .env

## Step 3: database.py (5 min)
- This is SQLAlchemy, NOT Motor — explain the difference
- create_engine — SQLAlchemy's connection to PostgreSQL
- SessionLocal — factory for database sessions
- Base — all our models inherit from this (declarative_base)
- get_db dependency — yields a session, closes it in finally block
- Compare with MongoDB: sessions vs collections, ORM vs documents

## Step 4: models/ (8 min)
- models/db_models.py — SQLAlchemy models (database tables)
  - Product: columns with types, constraints (nullable, unique)
  - Sale: items stored as JSON column — hybrid approach
  - Explain Column types: Integer, String, Float, DateTime, JSON
- models/product.py — Pydantic models (API schemas)
  - Explain why we need BOTH: SQLAlchemy for DB, Pydantic for API
  - ProductCreate, ProductResponse, ProductUpdate, StockUpdate
- models/sale.py — CartItem, CheckoutRequest, SaleResponse
  - Show how SaleItem matches the JSON structure in the Sale table

## Step 5: Alembic init + first migration (8 min)
- Show alembic.ini — point out sqlalchemy.url
- Show alembic/env.py — imports Base and models so Alembic sees the tables
- Show alembic/versions/001_initial_tables.py
  - upgrade() creates tables, downgrade() drops them
  - Explain op.create_table with column definitions
- Run: alembic upgrade head
- Show the tables in PostgreSQL (use psql or any client)
- Explain why migrations: version control for your database schema
- Show alembic downgrade -1 to rollback, then upgrade again

## Step 6: routes/products.py (8 min)
- CRUD with SQLAlchemy instead of MongoDB
- db.query(Product).filter(...) vs collection.find(...)
- db.add(), db.commit(), db.refresh() pattern
- Stock update endpoint — PATCH /products/{id}/stock
  - Validates stock does not go below 0
- Search by name using ilike — case-insensitive search
- Test all endpoints in Swagger

## Step 7: services/checkout_service.py (10 min)
- This is the most important file — explain transactions
- process_checkout function:
  - with_for_update() locks the product row — prevents race conditions
  - Explain the scenario: two cashiers, last item in stock
  - Loop through items: check stock, decrement, calculate subtotal
  - If ANY item fails, db.rollback() undoes ALL changes
  - Only if everything succeeds: db.commit()
- Show the try/except/rollback pattern
- Explain atomicity: all or nothing

## Step 8: routes/checkout.py (3 min)
- Simple route that calls the service
- Separation of concerns: route handles HTTP, service handles business logic
- Test: add products, then checkout

## Step 9: routes/cart.py (4 min)
- In-memory cart — simple list
- Explain limitations: resets on server restart, shared across users
- In production: use Redis or session-based storage
- Add to cart, view cart, remove, clear

## Step 10: routes/reports.py (8 min)
- daily — filter sales by date range, sum totals
- top_products — aggregate from JSON items field, sort by quantity
- revenue — group by date, return daily breakdown
- Test: create some products, do some checkouts, then check reports
- Explain how JSON column lets us query nested data

## Step 11: main.py (3 min)
- Include all four routers
- Run full demo: add products, add to cart, checkout, check reports
- Show what happens when you try to checkout with insufficient stock

## Demo Script
1. Add 3 products (Atta, Rice, Dal) with stock
2. Add Atta and Rice to cart
3. Checkout with UPI
4. Check stock — it should be decremented
5. Try to buy more than available — show the rollback error
6. Check daily report — see the sale
7. Show Alembic: run alembic current, alembic history

## Key Talking Points
- PostgreSQL vs MongoDB: when to use which
- Alembic is like git for your database — track schema changes
- Transactions ensure data consistency — critical for money/inventory
- with_for_update() prevents the double-sell problem
- JSON columns give you document-like flexibility in a relational DB
- Service layer pattern keeps business logic out of routes
