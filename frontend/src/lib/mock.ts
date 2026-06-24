// Client-side fallback used when the backend routes are unavailable.
// Excel parsing is REAL (SheetJS); the rest is canned demo data.

import * as XLSX from 'xlsx'
import type {
  ChatMessage,
  ContextFieldKey,
  SourceMetadata,
  UploadPreview,
} from '../types'

const SAMPLE_ROW_LIMIT = 5

/** Parse an .xlsx/.csv file entirely in the browser into an UploadPreview. */
export async function parseExcelClient(file: File): Promise<UploadPreview> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) {
    throw new Error('no sheets found in file')
  }

  const sheet = workbook.Sheets[firstSheet]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  })

  if (rows.length === 0) {
    throw new Error('no data rows detected')
  }

  const headers = Object.keys(rows[0])
  if (headers.length === 0) {
    throw new Error('no columns detected')
  }

  return {
    filename: file.name,
    rows: rows.length,
    cols: headers.length,
    headers,
    sampleRows: rows.slice(0, SAMPLE_ROW_LIMIT),
    excelData: rows.map((data) => ({ data })),
  }
}

/** Canned org-KB sources for the left panel when GET /sources is unavailable. */
export function mockSources(): SourceMetadata[] {
  return [
    {
      filename: 'cebu_baseline_2024.pdf',
      source_type: 'org_upload',
      chunk_count: 42,
      uploaded_at: '2026-05-12T09:00:00Z',
    },
    {
      filename: 'coastal_a_field_report.docx',
      source_type: 'org_upload',
      chunk_count: 18,
      uploaded_at: '2026-05-20T14:30:00Z',
    },
    {
      filename: 'irrigation_notes.txt',
      source_type: 'org_upload',
      chunk_count: 6,
      uploaded_at: '2026-06-01T11:15:00Z',
    },
  ]
}

/** Synthetic run id when POST /run is unavailable. */
export function mockRunId(): string {
  return `run_${Math.random().toString(36).slice(2, 10)}`
}

// ── Guided-question machine ──────────────────────────────────────────────────
// Detects which context fields are still missing and asks one concrete question,
// referencing parsed Excel numbers where possible.

interface GuidedStep {
  key: ContextFieldKey
  ask: (preview: UploadPreview | null) => string
}

const GUIDED_STEPS: GuidedStep[] = [
  {
    key: 'budget',
    ask: (preview) => {
      const lead = previewLead(preview)
      return `${lead}What's the total budget for this program, and over what period?`
    },
  },
  {
    key: 'staff',
    ask: () =>
      'How many field staff can you assign, and what roles do they cover?',
  },
  {
    key: 'region',
    ask: () =>
      'Which region or area is this for? Note anything about local conditions (infrastructure, weather, terrain).',
  },
  {
    key: 'crop',
    ask: () => 'What crop or livelihood activity is the focus?',
  },
  {
    key: 'beneficiaries',
    ask: () => 'Roughly how many beneficiaries are you targeting?',
  },
]

function previewLead(preview: UploadPreview | null): string {
  if (!preview) return ''
  const detected = detectFromHeaders(preview.headers)
  const parts: string[] = []
  if (detected.beneficiaries) parts.push(detected.beneficiaries)
  if (detected.crop) parts.push(detected.crop)
  if (parts.length === 0) {
    return `I parsed ${preview.rows} rows across ${preview.cols} columns. `
  }
  return `I see ${parts.join(' and ')} in the data. `
}

/**
 * Returns the next guided question given what's already captured, or null when
 * every field has been covered.
 */
export function nextGuidedQuestion(
  captured: Set<ContextFieldKey>,
  preview: UploadPreview | null,
): string | null {
  const step = GUIDED_STEPS.find((s) => !captured.has(s.key))
  return step ? step.ask(preview) : null
}

// ── Field-detection heuristic (Excel headers + chat keywords) ────────────────

const FIELD_KEYWORDS: Record<ContextFieldKey, string[]> = {
  region: ['region', 'province', 'district', 'barangay', 'village', 'municipal', 'area', 'location'],
  crop: ['crop', 'rice', 'maize', 'corn', 'coffee', 'cacao', 'wheat', 'livestock', 'fishery', 'yield'],
  beneficiaries: ['beneficiar', 'farmer', 'household', 'member', 'enrolled', 'population', 'count'],
  budget: ['budget', 'cost', 'funding', 'php', '₱', 'usd', '$', 'peso', 'grant'],
  staff: ['staff', 'officer', 'personnel', 'team', 'employee', 'extension worker'],
}

interface DetectedDetails {
  region?: string
  crop?: string
  beneficiaries?: string
  budget?: string
  staff?: string
}

/** Light extraction of human-readable detail from parsed Excel headers. */
function detectFromHeaders(headers: string[]): DetectedDetails {
  const lower = headers.map((h) => h.toLowerCase())
  const details: DetectedDetails = {}
  if (lower.some((h) => FIELD_KEYWORDS.beneficiaries.some((k) => h.includes(k)))) {
    details.beneficiaries = 'beneficiary data'
  }
  if (lower.some((h) => FIELD_KEYWORDS.crop.some((k) => h.includes(k)))) {
    details.crop = 'crop/yield data'
  }
  return details
}

/**
 * Detect which context fields are present given the parsed Excel and the chat
 * transcript. Header matches and chat keyword matches both count.
 */
export function detectContextFields(
  preview: UploadPreview | null,
  messages: ChatMessage[],
): Record<ContextFieldKey, string | undefined> {
  const result: Record<ContextFieldKey, string | undefined> = {
    region: undefined,
    crop: undefined,
    beneficiaries: undefined,
    budget: undefined,
    staff: undefined,
  }

  const headerBlob = (preview?.headers ?? []).join(' ').toLowerCase()
  const chatBlob = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase()

  for (const key of Object.keys(FIELD_KEYWORDS) as ContextFieldKey[]) {
    const keywords = FIELD_KEYWORDS[key]
    const inHeaders = keywords.some((k) => headerBlob.includes(k))
    const inChat = keywords.some((k) => chatBlob.includes(k))
    if (inHeaders && inChat) result[key] = 'data + context'
    else if (inHeaders) result[key] = 'from spreadsheet'
    else if (inChat) result[key] = 'from chat'
  }

  return result
}
