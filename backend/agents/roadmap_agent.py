"""
Roadmap Agent — Given a completed ProgramOutput, use an LLM to produce a
structured, month-by-month implementation roadmap with milestones, deliverables,
responsible staff, success criteria, and key risks.
"""

from __future__ import annotations
import json

from models import ProgramOutput, RoadmapMilestone, RoadmapOutput
from agents.base import call_llm, extract_json
from config import GEMINI_MAIN, GROQ_LARGE


async def generate_roadmap(program: ProgramOutput) -> RoadmapOutput:
    """Generate a structured roadmap from a completed ProgramOutput."""

    # Build a compact summary of the program for the LLM
    phases_text = "\n".join(
        f"  Phase {p.phase} — {p.name} ({p.duration}):\n    "
        + "\n    ".join(p.activities)
        for p in program.rollout_phases
    )
    kpis_text = "\n".join(f"  - {k.name}: {k.target}" for k in program.kpis)
    risks_text = "\n".join(f"  - {r}" for r in program.risk_assessment.risk_flags)
    staff_text = ", ".join(program.staff_roles)

    system_prompt = """You are a program implementation specialist who builds detailed, actionable roadmaps.

Given the program summary below, return ONLY valid JSON matching this schema:
{
  "summary": "string — 2-3 sentence executive summary of the full roadmap",
  "milestones": [
    {
      "month": "string (e.g. 'Month 1–2')",
      "title": "string — short milestone name",
      "description": "string — what happens in this period",
      "deliverables": ["list of concrete deliverables"],
      "responsible": ["staff roles responsible"]
    }
  ],
  "success_criteria": ["list of 3–5 measurable success criteria"],
  "key_risks": ["list of 3–5 key implementation risks with brief mitigation note"]
}

Rules:
- Create 5–8 milestones that are logically ordered and time-bounded
- Milestones must map realistically to the rollout phases provided
- Deliverables should be concrete, verifiable artifacts or outcomes
- Responsible roles must come from the staff_roles list provided
- success_criteria should link directly to the KPIs provided
- key_risks should name the risk and add a short mitigation hint in parentheses
- Return ONLY the JSON object, no extra prose"""

    user_prompt = f"""Program: {program.title}
Target beneficiaries: {program.target_beneficiaries}
Intervention: {program.intervention.intervention_name} — {program.intervention.description}

Rollout Phases:
{phases_text}

Staff roles: {staff_text}

KPIs:
{kpis_text}

Risk flags:
{risks_text}

Generate the implementation roadmap JSON."""

    raw = await _call_with_fallback(user_prompt, system_prompt)
    parsed = extract_json(raw)

    if not isinstance(parsed, dict):
        parsed = {}

    # Build milestones
    milestones: list[RoadmapMilestone] = []
    for m in parsed.get("milestones", []):
        if isinstance(m, dict):
            milestones.append(
                RoadmapMilestone(
                    month=m.get("month", f"Month {len(milestones) + 1}"),
                    title=m.get("title", "Milestone"),
                    description=m.get("description", ""),
                    deliverables=m.get("deliverables", []),
                    responsible=m.get("responsible", []),
                )
            )

    # Fallback milestones derived from rollout phases
    if not milestones:
        for p in program.rollout_phases:
            milestones.append(
                RoadmapMilestone(
                    month=p.duration,
                    title=f"Phase {p.phase}: {p.name}",
                    description=f"Execute Phase {p.phase} activities.",
                    deliverables=p.activities,
                    responsible=program.staff_roles[:2] if program.staff_roles else [],
                )
            )

    return RoadmapOutput(
        run_id=program.run_id,
        summary=parsed.get(
            "summary",
            f"Implementation roadmap for {program.title} targeting {program.target_beneficiaries}.",
        ),
        milestones=milestones,
        success_criteria=parsed.get(
            "success_criteria",
            [f"{k.name}: {k.target}" for k in program.kpis] or ["Achieve all program KPIs on schedule."],
        ),
        key_risks=parsed.get(
            "key_risks",
            program.risk_assessment.risk_flags or ["Monitor field conditions throughout rollout."],
        ),
    )


async def _call_with_fallback(user_prompt: str, system_prompt: str) -> str:
    """Gemini first, Groq as fallback."""
    try:
        return await call_llm("gemini", GEMINI_MAIN, user_prompt, system_prompt=system_prompt)
    except Exception:
        return await call_llm("groq", GROQ_LARGE, user_prompt, system_prompt=system_prompt)
