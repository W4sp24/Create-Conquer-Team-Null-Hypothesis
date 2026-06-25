// ── Backend contract mirrors (backend/models.py) ────────────────────────────

export interface ExcelRow {
  data: Record<string, unknown> // column_name → value, no rigid mapping
}

export interface ChatMessage {
  role: 'user' | 'system'
  content: string
}

export interface ContextPayload {
  run_id: string
  excel_data: ExcelRow[]
  chat_messages: ChatMessage[]
}

export interface SourceMetadata {
  filename: string
  source_type: 'specialized' | 'org_upload'
  chunk_count: number
  uploaded_at: string // ISO 8601
}

export interface SSEEvent {
  agent: string
  status: 'pending' | 'running' | 'done' | 'error'
}

// ── Agent analysis outputs (backend/models.py) ───────────────────────────────

export interface DataAnalystOutput {
  beneficiary_count: number | null
  crop_type: string | null
  region: string | null
  baseline_yield_t_ha: number | null
  income_drop_pct: number | null
  staff_count: number | null
  raw_metrics: Record<string, unknown>
}

export interface InterventionAdapterOutput {
  intervention_name: string
  description: string
  adaptations: string[]
  implementation_steps: string[]
}

export interface KPI {
  name: string
  target: string
  measurement: string
}

export interface RiskMneOutput {
  risk_level: string // "low" | "medium" | "high" | "unknown"
  risk_flags: string[]
  mitigations: string[]
  kpis: KPI[]
  confidence_score: number // 0.0–1.0
}

export interface RolloutPhase {
  phase: number
  name: string
  duration: string
  activities: string[]
}

/** The final generated program (backend ProgramOutput). */
export interface ProgramOutput {
  run_id: string
  title: string
  target_beneficiaries: string
  intervention: InterventionAdapterOutput
  rollout_phases: RolloutPhase[]
  staff_roles: string[]
  per_beneficiary_cost_usd: number | null
  total_budget_estimate: string | null
  kpis: KPI[]
  risk_assessment: RiskMneOutput
  adaptations_made: string[]
  citations: string[]
  confidence_level: number // 0.0–1.0
}

// ── Roadmap types ─────────────────────────────────────────────────────────────

export interface RoadmapMilestone {
  month: string
  title: string
  description: string
  deliverables: string[]
  responsible: string[]
}

export interface RoadmapOutput {
  run_id: string
  summary: string
  milestones: RoadmapMilestone[]
  success_criteria: string[]
  key_risks: string[]
}

/** Response from POST /compare — two programs from two context profiles. */
export interface CompareResponse {
  profile_a: ProgramOutput
  profile_b: ProgramOutput
}

/** Response from POST /chat — the assistant's reply + captured-context state. */
export interface ChatTurnResponse {
  reply: string
  captured_fields: string[]
  ready: boolean
  missing_required: string[]
}

// ── UI-only types ────────────────────────────────────────────────────────────

/** Result of parsing an uploaded Excel file (real or mocked). */
export interface UploadPreview {
  filename: string
  rows: number
  cols: number
  headers: string[]
  sampleRows: Record<string, unknown>[] // first few rows for the preview table
  excelData: ExcelRow[] // full data, sent to the backend in ContextPayload
}

export type ChipState = 'uploading' | 'parsed' | 'error'

/** A row in the Context Status checklist. */
export type ContextFieldKey =
  | 'region'
  | 'crop'
  | 'beneficiaries'
  | 'budget'
  | 'staff'

export interface ContextField {
  key: ContextFieldKey
  label: string
  captured: boolean
  /** What was detected, shown muted next to the label when present. */
  detail?: string
  /** Whether this field is required before a run can start. */
  required: boolean
}
