import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException

from config import GEMINI_API_KEY, UPLOAD_DIR
from database import analyses_collection
from services.image_processor import validate_image, resize_image_if_needed, save_image
from services.gemini_vision import analyze_crop_image
from models import CropAnalysis, Disease, Treatment

router = APIRouter(prefix="/analyze", tags=["Analysis"])


async def process_single_image(file: UploadFile) -> dict:
    """Process one image: validate, resize, analyze, save."""

    # Read file content
    content = await file.read()

    # Validate image
    validation = validate_image(content, file.content_type)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["errors"])

    # Resize if needed
    processed = resize_image_if_needed(content)

    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    # Save to disk
    save_image(processed, UPLOAD_DIR, unique_name)

    # Send to Gemini Vision
    analysis_data = await analyze_crop_image(processed, file.content_type)

    # Build CropAnalysis model
    diseases = [Disease(**d) for d in analysis_data.get("diseases", [])]
    treatments = [Treatment(**t) for t in analysis_data.get("treatments", [])]

    crop_analysis = CropAnalysis(
        image_filename=unique_name,
        original_name=file.filename,
        crop_detected=analysis_data.get("crop_detected", "unknown"),
        severity=analysis_data.get("severity", "healthy"),
        diseases=diseases,
        treatments=treatments,
        overall_health=analysis_data.get("overall_health", ""),
        additional_notes=analysis_data.get("additional_notes", ""),
    )

    # Save to database
    doc = crop_analysis.model_dump()
    result = await analyses_collection.insert_one(doc)
    crop_analysis.id = str(result.inserted_id)

    return crop_analysis.model_dump()


@router.post("/")
async def analyze_image(file: UploadFile = File(...)):
    """Upload a crop/plant image for disease analysis."""

    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Add it to your .env file.",
        )

    result = await process_single_image(file)

    return {
        "message": "Analysis complete",
        "analysis_id": result.get("id"),
        "crop_detected": result["crop_detected"],
        "severity": result["severity"],
        "diseases_found": len(result["diseases"]),
        "overall_health": result["overall_health"],
    }


@router.post("/batch")
async def analyze_batch(files: list[UploadFile] = File(...)):
    """Upload multiple crop images for batch analysis."""

    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Add it to your .env file.",
        )

    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images per batch")

    results = []
    errors = []

    for file in files:
        try:
            result = await process_single_image(file)
            results.append({
                "filename": file.filename,
                "analysis_id": result.get("id"),
                "crop_detected": result["crop_detected"],
                "severity": result["severity"],
                "diseases_found": len(result["diseases"]),
            })
        except HTTPException as e:
            errors.append({
                "filename": file.filename,
                "error": e.detail,
            })
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e),
            })

    return {
        "total_processed": len(results),
        "total_errors": len(errors),
        "results": results,
        "errors": errors,
    }
