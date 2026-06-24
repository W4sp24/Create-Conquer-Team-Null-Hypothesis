// API client. Each call hits the real backend via the Vite /api proxy and
// transparently falls back to the client-side mock when the route is absent
// (the backend routes are not implemented yet). No backend changes required —
// once the routes land, these calls start returning real data automatically.

import type {
  ChatMessage,
  ContextFieldKey,
  ContextPayload,
  SourceMetadata,
  UploadPreview,
} from '../types'
import {
  mockRunId,
  mockSources,
  nextGuidedQuestion,
  parseExcelClient,
} from './mock'

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
  const preview = await parseExcelClient(file)

  const form = new FormData()
  form.append('file', file)
  const backend = await tryJson<Partial<UploadPreview>>('/api/upload', {
    method: 'POST',
    body: form,
  })

  return backend ? { ...preview, ...backend, excelData: preview.excelData } : preview
}

/**
 * Get the next guided question. Tries POST /chat; falls back to the local
 * guided-question machine keyed on which context fields are still missing.
 */
export async function sendChat(
  messages: ChatMessage[],
  preview: UploadPreview | null,
  captured: Set<ContextFieldKey>,
): Promise<string | null> {
  const backend = await tryJson<{ content: string }>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_messages: messages }),
  })
  if (backend?.content) return backend.content
  return nextGuidedQuestion(captured, preview)
}

/** List org-KB sources for the left panel. Falls back to canned data. */
export async function getSources(): Promise<SourceMetadata[]> {
  const backend = await tryJson<SourceMetadata[]>('/api/sources')
  if (backend) return backend.filter((s) => s.source_type === 'org_upload')
  return mockSources()
}

/** Start a pipeline run. Returns a run_id (synthetic when /run is absent). */
export async function startRun(payload: ContextPayload): Promise<string> {
  const backend = await tryJson<{ run_id: string }>('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return backend?.run_id ?? mockRunId()
}
