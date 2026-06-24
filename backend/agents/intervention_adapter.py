from __future__ import annotations
import asyncio

from models import (
    ContextPayload,
    RetrievedDocs,
    InterventionAdapterOutput,
    SSEEvent,
)
from agents.base import call_llm, extract_json
from config import GROQ_LARGE


async def run_intervention_adapter(
    context: ContextPayload,
    retrieved: RetrievedDocs,
    sse_queue: asyncio.Queue,
) -> InterventionAdapterOutput:
    """Select and adapt an intervention using GROQ_LARGE."""
    
    await sse_queue.put(SSEEvent(agent="intervention_adapter", status="running"))
    
    try:
        # Build evidence summary
        evidence_summary = _summarize_evidence(retrieved)
        
        # Build chat summary
        chat_summary = "\n".join(
            f"{msg.role}: {msg.content}" for msg in context.chat_messages
        )
        
        # System prompt
        system_prompt = """You are an agricultural intervention specialist.
Your job: select the most appropriate intervention from the evidence base and adapt it to local context.

Return ONLY valid JSON matching this schema:
{
  "intervention_name": "string",
  "description": "string",
  "adaptations": ["list of specific changes made for local context"],
  "implementation_steps": ["ordered list of concrete steps"]
}

Rules:
- Choose interventions that match the evidence provided
- adaptations must explain WHAT was changed and WHY (e.g., "Shifted planting to dry season to avoid typhoon risk")
- implementation_steps must be concrete and actionable
- If no evidence, suggest a general best practice but note the limitation"""

        # User prompt
        user_prompt = f"""Evidence from knowledge base:
{evidence_summary}

Organization context:
{chat_summary}

Select and adapt an intervention as JSON."""

        # Call LLM
        raw_response = await call_llm(
            provider="groq",
            model=GROQ_LARGE,
            prompt=user_prompt,
            system_prompt=system_prompt,
        )
        
        # Parse JSON
        parsed = extract_json(raw_response)
        
        # Ensure we have a dict
        if not isinstance(parsed, dict):
            parsed = {}
        
        # Build output with defaults
        result = InterventionAdapterOutput(
            intervention_name=parsed.get("intervention_name", "General Agricultural Support"),
            description=parsed.get("description", "Context-adapted agricultural intervention"),
            adaptations=parsed.get("adaptations", []),
            implementation_steps=parsed.get("implementation_steps", []),
        )
        
        await sse_queue.put(SSEEvent(agent="intervention_adapter", status="done"))
        return result
        
    except Exception:
        # Fallback on any error
        await sse_queue.put(SSEEvent(agent="intervention_adapter", status="done"))
        return InterventionAdapterOutput(
            intervention_name="Fallback Intervention",
            description="Agent failed — using default intervention",
            adaptations=[],
            implementation_steps=[],
        )


def _summarize_evidence(retrieved: RetrievedDocs) -> str:
    """Convert retrieved docs to a readable summary."""
    lines = []
    
    if retrieved.specialized:
        lines.append(f"Global evidence ({len(retrieved.specialized)} docs):")
        for i, doc in enumerate(retrieved.specialized[:3], 1):
            lines.append(f"{i}. [{doc.source}] {doc.text[:200]}...")
        if len(retrieved.specialized) > 3:
            lines.append(f"... and {len(retrieved.specialized) - 3} more global docs")
    
    if retrieved.org_uploads:
        lines.append(f"\nOrganization docs ({len(retrieved.org_uploads)} docs):")
        for i, doc in enumerate(retrieved.org_uploads[:3], 1):
            lines.append(f"{i}. [{doc.source}] {doc.text[:200]}...")
        if len(retrieved.org_uploads) > 3:
            lines.append(f"... and {len(retrieved.org_uploads) - 3} more org docs")
    
    if not lines:
        return "No evidence retrieved from knowledge base."
    
    return "\n".join(lines)

# Made with Bob
