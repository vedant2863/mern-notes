"""
============================================================
FILE 08: FORM DATA, FILE UPLOADS, AND MULTIPART REQUESTS
============================================================
Topics: Form(), File(), UploadFile, multipart/form-data,
        file validation, saving files, StaticFiles, combining
        form fields with file uploads

WHY THIS MATTERS:
Not every API accepts JSON. Job portals need resume PDFs,
e-commerce needs product images, and government portals need
document scans. Understanding form data and file uploads is
essential for building real-world applications.
============================================================
"""

# STORY: Naukri.com — Resume PDF + Profile Photo + Form Fields
# Naukri.com is India's largest job portal with 80+ million registered
# users. When a job seeker updates their profile, they fill out form
# fields (name, experience), upload a resume PDF (max 5 MB), and
# optionally add a profile photo. This is a classic multipart request —
# form data AND files in the same HTTP call.
# Requires: pip install python-multipart

from fastapi import FastAPI, Form, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional
import os
import uuid

app = FastAPI(title="Naukri-Style File Uploads")

# --- Configuration ---
UPLOAD_DIR = "/tmp/naukri_uploads"
MAX_RESUME_SIZE = 5 * 1024 * 1024     # 5 MB
MAX_PHOTO_SIZE = 2 * 1024 * 1024      # 2 MB
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".doc", ".docx"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

os.makedirs(os.path.join(UPLOAD_DIR, "resumes"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "photos"), exist_ok=True)


# ════════════════════════════════════════════════════════════
# SECTION 1 — Form() for Form Data (vs JSON Body)
# ════════════════════════════════════════════════════════════

# WHY: HTML forms submit data as application/x-www-form-urlencoded,
# NOT as JSON. FastAPI's Form() handles this content type.
# You MUST install python-multipart: pip install python-multipart

@app.post("/login")
def login(
    username: str = Form(min_length=3, max_length=50),
    password: str = Form(min_length=8, max_length=100),
):
    """
    Accepts: Content-Type: application/x-www-form-urlencoded
    Body: username=rahul&password=secret1234

    NOTE: This is NOT JSON. Form data uses key=value&key=value format.
    HTML <form> tags send data this way by default.
    """
    return {"username": username, "message": "Login processing..."}


# ════════════════════════════════════════════════════════════
# SECTION 2 — File vs UploadFile: Understanding the Difference
# ════════════════════════════════════════════════════════════

# WHY: FastAPI offers two ways to handle uploads. Understanding when
# to use each saves you from memory issues with large files.

# --- bytes (File) — reads entire file into memory ---
@app.post("/upload/small")
def upload_small_file(
    file_content: bytes = File(description="Small file as bytes"),
):
    """
    File(bytes) loads the entire file into memory.
    Fine for small files (< 1 MB), dangerous for large ones.
    """
    return {"size_bytes": len(file_content)}


# --- UploadFile — memory-efficient, async-capable ---
@app.post("/upload/efficient")
async def upload_efficient(file: UploadFile):
    """
    UploadFile attributes:
    - file.filename    -> original filename ("resume.pdf")
    - file.content_type -> MIME type ("application/pdf")
    - file.size        -> file size in bytes
    - file.read()      -> read content (async)
    - file.seek(0)     -> reset read position
    """
    content = await file.read()
    return {"filename": file.filename, "content_type": file.content_type, "size_bytes": len(content)}


# ════════════════════════════════════════════════════════════
# SECTION 3 — Single File Upload with Validation
# ════════════════════════════════════════════════════════════

# WHY: Accepting any file without validation is a security risk.
# Always validate file type, extension, and size before processing.

def get_file_extension(filename: str) -> str:
    _, ext = os.path.splitext(filename or "")
    return ext.lower()

def generate_unique_filename(original: str) -> str:
    return f"{uuid.uuid4().hex}{get_file_extension(original)}"


@app.post("/upload/resume")
async def upload_resume(
    resume: UploadFile = File(description="Resume (PDF/DOC, max 5MB)"),
):
    """
    Upload a resume with full validation:
    1. Check file extension  2. Check file size  3. Save with unique name
    """
    ext = get_file_extension(resume.filename or "")
    if ext not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid extension '{ext}'. Allowed: {ALLOWED_RESUME_EXTENSIONS}")

    content = await resume.read()
    if len(content) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5 MB.")

    unique_name = generate_unique_filename(resume.filename or "resume.pdf")
    save_path = os.path.join(UPLOAD_DIR, "resumes", unique_name)
    with open(save_path, "wb") as f:
        f.write(content)

    return {"original_name": resume.filename, "saved_as": unique_name, "size_bytes": len(content)}


# ════════════════════════════════════════════════════════════
# SECTION 4 — Combining Form Data + File Uploads (Multipart)
# ════════════════════════════════════════════════════════════

# WHY: This is the Naukri.com use case — form fields (name, experience)
# AND files (resume, photo) in a SINGLE request. This requires
# multipart/form-data encoding.

@app.post("/profile/complete")
async def complete_profile(
    full_name: str = Form(min_length=2, max_length=100),
    email: str = Form(pattern=r"^[\w.+-]+@[\w-]+\.[\w.]+$"),
    phone: str = Form(pattern=r"^[6-9]\d{9}$"),
    experience_years: int = Form(ge=0, le=50),
    skills: str = Form(min_length=2, description="Comma-separated skills"),
    resume: UploadFile = File(description="Resume PDF (max 5 MB)"),
    photo: Optional[UploadFile] = File(default=None, description="Profile photo (max 2 MB)"),
):
    """
    Naukri.com-style profile: form fields + files together.

    IMPORTANT: When mixing Form() and File(), the request MUST be
    multipart/form-data. You CANNOT use JSON body with file uploads.
    """
    result = {
        "full_name": full_name, "email": email, "phone": phone,
        "experience_years": experience_years,
        "skills": [s.strip() for s in skills.split(",")],
    }

    # --- Validate and save resume ---
    ext = get_file_extension(resume.filename or "")
    if ext not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Resume must be PDF/DOC, got '{ext}'")
    resume_content = await resume.read()
    if len(resume_content) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="Resume exceeds 5 MB")
    resume_name = generate_unique_filename(resume.filename or "resume.pdf")
    with open(os.path.join(UPLOAD_DIR, "resumes", resume_name), "wb") as f:
        f.write(resume_content)
    result["resume_file"] = resume_name

    # --- Validate and save photo (optional) ---
    if photo and photo.filename:
        photo_ext = get_file_extension(photo.filename)
        if photo_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Photo must be JPG/PNG/WebP")
        photo_content = await photo.read()
        if len(photo_content) > MAX_PHOTO_SIZE:
            raise HTTPException(status_code=400, detail="Photo exceeds 2 MB")
        photo_name = generate_unique_filename(photo.filename)
        with open(os.path.join(UPLOAD_DIR, "photos", photo_name), "wb") as f:
            f.write(photo_content)
        result["photo_file"] = photo_name

    return {"message": "Profile updated", "profile": result}


# ════════════════════════════════════════════════════════════
# SECTION 5 — Serving Uploaded Files
# ════════════════════════════════════════════════════════════

# WHY: After uploading files, users need to download/view them.

# Mount uploads directory — files accessible via /uploads/photos/abc.jpg
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/download/resume/{filename}")
def download_resume(filename: str):
    """Download with Content-Disposition header. Prevents path traversal."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, "resumes", safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, filename=safe_filename, media_type="application/octet-stream")


# ════════════════════════════════════════════════════════════
# SECTION 6 — Upload Form HTML (Simple Frontend)
# ════════════════════════════════════════════════════════════

@app.get("/upload-form", response_class=HTMLResponse)
def get_upload_form():
    """Minimal HTML form for testing multipart file uploads."""
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Naukri Profile Upload</title></head>
    <body>
        <h1>Complete Your Profile</h1>
        <form action="/profile/complete" method="post" enctype="multipart/form-data">
            <p>Name: <input name="full_name" required></p>
            <p>Email: <input name="email" type="email" required></p>
            <p>Phone: <input name="phone" required pattern="[6-9][0-9]{9}"></p>
            <p>Experience: <input name="experience_years" type="number" min="0" required></p>
            <p>Skills: <input name="skills" required></p>
            <p>Resume: <input name="resume" type="file" accept=".pdf,.doc,.docx" required></p>
            <p>Photo: <input name="photo" type="file" accept=".jpg,.jpeg,.png,.webp"></p>
            <p><button type="submit">Submit</button></p>
        </form>
    </body>
    </html>
    """


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. Form() handles application/x-www-form-urlencoded (HTML forms).
#    File()/UploadFile handles multipart/form-data (file uploads).
# 2. bytes = File() loads entire file into memory — small files only.
#    UploadFile uses disk-backed temp files — safe for large files.
# 3. Always validate: extension, content_type, and size BEFORE saving.
# 4. Generate unique filenames (UUID) to prevent conflicts and
#    directory traversal attacks.
# 5. When mixing Form() + File(), request MUST be multipart/form-data.
# 6. python-multipart is REQUIRED: pip install python-multipart
# "Every resume upload on Naukri is someone's career on the line.
#  Handle their files with care." — Naukri Engineering Philosophy
