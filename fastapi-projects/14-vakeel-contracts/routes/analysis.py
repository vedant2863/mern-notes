from fastapi import APIRouter, HTTPException
from bson import ObjectId

from database import contracts_collection, analyses_collection
from services.gemini_analyzer import analyze_contract
from config import GEMINI_API_KEY

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.post("/analyze/{contract_id}")
async def run_analysis(contract_id: str):
    """Run AI analysis on an uploaded contract."""

    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Add it to your .env file.",
        )

    # Find the contract
    try:
        contract = await contracts_collection.find_one(
            {"_id": ObjectId(contract_id)}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contract ID format")

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if not contract.get("text_content"):
        raise HTTPException(
            status_code=400, detail="Contract has no text content to analyze"
        )

    # Update contract status
    await contracts_collection.update_one(
        {"_id": ObjectId(contract_id)},
        {"$set": {"status": "analyzing"}},
    )

    # Run AI analysis
    try:
        result = await analyze_contract(contract_id, contract["text_content"])
    except Exception as e:
        await contracts_collection.update_one(
            {"_id": ObjectId(contract_id)},
            {"$set": {"status": "error"}},
        )
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Save analysis result
    doc = result.model_dump()
    insert_result = await analyses_collection.insert_one(doc)
    result.id = str(insert_result.inserted_id)

    # Update contract status
    await contracts_collection.update_one(
        {"_id": ObjectId(contract_id)},
        {"$set": {"status": "analyzed"}},
    )

    return {
        "analysis_id": result.id,
        "contract_id": contract_id,
        "contract_type": result.contract_type,
        "summary": result.summary,
        "overall_risk_level": result.overall_risk_level,
        "clauses_found": len(result.key_clauses),
        "risks_found": len(result.risk_flags),
        "recommendations": result.recommendations,
    }


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get full analysis result by ID."""
    try:
        doc = await analyses_collection.find_one({"_id": ObjectId(analysis_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid analysis ID format")

    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")

    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/contract/{contract_id}")
async def get_analyses_for_contract(contract_id: str):
    """Get all analyses for a specific contract."""
    analyses = []
    cursor = analyses_collection.find({"contract_id": contract_id})

    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        analyses.append(doc)

    return {"analyses": analyses, "total": len(analyses)}
