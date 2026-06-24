import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, GitCompare, Loader2 } from 'lucide-react'
import TopNav from '../components/TopNav'
import FloatingParticles from '../components/FloatingParticles'
import ProgramOutputView from '../components/ProgramOutput'
import { getResult } from '../lib/api'
import type { ProgramOutput } from '../types'

type Status = 'loading' | 'ready' | 'notfound'

export default function OutputPage() {
  const [params] = useSearchParams()
  const runId = params.get('run')
  const [program, setProgram] = useState<ProgramOutput | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!runId) {
      setStatus('notfound')
      return
    }

    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 20 // ~30s — result can lag the stream close

    async function poll() {
      const result = await getResult(runId as string)
      if (cancelled) return
      if (result) {
        setProgram(result)
        setStatus('ready')
        return
      }
      attempts += 1
      if (attempts >= MAX_ATTEMPTS) {
        setStatus('notfound')
        return
      }
      setTimeout(poll, 1500)
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [runId])

  return (
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[920px] flex-1 px-4 py-10 sm:px-6">
        {status === 'loading' && <LoadingState />}

        {status === 'notfound' && (
          <div className="card-surface mx-auto max-w-md rounded-card p-10 text-center animate-rise">
            <p className="text-body text-secondary">
              {runId
                ? "No program found for this run yet. It may still be generating, or the run expired."
                : 'No run selected. Generate a program from the Input screen.'}
            </p>
            <Link
              to="/"
              className="pill mt-5 inline-flex items-center gap-1.5 bg-leaf px-4 py-2 text-[13px] font-medium text-white shadow-glow transition-all hover:scale-105"
            >
              <ArrowLeft size={15} strokeWidth={1.7} />
              Back to Input
            </Link>
          </div>
        )}

        {status === 'ready' && program && (
          <>
            <ProgramOutputView program={program} />
            <div className="mt-8 flex justify-center">
              <Link
                to="/compare"
                className="pill inline-flex items-center gap-2 border border-hairline bg-white px-5 py-2.5 text-[14px] font-medium text-forest transition-all duration-300 hover:scale-105 hover:border-leaf hover:shadow-glow"
              >
                <GitCompare size={16} strokeWidth={1.8} />
                Compare two contexts
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="card-surface mx-auto flex max-w-md flex-col items-center rounded-card p-12 text-center animate-rise">
      <Loader2 size={28} strokeWidth={2} className="animate-spin text-leaf" />
      <p className="mt-4 font-display text-[18px] font-semibold text-primary">
        Assembling your program…
      </p>
      <p className="mt-1 text-[13px] text-secondary">
        Fetching the synthesized result from the pipeline.
      </p>
    </div>
  )
}
