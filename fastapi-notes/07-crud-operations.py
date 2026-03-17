"""
============================================================
FILE 07: COMPLETE CRUD OPERATIONS — BUILDING A REAL API
============================================================
Topics: POST create, GET read (all + single), PUT full update,
        PATCH partial update, DELETE, filtering, pagination,
        status transitions, PUT vs PATCH

WHY THIS MATTERS:
Every API in the world boils down to CRUD. Whether you are
building a food delivery app or a government portal, mastering
Create-Read-Update-Delete is the foundation of backend work.
============================================================
"""

# STORY: Dunzo — Delivery Task Create/Read/Update/Delete
# Dunzo is a Bangalore-born hyperlocal delivery platform. Every order
# — whether it is picking up biryani from Meghana Foods or medicines
# from Apollo Pharmacy — is a "task" in their system. Each task goes
# through a lifecycle: created -> assigned -> picked_up -> delivered.
# Understanding CRUD deeply is how you build Dunzo-scale systems.

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum

app = FastAPI(title="Dunzo-Style Delivery Tasks API")


# ════════════════════════════════════════════════════════════
# SECTION 1 — In-Memory Data Store and Models
# ════════════════════════════════════════════════════════════

# WHY: Before connecting a real database, an in-memory store lets you
# prototype all CRUD logic. The patterns transfer directly to SQL/NoSQL.

task_id_counter: int = 0
tasks_db: dict[int, dict] = {}

def get_next_id() -> int:
    global task_id_counter
    task_id_counter += 1
    return task_id_counter


class TaskStatus(str, Enum):
    created = "created"
    assigned = "assigned"
    picked_up = "picked_up"
    delivered = "delivered"
    cancelled = "cancelled"


class TaskCategory(str, Enum):
    food = "food"
    grocery = "grocery"
    medicine = "medicine"
    other = "other"


# --- Pydantic models for request/response ---
class TaskCreate(BaseModel):
    """What the client sends to CREATE a task."""
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    pickup_address: str = Field(min_length=5, max_length=500)
    delivery_address: str = Field(min_length=5, max_length=500)
    category: TaskCategory = TaskCategory.other
    estimated_price: float = Field(gt=0, le=50000)
    customer_phone: str = Field(pattern=r"^[6-9]\d{9}$")


class TaskPatch(BaseModel):
    """Partial update — all fields optional (PATCH semantics)."""
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    pickup_address: Optional[str] = Field(default=None, min_length=5)
    delivery_address: Optional[str] = Field(default=None, min_length=5)
    category: Optional[TaskCategory] = None
    estimated_price: Optional[float] = Field(default=None, gt=0, le=50000)
    status: Optional[TaskStatus] = None


class TaskResponse(BaseModel):
    """What the API returns for a single task."""
    id: int
    title: str
    description: Optional[str] = None
    pickup_address: str
    delivery_address: str
    category: TaskCategory
    estimated_price: float
    customer_phone: str
    status: TaskStatus
    created_at: str
    updated_at: str


class PaginatedResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    size: int
    pages: int


# ════════════════════════════════════════════════════════════
# SECTION 2 — CREATE: POST Endpoint
# ════════════════════════════════════════════════════════════

# WHY: POST creates a new resource. It must validate input, assign
# an ID, set timestamps, store the data, and return the created resource.

@app.post("/tasks", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate):
    """
    Create a new delivery task.
    Auto-assigns ID, sets status to 'created', records timestamps.
    """
    now = datetime.now(timezone.utc).isoformat()
    task_id = get_next_id()
    task_dict = {
        "id": task_id,
        **task.model_dump(),
        "status": TaskStatus.created,
        "created_at": now,
        "updated_at": now,
    }
    tasks_db[task_id] = task_dict
    return task_dict


# ════════════════════════════════════════════════════════════
# SECTION 3 — READ: GET All + GET Single
# ════════════════════════════════════════════════════════════

# WHY: Returning ALL records is dangerous at scale. Pagination is
# mandatory. Always handle "not found" with a 404.

@app.get("/tasks", response_model=PaginatedResponse)
def list_tasks(
    page: int = Query(ge=1, default=1),
    size: int = Query(ge=1, le=100, default=10),
):
    """List all tasks with pagination."""
    all_tasks = list(tasks_db.values())
    total = len(all_tasks)
    pages = max(1, (total + size - 1) // size)
    skip = (page - 1) * size
    return {
        "items": all_tasks[skip : skip + size],
        "total": total, "page": page, "size": size, "pages": pages,
    }


@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int):
    """Get a single task by ID. Returns 404 if not found."""
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return tasks_db[task_id]


# ════════════════════════════════════════════════════════════
# SECTION 4 — UPDATE: PATCH for Partial Update
# ════════════════════════════════════════════════════════════

# WHY: PATCH sends ONLY the fields that changed. The key trick is
# model_dump(exclude_unset=True) — it distinguishes "field not sent"
# from "field sent as None."

# --- PUT vs PATCH: Quick Comparison ---
#
# | Aspect      | PUT                      | PATCH                    |
# |-------------|--------------------------|--------------------------|
# | Fields      | ALL fields required      | Only changed fields      |
# | Model       | All fields mandatory     | All fields Optional      |
# | Key method  | model_dump()             | model_dump(exclude_unset)|
# | Use when    | Client has full state    | Client has partial state |
#
# Rule of thumb: Use PATCH for most real-world updates.

@app.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task_partial(task_id: int, task: TaskPatch):
    """
    Partial update (PATCH) — only updates fields that were sent.
    model_dump(exclude_unset=True) is the KEY difference from PUT.
    Example: {"status": "assigned"} updates ONLY status.
    """
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    existing = tasks_db[task_id]
    update_data = task.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field, value in update_data.items():
        existing[field] = value

    existing["updated_at"] = datetime.now(timezone.utc).isoformat()
    tasks_db[task_id] = existing
    return existing


# ════════════════════════════════════════════════════════════
# SECTION 5 — DELETE: Remove an Item
# ════════════════════════════════════════════════════════════

# WHY: Deletion seems simple but has nuances: hard vs soft delete,
# returning the deleted item, and proper 404 handling.

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    """Hard delete — removed from store. Returns deleted data."""
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    deleted_task = tasks_db.pop(task_id)
    return {"message": "Task deleted", "deleted": deleted_task}

# --- Soft delete alternative (preferred in production) ---
# Instead of removing, set a deleted_at timestamp:
#   tasks_db[task_id]["deleted_at"] = datetime.now(timezone.utc).isoformat()
#   tasks_db[task_id]["status"] = "cancelled"
# Then filter out soft-deleted items in list endpoints.


# ════════════════════════════════════════════════════════════
# SECTION 6 — Status Transitions (Business Logic)
# ════════════════════════════════════════════════════════════

# WHY: A real delivery system has rules about status transitions.
# You cannot jump from "created" to "delivered" — it must go through
# assigned -> picked_up -> delivered.

VALID_TRANSITIONS: dict[str, list[str]] = {
    "created": ["assigned", "cancelled"],
    "assigned": ["picked_up", "cancelled"],
    "picked_up": ["delivered", "cancelled"],
    "delivered": [],      # terminal state
    "cancelled": [],      # terminal state
}

@app.patch("/tasks/{task_id}/status")
def update_task_status(
    task_id: int,
    new_status: TaskStatus = Query(description="New status value"),
):
    """Update task status with transition validation."""
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks_db[task_id]
    current = task["status"]
    allowed = VALID_TRANSITIONS.get(current, [])

    if new_status.value not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot go from '{current}' to '{new_status.value}'. Allowed: {allowed}",
        )

    task["status"] = new_status.value
    task["updated_at"] = datetime.now(timezone.utc).isoformat()
    return {"message": f"Status updated to {new_status.value}", "task": task}


# ════════════════════════════════════════════════════════════
# SECTION 7 — Seed Data for Testing
# ════════════════════════════════════════════════════════════

@app.post("/tasks/seed", status_code=201)
def seed_tasks():
    """Populate the store with sample tasks for testing."""
    samples = [
        TaskCreate(
            title="Biryani from Meghana Foods",
            description="2x Chicken Biryani",
            pickup_address="Meghana Foods, Koramangala, Bangalore",
            delivery_address="42 Wind Tunnel Road, Bangalore",
            category=TaskCategory.food,
            estimated_price=650.0,
            customer_phone="9876543210",
        ),
        TaskCreate(
            title="Medicines from Apollo Pharmacy",
            description="Paracetamol 500mg x 10",
            pickup_address="Apollo Pharmacy, Indiranagar 100ft Road",
            delivery_address="15 CMH Road, Indiranagar, Bangalore",
            category=TaskCategory.medicine,
            estimated_price=350.0,
            customer_phone="8765432109",
        ),
    ]

    created = []
    for task_data in samples:
        now = datetime.now(timezone.utc).isoformat()
        task_id = get_next_id()
        task_dict = {
            "id": task_id, **task_data.model_dump(),
            "status": TaskStatus.created, "created_at": now, "updated_at": now,
        }
        tasks_db[task_id] = task_dict
        created.append(task_dict)

    return {"message": f"Seeded {len(created)} tasks", "tasks": created}


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Use a dict with int keys for O(1) lookups — maps directly to
#    database primary key lookups later.
# 2. Always return 404 when a resource is not found — never silently
#    return None or empty dict.
# 3. POST returns 201 (Created), not 200. Use status_code=201.
# 4. PATCH = partial update (all fields Optional + exclude_unset=True).
#    model_dump(exclude_unset=True) is the key to proper PATCH.
# 5. Pagination must return metadata (total, page, pages) — not just
#    the items list — so the client can build pagination UI.
# 6. Status transitions should be validated against a state machine.
# "First make it work (CRUD), then make it right (validation),
#  then make it fast (database)." — Dunzo Engineering Principle
