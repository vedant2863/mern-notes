"""
Text chunker — splits documents into overlapping chunks.
This is the first step in RAG: break big documents into small pieces.
"""

from config import CHUNK_SIZE, CHUNK_OVERLAP


def split_into_chunks(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """
    Split text into overlapping chunks using recursive character splitting.
    We try to split on paragraphs first, then sentences, then words.
    """
    if len(text) <= chunk_size:
        return [text.strip()] if text.strip() else []

    # Separators to try, in order of preference
    separators = ["\n\n", "\n", ". ", " "]

    chunks = _recursive_split(text, separators, chunk_size, chunk_overlap)
    return [c.strip() for c in chunks if c.strip()]


def _recursive_split(
    text: str,
    separators: list[str],
    chunk_size: int,
    chunk_overlap: int
) -> list[str]:
    """Try splitting with the best separator, fall back to next."""

    if len(text) <= chunk_size:
        return [text]

    # Find the best separator that exists in the text
    best_separator = separators[-1]  # default to space
    for sep in separators:
        if sep in text:
            best_separator = sep
            break

    # Split by the chosen separator
    parts = text.split(best_separator)

    # Merge parts into chunks of appropriate size
    chunks = []
    current_chunk = ""

    for part in parts:
        # Add separator back (except for the first piece)
        candidate = current_chunk + best_separator + part if current_chunk else part

        if len(candidate) <= chunk_size:
            current_chunk = candidate
        else:
            # Save current chunk if it has content
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = part

    # Don't forget the last chunk
    if current_chunk:
        chunks.append(current_chunk)

    # Add overlap between chunks
    if chunk_overlap > 0 and len(chunks) > 1:
        chunks = _add_overlap(chunks, chunk_overlap)

    return chunks


def _add_overlap(chunks: list[str], overlap_size: int) -> list[str]:
    """Add overlapping text between consecutive chunks."""
    overlapped = [chunks[0]]

    for i in range(1, len(chunks)):
        # Take the end of the previous chunk as overlap
        prev_text = chunks[i - 1]
        overlap = prev_text[-overlap_size:] if len(prev_text) > overlap_size else prev_text

        # Prepend overlap to current chunk
        overlapped.append(overlap + " " + chunks[i])

    return overlapped


def estimate_page_number(chunk_index: int, total_chunks: int, estimated_pages: int = 1) -> int:
    """Rough estimate of which page a chunk belongs to."""
    if total_chunks == 0:
        return 1
    page = int((chunk_index / total_chunks) * estimated_pages) + 1
    return min(page, estimated_pages)
