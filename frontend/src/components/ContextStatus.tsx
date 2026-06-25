import { Minus } from 'lucide-react'
import type { ContextField, ContextFieldKey } from '../types'
import ConfirmationSeal from './ConfirmationSeal'

interface ContextStatusProps {
  fields: ContextField[]
  onReview: () => void
}

const WHY_TEXT: Record<ContextFieldKey, string> = {
  region: 'Shapes the climate and infrastructure assumptions in your program.',
  crop: 'Determines which interventions are relevant at all.',
  beneficiaries: 'Sets the scale the program is designed for.',
  budget: 'Affects how many rollout phases we can recommend.',
  staff: 'Affects how many rollout phases your team can realistically run.',
}

/**
 * Right panel — what we've picked up from chat + spreadsheet, in plain
 * language. Once every required field is captured, this becomes the entry
 * point into the Review Context screen via the footer button.
 */
export default function ContextStatus({ fields, onReview }: ContextStatusProps) {
  const missingRequired = fields
    .filter((f) => f.required && !f.captured)
    .map((f) => f.label.toLowerCase())

  const capturedCount = fields.filter((f) => f.captured).length
  const totalCount = fields.length
  const progress = (capturedCount / totalCount) * 100
  const ready = missingRequired.length === 0

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
                <ConfirmationSeal size={13} className="animate-bounce-in" />
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
                <div className="text-[12px] text-forest transition-all duration-300 group-hover:text-forest-deep">
                  {field.detail}
                </div>
              ) : (
                <div className="text-[12px] text-secondary">{WHY_TEXT[field.key]}</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!ready ? (
        <p className="mt-5 rounded-xl border border-hairline bg-canvas/50 px-3 py-2.5 text-center text-[12px] text-secondary animate-fade-in">
          Still needed: {missingRequired.join(', ')}. The assistant will ask in chat.
        </p>
      ) : (
        <button
          type="button"
          onClick={onReview}
          className="mt-5 flex items-center justify-center gap-1.5 rounded-xl border border-leaf/40 bg-leaf-soft px-3 py-2.5 text-center text-[12px] font-medium text-forest transition-all duration-300 hover:scale-[1.02] hover:bg-leaf/20 animate-stamp motion-reduce:animate-fade-in"
        >
          <ConfirmationSeal size={14} />
          Review & generate
        </button>
      )}
    </div>
  )
}
