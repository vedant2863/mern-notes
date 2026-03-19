import os
from PyPDF2 import PdfReader


def extract_text_from_pdf(file_path: str) -> dict:
    """Extract text content from a PDF file."""
    reader = PdfReader(file_path)
    pages = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())

    full_text = "\n\n".join(pages)

    return {
        "text": full_text,
        "page_count": len(reader.pages),
        "word_count": len(full_text.split()),
    }


def extract_text_from_txt(file_path: str) -> dict:
    """Extract text from a plain text file."""
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    return {
        "text": text,
        "page_count": 1,
        "word_count": len(text.split()),
    }


def extract_text(file_path: str) -> dict:
    """Extract text from a file based on its extension."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".txt":
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
