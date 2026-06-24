from __future__ import annotations
import asyncio

from models import (
    ContextPayload,
    RetrievedDocs,
    DataAnalystOutput,
    InterventionAdapterOutput,
    KPI,
    RiskMneOutput,
    RolloutPhase,
    ProgramOutput,
    SSEEvent,
)


async def _push_sse(queue: asyncio.Queue, agent: str, status: str) -> None:
    await queue.put(SSEEvent(agent=agent, status=status))


# ── Phase 1 stub ───────────────────────────────────────────────────────────────

async def _run_evidence_retriever_stub(
    context: ContextPayload,
    sse_queue: asyncio.Queue,
) -> RetrievedDocs:
    await _push_sse(sse_queue, "evidence_retriever", "running")
    await asyncio.sleep(0)
    result = RetrievedDocs(specialized=[], org_uploads=[])
    await _push_sse(sse_queue, "evidence_retriever", "done")
    return result


# ── Phase 2 stubs ──────────────────────────────────────────────────────────────

async def _run_data_analyst_stub(
    context: ContextPayload,
    sse_queue: asyncio.Queue,
) -> DataAnalystOutput:
    await _push_sse(sse_queue, "data_analyst", "running")
    await asyncio.sleep(0)
    result = DataAnalystOutput(
        beneficiary_count=5000,
        crop_type="rice",
        region="coastal",
        baseline_yield_t_ha=1.9,
        income_drop_pct=45.0,
        staff_count=12,
        raw_metrics={"plot_size_ha": 2.1},
    )
    await _push_sse(sse_queue, "data_analyst", "done")
    return result


async def _run_intervention_adapter_stub(
    context: ContextPayload,
    retrieved: RetrievedDocs,
    sse_queue: asyncio.Queue,
) -> InterventionAdapterOutput:
    await _push_sse(sse_queue, "intervention_adapter", "running")
    await asyncio.sleep(0)
    result = InterventionAdapterOutput(
        intervention_name="System of Rice Intensification (SRI)",
        description=(
            "A set of principles for increasing rice yields by changing crop, "
            "soil, water, and nutrient management."
        ),
        adaptations=[
            "Shifted to dry-season planting to avoid saltwater intrusion",
            "Reduced transplanting density due to smaller average plot size",
        ],
        implementation_steps=[
            "Conduct farmer training on SRI principles",
            "Establish demo plots in each barangay",
            "Procure and distribute certified seeds",
            "Implement controlled irrigation schedule",
        ],
    )
    await _push_sse(sse_queue, "intervention_adapter", "done")
    return result


async def _run_risk_mne_stub(
    context: ContextPayload,
    retrieved: RetrievedDocs,
    sse_queue: asyncio.Queue,
) -> RiskMneOutput:
    await _push_sse(sse_queue, "risk_mne_agent", "running")
    await asyncio.sleep(0)
    result = RiskMneOutput(
        risk_level="medium",
        risk_flags=[
            "Typhoon season overlaps with Phase 1 timeline",
            "Limited irrigation infrastructure in 3 barangays",
        ],
        mitigations=[
            "Begin Phase 1 before June to avoid peak typhoon months",
            "Coordinate with DA for irrigation support in affected areas",
        ],
        kpis=[
            KPI(
                name="Yield per hectare",
                target="2.8 t/ha",
                measurement="End-of-season harvest survey",
            ),
            KPI(
                name="Adoption rate",
                target="70% of enrolled farmers",
                measurement="Monthly monitoring visits",
            ),
            KPI(
                name="Income recovery",
                target="₱18,000/season",
                measurement="Household income survey",
            ),
        ],
        confidence_score=0.72,
    )
    await _push_sse(sse_queue, "risk_mne_agent", "done")
    return result


# ── Synthesis stub ─────────────────────────────────────────────────────────────

async def _run_synthesizer_stub(
    retrieved: RetrievedDocs,
    analyst: DataAnalystOutput,
    adapter: InterventionAdapterOutput,
    risk: RiskMneOutput,
    run_id: str,
    sse_queue: asyncio.Queue,
) -> ProgramOutput:
    await _push_sse(sse_queue, "synthesizer", "running")
    await asyncio.sleep(0)

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

    citations = (
        [f"[Global: {doc.source}]" for doc in retrieved.specialized]
        + [f"[Org: {doc.source}]" for doc in retrieved.org_uploads]
    )
    if not citations:
        citations = ["[No sources retrieved — upload docs via POST /sources/upload]"]

    result = ProgramOutput(
        run_id=run_id,
        title=title,
        target_beneficiaries=target_beneficiaries,
        intervention=adapter,
        rollout_phases=[
            RolloutPhase(
                phase=1,
                name="Pilot",
                duration="3 months",
                activities=["Farmer orientation", "Demo plot setup", "Seed distribution"],
            ),
            RolloutPhase(
                phase=2,
                name="Scale-up",
                duration="6 months",
                activities=[
                    "Full rollout to all enrolled farmers",
                    "Field monitoring",
                    "Mid-season assessment",
                ],
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
    await _push_sse(sse_queue, "synthesizer", "done")
    return result


# ── Main pipeline entry point ──────────────────────────────────────────────────

async def run_pipeline(
    context: ContextPayload,
    run_id: str,
    sse_queue: asyncio.Queue,
) -> ProgramOutput:
    # Phase 1 — retrieval gate (runs alone before analysis agents)
    retrieved = await _run_evidence_retriever_stub(context, sse_queue)

    # Phase 2 — 3 MVP agents in parallel
    analyst, adapter, risk = await asyncio.gather(
        _run_data_analyst_stub(context, sse_queue),
        _run_intervention_adapter_stub(context, retrieved, sse_queue),
        _run_risk_mne_stub(context, retrieved, sse_queue),
        return_exceptions=True,
    )

    # Fallback for any agent that raised an exception
    if isinstance(analyst, Exception):
        analyst = DataAnalystOutput()
    if isinstance(adapter, Exception):
        adapter = InterventionAdapterOutput(
            intervention_name="Fallback",
            description="Agent failed — using defaults",
            adaptations=[],
            implementation_steps=[],
        )
    if isinstance(risk, Exception):
        risk = RiskMneOutput(
            risk_level="unknown",
            risk_flags=["Risk agent failed"],
            mitigations=[],
            kpis=[],
            confidence_score=0.0,
        )

    return await _run_synthesizer_stub(retrieved, analyst, adapter, risk, run_id, sse_queue)
