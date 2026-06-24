"""
POST /run — Start pipeline → returns run_id, fires agents async
GET /stream/{run_id} — SSE endpoint → streams agent status to React
GET /result/{run_id} — Retrieve completed program JSON
"""

import asyncio
import uuid
from typing import Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from models import ContextPayload, ProgramOutput, SSEEvent
from orchestrator import run_pipeline

router = APIRouter()

# In-memory storage for run results and SSE queues
_run_results: Dict[str, ProgramOutput] = {}
_sse_queues: Dict[str, asyncio.Queue] = {}


@router.post("/run")
async def start_run(context: ContextPayload) -> dict:
    """
    Start pipeline → returns run_id, fires agents async
    
    Purpose: Start pipeline → returns run_id, fires agents async
    """
    run_id = str(uuid.uuid4())
    sse_queue: asyncio.Queue = asyncio.Queue()
    _sse_queues[run_id] = sse_queue
    
    # Fire pipeline in background
    asyncio.create_task(_execute_pipeline(context, run_id, sse_queue))
    
    return {"run_id": run_id}


async def _execute_pipeline(
    context: ContextPayload,
    run_id: str,
    sse_queue: asyncio.Queue,
) -> None:
    """Execute the pipeline and store results."""
    try:
        result = await run_pipeline(context, run_id, sse_queue)
        _run_results[run_id] = result
    except Exception as e:
        # Push error event to SSE stream
        await sse_queue.put(SSEEvent(agent="pipeline", status="error"))
        raise
    finally:
        # Signal completion
        await sse_queue.put(None)


@router.get("/stream/{run_id}")
async def stream_agent_status(run_id: str):
    """
    SSE endpoint → streams agent status to React
    
    Purpose: SSE endpoint → streams agent status to React
    """
    if run_id not in _sse_queues:
        raise HTTPException(status_code=404, detail="Run ID not found")
    
    sse_queue = _sse_queues[run_id]
    
    async def event_generator():
        while True:
            event = await sse_queue.get()
            if event is None:
                # Pipeline complete
                break
            yield {
                "event": "agent_status",
                "data": event.model_dump_json(),
            }
    
    return EventSourceResponse(event_generator())


@router.get("/result/{run_id}")
async def get_result(run_id: str) -> ProgramOutput:
    """
    Retrieve completed program JSON
    
    Purpose: Retrieve completed program JSON
    """
    if run_id not in _run_results:
        raise HTTPException(
            status_code=404,
            detail="Result not found. Pipeline may still be running or run_id is invalid."
        )
    
    return _run_results[run_id]

# Made with Bob
