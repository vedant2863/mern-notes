import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/uploads", tags=["Uploads"])

UPLOAD_DIR = "uploads"


@router.post("/logo")
def upload_logo(file: UploadFile = File(...)):
    """Upload a shop logo image (PNG or JPG)."""
    # Validate file type
    allowed = ["image/png", "image/jpeg"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only PNG and JPG files allowed")

    # Save the file
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "filename": file.filename,
        "path": file_path,
        "message": "Logo uploaded. Use this path when creating an invoice.",
    }
