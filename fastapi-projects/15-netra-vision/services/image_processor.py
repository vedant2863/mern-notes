import os
import io
from PIL import Image
from config import MAX_FILE_SIZE_MB, ALLOWED_IMAGE_TYPES, MAX_IMAGE_DIMENSION


def validate_image(content: bytes, content_type: str) -> dict:
    """Validate image file: type, size, and dimensions."""
    errors = []

    # Check content type
    if content_type not in ALLOWED_IMAGE_TYPES:
        errors.append(f"Invalid image type: {content_type}. Allowed: {ALLOWED_IMAGE_TYPES}")

    # Check file size
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        errors.append(f"Image too large: {size_mb:.1f}MB. Max: {MAX_FILE_SIZE_MB}MB")

    if errors:
        return {"valid": False, "errors": errors}

    # Check if it's a valid image
    try:
        image = Image.open(io.BytesIO(content))
        width, height = image.size
    except Exception:
        return {"valid": False, "errors": ["File is not a valid image"]}

    return {
        "valid": True,
        "width": width,
        "height": height,
        "format": image.format,
        "size_mb": round(size_mb, 2),
    }


def resize_image_if_needed(content: bytes) -> bytes:
    """Resize image if it exceeds max dimensions. Returns bytes."""
    image = Image.open(io.BytesIO(content))
    width, height = image.size

    # No resize needed
    if width <= MAX_IMAGE_DIMENSION and height <= MAX_IMAGE_DIMENSION:
        return content

    # Calculate new size maintaining aspect ratio
    if width > height:
        new_width = MAX_IMAGE_DIMENSION
        new_height = int(height * (MAX_IMAGE_DIMENSION / width))
    else:
        new_height = MAX_IMAGE_DIMENSION
        new_width = int(width * (MAX_IMAGE_DIMENSION / height))

    resized = image.resize((new_width, new_height), Image.LANCZOS)

    # Save to bytes
    output = io.BytesIO()
    img_format = image.format or "JPEG"
    resized.save(output, format=img_format)
    return output.getvalue()


def save_image(content: bytes, upload_dir: str, filename: str) -> str:
    """Save image bytes to disk and return the file path."""
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    return file_path
