// Real, client-side Excel parsing (SheetJS). This is the only client-side data
// source — everything else (chat, sources, runs) comes from the live backend.

import * as XLSX from 'xlsx'
import type { ExcelRow, UploadPreview } from '../types'

const SAMPLE_ROW_LIMIT = 5
const MAX_SUMMARIZED_COLS = 25

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

/**
 * Heuristic: does pasted clipboard text look like spreadsheet cells? Copying a
 * range from Excel / Google Sheets yields tab-delimited rows, so a tab plus at
 * least two lines is a strong, safe signal (won't hijack ordinary chat text).
 */
export function looksLikeTable(text: string): boolean {
  const t = text.trim()
  if (!t.includes('\t')) return false
  const lines = t.split(/\r?\n/).filter((l) => l.length > 0)
  return lines.length >= 2 && lines[0].split('\t').length >= 2
}

/** Parse pasted spreadsheet cells (tab- or comma-delimited) into an UploadPreview. */
export function parsePastedTable(text: string): UploadPreview {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) {
    throw new Error('no table rows detected in pasted data')
  }

  const delim = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delim).map((h) => h.trim())
  if (headers.length === 0) {
    throw new Error('no columns detected in pasted data')
  }

  const dataRows = lines.slice(1).map((line) => {
    const cells = line.split(delim)
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      const raw = cells[i]?.trim() ?? ''
      obj[h] = raw === '' ? null : coerceCell(raw)
    })
    return obj
  })

  return {
    filename: 'pasted data',
    rows: dataRows.length,
    cols: headers.length,
    headers,
    sampleRows: dataRows.slice(0, SAMPLE_ROW_LIMIT),
    excelData: dataRows.map((data) => ({ data })),
  }
}

/** Numbers (incl. thousands-separated) become numbers; everything else stays text. */
function coerceCell(value: string): string | number {
  const n = Number(value.replace(/,/g, ''))
  return value !== '' && !Number.isNaN(n) ? n : value
}

// ── Column summary (so the chat assistant can read the data, not just headers) ──

export interface ColumnStat {
  name: string
  kind: 'number' | 'text'
  count: number // non-null values
  mean?: number
  min?: number
  max?: number
  sum?: number
  examples?: string[] // distinct sample values (text columns)
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return v.trim() !== '' && !Number.isNaN(n) ? n : null
  }
  return null
}

/**
 * Compact per-column summary used to brief the chat assistant on the actual
 * spreadsheet contents. Numeric columns report min/mean/max/sum; text columns
 * report a few distinct example values.
 */
export function summarizeColumns(excelData: ExcelRow[], headers: string[]): ColumnStat[] {
  return headers.slice(0, MAX_SUMMARIZED_COLS).map((name) => {
    const values = excelData
      .map((r) => r.data[name])
      .filter((v) => v !== null && v !== undefined && v !== '')

    const nums = values.map(asNumber).filter((n): n is number => n !== null)
    const isNumeric = values.length > 0 && nums.length >= values.length * 0.6

    if (isNumeric && nums.length > 0) {
      const sum = nums.reduce((a, b) => a + b, 0)
      return {
        name,
        kind: 'number',
        count: values.length,
        sum: round2(sum),
        mean: round2(sum / nums.length),
        min: Math.min(...nums),
        max: Math.max(...nums),
      }
    }

    const examples = Array.from(new Set(values.map((v) => String(v)))).slice(0, 5)
    return { name, kind: 'text', count: values.length, examples }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
