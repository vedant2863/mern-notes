"""
ChromaDB vector store — stores and searches embeddings.
Think of it as a database where you search by *meaning* instead of keywords.
"""

import chromadb
from config import CHROMA_PATH


# Persistent client — data survives server restarts
client = chromadb.PersistentClient(path=CHROMA_PATH)

# One collection for all document chunks
COLLECTION_NAME = "vidya_chunks"


def get_collection():
    """Get or create the chunks collection."""
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "Study material chunks for RAG"}
    )


def add_chunks(
    chunk_ids: list[str],
    texts: list[str],
    embeddings: list[list[float]],
    metadatas: list[dict]
):
    """Add chunks with their embeddings to the vector store."""
    collection = get_collection()
    collection.add(
        ids=chunk_ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas
    )


def search_similar(
    query_embedding: list[float],
    top_k: int = 5
) -> dict:
    """
    Find the most similar chunks to a query embedding.
    Returns documents, metadatas, and distances.
    """
    collection = get_collection()

    # Check if collection has any documents
    if collection.count() == 0:
        return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count())
    )
    return results


def delete_document_chunks(document_id: int):
    """Remove all chunks belonging to a document."""
    collection = get_collection()

    # Get all chunks for this document
    results = collection.get(
        where={"document_id": document_id}
    )

    if results["ids"]:
        collection.delete(ids=results["ids"])


def get_collection_stats() -> dict:
    """Get stats about the vector store."""
    collection = get_collection()
    return {
        "total_chunks": collection.count(),
        "collection_name": COLLECTION_NAME
    }
