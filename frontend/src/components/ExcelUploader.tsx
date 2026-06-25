import { useState } from 'react'
import {
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  X,
  AlertTriangle,
  Loader2,
  Check,
} from 'lucide-react'
import type { ChipState, UploadPreview } from '../types'

interface ExcelUploaderProps {
  state: ChipState
  preview: UploadPreview | null
  errorMessage?: string
  onRemove: () => void
}

/**
 * Inline attachment chip rendered inside the chat composer. Three states:
 * uploading → parsed (expandable preview table) → error.
 */
export default function ExcelUploader({
  state,
  preview,
  errorMessage,
  onRemove,
}: ExcelUploaderProps) {
  const [expanded, setExpanded] = useState(false)

  const ring =
    state === 'parsed'
      ? 'border-leaf/40 bg-leaf-soft'
      : state === 'error'
        ? 'border-amber-400/60 bg-amber-50'
        : 'border-hairline bg-canvas'

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md ${ring}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          className={
            state === 'parsed'
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-glow'
              : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-secondary shadow-sm transition-all duration-300'
          }
        >
          {state === 'uploading' && (
            <Loader2 size={17} strokeWidth={1.6} className="animate-spin" />
          )}
          {state === 'parsed' && <FileSpreadsheet size={17} strokeWidth={1.6} className="animate-bounce-in" />}
          {state === 'error' && (
            <AlertTriangle size={17} strokeWidth={1.6} className="text-amber-600 animate-bounce-in" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-primary transition-colors duration-200">
            {preview?.filename ?? 'spreadsheet'}
          </div>
          <div className="text-[12px] text-secondary">
            {state === 'uploading' && (
              <span className="shimmer inline-block">reading file…</span>
            )}
            {state === 'parsed' && preview && (
              <span className="inline-flex items-center gap-1 font-medium text-forest animate-slide-in-right">
                <Check size={13} strokeWidth={2} className="animate-bounce-in" />
                {preview.rows.toLocaleString()} rows · {preview.cols} cols
              </span>
            )}
            {state === 'error' && (
              <span className="animate-slide-in-right">{errorMessage ?? "couldn't read file"}</span>
            )}
          </div>
        </div>

        {state === 'parsed' && preview && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="pill bg-white/70 px-2.5 py-1 text-[12px] text-forest shadow-sm transition-all duration-200 hover:scale-105 hover:bg-white hover:shadow-md"
          >
            {expanded ? (
              <ChevronDown size={14} strokeWidth={1.7} className="transition-transform duration-200" />
            ) : (
              <ChevronRight size={14} strokeWidth={1.7} className="transition-transform duration-200" />
            )}
            preview
          </button>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary transition-all duration-200 hover:scale-110 hover:bg-white hover:text-primary hover:shadow-sm active:scale-95"
        >
          <X size={15} strokeWidth={1.7} />
        </button>
      </div>

      {expanded && state === 'parsed' && preview && (
        <div className="overflow-x-auto border-t border-leaf/30 bg-white/60 px-3 py-2.5 animate-slide-in-up">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {preview.headers.map((h, i) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-hairline px-2 py-1.5 text-left font-semibold text-forest transition-colors duration-200 hover:text-forest-deep animate-slide-in-up"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, i) => (
                <tr key={i} className="odd:bg-canvas/70 transition-colors duration-200 hover:bg-leaf-soft animate-slide-in-up" style={{ animationDelay: `${(i + 1) * 0.05}s` }}>
                  {preview.headers.map((h) => (
                    <td
                      key={h}
                      className="whitespace-nowrap px-2 py-1.5 text-secondary transition-colors duration-200"
                    >
                      {formatCell(row[h])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}
