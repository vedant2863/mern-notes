# Recording Guide — Kitaab Exchange

## Overview
Total recording time: ~40-50 minutes
Theme: College book exchange for DU students

## Recording Order

### Step 1: models/user.py (~5 min)
- Explain the client brief — DU students selling books
- Create the User SQLModel table with id, name, email, college
- Add the Relationship field for books (one-to-many)
- Create UserCreate and UserRead schemas
- Explain why we separate table models from request/response models

### Step 2: models/book.py (~5 min)
- Create the Book table with title, author, price, is_sold, user_id
- Show how foreign_key links to the user table
- Add the Relationship back to User (back_populates)
- Create BookCreate, BookRead, BookUpdate schemas
- Explain BookUpdate uses Optional fields for partial updates

### Step 3: database.py (~3 min)
- Set up SQLite engine with create_engine
- Write create_tables function using SQLModel.metadata
- Write get_session generator for dependency injection
- Explain why we use a generator with yield

### Step 4: auth.py (~5 min)
- Explain API key authentication as the simplest auth pattern
- Use Header() to extract X-API-Key from request headers
- Compare the key and raise 403 if invalid
- Show this is a dependency we'll inject into protected routes

### Step 5: routes/users.py (~7 min)
- Create APIRouter with prefix and tags
- POST / — register a user (check for duplicate email)
- GET / — list all users
- Show how Depends(verify_api_key) protects the POST route
- Test in /docs — try without API key, then with correct key

### Step 6: routes/books.py (~10 min)
- GET / — list available books with optional title/author search
- POST / — create a book listing (protected by API key)
- PATCH /{id} — update price or sold status
- PATCH /{id}/sold — dedicated endpoint to mark as sold
- Explain Query parameters and .contains() for search
- Test search in /docs with different query params

### Step 7: main.py (~5 min)
- Create the FastAPI app with title and description
- Include both routers
- Add startup event to create tables
- Add a home route
- Run the server and do a full demo

## Demo Flow
1. Register 2-3 users from different colleges
2. List a few books under different users
3. Search books by title, then by author
4. Mark a book as sold — show it disappears from listing
5. Try creating a book without API key — show 403 error
