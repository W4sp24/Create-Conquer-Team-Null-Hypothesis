"""
POST /roadmap/{run_id} — Generate a structured implementation roadmap for a
completed program run. The run must already be finished (result stored by the
/run pipeline). Returns a RoadmapOutput.
"""

from fastapi import APIRouter, HTTPException

from models import RoadmapOutput
from agents.roadmap_agent import generate_roadmap

# Import the in-memory result store from run.py
from routes.run import _run_results

router = APIRouter()


@router.post("/roadmap/{run_id}", response_model=RoadmapOutput)
async def create_roadmap(run_id: str) -> RoadmapOutput:
    """
    Generate an AI roadmap for a completed program run.

    Calls the roadmap agent which uses the LLM (Gemini → Groq fallback) to
    produce a structured, month-by-month implementation roadmap from the stored
    ProgramOutput.
    """
    program = _run_results.get(run_id)
    if program is None:
        raise HTTPException(
            status_code=404,
            detail="Program not found. The run may still be in progress or the run_id is invalid.",
        )

    roadmap = await generate_roadmap(program)
    return roadmap
