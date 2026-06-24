"""
POST /upload — Parse Excel → structured JSON preview
POST /chat — Process chat message → return next guided question
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from models import ExcelRow, ChatMessage
from parsers.excel_parser import parse_excel
from agents.chat_assistant import run_chat_assistant, REQUIRED_FIELDS

router = APIRouter()


class UploadResponse(BaseModel):
    """Response from Excel upload with parsed data preview."""
    rows: list[ExcelRow]
    row_count: int


class ExcelPreview(BaseModel):
    """Compact summary of a parsed spreadsheet, sent alongside chat turns."""
    filename: str
    rows: int
    cols: int
    headers: list[str] = []
    sample_rows: list[dict] = []   # first few rows: {column: value}
    columns: list[dict] = []       # per-column stats from summarizeColumns()


class ChatRequest(BaseModel):
    """Request body for chat endpoint — full transcript + optional Excel summary."""
    chat_messages: list[ChatMessage]
    excel_preview: ExcelPreview | None = None


class ChatResponse(BaseModel):
    """Conversational reply plus captured-context state for the UI."""
    reply: str
    captured_fields: list[str]
    ready: bool
    missing_required: list[str]


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
    Process a chat turn → real LLM reply + captured-context state.

    The LLM intake assistant answers the user conversationally, decides which
    context fields are captured from the transcript + parsed spreadsheet, and
    signals `ready` once all required fields are present so the UI can offer to
    generate the program.
    """
    excel_preview = (
        request.excel_preview.model_dump() if request.excel_preview else None
    )
    result = await run_chat_assistant(request.chat_messages, excel_preview)

    captured = result["captured_fields"]
    missing_required = [f for f in REQUIRED_FIELDS if f not in captured]

    return ChatResponse(
        reply=result["reply"],
        captured_fields=captured,
        ready=result["ready"],
        missing_required=missing_required,
    )
