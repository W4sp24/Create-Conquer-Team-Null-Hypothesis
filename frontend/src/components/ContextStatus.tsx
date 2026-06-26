import { Minus } from 'lucide-react'
import type { ContextField, ContextFieldKey } from '../types'
import ConfirmationSeal from './ConfirmationSeal'

interface ContextStatusProps {
  fields: ContextField[]
  richness: number
  onReview: () => void
}

const WHY_TEXT: Record<ContextFieldKey, string> = {
  goal: 'Defines the type of program to generate.',
  region: 'Shapes climate and infrastructure assumptions.',
  crop: 'Determines which interventions are relevant.',
  beneficiaries: 'Sets the scale the program is designed for.',
  budget: 'Affects how many rollout phases we can recommend.',
  staff: 'Affects how many phases your team can run.',
}

export default function ContextStatus({ fields, richness, onReview }: ContextStatusProps) {
  const missingRequired = fields
    .filter((f) => f.required && !f.captured)
    .map((f) => f.label.toLowerCase())

  const ready = missingRequired.length === 0

  return (
    <div className="flex h-full flex-col gap-2.5">
      {/* Intro */}
      <p className="text-[12px] leading-relaxed text-secondary">
        What we've picked up from your data and chat.
      </p>

      {/* Context richness indicator */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-label text-secondary">
            Context richness
          </span>
          <span className={`text-[12px] font-semibold tabular-nums transition-all duration-500 ${
            richness >= 80 ? 'text-forest' :
            richness >= 60 ? 'text-leaf' :
            'text-secondary'
          }`}>
            {richness}%
          </span>
        </div>
        <div className="overflow-hidden rounded-full bg-canvas">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-leaf to-forest transition-all duration-700 ease-out"
            style={{ width: `${richness}%` }}
          />
        </div>
        <p className={`mt-1 text-[10px] transition-colors duration-300 ${
          richness >= 80 ? 'text-forest' : 'text-secondary'
        }`}>
          {richness < 60
            ? 'Capture region, crop & beneficiaries to improve.'
            : richness < 80
              ? 'Add budget & staff for a more detailed program.'
              : 'Strong context — agents have what they need.'}
        </p>
      </div>

      {/* Field checklist */}
      <ul className="space-y-1.5">
        {fields.map((field, index) => (
          <li
            key={field.key}
            className={
              field.captured
                ? 'group flex items-start gap-2 rounded-xl border border-leaf/40 bg-leaf-soft px-2.5 py-2 shadow-sm transition-all duration-300 animate-bounce-in'
                : 'group flex items-start gap-2 rounded-xl border border-hairline bg-canvas px-2.5 py-2 transition-all duration-300 hover:border-leaf/40 hover:bg-leaf-soft animate-slide-in-up'
            }
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                field.captured
                  ? 'bg-forest text-white'
                  : 'border border-hairline text-secondary group-hover:border-leaf group-hover:text-leaf'
              }`}
            >
              {field.captured ? (
                <ConfirmationSeal size={9} className="animate-bounce-in" />
              ) : (
                <Minus size={10} strokeWidth={2.5} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className={`text-[12px] font-medium leading-tight ${
                field.captured ? 'text-primary' : 'text-primary/70'
              }`}>
                {field.label}
              </div>
              <div className={`mt-0.5 text-[11px] leading-snug ${
                field.captured ? 'text-forest' : 'text-secondary'
              }`}>
                {field.captured && field.detail ? field.detail : WHY_TEXT[field.key]}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="mt-auto">
        {!ready ? (
          <p className="rounded-xl border border-hairline bg-canvas px-3 py-2 text-center text-[11px] text-secondary">
            Still needed: {missingRequired.join(', ')}. The assistant will ask in chat.
          </p>
        ) : (
          <button
            type="button"
            onClick={onReview}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-leaf/40 bg-leaf-soft px-3 py-2 text-[12px] font-medium text-forest transition-all duration-300 hover:scale-[1.02] hover:border-leaf hover:shadow-sm animate-stamp motion-reduce:animate-fade-in"
          >
            <ConfirmationSeal size={13} />
            Review & generate
          </button>
        )}
      </div>
    </div>
  )
}
