import { useState } from 'react'
import { GitCompare, Loader2, Play } from 'lucide-react'
import TopNav from '../components/TopNav'
import FloatingParticles from '../components/FloatingParticles'
import ProgramOutputView from '../components/ProgramOutput'
import { compareProfiles } from '../lib/api'
import type { CompareResponse, ContextPayload } from '../types'

const PRESET_A =
  'Coastal Cebu, rice farming. ~5,000 smallholder farmers. Typhoon season June–November, frequent saltwater intrusion in low-lying paddies. Limited irrigation infrastructure. Tight budget.'

const PRESET_B =
  'Inland highland province, rice farming. ~5,000 smallholder farmers. Drought-prone with a long dry season, no typhoons but unreliable rainfall. Some access to deep wells. Tight budget.'

/** Full-page Compare View — same need, two contexts → two programs side-by-side.
 *  Runs two full pipelines via POST /compare. */
export default function CompareView() {
  const [textA, setTextA] = useState(PRESET_A)
  const [textB, setTextB] = useState(PRESET_B)
  const [result, setResult] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  async function run() {
    setLoading(true)
    setFailed(false)
    setResult(null)
    const profile = (text: string): ContextPayload => ({
      run_id: crypto.randomUUID(),
      excel_data: [],
      chat_messages: [{ role: 'user', content: text }],
    })
    const res = await compareProfiles(profile(textA), profile(textB))
    if (res) setResult(res)
    else setFailed(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 animate-rise">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-leaf-bright">
            <GitCompare size={12} className="text-gold" />
            Compare View
          </div>
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-headline text-mist">
            Same need, two contexts
          </h1>
          <p className="mt-2 text-body text-mist-muted">
            Identical goal, different local conditions — see how the pipeline reshapes the program.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ContextEditor label="Context A" value={textA} onChange={setTextA} />
          <ContextEditor label="Context B" value={textB} onChange={setTextB} />
        </div>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className={`pill inline-flex items-center gap-2 px-6 py-3 text-[14px] font-medium transition-all duration-300 ${
              loading
                ? 'cursor-not-allowed bg-leaf-soft border border-leaf/30 text-forest/70'
                : 'bg-leaf text-white shadow-glow hover:scale-105 hover:shadow-glow-lg'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running both pipelines…
              </>
            ) : (
              <>
                <Play size={16} strokeWidth={1.8} />
                Run comparison
              </>
            )}
          </button>
        </div>

        {failed && (
          <p className="mt-6 text-center text-[14px] text-red-600">
            Comparison failed — make sure the backend is running.
          </p>
        )}

        {result && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <ColumnHeader label="Context A" />
              <ProgramOutputView program={result.profile_a} />
            </div>
            <div>
              <ColumnHeader label="Context B" />
              <ProgramOutputView program={result.profile_b} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function ContextEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="card-surface rounded-card p-5">
      <div className="mb-2 text-label font-semibold uppercase tracking-label text-forest">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full resize-none rounded-xl border border-hairline bg-canvas p-3 text-[14px] text-primary outline-none transition-colors focus:border-leaf"
      />
    </div>
  )
}

function ColumnHeader({ label }: { label: string }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-forest-deep px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-label text-white">
      {label}
    </div>
  )
}
