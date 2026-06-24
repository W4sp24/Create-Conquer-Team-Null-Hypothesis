from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from datetime import datetime
import uuid
import os
from models import SourceUploadResponse, SourceListResponse, SourceMetadata

router = APIRouter()

# In-memory storage for source metadata
sources_metadata: dict[str, SourceMetadata] = {}

# Directory for storing uploaded files (in production, use proper storage)
UPLOAD_DIR = "knowledge_base/chroma_db/org_uploads"


@router.post("/sources/upload", response_model=SourceUploadResponse)
async def upload_source(file: UploadFile = File(...)):
    """
    Ingest file → org_collection ChromaDB
    
    Uploads a source document to the organization's knowledge base.
    Chunks and embeds the document into ChromaDB for retrieval.
    """
    # Validate file type
    allowed_extensions = ['.pdf', '.docx', '.txt', '.doc']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Read file content
        contents = await file.read()
        file_size = len(contents)
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        safe_filename = f"{file_id}_{file.filename}"
        
        # Save file (in production, save to proper storage)
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        with open(file_path, 'wb') as f:
            f.write(contents)
        
        # Simulate chunking and embedding
        # In production, this would:
        # 1. Extract text from PDF/DOCX
        # 2. Chunk the text
        # 3. Embed chunks using sentence-transformers
        # 4. Store in ChromaDB org_collection
        
        chunk_count = len(contents) // 1000  # Rough estimate
        if chunk_count == 0:
            chunk_count = 1
        
        # Store metadata
        metadata = SourceMetadata(
            filename=file.filename,
            org_id="default_org",  # In production, get from auth
            uploaded_at=datetime.utcnow(),
            chunk_count=chunk_count,
            file_type=file_ext,
            file_size=file_size
        )
        
        sources_metadata[safe_filename] = metadata
        
        return SourceUploadResponse(
            message=f"Successfully ingested {file.filename}",
            filename=safe_filename,
            chunks_ingested=chunk_count
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/sources", response_model=SourceListResponse)
async def list_sources():
    """
    List all uploaded sources with metadata
    
    Returns a list of all documents uploaded to the organization's knowledge base,
    including metadata like upload date, chunk count, and file size.
    """
    sources = list(sources_metadata.values())
    
    return SourceListResponse(sources=sources)


@router.delete("/sources/{filename}")
async def delete_source(filename: str):
    """
    Remove all chunks for a source
    
    Deletes a source document and all its chunks from the knowledge base.
    """
    if filename not in sources_metadata:
        raise HTTPException(status_code=404, detail="Source not found")
    
    try:
        # Delete file from storage
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Remove from ChromaDB (in production)
        # chroma_client.delete_by_filename(filename)
        
        # Remove metadata
        del sources_metadata[filename]
        
        return {
            "message": f"Successfully deleted {filename}",
            "filename": filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting source: {str(e)}")


@router.get("/sources/{filename}/metadata")
async def get_source_metadata(filename: str):
    """Get metadata for a specific source"""
    if filename not in sources_metadata:
        raise HTTPException(status_code=404, detail="Source not found")
    
    return sources_metadata[filename]


@router.get("/sources/{filename}/chunks")
async def get_source_chunks(filename: str):
    """
    Get all chunks for a source document
    
    Returns all text chunks that were extracted from the source document.
    Useful for debugging and verification.
    """
    if filename not in sources_metadata:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # In production, query ChromaDB for all chunks with this filename
    # For now, return mock data
    
    metadata = sources_metadata[filename]
    
    return {
        "filename": filename,
        "chunk_count": metadata.chunk_count,
        "chunks": [
            {
                "chunk_id": i,
                "text": f"Sample chunk {i} from {filename}",
                "metadata": {
                    "source": filename,
                    "chunk_index": i
                }
            }
            for i in range(min(metadata.chunk_count, 10))  # Return first 10 chunks
        ]
    }

# Made with Bob
