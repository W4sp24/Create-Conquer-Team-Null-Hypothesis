"""
POST /sources/upload — Ingest file into org_collection ChromaDB
GET  /sources        — List all uploaded sources with metadata
DELETE /sources/{filename} — Remove all chunks for a source
"""

import asyncio
import os

from fastapi import APIRouter, UploadFile, File, HTTPException

from models import SourceMetadata
from rag.chroma_client import org_collection
from rag.ingestor import ingest_file, delete_source, list_sources

router = APIRouter()

ORG_UPLOADS_DIR = "./knowledge_base/chroma_db/org_uploads"
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}


@router.post("/sources/upload")
async def upload_source(file: UploadFile = File(...)) -> dict:
    """Ingest an org document into ChromaDB and return chunk count."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()

    os.makedirs(ORG_UPLOADS_DIR, exist_ok=True)
    file_path = os.path.join(ORG_UPLOADS_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        n = await asyncio.to_thread(
            ingest_file, file_path, org_collection, file.filename
        )
    except Exception as exc:
        os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")

    return {"filename": file.filename, "status": "ingested", "chunk_count": n}


@router.get("/sources")
async def get_sources() -> list[SourceMetadata]:
    """List all org-uploaded sources with chunk count and upload time."""
    sources = await asyncio.to_thread(list_sources, org_collection)
    return [
        SourceMetadata(
            filename=s["source_name"],
            source_type="org_upload",
            chunk_count=s["chunk_count"],
            uploaded_at=s["uploaded_at"],
        )
        for s in sources
    ]


@router.delete("/sources/{filename}")
async def remove_source(filename: str) -> dict:
    """Delete all chunks for a source from ChromaDB and remove the file."""
    existing = await asyncio.to_thread(
        org_collection.get,
        where={"source": filename},
        include=[],
        limit=1,
    )
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail=f"Source '{filename}' not found")

    await asyncio.to_thread(delete_source, org_collection, filename)

    file_path = os.path.join(ORG_UPLOADS_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    return {"filename": filename, "status": "deleted"}
