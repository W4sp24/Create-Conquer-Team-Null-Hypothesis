// Real, client-side Excel parsing (SheetJS). This is the only client-side data
// source — everything else (chat, sources, runs) comes from the live backend.

import * as XLSX from 'xlsx'
import type { UploadPreview } from '../types'

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
