from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
import pandas as pd
import io
from models import ChatMessage, ChatResponse, UploadResponse
import uuid

router = APIRouter()

# In-memory storage for chat sessions and parsed data
chat_sessions: Dict[str, Dict[str, Any]] = {}
uploaded_data: Dict[str, Dict[str, Any]] = {}


@router.post("/upload", response_model=UploadResponse)
async def upload_excel(file: UploadFile = File(...)):
    """
    Parse Excel → structured JSON preview
    
    Parses Excel file into structured JSON rows. Column headers are
    interpreted by the Data Analyst agent — no rigid column name mapping required.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Convert to JSON structure
        data_json = df.to_dict(orient='records')
        
        # Store parsed data with a session ID
        session_id = str(uuid.uuid4())
        uploaded_data[session_id] = {
            'filename': file.filename,
            'data': data_json,
            'columns': list(df.columns),
            'row_count': len(df)
        }
        
        # Create preview (first 5 rows)
        preview = {
            'columns': list(df.columns),
            'sample_rows': data_json[:5],
            'session_id': session_id
        }
        
        return UploadResponse(
            message=f"Successfully parsed {file.filename}",
            preview=preview,
            row_count=len(df)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing Excel file: {str(e)}")


@router.post("/chat", response_model=ChatResponse)
async def process_chat(message: ChatMessage):
    """
    Process chat message → return next guided question
    
    After Excel upload, the system reads the data and asks smart data-aware questions
    ("I can see 5,000 beneficiaries — what is your budget?"). User can type freely at any point.
    Captures budget, staff, constraints, local context.
    """
    session_id = message.session_id or str(uuid.uuid4())
    
    # Initialize session if new
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {
            'messages': [],
            'context': {},
            'question_index': 0
        }
    
    session = chat_sessions[session_id]
    
    # Store user message
    session['messages'].append({
        'role': 'user',
        'content': message.message
    })
    
    # Parse user input for context extraction (simplified)
    # In production, this would use NLP/LLM to extract structured info
    user_msg_lower = message.message.lower()
    
    # Extract context from message
    if 'budget' in user_msg_lower or '$' in message.message:
        # Try to extract budget amount
        import re
        numbers = re.findall(r'\d+(?:,\d{3})*(?:\.\d+)?', message.message.replace(',', ''))
        if numbers:
            session['context']['budget'] = float(numbers[0])
    
    if 'staff' in user_msg_lower or 'people' in user_msg_lower:
        import re
        numbers = re.findall(r'\d+', message.message)
        if numbers:
            session['context']['staff_count'] = int(numbers[0])
    
    # Determine next question based on what we have
    questions = [
        "What is your total budget for this program?",
        "How many staff members do you have available?",
        "What are the main constraints or challenges you're facing?",
        "Can you describe the local context or any cultural considerations?",
        "Is there anything else important I should know about your situation?"
    ]
    
    # Get next question
    question_index = session['question_index']
    if question_index < len(questions):
        next_question = questions[question_index]
        session['question_index'] += 1
    else:
        next_question = "Thank you! I have all the information I need. You can now run the pipeline."
    
    # Store assistant response
    session['messages'].append({
        'role': 'assistant',
        'content': next_question
    })
    
    return ChatResponse(
        question=next_question,
        session_id=session_id
    )


@router.get("/chat/{session_id}/context")
async def get_chat_context(session_id: str):
    """Get the extracted context from a chat session"""
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        'session_id': session_id,
        'context': chat_sessions[session_id]['context'],
        'messages': chat_sessions[session_id]['messages']
    }


@router.get("/upload/{session_id}/data")
async def get_uploaded_data(session_id: str):
    """Get the uploaded Excel data for a session"""
    if session_id not in uploaded_data:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    return uploaded_data[session_id]

# Made with Bob
