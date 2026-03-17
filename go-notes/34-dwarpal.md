# Chapter 34 — DwarPal: Auth Gateway
## *The Doorkeeper of the Trading Bazaar*

> **Dwar** = Gate | **Pal** = Keeper. Every trader entering Zerodha's bazaar
> must pass through the dwar. DwarPal checks identity, stamps a token, and
> decides which stalls they may visit.

---

## Why This Chapter?

Authentication is the most security-critical piece of any API. This chapter
builds a production-style auth gateway using Chi, SQLite (modernc), JWT
(HMAC-SHA256), and bcrypt.

---

## Core Concepts

### 1. JWT vs Sessions

**Sessions** store state server-side — every request hits a session store.
**JWT** encodes identity inside the token — the server just validates the
signature, no DB lookup needed per request.

Trade-off: JWT has no easy revocation before expiry (hence short expiry +
refresh tokens). Sessions offer easy revocation but need a store lookup.

### 2. Password Hashing with bcrypt

Never store plain-text passwords. bcrypt is intentionally slow (adaptive cost),
includes a random salt, and `CompareHashAndPassword` is timing-safe.

```go
hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)  // cost 12 ~300ms
```

### 3. RBAC — Role-Based Access Control

| Role | Access |
|---|---|
| `trader` | Own profile, place orders, view portfolio |
| `admin` | Everything above + manage users and system |

Middleware chain: `JWTAuth` ("Who are you?") -> `RequireRole` ("Are you allowed?")

### 4. Token Refresh Strategy

- **Access token**: Short-lived (15 min), sent with every API call.
- **Refresh token**: Long-lived (7 days), stored hashed in DB, used only to
  get new access tokens. Rotation: each use issues a new pair and revokes the old.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Get token pair |
| POST | `/api/auth/refresh` | No* | Exchange refresh for new pair |
| GET | `/api/users/me` | Yes | Current user profile |
| GET | `/api/admin/users` | Yes+admin | List all users |

---

## Project Structure

```
34-dwarpal/
├── main.go
├── go.mod / Dockerfile / docker-compose.yml
└── internal/
    ├── config/config.go
    ├── model/user.go              # User, requests, claims
    ├── store/user_store.go        # SQLite: users + refresh_tokens
    ├── auth/jwt.go, password.go   # JWT generation & bcrypt
    ├── handler/auth_handler.go
    └── middleware/auth_middleware.go, middleware.go
```

---

## Running

```bash
export JWT_SECRET=$(openssl rand -hex 32)
cd 34-dwarpal && go run main.go

# Register + Login + Access protected route
curl -X POST http://localhost:8081/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"kiran@zerodha.com","password":"TradeSafe123!","role":"trader"}'

curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kiran@zerodha.com","password":"TradeSafe123!"}'

curl http://localhost:8081/api/users/me -H "Authorization: Bearer <token>"
```

---

## Key Takeaways

1. **Stateless auth scales** — JWT eliminates per-request DB lookups.
2. **Defense in depth** — bcrypt passwords, short JWTs, hashed refresh tokens,
   role-based middleware. All layers work together.
3. **Middleware is Go's superpower** — `func(http.Handler) http.Handler`
   composes auth, logging, and CORS cleanly.
4. **Context carries request-scoped data** — JWT middleware stores claims in
   `r.Context()`, downstream handlers retrieve without coupling.
5. **Refresh token rotation prevents replay** — old tokens are revoked on use.
6. **Never roll your own crypto** — use `crypto/rand`, `bcrypt`, `golang-jwt`.

---

*Next: BazaarAPI (Ch 35) — trading endpoints behind DwarPal's gate.*
