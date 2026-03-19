import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from config import UPLOAD_DIR, MAX_FILE_SIZE_MB, ALLOWED_EXTENSIONS
from database import contracts_collection
from services.document_parser import extract_text
from models import Contract

router = APIRouter(prefix="/contracts", tags=["Contracts"])


@router.post("/upload")
async def upload_contract(file: UploadFile = File(...)):
    """Upload a PDF or TXT contract file."""

    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext} not allowed. Use: {ALLOWED_EXTENSIONS}",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({size_mb:.1f}MB). Max: {MAX_FILE_SIZE_MB}MB",
        )

    # Save file to uploads directory
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    # Extract text from the file
    try:
        parsed = extract_text(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    # Create contract record
    contract = Contract(
        filename=unique_name,
        original_name=file.filename,
        text_content=parsed["text"],
        page_count=parsed["page_count"],
        word_count=parsed["word_count"],
        status="uploaded",
    )

    # Save to database
    doc = contract.model_dump()
    result = await contracts_collection.insert_one(doc)
    contract.id = str(result.inserted_id)

    return {
        "message": "Contract uploaded successfully",
        "contract_id": contract.id,
        "filename": file.filename,
        "page_count": contract.page_count,
        "word_count": contract.word_count,
    }


@router.get("/")
async def list_contracts():
    """List all uploaded contracts."""
    contracts = []
    cursor = contracts_collection.find({}, {"text_content": 0})

    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        contracts.append(doc)

    return {"contracts": contracts, "total": len(contracts)}


@router.get("/{contract_id}")
async def get_contract(contract_id: str):
    """Get a specific contract by ID."""
    from bson import ObjectId

    try:
        doc = await contracts_collection.find_one({"_id": ObjectId(contract_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contract ID format")

    if not doc:
        raise HTTPException(status_code=404, detail="Contract not found")

    doc["id"] = str(doc.pop("_id"))
    # Return first 500 chars of text as preview
    if len(doc.get("text_content", "")) > 500:
        doc["text_preview"] = doc["text_content"][:500] + "..."
        doc.pop("text_content")

    return doc
