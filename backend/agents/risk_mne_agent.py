from __future__ import annotations
import asyncio

from models import (
    ContextPayload,
    RetrievedDocs,
    RiskMneOutput,
    KPI,
    SSEEvent,
)
from agents.base import call_llm, extract_json
from config import GROQ_EVAL


async def run_risk_mne_agent(
    context: ContextPayload,
    retrieved: RetrievedDocs,
    sse_queue: asyncio.Queue,
) -> RiskMneOutput:
    """Assess risks and define KPIs using GROQ_EVAL."""
    
    await sse_queue.put(SSEEvent(agent="risk_mne_agent", status="running"))
    
    try:
        # Build evidence summary
        evidence_summary = _summarize_evidence(retrieved)
        
        # Build chat summary
        chat_summary = "\n".join(
            f"{msg.role}: {msg.content}" for msg in context.chat_messages
        )
        
        # System prompt
        system_prompt = """You are a risk assessment and M&E specialist for agricultural livelihood programs.

Return ONLY valid JSON matching this schema:
{
  "risk_level": "low" | "medium" | "high",
  "risk_flags": ["specific risks identified"],
  "mitigations": ["concrete mitigation strategies"],
  "kpis": [
    {
      "name": "string",
      "target": "string with number and unit",
      "measurement": "how to measure this"
    }
  ],
  "confidence_score": 0.0 to 1.0
}

Rules:
- risk_level must be exactly "low", "medium", or "high"
- risk_flags should identify specific, actionable risks (weather, infrastructure, capacity)
- mitigations must be concrete actions, not vague statements
- Define 3-5 KPIs that are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- confidence_score reflects data quality (0.0 = no data, 1.0 = comprehensive data)"""

        # User prompt
        goal_line = f"Program goal: {context.goal}.\n" if context.goal else ""
        user_prompt = f"""{goal_line}Evidence from knowledge base:
{evidence_summary}

Organization context:
{chat_summary}

Assess risks and define KPIs appropriate for this program type as JSON."""

        # Call LLM
        raw_response = await call_llm(
            provider="groq",
            model=GROQ_EVAL,
            prompt=user_prompt,
            system_prompt=system_prompt,
        )
        
        # Parse JSON
        parsed = extract_json(raw_response)
        
        # Ensure we have a dict
        if not isinstance(parsed, dict):
            parsed = {}
        
        # Validate and normalize risk_level
        risk_level = parsed.get("risk_level", "medium")
        if risk_level not in ("low", "medium", "high"):
            risk_level = "medium"
        
        # Parse KPIs
        kpis = []
        for kpi_data in parsed.get("kpis", []):
            if isinstance(kpi_data, dict):
                kpis.append(KPI(
                    name=kpi_data.get("name", "Unnamed KPI"),
                    target=kpi_data.get("target", "TBD"),
                    measurement=kpi_data.get("measurement", "TBD"),
                ))
        
        # Ensure confidence_score is in valid range
        confidence_score = parsed.get("confidence_score", 0.5)
        if not isinstance(confidence_score, (int, float)):
            confidence_score = 0.5
        confidence_score = max(0.0, min(1.0, float(confidence_score)))
        
        # Build output
        result = RiskMneOutput(
            risk_level=risk_level,
            risk_flags=parsed.get("risk_flags", []),
            mitigations=parsed.get("mitigations", []),
            kpis=kpis,
            confidence_score=confidence_score,
        )
        
        await sse_queue.put(SSEEvent(agent="risk_mne_agent", status="done"))
        return result
        
    except Exception:
        # Fallback on any error
        await sse_queue.put(SSEEvent(agent="risk_mne_agent", status="done"))
        return RiskMneOutput(
            risk_level="unknown",
            risk_flags=["Risk assessment failed"],
            mitigations=[],
            kpis=[],
            confidence_score=0.0,
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
