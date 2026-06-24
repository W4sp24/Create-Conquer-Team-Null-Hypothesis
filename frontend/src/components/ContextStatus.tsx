import { Check, Minus, ArrowRight, Loader2 } from 'lucide-react'
import type { ContextField } from '../types'

interface ContextStatusProps {
  fields: ContextField[]
  ready: boolean
  running: boolean
  onRun: () => void
}

/**
 * Right panel — flat checklist of captured context fields plus the Run button.
 * Field capture is a client-side heuristic over parsed Excel headers + chat
 * keywords; the payload sent to /run stays the real {run_id, excel_data,
 * chat_messages} shape.
 */
export default function ContextStatus({
  fields,
  ready,
  running,
  onRun,
}: ContextStatusProps) {
  const missingRequired = fields
    .filter((f) => f.required && !f.captured)
    .map((f) => f.label.toLowerCase())

  const capturedCount = fields.filter((f) => f.captured).length
  const totalCount = fields.length
  const progress = (capturedCount / totalCount) * 100

  return (
    <div className="flex h-full flex-col">
      <p className="mb-4 text-[13px] leading-relaxed text-secondary">
        What we've picked up from your data and chat.
      </p>

      {/* Progress bar */}
      <div className="mb-4 overflow-hidden rounded-full bg-canvas/70">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-leaf to-forest transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="flex-1 space-y-2">
        {fields.map((field, index) => (
          <li
            key={field.key}
            className={
              field.captured
                ? 'group flex items-center gap-3 rounded-xl border border-leaf/40 bg-leaf-soft px-3 py-2.5 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md animate-bounce-in'
                : 'group flex items-center gap-3 rounded-xl border border-hairline bg-canvas/50 px-3 py-2.5 transition-all duration-300 hover:border-leaf/30 hover:bg-canvas animate-slide-in-up'
            }
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <span
              className={
                field.captured
                  ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow'
                  : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-secondary transition-all duration-300 group-hover:border-leaf group-hover:text-leaf'
              }
            >
              {field.captured ? (
                <Check size={14} strokeWidth={2.2} className="animate-bounce-in" />
              ) : (
                <Minus size={14} strokeWidth={2} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div
                className={
                  field.captured
                    ? 'text-[14px] font-medium text-primary transition-colors duration-300'
                    : 'text-[14px] text-secondary transition-colors duration-300 group-hover:text-primary'
                }
              >
                {field.label}
              </div>
              {field.detail ? (
                <div className="text-[12px] text-forest transition-all duration-300 group-hover:text-forest-deep">{field.detail}</div>
              ) : (
                field.required && (
                  <div className="text-[12px] text-secondary">required</div>
                )
              )}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={!ready || running}
        onClick={onRun}
        className={
          ready && !running
            ? 'glow-on-hover mt-5 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-forest to-forest-deep px-4 py-3.5 text-[14px] font-semibold text-white shadow-card transition-all duration-300 hover:scale-105 hover:shadow-glow active:scale-95'
            : 'mt-5 flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-hairline bg-canvas/50 px-4 py-3.5 text-[14px] font-semibold text-secondary transition-all duration-200'
        }
      >
        {running ? (
          <>
            <Loader2 size={16} strokeWidth={1.7} className="animate-spin" />
            Starting…
          </>
        ) : (
          <>
            Run Pipeline
            <ArrowRight size={16} strokeWidth={1.8} className="transition-transform duration-300 group-hover:translate-x-1" />
          </>
        )}
      </button>

      {!ready && missingRequired.length > 0 && (
        <p className="mt-2.5 text-center text-[12px] text-secondary animate-fade-in">
          Add {missingRequired.join(', ')} to run.
        </p>
      )}
    </div>
  )
}
