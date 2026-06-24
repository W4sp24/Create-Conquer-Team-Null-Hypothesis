from __future__ import annotations
import asyncio

from models import (
    RetrievedDocs,
    DataAnalystOutput,
    InterventionAdapterOutput,
    RiskMneOutput,
    ProgramOutput,
    RolloutPhase,
    SSEEvent,
)
from agents.base import call_llm, extract_json
from config import GEMINI_MAIN, GROQ_LARGE


async def _synthesize_llm(user_prompt: str, system_prompt: str) -> str:
    """Synthesize with Gemini (best quality); on failure — e.g. Gemini free-tier
    quota/429 — degrade to a Groq model so we still get real LLM synthesis rather
    than the static fallback."""
    try:
        return await call_llm("gemini", GEMINI_MAIN, user_prompt, system_prompt=system_prompt)
    except Exception:
        return await call_llm("groq", GROQ_LARGE, user_prompt, system_prompt=system_prompt)


async def run_synthesizer(
    retrieved: RetrievedDocs,
    analyst: DataAnalystOutput,
    adapter: InterventionAdapterOutput,
    risk: RiskMneOutput,
    run_id: str,
    sse_queue: asyncio.Queue,
) -> ProgramOutput:
    """Synthesize all agent outputs into a complete program using GEMINI_MAIN."""
    
    await sse_queue.put(SSEEvent(agent="synthesizer", status="running"))
    
    try:
        # Build citations before the prompt
        citations = _build_citations(retrieved)
        
        # Build context summary for LLM
        context_summary = f"""Data Analyst findings:
- Beneficiaries: {analyst.beneficiary_count or 'unknown'}
- Crop: {analyst.crop_type or 'unknown'}
- Region: {analyst.region or 'unknown'}
- Baseline yield: {analyst.baseline_yield_t_ha or 'unknown'} t/ha
- Income drop: {analyst.income_drop_pct or 'unknown'}%
- Staff: {analyst.staff_count or 'unknown'}

Intervention selected:
{adapter.intervention_name}
{adapter.description}

Risk assessment:
Level: {risk.risk_level}
Flags: {', '.join(risk.risk_flags) if risk.risk_flags else 'none'}"""

        # System prompt
        system_prompt = """You are a program synthesis specialist.
Your job: create a complete, implementation-ready program document.

Return ONLY valid JSON matching this schema:
{
  "title": "string",
  "target_beneficiaries": "string describing who",
  "rollout_phases": [
    {
      "phase": 1,
      "name": "string",
      "duration": "string (e.g., '3 months')",
      "activities": ["list of activities"]
    }
  ],
  "staff_roles": ["list of roles with counts"]
}

Rules:
- title should be descriptive and include intervention name
- target_beneficiaries should be specific (count, crop, region)
- Create 2-3 rollout phases (Pilot, Scale-up, Consolidation)
- Each phase needs realistic duration and concrete activities
- staff_roles should match the staff_count from data (e.g., "Field officer (×3)")
- Be specific and actionable, not generic"""

        # User prompt
        user_prompt = f"""Context:
{context_summary}

Create a complete program document as JSON."""

        # Call LLM for the parts that need generation (Gemini → Groq fallback)
        raw_response = await _synthesize_llm(user_prompt, system_prompt)
        
        # Parse JSON
        parsed = extract_json(raw_response)
        
        # Ensure we have a dict
        if not isinstance(parsed, dict):
            parsed = {}
        
        # Build title with fallback
        title = parsed.get("title")
        if not title:
            crop = analyst.crop_type or "crop"
            region = analyst.region or "target area"
            title = f"{adapter.intervention_name} — {region.title()} {crop.title()} Program"
        
        # Build target_beneficiaries with fallback
        target_beneficiaries = parsed.get("target_beneficiaries")
        if not target_beneficiaries:
            count_str = f"{analyst.beneficiary_count:,}" if analyst.beneficiary_count else "Enrolled"
            crop = analyst.crop_type or "crop"
            region = analyst.region or "target area"
            target_beneficiaries = f"{count_str} smallholder {crop} farmers in {region} areas"
        
        # Parse rollout_phases
        rollout_phases = []
        for phase_data in parsed.get("rollout_phases", []):
            if isinstance(phase_data, dict):
                rollout_phases.append(RolloutPhase(
                    phase=phase_data.get("phase", len(rollout_phases) + 1),
                    name=phase_data.get("name", f"Phase {len(rollout_phases) + 1}"),
                    duration=phase_data.get("duration", "TBD"),
                    activities=phase_data.get("activities", []),
                ))
        
        # Fallback if no phases generated
        if not rollout_phases:
            rollout_phases = [
                RolloutPhase(
                    phase=1,
                    name="Pilot",
                    duration="3 months",
                    activities=["Farmer orientation", "Demo plot setup", "Initial training"],
                ),
                RolloutPhase(
                    phase=2,
                    name="Scale-up",
                    duration="6 months",
                    activities=["Full rollout", "Field monitoring", "Mid-season assessment"],
                ),
            ]
        
        # Build staff_roles with fallback
        staff_roles = parsed.get("staff_roles", [])
        if not staff_roles:
            staff_count = analyst.staff_count or 6
            field_officers = max(1, staff_count - 2)
            staff_roles = [
                f"Field officer (×{field_officers})",
                "M&E coordinator (×1)",
                "Program manager (×1)",
            ]
        
        # Assemble final output
        result = ProgramOutput(
            run_id=run_id,
            title=title,
            target_beneficiaries=target_beneficiaries,
            intervention=adapter,
            rollout_phases=rollout_phases,
            staff_roles=staff_roles,
            per_beneficiary_cost_usd=None,  # Budget planner not in MVP
            total_budget_estimate=None,     # Budget planner not in MVP
            kpis=risk.kpis,
            risk_assessment=risk,
            adaptations_made=adapter.adaptations,
            citations=citations,
            confidence_level=risk.confidence_score,
        )
        
        await sse_queue.put(SSEEvent(agent="synthesizer", status="done"))
        return result
        
    except Exception:
        # Fallback on any error - build minimal valid output
        await sse_queue.put(SSEEvent(agent="synthesizer", status="done"))
        
        crop = analyst.crop_type or "crop"
        region = analyst.region or "target area"
        title = f"{adapter.intervention_name} — {region.title()} {crop.title()} Program"
        
        count_str = f"{analyst.beneficiary_count:,}" if analyst.beneficiary_count else "Enrolled"
        target_beneficiaries = f"{count_str} smallholder {crop} farmers in {region} areas"
        
        staff_count = analyst.staff_count or 6
        field_officers = max(1, staff_count - 2)
        staff_roles = [
            f"Field officer (×{field_officers})",
            "M&E coordinator (×1)",
            "Program manager (×1)",
        ]
        
        citations = _build_citations(retrieved)
        
        return ProgramOutput(
            run_id=run_id,
            title=title,
            target_beneficiaries=target_beneficiaries,
            intervention=adapter,
            rollout_phases=[
                RolloutPhase(
                    phase=1,
                    name="Pilot",
                    duration="3 months",
                    activities=["Farmer orientation", "Demo plot setup", "Initial training"],
                ),
                RolloutPhase(
                    phase=2,
                    name="Scale-up",
                    duration="6 months",
                    activities=["Full rollout", "Field monitoring", "Mid-season assessment"],
                ),
            ],
            staff_roles=staff_roles,
            per_beneficiary_cost_usd=None,
            total_budget_estimate=None,
            kpis=risk.kpis,
            risk_assessment=risk,
            adaptations_made=adapter.adaptations,
            citations=citations,
            confidence_level=risk.confidence_score,
        )


def _build_citations(retrieved: RetrievedDocs) -> list[str]:
    """Build citation list from retrieved documents."""
    citations = []
    
    # Add specialized (global) citations
    for doc in retrieved.specialized:
        citations.append(f"[Global: {doc.source}]")
    
    # Add org upload citations
    for doc in retrieved.org_uploads:
        citations.append(f"[Org: {doc.source}]")
    
    # Fallback if no sources
    if not citations:
        citations = ["[No sources retrieved — upload docs via POST /sources/upload]"]
    
    return citations

# Made with Bob
