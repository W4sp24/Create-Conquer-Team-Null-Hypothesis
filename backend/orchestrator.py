from __future__ import annotations
import asyncio
from typing import cast

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
from agents.data_analyst import run_data_analyst
from agents.intervention_adapter import run_intervention_adapter
from agents.risk_mne_agent import run_risk_mne_agent
from agents.synthesizer import run_synthesizer
from agents.evidence_retriever import run_evidence_retriever


async def _push_sse(queue: asyncio.Queue, agent: str, status: str) -> None:
    await queue.put(SSEEvent(agent=agent, status=status))


# ── Phase 1 — retrieval gate ─────────────────────────────────────────────────────

async def _safe_evidence_retriever(
    context: ContextPayload,
    sse_queue: asyncio.Queue,
) -> RetrievedDocs:
    """Run the real evidence retriever, but never let it block the pipeline.

    `run_evidence_retriever` pushes its own running/done SSE events. If it raises
    (e.g. embedding model unavailable offline), emit `done` and fall back to empty
    docs so the analysis agents still run.
    """
    try:
        return await run_evidence_retriever(context, sse_queue)
    except Exception:
        await _push_sse(sse_queue, "evidence_retriever", "done")
        return RetrievedDocs(specialized=[], org_uploads=[])


# ── Main pipeline entry point ──────────────────────────────────────────────────

async def run_pipeline(
    context: ContextPayload,
    run_id: str,
    sse_queue: asyncio.Queue,
) -> ProgramOutput:
    # Phase 1 — retrieval gate (runs alone before analysis agents)
    retrieved = await _safe_evidence_retriever(context, sse_queue)

    # Phase 2 — 3 MVP agents in parallel
    analyst, adapter, risk = await asyncio.gather(
        run_data_analyst(context, sse_queue),
        run_intervention_adapter(context, retrieved, sse_queue),
        run_risk_mne_agent(context, retrieved, sse_queue),
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

    return await run_synthesizer(
        retrieved,
        cast(DataAnalystOutput, analyst),
        cast(InterventionAdapterOutput, adapter),
        cast(RiskMneOutput, risk),
        run_id,
        sse_queue,
    )
