# Recording Guide — Karigar Jobs

## Overview
Total recording time: ~60-70 minutes
Theme: Blue-collar job platform with proper authentication

## Recording Order

### Step 1: config.py (~3 min)
- Explain we need secure config for JWT secrets
- Create Settings class with pydantic-settings
- Show SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_MINUTES
- Explain how it reads from .env file automatically
- Create the .env.example file

### Step 2: security.py (~7 min)
- Set up passlib CryptContext for bcrypt
- Write hash_password and verify_password
- Write create_token — explain JWT payload and expiry
- Write decode_token — explain how verification works
- Explain why we never store plain passwords

### Step 3: models/user.py (~5 min)
- Create User table with hashed_password and role field
- Explain role is either "worker" or "customer"
- Create UserCreate (takes plain password), UserRead (no password), UserLogin
- Explain why UserRead excludes the password hash

### Step 4: models/job.py (~5 min)
- Create Job table with title, description, location, pay, posted_by
- posted_by is a foreign key to User
- is_open boolean to track if the job is still available
- Create JobCreate and JobRead schemas

### Step 5: models/application.py (~5 min)
- Create Application table linking worker to job
- Foreign keys: job_id and worker_id both point to different tables
- Create ApplicationCreate and ApplicationRead

### Step 6: database.py (~3 min)
- Same pattern — engine, create_tables, get_session
- Quick and familiar by now

### Step 7: dependencies.py (~10 min)
- This is the key file — explain thoroughly
- Set up OAuth2PasswordBearer with tokenUrl
- Write get_current_user: decode token, fetch user from DB
- Write require_role factory function
- Explain how require_role("customer") returns a dependency
- Show the dependency chain: token -> user -> role check

### Step 8: routes/auth.py (~8 min)
- POST /register — validate role, hash password, save user
- POST /login — verify credentials, return JWT token
- Test registration and login in /docs
- Show the Authorize button — paste the token there

### Step 9: routes/jobs.py (~8 min)
- GET / — list open jobs (anyone can browse, add filters)
- POST / — create job (only customers, using require_role)
- GET /{id} — get single job
- PATCH /{id}/close — customer closes their own job
- Test: try posting a job as a worker — show 403 error

### Step 10: routes/applications.py (~8 min)
- POST / — worker applies to a job (prevent duplicate applications)
- GET /job/{id} — customer views applicants for their job
- GET /my — worker sees their own applications
- Test the full flow: customer posts job, worker applies, customer views

### Step 11: main.py (~3 min)
- Wire up all three routers
- Add startup event
- Run and do the complete demo

## Demo Flow
1. Register "Ramesh" as customer, "Sunil" as worker
2. Login as Ramesh, post a plumbing job in Delhi, Rs 800/day
3. Login as Sunil, browse jobs, apply to the plumbing job
4. Switch to Ramesh, view applicants for the job
5. Try to apply as Ramesh (customer) — show 403 error
6. Close the job as Ramesh
