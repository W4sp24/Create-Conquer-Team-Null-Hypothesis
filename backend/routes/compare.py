"""
POST /compare — Run two context profiles → side-by-side programs
"""

import asyncio
import uuid

from fastapi import APIRouter

from models import CompareRequest, ProgramOutput
from orchestrator import run_pipeline

router = APIRouter()


@router.post("/compare")
async def compare_profiles(request: CompareRequest) -> dict:
    """
    Run two context profiles → side-by-side programs
    
    Purpose: Run two context profiles → side-by-side programs
    
    Takes two different chat context profiles (same Excel, two different chat
    contexts) and runs the pipeline for both. Returns two complete programs
    side-by-side for comparison. This is the demo's core differentiator —
    showing how the same data produces different solutions based on context.
    """
    # Generate unique run IDs for both profiles
    run_id_a = str(uuid.uuid4())
    run_id_b = str(uuid.uuid4())
    
    # Create SSE queues (not used in compare, but required by orchestrator)
    queue_a: asyncio.Queue = asyncio.Queue()
    queue_b: asyncio.Queue = asyncio.Queue()
    
    # Run both pipelines in parallel
    program_a, program_b = await asyncio.gather(
        run_pipeline(request.profile_a, run_id_a, queue_a),
        run_pipeline(request.profile_b, run_id_b, queue_b),
        return_exceptions=True,
    )
    
    # Handle exceptions
    if isinstance(program_a, Exception):
        program_a = ProgramOutput(
            run_id=run_id_a,
            title="Error: Pipeline A failed",
            target_beneficiaries="N/A",
            intervention={
                "intervention_name": "Error",
                "description": str(program_a),
                "adaptations": [],
                "implementation_steps": [],
            },
            rollout_phases=[],
            staff_roles=[],
            per_beneficiary_cost_usd=None,
            total_budget_estimate=None,
            kpis=[],
            risk_assessment={
                "risk_level": "unknown",
                "risk_flags": ["Pipeline failed"],
                "mitigations": [],
                "kpis": [],
                "confidence_score": 0.0,
            },
            adaptations_made=[],
            citations=[],
            confidence_level=0.0,
        )
    
    if isinstance(program_b, Exception):
        program_b = ProgramOutput(
            run_id=run_id_b,
            title="Error: Pipeline B failed",
            target_beneficiaries="N/A",
            intervention={
                "intervention_name": "Error",
                "description": str(program_b),
                "adaptations": [],
                "implementation_steps": [],
            },
            rollout_phases=[],
            staff_roles=[],
            per_beneficiary_cost_usd=None,
            total_budget_estimate=None,
            kpis=[],
            risk_assessment={
                "risk_level": "unknown",
                "risk_flags": ["Pipeline failed"],
                "mitigations": [],
                "kpis": [],
                "confidence_score": 0.0,
            },
            adaptations_made=[],
            citations=[],
            confidence_level=0.0,
        )
    
    return {
        "profile_a": program_a,
        "profile_b": program_b,
    }

# Made with Bob
