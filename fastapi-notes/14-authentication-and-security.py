"""
============================================================
FILE 14: AUTHENTICATION, JWT TOKENS, AND SECURITY
============================================================
Topics: auth vs authz, password hashing, OAuth2 password flow,
        JWT structure, token creation/verification, get_current_user,
        role-based access control (RBAC), refresh tokens

WHY THIS MATTERS:
Every API that stores user data needs authentication. Without
it, anyone can read anyone's data, delete accounts, or make
purchases. Authentication is not optional — it is the first
thing auditors and pen-testers check.
============================================================
"""

# STORY: DigiLocker — 150M Citizens, Aadhaar OTP to JWT
# DigiLocker is India's official document wallet, used by 150M+
# citizens to store Aadhaar, PAN, and driving license. A user
# authenticates via Aadhaar OTP, receives a JWT, and uses that
# token to access their documents. The JWT proves "this is Rahul,
# and he can only see HIS documents." A single auth bug would
# expose 150 million citizens' personal data.

from typing import Optional
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

# ════════════════════════════════════════════════════════════
# SECTION 1 — Authentication vs Authorization
# ════════════════════════════════════════════════════════════

# AUTHENTICATION (AuthN): "Who are you?"
#   - Verifying identity: username + password, OTP, biometrics
#   - Analogy: Showing your Aadhaar card at the airport
#
# AUTHORIZATION (AuthZ): "What can you do?"
#   - Checking permissions: can this user access admin panel?
#   - Analogy: Boarding pass says economy, not business class
#
# Flow: Authenticate first -> then Authorize


# ════════════════════════════════════════════════════════════
# SECTION 2 — Password Hashing
# ════════════════════════════════════════════════════════════

# WHY: NEVER store plain-text passwords. If your database leaks,
# hashed passwords are useless to attackers. Bcrypt is the gold
# standard — it is slow on purpose, making brute force impractical.

# --- Production code (pip install "passlib[bcrypt]") ---
# from passlib.context import CryptContext
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# def hash_password(password: str) -> str:
#     return pwd_context.hash(password)
# def verify_password(plain: str, hashed: str) -> bool:
#     return pwd_context.verify(plain, hashed)

# --- Teaching version (works without passlib) ---
import hashlib

def hash_password(password: str) -> str:
    """SHA-256 for TEACHING ONLY. Production: use bcrypt via passlib."""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


# ════════════════════════════════════════════════════════════
# SECTION 3 — User Models and Fake Database
# ════════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=5)
    password: str = Field(min_length=8)

class UserResponse(BaseModel):
    """Sent to client — NO password field."""
    id: int
    username: str
    email: str
    is_active: bool
    role: str

class UserInDB(BaseModel):
    """Internal — includes hashed password, never sent to client."""
    id: int
    username: str
    email: str
    is_active: bool = True
    role: str = "citizen"
    hashed_password: str

fake_users_db: dict = {}
user_id_counter = 0


# ════════════════════════════════════════════════════════════
# SECTION 4 — OAuth2 Flow and JWT Tokens
# ════════════════════════════════════════════════════════════

# OAuth2 Password Flow:
# 1. Client sends username + password to /auth/login
# 2. Server verifies, returns JWT
# 3. Client sends token: Authorization: Bearer <token>
# 4. Server verifies token on each request

# JWT Structure: header.payload.signature
# HEADER: {"alg": "HS256", "typ": "JWT"}
# PAYLOAD: {"sub": "rahul", "role": "citizen", "exp": 1709283600}
# SIGNATURE: HMAC_SHA256(header + payload, secret)
# IMPORTANT: Payload is NOT encrypted — never put passwords in JWT.

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

JWT_SECRET_KEY = "digilocker-super-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# --- Production JWT (pip install python-jose[cryptography]) ---
# from jose import jwt, JWTError
# encoded = jwt.encode(payload, SECRET, algorithm="HS256")
# decoded = jwt.decode(token, SECRET, algorithms=["HS256"])

# --- Teaching version (base64 + HMAC, NOT production-secure) ---
import json, base64, hmac

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire.isoformat(), "iat": datetime.now(timezone.utc).isoformat()})

    payload_b64 = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode()
    sig = hmac.new(JWT_SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"

def decode_access_token(token: str) -> dict:
    try:
        payload_b64, sig = token.split(".")
        expected = hmac.new(JWT_SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("Invalid signature")
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        if datetime.now(timezone.utc) > datetime.fromisoformat(payload["exp"]):
            raise ValueError("Token expired")
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}",
                            headers={"WWW-Authenticate": "Bearer"})

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ════════════════════════════════════════════════════════════
# SECTION 5 — get_current_user (The Core Auth Dependency)
# ════════════════════════════════════════════════════════════

# WHY: This is the ONE dependency every protected endpoint uses.
# It extracts the token, decodes it, and returns the user.

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    """Chain: Request -> OAuth2PasswordBearer -> decode -> user lookup"""
    payload = decode_access_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")
    user = fake_users_db.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user_obj = UserInDB(**user)
    if not user_obj.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user_obj


# ════════════════════════════════════════════════════════════
# SECTION 6 — Role-Based Access Control (RBAC)
# ════════════════════════════════════════════════════════════

# DigiLocker roles:
# - citizen: view/download their own documents
# - verifier: verify a citizen's document (e.g., bank KYC)
# - admin: manage users, view analytics

def require_role(allowed_roles: list):
    """Factory: creates a role-checking dependency."""
    async def role_checker(current_user: UserInDB = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403,
                detail=f"Role '{current_user.role}' not authorized. Need: {allowed_roles}")
        return current_user
    return role_checker

require_admin = require_role(["admin"])
require_citizen = require_role(["citizen", "admin"])


# ════════════════════════════════════════════════════════════
# SECTION 7 — Complete Auth API
# ════════════════════════════════════════════════════════════

app = FastAPI(title="DigiLocker Auth API", version="1.0.0")


@app.post("/auth/register", response_model=UserResponse, status_code=201)
def register(user_data: UserCreate):
    """Register: check uniqueness, hash password, store, return (no password)."""
    global user_id_counter
    if user_data.username in fake_users_db:
        raise HTTPException(status_code=400, detail="Username already registered")

    user_id_counter += 1
    user_record = {
        "id": user_id_counter, "username": user_data.username,
        "email": user_data.email, "is_active": True, "role": "citizen",
        "hashed_password": hash_password(user_data.password),
    }
    fake_users_db[user_data.username] = user_record
    return UserResponse(**user_record)


@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login with username + password, receive JWT token."""
    user = fake_users_db.get(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "role": user["role"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token)


@app.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: UserInDB = Depends(get_current_user)):
    """Protected: get current user's profile. Requires valid JWT."""
    return UserResponse(**current_user.model_dump())


@app.get("/my-documents")
async def get_my_documents(current_user: UserInDB = Depends(require_citizen)):
    """Only citizens and admins can access documents."""
    return {"user": current_user.username, "documents": [
        {"type": "Aadhaar", "id": "XXXX-XXXX-1234", "status": "verified"},
        {"type": "PAN", "id": "ABCDE1234F", "status": "verified"},
    ]}


@app.get("/admin/users")
async def admin_list_users(current_user: UserInDB = Depends(require_admin)):
    """Admin only — list all users. Citizens get 403."""
    users = [UserResponse(**u) for u in fake_users_db.values()]
    return {"users": users, "total": len(users)}


# ════════════════════════════════════════════════════════════
# SECTION 8 — Refresh Tokens and Security Best Practices
# ════════════════════════════════════════════════════════════

# Refresh Token Flow:
# 1. Login returns access_token (30 min) + refresh_token (7 days)
# 2. When access_token expires, client sends refresh_token
# 3. Server returns new access_token without re-login

@app.post("/auth/refresh", response_model=Token)
def refresh_token(refresh_token_str: str):
    """Get a new access token using a refresh token."""
    payload = decode_access_token(refresh_token_str)
    new_token = create_access_token(
        data={"sub": payload["sub"], "user_id": payload.get("user_id"),
              "role": payload.get("role")},
    )
    return Token(access_token=new_token)

# --- Security Best Practices ---
# 1. ALWAYS hash passwords with bcrypt (never MD5/SHA/plain text)
# 2. Use HTTPS in production (TLS encrypts tokens in transit)
# 3. Short access token expiration (15-30 min) + refresh tokens
# 4. Never put sensitive data in JWT payload (it is NOT encrypted)
# 5. Rate limit the login endpoint (prevent brute force)
# 6. CORS to restrict which domains can call your API
# 7. Validate all input — Pydantic does this for free in FastAPI


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Authentication = who are you; Authorization = what can you do
# 2. ALWAYS hash passwords with bcrypt — never store plain text
# 3. OAuth2PasswordBearer extracts tokens from Authorization header
# 4. JWT = header.payload.signature — payload is NOT encrypted
# 5. get_current_user is the backbone of auth in FastAPI
# 6. Use require_role() factory for clean role-based access control
# 7. Short-lived access tokens + refresh tokens = secure sessions
# "Security is not a product, but a process." — Bruce Schneier
