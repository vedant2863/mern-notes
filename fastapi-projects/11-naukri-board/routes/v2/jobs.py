from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from datetime import datetime
from typing import Optional

from models.job import JobCreate, JobResponse, JobUpdate
from database import jobs_collection

router = APIRouter(prefix="/v2/jobs", tags=["v2-jobs"])


def doc_to_response(doc: dict) -> JobResponse:
    return JobResponse(
        id=str(doc["_id"]),
        **{k: v for k, v in doc.items() if k != "_id"},
    )


@router.post("/", response_model=JobResponse)
async def create_job(job: JobCreate):
    doc = job.model_dump()
    doc["created_at"] = datetime.utcnow()

    result = await jobs_collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    return doc_to_response(doc)


@router.get("/", response_model=list[JobResponse])
async def list_jobs(
    job_type: Optional[str] = Query(None, description="Filter: full-time, part-time, contract, internship"),
    location: Optional[str] = Query(None, description="Filter by company location"),
    is_remote: Optional[bool] = Query(None, description="Filter remote jobs"),
    skill: Optional[str] = Query(None, description="Filter by skill"),
    salary_min: Optional[int] = Query(None, description="Minimum salary filter"),
    salary_max: Optional[int] = Query(None, description="Maximum salary filter"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: int = Query(-1, description="-1 for newest first, 1 for oldest"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """V2: Enhanced listing with filtering, salary range, and pagination."""
    query = {}

    if job_type:
        query["job_type"] = job_type
    if location:
        query["company.location"] = location
    if is_remote is not None:
        query["is_remote"] = is_remote
    if skill:
        query["skills"] = skill
    if salary_min is not None:
        query["salary_max"] = {"$gte": salary_min}
    if salary_max is not None:
        query["salary_min"] = {"$lte": salary_max}

    cursor = jobs_collection.find(query)
    cursor = cursor.sort(sort_by, sort_order)
    cursor = cursor.skip(skip).limit(limit)

    # Get total count for pagination info
    total = await jobs_collection.count_documents(query)

    jobs = []
    async for doc in cursor:
        jobs.append(doc_to_response(doc))

    return jobs


@router.get("/stats")
async def job_stats():
    """V2 only: Get job posting statistics."""
    pipeline = [
        {"$group": {
            "_id": "$job_type",
            "count": {"$sum": 1},
            "avg_salary_min": {"$avg": "$salary_min"},
            "avg_salary_max": {"$avg": "$salary_max"},
        }},
        {"$sort": {"count": -1}},
    ]

    results = await jobs_collection.aggregate(pipeline).to_list(20)

    total = await jobs_collection.count_documents({})
    remote_count = await jobs_collection.count_documents({"is_remote": True})

    return {
        "total_jobs": total,
        "remote_jobs": remote_count,
        "by_type": [
            {
                "job_type": r["_id"],
                "count": r["count"],
                "avg_salary_min": round(r["avg_salary_min"] or 0),
                "avg_salary_max": round(r["avg_salary_max"] or 0),
            }
            for r in results
        ],
    }


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    doc = await jobs_collection.find_one({"_id": ObjectId(job_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    return doc_to_response(doc)


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(job_id: str, updates: JobUpdate):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await jobs_collection.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")

    doc = await jobs_collection.find_one({"_id": ObjectId(job_id)})
    return doc_to_response(doc)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    result = await jobs_collection.delete_one({"_id": ObjectId(job_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted"}
