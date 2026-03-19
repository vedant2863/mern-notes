"""
Document routes — upload, list, and delete study materials.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from models import DocumentResponse, UploadResponse
from database import insert_document, get_all_documents, get_document_by_id, delete_document
from services.chunker import split_into_chunks, estimate_page_number
from services.embedder import embed_texts
from services.vector_store import add_chunks, delete_document_chunks

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    title: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload a text/PDF document, chunk it, embed it, store in ChromaDB."""

    # Read the file content
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    if not text.strip():
        raise HTTPException(status_code=400, detail="File is empty")

    # Step 1: Chunk the text
    chunks = split_into_chunks(text)

    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks created from document")

    # Step 2: Save document metadata to SQLite
    doc_id = insert_document(title=title, chunk_count=len(chunks))

    # Step 3: Generate embeddings for all chunks
    embeddings = embed_texts(chunks)

    # Step 4: Estimate pages (rough: ~3000 chars per page)
    estimated_pages = max(1, len(text) // 3000)

    # Step 5: Store in ChromaDB
    chunk_ids = [f"doc{doc_id}_chunk{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": doc_id,
            "document_title": title,
            "chunk_index": i,
            "page_estimate": estimate_page_number(i, len(chunks), estimated_pages)
        }
        for i in range(len(chunks))
    ]

    add_chunks(
        chunk_ids=chunk_ids,
        texts=chunks,
        embeddings=embeddings,
        metadatas=metadatas
    )

    return UploadResponse(
        message=f"Document '{title}' processed successfully",
        document_id=doc_id,
        title=title,
        chunks_created=len(chunks)
    )


@router.get("/", response_model=list[DocumentResponse])
async def list_documents():
    """List all uploaded documents."""
    docs = get_all_documents()
    return docs


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: int):
    """Get a single document by ID."""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}")
async def remove_document(doc_id: int):
    """Delete a document and its chunks from both SQLite and ChromaDB."""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from vector store first
    delete_document_chunks(doc_id)

    # Then remove from SQLite
    delete_document(doc_id)

    return {"message": f"Document '{doc['title']}' deleted successfully"}
