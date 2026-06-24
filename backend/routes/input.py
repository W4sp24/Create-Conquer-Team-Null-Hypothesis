"""
POST /upload — Parse Excel → structured JSON preview
POST /chat — Process chat message → return next guided question
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from models import ExcelRow, ChatMessage
from parsers.excel_parser import parse_excel

router = APIRouter()


class UploadResponse(BaseModel):
    """Response from Excel upload with parsed data preview."""
    rows: list[ExcelRow]
    row_count: int


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str
    excel_data: list[ExcelRow] | None = None


class ChatResponse(BaseModel):
    """Response from chat endpoint with next guided question."""
    question: str
    role: str = "assistant"


@router.post("/upload")
async def upload_excel(file: UploadFile = File(...)) -> UploadResponse:
    """
    Parse Excel → structured JSON preview
    
    Purpose: Parse Excel → structured JSON preview
    """
    if not file.filename or not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .xlsx and .xls files are supported."
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse Excel using the excel_parser module
        rows = parse_excel(content)
        
        return UploadResponse(
            rows=rows,
            row_count=len(rows)
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Excel file: {str(e)}"
        )


@router.post("/chat")
async def process_chat(request: ChatRequest) -> ChatResponse:
    """
    Process chat message → return next guided question
    
    Purpose: Process chat message → return next guided question
    
    After Excel upload, the system reads the data and asks smart data-aware
    guided questions. User can type freely at any point. Captures budget,
    staff, constraints, local context.
    """
    # This is a guided chat system that asks contextual questions
    # based on the uploaded Excel data
    
    # For MVP, we'll implement a simple question flow
    # In production, this would use an LLM to generate smart questions
    
    message_lower = request.message.lower()
    
    # Check if user has uploaded data
    if not request.excel_data:
        return ChatResponse(
            question="Please upload your Excel file first to begin the assessment."
        )
    
    # Analyze what information we might be missing
    # This is a simplified version - production would use LLM
    
    if "budget" not in message_lower and "cost" not in message_lower:
        return ChatResponse(
            question=f"I can see {len(request.excel_data)} beneficiaries in your data. What is your available budget for this program?"
        )
    
    if "staff" not in message_lower and "team" not in message_lower:
        return ChatResponse(
            question="How many staff members do you have available for program implementation?"
        )
    
    if "constraint" not in message_lower and "challenge" not in message_lower:
        return ChatResponse(
            question="Are there any specific constraints or challenges in your region that we should consider (e.g., seasonal factors, infrastructure limitations)?"
        )
    
    if "timeline" not in message_lower and "duration" not in message_lower:
        return ChatResponse(
            question="What is your preferred timeline for program implementation?"
        )
    
    # If we've covered the basics, acknowledge and prepare for pipeline
    return ChatResponse(
        question="Thank you for providing that information. I have everything I need to generate a customized program. Click 'Run' when you're ready to proceed."
    )

# Made with Bob
