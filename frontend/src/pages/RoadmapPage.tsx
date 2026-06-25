import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Map } from 'lucide-react'
import TopNav from '../components/TopNav'
import FloatingParticles from '../components/FloatingParticles'
import RoadmapView from '../components/RoadmapView'
import { generateRoadmap } from '../lib/api'
import type { RoadmapOutput } from '../types'

type PageStatus = 'loading' | 'ready' | 'error'

export default function RoadmapPage() {
  const [params] = useSearchParams()
  const runId = params.get('run')
  const [roadmap, setRoadmap] = useState<RoadmapOutput | null>(null)
  const [status, setStatus] = useState<PageStatus>('loading')

  useEffect(() => {
    if (!runId) {
      setStatus('error')
      return
    }
    let cancelled = false
    generateRoadmap(runId).then((result) => {
      if (cancelled) return
      if (result) {
        setRoadmap(result)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [runId])

  return (
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[960px] flex-1 px-4 py-10 sm:px-6">
        {/* Back link */}
        <div className="no-print mb-6">
          <Link
            to={runId ? `/output?run=${encodeURIComponent(runId)}` : '/output'}
            className="pill inline-flex items-center gap-1.5 border border-hairline bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-mist transition-all hover:bg-white/20 hover:scale-105"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
            Back to Output
          </Link>
        </div>

        {/* Page title */}
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-leaf text-white shadow-glow">
            <Map size={20} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-label text-mist-muted">
              Program Roadmap
            </p>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-headline text-white">
              Implementation Plan
            </h1>
          </div>
        </div>

        {/* States */}
        {status === 'loading' && <LoadingState />}
        {status === 'error'   && <ErrorState runId={runId} />}
        {status === 'ready' && roadmap && <RoadmapView roadmap={roadmap} />}
      </main>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="card-surface mx-auto flex max-w-md flex-col items-center rounded-card p-12 text-center animate-rise">
      <Loader2 size={28} strokeWidth={2} className="animate-spin text-leaf" />
      <p className="mt-4 font-display text-[18px] font-semibold text-primary">
        Building your roadmap…
      </p>
      <p className="mt-1 text-[13px] text-secondary">
        The AI is planning your implementation milestones.
      </p>
    </div>
  )
}

function ErrorState({ runId }: { runId: string | null }) {
  return (
    <div className="card-surface mx-auto max-w-md rounded-card p-10 text-center animate-rise">
      <p className="text-body text-secondary">
        {runId
          ? 'Could not generate the roadmap — make sure the backend is running and the run is complete.'
          : 'No run selected. Please go back to the Output page.'}
      </p>
      <Link
        to={runId ? `/output?run=${encodeURIComponent(runId)}` : '/output'}
        className="pill mt-5 inline-flex items-center gap-1.5 bg-leaf px-4 py-2 text-[13px] font-medium text-white shadow-glow transition-all hover:scale-105"
      >
        <ArrowLeft size={15} strokeWidth={1.7} />
        Back to Output
      </Link>
    </div>
  )
}
