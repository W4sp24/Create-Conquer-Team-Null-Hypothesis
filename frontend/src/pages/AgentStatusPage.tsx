import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import TopNav from '../components/TopNav'
import AgentCard from '../components/AgentCard'
import FloatingParticles from '../components/FloatingParticles'
import { useAgentStream } from '../hooks/useAgentStream'

export default function AgentStatusPage() {
  const [params] = useSearchParams()
  const runId = params.get('run')
  const navigate = useNavigate()
  const { agents, done, error } = useAgentStream(runId)

  const completed = agents.filter((a) => a.status === 'done').length
  const total = agents.length

  // Auto-advance to the program once the pipeline finishes successfully.
  useEffect(() => {
    if (done && !error && runId) {
      const t = setTimeout(() => navigate(`/output?run=${encodeURIComponent(runId)}`), 1200)
      return () => clearTimeout(t)
    }
  }, [done, error, runId, navigate])

  if (!runId) {
    return (
      <div className="flex min-h-screen flex-col">
        <TopNav />
        <main className="flex flex-1 items-center justify-center px-6">
          <div className="card-surface max-w-md rounded-card p-10 text-center">
            <p className="text-body text-secondary">
              No active run. Start one from the Input screen.
            </p>
            <Link
              to="/"
              className="pill mt-5 inline-flex items-center gap-1.5 bg-leaf px-4 py-2 text-[13px] font-medium text-white shadow-glow transition-all hover:scale-105"
            >
              Go to Input
              <ArrowRight size={15} strokeWidth={1.7} />
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[920px] flex-1 px-4 py-10 sm:px-6">
        <p aria-live="polite" className="sr-only">
          {agents
            .filter((a) => a.status === 'done' || a.status === 'error')
            .map((a) => `${a.id.replace(/_/g, ' ')}: ${a.status}`)
            .join('. ')}
        </p>
        <div className="mb-8 animate-rise">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-leaf-bright">
            <Sparkles size={12} className="text-gold" />
            Agent Status
          </div>
          <h1 className="font-display text-[34px] font-semibold leading-tight tracking-headline text-mist">
            {done && !error
              ? 'Program assembled'
              : error
                ? 'A step ran into trouble'
                : 'Agents are working…'}
          </h1>
          <p className="mt-2 text-body text-mist-muted">
            {error
              ? 'The pipeline hit an error. You can still view whatever was produced, or retry from Input.'
              : `Five agents run as a pipeline — retrieval first, then analysis in parallel, then synthesis. ${completed}/${total} done.`}
          </p>

          {/* progress bar */}
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-leaf transition-all duration-500"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4">
          {agents.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i} />
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!done}
            onClick={() => navigate(`/output?run=${encodeURIComponent(runId)}`)}
            className={`pill inline-flex items-center gap-1.5 px-5 py-2.5 text-[14px] font-medium transition-all duration-300 ${
              done
                ? 'bg-leaf text-white shadow-glow hover:scale-105 hover:shadow-glow-lg'
                : 'cursor-not-allowed bg-cream text-secondary'
            }`}
          >
            View program
            <ArrowRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      </main>
    </div>
  )
}
