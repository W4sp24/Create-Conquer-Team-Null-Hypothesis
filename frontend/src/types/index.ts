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
