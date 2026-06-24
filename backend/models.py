from __future__ import annotations
from pydantic import BaseModel, Field


# ── Input layer ────────────────────────────────────────────────────────────────

class ExcelRow(BaseModel):
    data: dict  # flexible: column_name → value, no rigid mapping


class ChatMessage(BaseModel):
    role: str  # "user" | "system"
    content: str


class ContextPayload(BaseModel):
    run_id: str
    excel_data: list[ExcelRow]
    chat_messages: list[ChatMessage]


# ── Evidence Retriever output ──────────────────────────────────────────────────

class RetrievedDoc(BaseModel):
    text: str
    source: str
    source_type: str  # "specialized" | "org_upload"


class RetrievedDocs(BaseModel):
    specialized: list[RetrievedDoc]
    org_uploads: list[RetrievedDoc]


# ── Analysis agent outputs ─────────────────────────────────────────────────────

class DataAnalystOutput(BaseModel):
    beneficiary_count: int | None = None
    crop_type: str | None = None
    region: str | None = None
    baseline_yield_t_ha: float | None = None
    income_drop_pct: float | None = None
    staff_count: int | None = None
    raw_metrics: dict = Field(default_factory=dict)


class InterventionAdapterOutput(BaseModel):
    intervention_name: str
    description: str
    adaptations: list[str]        # what was changed for local context
    implementation_steps: list[str]


class KPI(BaseModel):
    name: str
    target: str
    measurement: str


class RiskMneOutput(BaseModel):
    risk_level: str               # "low" | "medium" | "high"
    risk_flags: list[str]
    mitigations: list[str]
    kpis: list[KPI]
    confidence_score: float       # 0.0–1.0


# ── Synthesizer output (final program) ────────────────────────────────────────

class RolloutPhase(BaseModel):
    phase: int
    name: str
    duration: str
    activities: list[str]


class ProgramOutput(BaseModel):
    run_id: str
    title: str
    target_beneficiaries: str
    intervention: InterventionAdapterOutput
    rollout_phases: list[RolloutPhase]
    staff_roles: list[str]
    per_beneficiary_cost_usd: float | None = None
    total_budget_estimate: str | None = None
    kpis: list[KPI]
    risk_assessment: RiskMneOutput
    adaptations_made: list[str]   # visible to user — how program was reshaped
    citations: list[str]          # "[Global: FAO 2023]" | "[Org: cebu_baseline.pdf]"
    confidence_level: float       # 0.0–1.0


# ── SSE / real-time ───────────────────────────────────────────────────────────

class SSEEvent(BaseModel):
    agent: str
    status: str  # "pending" | "running" | "done" | "error"


# ── Sources screen ────────────────────────────────────────────────────────────

class SourceMetadata(BaseModel):
    filename: str
    source_type: str   # "specialized" | "org_upload"
    chunk_count: int
    uploaded_at: str   # ISO 8601


# ── Compare endpoint ──────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    profile_a: ContextPayload
    profile_b: ContextPayload