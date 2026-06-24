from __future__ import annotations
import uuid
from datetime import datetime, timezone

import chromadb
from sentence_transformers import SentenceTransformer

from config import EMBED_MODEL, CHUNK_SIZE, CHUNK_OVERLAP

_embedder: SentenceTransformer | None = None


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def _extract_text(file_path: str) -> str:
    lower = file_path.lower()
    if lower.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif lower.endswith(".pdf"):
        import pypdf
        reader = pypdf.PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    elif lower.endswith((".docx", ".doc")):
        import docx
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)
    raise ValueError(f"Unsupported file type: {file_path}")


def _chunk_text(text: str) -> list[str]:
    words = text.split()
    step = CHUNK_SIZE - CHUNK_OVERLAP
    chunks = []
    for i in range(0, max(1, len(words)), step):
        chunk = " ".join(words[i : i + CHUNK_SIZE])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def ingest_file(
    file_path: str,
    collection: chromadb.Collection,
    source_name: str,
    uploaded_at: str | None = None,
) -> int:
    """Extract, chunk, embed, and store a file. Returns number of chunks stored."""
    if uploaded_at is None:
        uploaded_at = datetime.now(timezone.utc).isoformat()

    text = _extract_text(file_path)
    chunks = _chunk_text(text)
    if not chunks:
        return 0

    embeddings = _get_embedder().encode(chunks).tolist()
    ids = [str(uuid.uuid4()) for _ in chunks]
    metadatas = [
        {"source": source_name, "chunk_index": i, "uploaded_at": uploaded_at}
        for i in range(len(chunks))
    ]

    collection.add(
        documents=chunks,
        embeddings=embeddings,
        ids=ids,
        metadatas=metadatas,
    )
    return len(chunks)


def delete_source(collection: chromadb.Collection, source_name: str) -> None:
    """Remove all chunks for a given source from a ChromaDB collection."""
    results = collection.get(where={"source": source_name}, include=[])
    if results["ids"]:
        collection.delete(ids=results["ids"])


def list_sources(collection: chromadb.Collection) -> list[dict]:
    """Return unique sources with chunk count and upload time from a collection."""
    results = collection.get(include=["metadatas"])
    if not results["metadatas"]:
        return []

    seen: dict[str, dict] = {}
    for meta in results["metadatas"]:
        name = meta.get("source", "unknown")
        if name not in seen:
            seen[name] = {
                "source_name": name,
                "chunk_count": 0,
                "uploaded_at": meta.get("uploaded_at", ""),
            }
        seen[name]["chunk_count"] += 1

    return list(seen.values())
