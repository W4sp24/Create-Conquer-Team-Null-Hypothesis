"""
Admin endpoints for specialized KB management (no auth — hidden route).
POST   /admin/ingest-specialized     — upload PDF/DOCX/TXT → ingest into specialized_collection
GET    /admin/specialized-sources    — list sources in specialized KB
DELETE /admin/specialized/{filename} — remove a source from specialized KB
"""
import asyncio
import os
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from models import SourceMetadata
from rag.chroma_client import specialized_collection
from rag.ingestor import delete_source, ingest_file, list_sources

router = APIRouter(prefix="/admin")

_ALLOWED = {".pdf", ".docx", ".doc", ".txt"}


@router.post("/ingest-specialized")
async def ingest_specialized(file: UploadFile = File(...)) -> dict:
    """Upload and ingest a document into the specialized knowledge base."""
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in _ALLOWED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported type '{ext}'. Allowed: {', '.join(sorted(_ALLOWED))}",
        )

    content = await file.read()

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        chunk_count = await asyncio.to_thread(
            ingest_file, tmp_path, specialized_collection, filename
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")
    finally:
        os.unlink(tmp_path)

    return {"filename": filename, "status": "ingested", "chunk_count": chunk_count}


@router.get("/specialized-sources")
async def get_specialized_sources() -> list[SourceMetadata]:
    """List all sources currently in the specialized knowledge base."""
    sources = await asyncio.to_thread(list_sources, specialized_collection)
    return [
        SourceMetadata(
            filename=s["source_name"],
            source_type="specialized",
            chunk_count=s["chunk_count"],
            uploaded_at=s["uploaded_at"],
        )
        for s in sources
    ]


@router.delete("/specialized/{filename}")
async def delete_specialized_source(filename: str) -> dict:
    """Remove all chunks for a source from the specialized knowledge base."""
    existing = await asyncio.to_thread(
        specialized_collection.get,
        where={"source": filename},
        include=[],
        limit=1,
    )
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail=f"Source '{filename}' not found")

    await asyncio.to_thread(delete_source, specialized_collection, filename)
    return {"filename": filename, "status": "deleted"}
