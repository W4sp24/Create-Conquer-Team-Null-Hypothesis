import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sprout } from 'lucide-react'
import type { ContextPayload, ReviewNavState } from '../types'
import ConfirmationSeal from '../components/ConfirmationSeal'
import TopNav from '../components/TopNav'
import FloatingParticles from '../components/FloatingParticles'
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
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[640px] flex-1 px-4 pb-36 pt-10 sm:px-6">
        <div className="mb-8 animate-rise">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-leaf-bright">
            <Sprout size={12} className="text-gold" />
            Review
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-headline text-mist">
            Here's everything we'll use to build your program
          </h1>
          <p className="mt-2 text-body text-mist-muted">
            Check that this looks right before the agents start working.
          </p>
        </div>

        <ul className="space-y-3">
          {FIELD_ORDER.map((key, i) => {
            const value = state.fieldValues[key]
            const captured = state.captured.includes(key)
            return (
              <li
                key={key}
                className="card-surface flex items-start gap-3 rounded-card border border-hairline p-4 animate-rise"
                style={{ animationDelay: `${(i + 1) * 0.07}s` }}
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
                    {captured
                      ? (value ?? 'Captured')
                      : 'Not provided — program will use general defaults.'}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </main>

      {/* Fixed action footer — solid dark background so buttons are always visible */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-forest-ink px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={handleAddMoreInfo}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-[14px] font-semibold text-mist transition-all duration-200 hover:border-leaf/40 hover:bg-white/10"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
            Add more info
          </button>
          <button
            type="button"
            onClick={handleConfirmGenerate}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-leaf px-4 py-3 text-[14px] font-semibold text-white shadow-glow transition-all duration-200 hover:scale-[1.02] hover:bg-leaf-bright active:scale-95"
          >
            <Sprout size={16} strokeWidth={1.8} />
            Looks right — generate
            <ArrowRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  )
}
