from fastapi import APIRouter, HTTPException
from bson import ObjectId
from datetime import datetime

from models.job import JobCreate, JobResponse, JobUpdate
from database import jobs_collection

router = APIRouter(prefix="/v1/jobs", tags=["v1-jobs"])


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
async def list_jobs():
    """V1: Simple list, no filtering."""
    cursor = jobs_collection.find().sort("created_at", -1).limit(20)

    jobs = []
    async for doc in cursor:
        jobs.append(doc_to_response(doc))
    return jobs


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
