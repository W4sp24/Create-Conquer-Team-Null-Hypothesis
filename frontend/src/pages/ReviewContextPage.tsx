import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sprout } from 'lucide-react'
import type { ContextPayload, ReviewNavState } from '../types'
import ConfirmationSeal from '../components/ConfirmationSeal'
import { startRun } from '../lib/api'

const FIELD_LABELS: Record<string, string> = {
  goal: 'Program goal',
  region: 'Region & conditions',
  crop: 'Crop / activity',
  beneficiaries: 'Beneficiaries',
  budget: 'Budget',
  staff: 'Staff',
}
const FIELD_ORDER = ['goal', 'region', 'crop', 'beneficiaries', 'budget', 'staff']

/**
 * The pause-before-the-pipeline-runs checkpoint: shows every context field the
 * AI has captured, in plain language, before any agent fires. Reached only via
 * navigation `state` from InputPage — a direct/bookmarked visit has no state to
 * show, so it bounces back to the Input page.
 */
export default function ReviewContextPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ReviewNavState | null

  useEffect(() => {
    if (!state) navigate('/', { replace: true })
  }, [state, navigate])

  if (!state) return null

  async function handleConfirmGenerate() {
    const payload: ContextPayload = {
      run_id: crypto.randomUUID(),
      excel_data: state!.preview?.excelData ?? [],
      chat_messages: state!.messages,
      goal: state!.fieldValues?.goal ?? '',
    }
    const id = await startRun(payload)
    if (id) {
      navigate(`/status?run=${encodeURIComponent(id)}`)
    } else {
      navigate('/', { state })
    }
  }

  function handleAddMoreInfo() {
    navigate('/', { state })
  }

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <main className="mx-auto w-full max-w-[640px] px-4 py-12 sm:px-6">
        <h1 className="font-display text-[28px] font-semibold text-primary animate-rise">
          Here's everything we'll use to build your program
        </h1>
        <p className="mt-2 text-[14px] text-secondary animate-rise" style={{ animationDelay: '0.08s' }}>
          Check that this looks right before the agents start working.
        </p>

        <ul className="mt-6 space-y-3">
          {FIELD_ORDER.map((key, i) => {
            const value = state.fieldValues[key]
            const captured = state.captured.includes(key)
            return (
              <li
                key={key}
                className="card-surface flex items-start gap-3 rounded-card border border-hairline p-4 animate-rise"
                style={{ animationDelay: `${(i + 2) * 0.08}s` }}
              >
                <span
                  className={
                    captured
                      ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-white'
                      : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline text-secondary'
                  }
                >
                  <ConfirmationSeal size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-primary">{FIELD_LABELS[key]}</div>
                  <div className="text-[13px] text-secondary">
                    {captured ? (value ?? 'Captured') : 'Not provided — program will use general defaults.'}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-canvas/95 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleAddMoreInfo}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-hairline bg-panel px-4 py-3 text-[14px] font-semibold text-primary transition-all duration-300 hover:border-leaf hover:bg-leaf-soft"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              Add more info
            </button>
            <button
              type="button"
              onClick={handleConfirmGenerate}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-forest to-forest-deep px-4 py-3 text-[14px] font-semibold text-white shadow-card transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-95"
            >
              <Sprout size={16} strokeWidth={1.8} className="text-leaf-bright" />
              Looks right — generate
              <ArrowRight size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
