# Chapter 35 — BazaarAPI: E-Commerce Marketplace API

## Story: Flipkart Big Billion Days

Millions of users flood the platform simultaneously — adding to carts, racing
for flash deals, hammering checkout. The backend must handle real-time stock
counts, persistent carts, and atomic order processing where two users can never
buy the last unit of the same item. **BazaarAPI** is that backend — Chi, SQLite,
JWT auth, transactions, and pagination.

---

## Why Multi-Resource API Design?

| Resource | Depends On | Operations |
|----------|-----------|------------|
| Users | Nothing | Register, Login, Profile |
| Products | Users (seller) | CRUD, Search, Pagination |
| Cart | Users + Products | Add, Update, Remove, View |
| Orders | Users + Products | Create (from cart), Track |

Challenges: foreign keys, atomic transactions, authorization, stock consistency.

---

## Database Transactions in Go

```go
tx, err := db.BeginTx(ctx, nil)
defer tx.Rollback()             // safety net
// ... multiple operations ...
err = tx.Commit()               // make permanent
```

Without transactions, two users buying the last item causes overselling. The
`BEGIN ... COMMIT` block ensures all ops succeed or none do (ACID).

## Relationship Modeling

SQLite foreign keys (`PRAGMA foreign_keys = ON`) enforce referential integrity.
The cart uses `UNIQUE(user_id, product_id)` with upsert — the DB handles
atomicity, not the application.

## Pagination

```
GET /api/products?page=2&limit=20&category=electronics
→ SELECT * FROM products WHERE category = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
```

---

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create user |
| POST | `/api/auth/login` | Get JWT |
| GET | `/api/products` | List (paged) |
| GET | `/api/products/{id}` | Single product |

### Protected (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cart` | View cart |
| POST | `/api/cart` | Add to cart |
| POST | `/api/orders` | Create order from cart |
| GET | `/api/orders` | List orders |

### Admin Only
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/products` | Create product |
| PUT | `/api/admin/orders/{id}/status` | Update order status |

---

## Project Structure

```
35-bazaarapi/
├── main.go
├── go.mod / Dockerfile / docker-compose.yml
└── internal/
    ├── config/config.go
    ├── model/user.go, product.go, cart.go, order.go
    ├── store/user_store.go, product_store.go, cart_store.go, order_store.go
    ├── auth/jwt.go, password.go
    ├── handler/auth, product, cart, order handlers + helpers.go
    └── middleware/auth_middleware.go, middleware.go
```

---

## How to Run

```bash
cd 35-bazaarapi && go mod tidy && go run main.go

curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"rahul@flipkart.com","password":"bigbillion2024","name":"Rahul"}'

# Docker
docker compose up --build
```

---

## Key Takeaways

1. **Transactions are non-negotiable for e-commerce** — `CreateFromCart` wraps
   cart-to-order in a single transaction to prevent overselling.
2. **Foreign keys enforce relationships at DB level** — no application-level
   race conditions for referential integrity.
3. **Upsert simplifies cart logic** — `ON CONFLICT ... DO UPDATE` is atomic.
4. **Pagination is mandatory for list endpoints** — unbounded queries crash
   both server and client.
5. **Role-based access** — middleware checks JWT claims before handlers run.
6. **Price as float64 is educational** — production uses integer cents.
7. **Chi's r.Route() and r.Group()** organize endpoints with per-group middleware.

---

*This completes the e-commerce trilogy (CRUD -> Auth -> Marketplace). Next
chapters cover AI tools, search engines, and processing pipelines.*
