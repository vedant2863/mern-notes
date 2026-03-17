"""
============================================================
FILE 10: DATABASE INTEGRATION WITH SQLMODEL AND SQLITE
============================================================
Topics: SQLModel, SQLite, create_engine, Session, CRUD with DB,
        model separation (Base/Create/Read/Table), Depends,
        lifespan, pagination

WHY THIS MATTERS:
In-memory data stores vanish when the server restarts. Every
production application needs a database. SQLModel combines the
best of SQLAlchemy (database power) and Pydantic (validation)
into one elegant library built by the creator of FastAPI.
============================================================
"""

# STORY: BookMyShow — Every Seat Is a DB Record Across India
# BookMyShow handles 250+ million visitors per year, selling tickets
# for movies across 650+ cities. Every seat is a row in the database.
# Every booking is a transaction. Without a robust database layer,
# BookMyShow would collapse under the first-day-first-show rush.

# Requires: pip install sqlmodel

from fastapi import FastAPI, HTTPException, Depends, Query
from sqlmodel import SQLModel, Field, Session, create_engine, select
from typing import Optional
from datetime import datetime, timezone
from contextlib import asynccontextmanager


# ════════════════════════════════════════════════════════════
# SECTION 1 — SQLModel: Defining Database Models
# ════════════════════════════════════════════════════════════

# WHY: SQLModel models serve double duty — BOTH Pydantic models
# (for validation) AND SQLAlchemy models (for database ORM).

# table=True makes this a database table, not just a Pydantic model
class Movie(SQLModel, table=True):
    """A movie in the BookMyShow catalog."""
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(min_length=1, max_length=200, index=True)
    language: str = Field(max_length=50)
    genre: str = Field(max_length=50)
    duration_minutes: int = Field(ge=1, le=600)
    rating: Optional[float] = Field(default=None, ge=0, le=10)
    is_active: bool = Field(default=True)
    created_at: Optional[str] = Field(default=None)
    updated_at: Optional[str] = Field(default=None)


# ════════════════════════════════════════════════════════════
# SECTION 2 — Separate Models: Base, Create, Read, Update
# ════════════════════════════════════════════════════════════

# WHY: A single model for everything creates problems:
# - Create: client should NOT send id or created_at
# - Read: response SHOULD include id and created_at
# - Table: needs id as primary key + table=True

class MovieBase(SQLModel):
    """Fields shared by all Movie models."""
    title: str = Field(min_length=1, max_length=200)
    language: str = Field(max_length=50)
    genre: str = Field(max_length=50)
    duration_minutes: int = Field(ge=1, le=600)
    rating: Optional[float] = Field(default=None, ge=0, le=10)

class MovieCreate(MovieBase):
    """Request body for creating a movie. No id, no timestamps."""
    pass

class MovieRead(MovieBase):
    """Response model with id and metadata."""
    id: int
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class MovieUpdate(SQLModel):
    """Partial update — all fields optional."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    language: Optional[str] = Field(default=None, max_length=50)
    genre: Optional[str] = Field(default=None, max_length=50)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    rating: Optional[float] = Field(default=None, ge=0, le=10)
    is_active: Optional[bool] = None


# ════════════════════════════════════════════════════════════
# SECTION 3 — Engine, Lifespan, and Session Dependency
# ════════════════════════════════════════════════════════════

# WHY: The engine is your database connection. The lifespan creates
# tables at startup. The session dependency injects DB access into routes.

# connect_args needed for SQLite only (not thread-safe by default)
DATABASE_URL = "sqlite:///./bookmyshow.db"
engine = create_engine(
    DATABASE_URL, echo=False,
    connect_args={"check_same_thread": False},
)

@asynccontextmanager
async def lifespan(the_app: FastAPI):
    """
    Lifespan replaces @app.on_event("startup").
    Code before yield = STARTUP. Code after yield = SHUTDOWN.
    """
    SQLModel.metadata.create_all(engine)
    print("Database tables created.")
    yield
    print("Shutting down.")

app = FastAPI(title="BookMyShow API", lifespan=lifespan)

def get_session():
    """Dependency: provides a DB session, auto-closes after request."""
    with Session(engine) as session:
        yield session


# ════════════════════════════════════════════════════════════
# SECTION 4 — CREATE: Adding Records
# ════════════════════════════════════════════════════════════

# WHY: session.add() stages a record. session.commit() writes it.
# session.refresh() reloads it with the auto-generated id.

@app.post("/movies", response_model=MovieRead, status_code=201)
def create_movie(movie_data: MovieCreate, session: Session = Depends(get_session)):
    """
    Flow: MovieCreate validates -> Movie(table) becomes DB record ->
    session.add() + commit() + refresh() to get auto-generated id.
    """
    now = datetime.now(timezone.utc).isoformat()
    movie = Movie(**movie_data.model_dump(), is_active=True, created_at=now, updated_at=now)
    session.add(movie)
    session.commit()
    session.refresh(movie)
    return movie


# ════════════════════════════════════════════════════════════
# SECTION 5 — READ: Querying the Database
# ════════════════════════════════════════════════════════════

# WHY: SELECT queries are the most common operation. SQLModel uses
# select() for type-safe queries with offset/limit for pagination.

@app.get("/movies", response_model=list[MovieRead])
def list_movies(
    offset: int = Query(ge=0, default=0),
    limit: int = Query(ge=1, le=100, default=20),
    language: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    """
    select(Movie)          -> SELECT * FROM movie
    .where(...)            -> WHERE clause
    .offset(N).limit(N)    -> pagination at DB level
    """
    statement = select(Movie).where(Movie.is_active == True)
    if language:
        statement = statement.where(Movie.language == language)
    statement = statement.offset(offset).limit(limit)
    return session.exec(statement).all()


@app.get("/movies/{movie_id}", response_model=MovieRead)
def get_movie(movie_id: int, session: Session = Depends(get_session)):
    """session.get(Model, id) — simplest way to fetch by primary key."""
    movie = session.get(Movie, movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


# ════════════════════════════════════════════════════════════
# SECTION 6 — UPDATE: Modifying Records
# ════════════════════════════════════════════════════════════

# WHY: Fetch, modify, save — all within a session.
# exclude_unset=True ensures only sent fields are updated.

@app.patch("/movies/{movie_id}", response_model=MovieRead)
def update_movie(
    movie_id: int, movie_data: MovieUpdate,
    session: Session = Depends(get_session),
):
    """Partial update: fetch -> apply only sent fields -> commit."""
    movie = session.get(Movie, movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    update_data = movie_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field, value in update_data.items():
        setattr(movie, field, value)
    movie.updated_at = datetime.now(timezone.utc).isoformat()

    session.add(movie)
    session.commit()
    session.refresh(movie)
    return movie


# ════════════════════════════════════════════════════════════
# SECTION 7 — DELETE: Soft Delete (Preferred)
# ════════════════════════════════════════════════════════════

# WHY: Prefer soft deletes (is_active=False) over hard deletes.
# Preserves audit trails and allows data recovery.

@app.delete("/movies/{movie_id}")
def delete_movie(movie_id: int, session: Session = Depends(get_session)):
    """Soft delete — sets is_active=False. Record stays for auditing."""
    movie = session.get(Movie, movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    movie.is_active = False
    movie.updated_at = datetime.now(timezone.utc).isoformat()
    session.add(movie)
    session.commit()
    return {"message": f"Movie '{movie.title}' deactivated (soft delete)"}


# ════════════════════════════════════════════════════════════
# SECTION 8 — Seed Data for Testing
# ════════════════════════════════════════════════════════════

@app.post("/seed", status_code=201)
def seed_database(session: Session = Depends(get_session)):
    """Populate with sample BookMyShow data."""
    now = datetime.now(timezone.utc).isoformat()
    movies_data = [
        MovieCreate(title="Pushpa 2: The Rule", language="Telugu", genre="Action", duration_minutes=180, rating=7.8),
        MovieCreate(title="Stree 2", language="Hindi", genre="Horror Comedy", duration_minutes=152, rating=7.5),
    ]

    created = []
    for md in movies_data:
        movie = Movie(**md.model_dump(), is_active=True, created_at=now, updated_at=now)
        session.add(movie)
        session.commit()
        session.refresh(movie)
        created.append({"id": movie.id, "title": movie.title})

    return {"message": f"Seeded {len(created)} movies", "movies": created}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. SQLModel = SQLAlchemy + Pydantic in one class. table=True makes
#    it a database table; omit it for plain validation models.
# 2. Use separate models: MovieBase (shared), MovieCreate (input),
#    MovieRead (output), Movie(table=True) (database).
# 3. create_engine() connects to the DB. For SQLite, use
#    connect_args={"check_same_thread": False}.
# 4. Lifespan function replaces @app.on_event. Put table creation
#    in the startup phase.
# 5. Depends(get_session) injects a DB session into every route.
#    The yield pattern ensures proper cleanup.
# 6. CRUD: session.add() + commit() + refresh() for create/update.
#    session.get(Model, id) for read. Soft delete via is_active=False.
# 7. Paginate at DB level (offset/limit) — never load all records
#    into Python and slice.
# "At BookMyShow, the database is the single source of truth.
#  Every seat, every show, every rupee flows through it." — BMS Engineering
