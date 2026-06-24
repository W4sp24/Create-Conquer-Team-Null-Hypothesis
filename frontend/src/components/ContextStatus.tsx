import { Check, Minus } from 'lucide-react'
import type { ContextField } from '../types'

interface ContextStatusProps {
  fields: ContextField[]
}

/**
 * Right panel — informational only. A flat checklist of which context fields the
 * assistant has captured from the chat + spreadsheet. The run is triggered from
 * inside the chat (the "Generate program" action), not from here.
 */
export default function ContextStatus({ fields }: ContextStatusProps) {
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

      {missingRequired.length > 0 ? (
        <p className="mt-5 rounded-xl border border-hairline bg-canvas/50 px-3 py-2.5 text-center text-[12px] text-secondary animate-fade-in">
          Still needed: {missingRequired.join(', ')}. The assistant will ask in chat.
        </p>
      ) : (
        <p className="mt-5 flex items-center justify-center gap-1.5 rounded-xl border border-leaf/40 bg-leaf-soft px-3 py-2.5 text-center text-[12px] font-medium text-forest animate-fade-in">
          <Check size={13} strokeWidth={2.2} />
          Ready — generate from the chat.
        </p>
      )}
    </div>
  )
}
