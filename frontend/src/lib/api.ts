// API client. In dev, VITE_API_URL is unset and calls go through the Vite /api
// proxy (which strips the prefix and routes to localhost:8000). In production on
// Vercel, set VITE_API_URL=https://<railway-app>.up.railway.app and calls go
// directly to the backend with CORS.

import type {
  ChatMessage,
  ChatTurnResponse,
  CompareResponse,
  ContextPayload,
  ProgramOutput,
  RoadmapOutput,
  SourceMetadata,
  UploadPreview,
} from '../types'
import { parseExcelClient, summarizeColumns } from './mock'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

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
  capturedFields: string[] = [],
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

  const backend = await tryJson<ChatTurnResponse>(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_messages: messages, excel_preview, captured_fields: capturedFields }),
  })

  if (backend) return backend
  const REQUIRED = ['region', 'crop', 'beneficiaries']
  const weights: Record<string, number> = { region: 20, crop: 20, beneficiaries: 20, budget: 20, staff: 15 }
  const richness = Object.entries(weights)
    .filter(([k]) => capturedFields.includes(k))
    .reduce((s, [, v]) => s + v, 0)
  return {
    reply: "I couldn't reach the assistant — make sure the backend is running.",
    captured_fields: capturedFields,
    field_values: {},
    ready: REQUIRED.every((f) => capturedFields.includes(f)),
    missing_required: REQUIRED.filter((f) => !capturedFields.includes(f)),
    context_richness: richness,
  }
}

/** List org-KB sources for the left panel. Empty list on failure (no fakes). */
export async function getSources(): Promise<SourceMetadata[]> {
  const backend = await tryJson<SourceMetadata[]>(`${API_BASE}/sources`)
  return backend ? backend.filter((s) => s.source_type === 'org_upload') : []
}

/** List the curated global evidence base (read-only specialized KB). */
export async function getSpecializedSources(): Promise<SourceMetadata[]> {
  const backend = await tryJson<SourceMetadata[]>(`${API_BASE}/sources/specialized`)
  return backend ?? []
}

/** Start a pipeline run. Returns the backend-assigned run_id, or null on failure. */
export async function startRun(payload: ContextPayload): Promise<string | null> {
  const backend = await tryJson<{ run_id: string }>(`${API_BASE}/run`, {
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
  return tryJson<ProgramOutput>(`${API_BASE}/result/${encodeURIComponent(runId)}`)
}

/** Run two context profiles and return both programs side-by-side. */
export async function compareProfiles(
  profileA: ContextPayload,
  profileB: ContextPayload,
): Promise<CompareResponse | null> {
  return tryJson<CompareResponse>(`${API_BASE}/compare`, {
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
  return tryJson(`${API_BASE}/sources/upload`, { method: 'POST', body: form })
}

/**
 * Generate an AI roadmap for a completed program run.
 */
export async function generateRoadmap(runId: string): Promise<RoadmapOutput | null> {
  return tryJson<RoadmapOutput>(`${API_BASE}/roadmap/${encodeURIComponent(runId)}`, {
    method: 'POST',
  })
}

/** Remove a source (all its chunks) from the org knowledge base. */
export async function deleteSource(filename: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/sources/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Admin: Specialized KB management ────────────────────────────────────────

/** List all sources in the specialized (curated) knowledge base. */
export async function getAdminSpecializedSources(): Promise<SourceMetadata[]> {
  return (await tryJson<SourceMetadata[]>(`${API_BASE}/admin/specialized-sources`)) ?? []
}

/** Upload and ingest a document into the specialized knowledge base. */
export async function ingestSpecialized(
  file: File,
): Promise<{ filename: string; status: string; chunk_count: number } | null> {
  const form = new FormData()
  form.append('file', file)
  return tryJson(`${API_BASE}/admin/ingest-specialized`, { method: 'POST', body: form })
}

/** Remove a source from the specialized knowledge base. */
export async function deleteSpecializedSource(filename: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/specialized/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch {
    return false
  }
}
