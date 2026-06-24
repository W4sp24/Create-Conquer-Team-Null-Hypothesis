"""
POST /sources/upload — Ingest file → org_collection ChromaDB
GET /sources — List all uploaded sources with metadata
DELETE /sources/{filename} — Remove all chunks for a source
"""

import os
from datetime import datetime
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException

from models import SourceMetadata

router = APIRouter()

# Directory for storing uploaded organization files
ORG_UPLOADS_DIR = "./knowledge_base/chroma_db/org_uploads"


@router.post("/sources/upload")
async def upload_source(file: UploadFile = File(...)) -> dict:
    """
    Ingest file → org_collection ChromaDB
    
    Purpose: Ingest file → org_collection ChromaDB
    
    Accepts PDFs, DOCX, TXT files. Chunks them and stores in the
    organization's ChromaDB collection for retrieval during pipeline execution.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Validate file type
    allowed_extensions = {'.pdf', '.docx', '.txt', '.doc'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Ensure upload directory exists
        os.makedirs(ORG_UPLOADS_DIR, exist_ok=True)
        
        # Save file to disk
        file_path = os.path.join(ORG_UPLOADS_DIR, file.filename)
        content = await file.read()
        
        with open(file_path, 'wb') as f:
            f.write(content)
        
        # TODO: When feat/rag-layer merges, this will:
        # 1. Extract text from the file
        # 2. Chunk the content
        # 3. Embed chunks using sentence-transformers
        # 4. Store in ChromaDB org_collection
        
        # For now, just acknowledge the upload
        return {
            "filename": file.filename,
            "status": "uploaded",
            "message": "File uploaded successfully. RAG ingestion will be implemented when feat/rag-layer merges."
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/sources")
async def list_sources() -> List[SourceMetadata]:
    """
    List all uploaded sources with metadata
    
    Purpose: List all uploaded sources with metadata
    
    Returns list of all organization-uploaded documents with their metadata
    (filename, chunk count, upload timestamp).
    """
    sources = []
    
    try:
        # Check if directory exists
        if not os.path.exists(ORG_UPLOADS_DIR):
            return sources
        
        # List all files in the uploads directory
        for filename in os.listdir(ORG_UPLOADS_DIR):
            file_path = os.path.join(ORG_UPLOADS_DIR, filename)
            
            # Skip directories
            if os.path.isdir(file_path):
                continue
            
            # Get file stats
            stat = os.stat(file_path)
            uploaded_at = datetime.fromtimestamp(stat.st_mtime).isoformat()
            
            # TODO: When feat/rag-layer merges, get actual chunk_count from ChromaDB
            # For now, use placeholder
            chunk_count = 0
            
            sources.append(SourceMetadata(
                filename=filename,
                source_type="org_upload",
                chunk_count=chunk_count,
                uploaded_at=uploaded_at
            ))
        
        return sources
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list sources: {str(e)}"
        )


@router.delete("/sources/{filename}")
async def delete_source(filename: str) -> dict:
    """
    Remove all chunks for a source
    
    Purpose: Remove all chunks for a source
    
    Deletes the file and removes all associated chunks from ChromaDB.
    """
    try:
        file_path = os.path.join(ORG_UPLOADS_DIR, filename)
        
        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"Source '{filename}' not found"
            )
        
        # Delete the file
        os.remove(file_path)
        
        # TODO: When feat/rag-layer merges, also delete chunks from ChromaDB
        # using the ingestor/retriever modules
        
        return {
            "filename": filename,
            "status": "deleted",
            "message": "Source deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete source: {str(e)}"
        )

# Made with Bob
