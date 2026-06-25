// API client. Every call hits the real backend via the Vite /api proxy. There
// are no canned-data fallbacks — when a call fails it returns an honest empty/
// error result so the UI never shows fabricated data.

import type {
  ChatMessage,
  ChatTurnResponse,
  CompareResponse,
  ContextPayload,
  ProgramOutput,
  SourceMetadata,
  UploadPreview,
} from '../types'
import { parseExcelClient, summarizeColumns } from './mock'

/** Whether a fetch succeeded with a JSON body. Network errors / 404s → false. */
async function tryJson<T>(input: RequestInfo, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(input, init)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/**
 * Upload + parse an Excel file. Parsing is done client-side (real, via SheetJS)
 * so a preview is always available; the backend is queried opportunistically to
 * enrich the result once POST /upload exists. Throws on an unreadable file so
 * the caller can render the error chip.
 */
export async function uploadExcel(file: File): Promise<UploadPreview> {
  // Parsing is authoritative client-side (SheetJS) — it yields the full preview
  // (rows/cols/headers/sampleRows/excelData) that the UI and ContextPayload need.
  // The backend POST /upload returns a different shape ({rows, row_count}) and
  // adds nothing the client lacks, so we don't merge it back in.
  return parseExcelClient(file)
}

/**
 * Send a chat turn to the LLM intake assistant. Returns its reply plus the
 * captured-context state ({captured_fields, ready}). On a network/backend
 * failure, returns an honest error reply (never a fabricated question).
 */
export async function sendChat(
  messages: ChatMessage[],
  preview: UploadPreview | null,
): Promise<ChatTurnResponse> {
  const excel_preview = preview
    ? {
        filename: preview.filename,
        rows: preview.rows,
        cols: preview.cols,
        headers: preview.headers,
        sample_rows: preview.sampleRows.slice(0, 5),
        columns: summarizeColumns(preview.excelData, preview.headers),
      }
    : null

  const backend = await tryJson<ChatTurnResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_messages: messages, excel_preview }),
  })

  if (backend) return backend
  return {
    reply: "I couldn't reach the assistant — make sure the backend is running.",
    captured_fields: [],
    field_values: {},
    ready: false,
    missing_required: ['region', 'crop', 'beneficiaries'],
  }
}

/** List org-KB sources for the left panel. Empty list on failure (no fakes). */
export async function getSources(): Promise<SourceMetadata[]> {
  const backend = await tryJson<SourceMetadata[]>('/api/sources')
  return backend ? backend.filter((s) => s.source_type === 'org_upload') : []
}

/** List the curated global evidence base (read-only specialized KB). */
export async function getSpecializedSources(): Promise<SourceMetadata[]> {
  const backend = await tryJson<SourceMetadata[]>('/api/sources/specialized')
  return backend ?? []
}

/** Start a pipeline run. Returns the backend-assigned run_id, or null on failure. */
export async function startRun(payload: ContextPayload): Promise<string | null> {
  const backend = await tryJson<{ run_id: string }>('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return backend?.run_id ?? null
}

/**
 * Fetch the completed program for a run. Returns null while the pipeline is
 * still running (GET /result/{run_id} 404s until it finishes) so callers can poll.
 */
export async function getResult(runId: string): Promise<ProgramOutput | null> {
  return tryJson<ProgramOutput>(`/api/result/${encodeURIComponent(runId)}`)
}

/** Run two context profiles and return both programs side-by-side. */
export async function compareProfiles(
  profileA: ContextPayload,
  profileB: ContextPayload,
): Promise<CompareResponse | null> {
  return tryJson<CompareResponse>('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_a: profileA, profile_b: profileB }),
  })
}

/** Ingest a document into the org knowledge base. */
export async function uploadSource(
  file: File,
): Promise<{ filename: string; status: string; chunk_count: number } | null> {
  const form = new FormData()
  form.append('file', file)
  return tryJson('/api/sources/upload', { method: 'POST', body: form })
}

/** Remove a source (all its chunks) from the org knowledge base. */
export async function deleteSource(filename: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sources/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch {
    return false
  }
}
