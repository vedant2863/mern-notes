from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId

from database import analyses_collection

router = APIRouter(prefix="/analyses", tags=["History"])


@router.get("/")
async def list_analyses(
    crop: str = Query(None, description="Filter by crop name"),
    severity: str = Query(None, description="Filter by severity level"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List past analyses with optional filters."""

    # Build filter
    query = {}
    if crop:
        query["crop_detected"] = {"$regex": crop, "$options": "i"}
    if severity:
        query["severity"] = severity

    # Get total count
    total = await analyses_collection.count_documents(query)

    # Fetch results (exclude large fields for list view)
    cursor = analyses_collection.find(
        query,
        {
            "diseases": 0,
            "treatments": 0,
            "additional_notes": 0,
        },
    ).sort("upload_date", -1).skip(skip).limit(limit)

    analyses = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        analyses.append(doc)

    return {
        "analyses": analyses,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get full analysis details by ID."""
    try:
        doc = await analyses_collection.find_one({"_id": ObjectId(analysis_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format")

    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")

    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/stats/summary")
async def analysis_stats():
    """Get summary statistics across all analyses."""

    total = await analyses_collection.count_documents({})

    # Count by severity
    severity_pipeline = [
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    severity_counts = {}
    async for doc in analyses_collection.aggregate(severity_pipeline):
        severity_counts[doc["_id"]] = doc["count"]

    # Count by crop
    crop_pipeline = [
        {"$group": {"_id": "$crop_detected", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_crops = {}
    async for doc in analyses_collection.aggregate(crop_pipeline):
        top_crops[doc["_id"]] = doc["count"]

    return {
        "total_analyses": total,
        "by_severity": severity_counts,
        "top_crops": top_crops,
    }
