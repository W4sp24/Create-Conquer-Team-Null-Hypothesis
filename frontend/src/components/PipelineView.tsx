import { Check, Loader2, AlertTriangle, Circle, Sprout, Database, BarChart3, ShieldCheck, Layers } from 'lucide-react'
import type { AgentState } from '../hooks/useAgentStream'

const AGENT_META: Record<string, { name: string; role: string; model: string; icon: React.ReactNode }> = {
  evidence_retriever: {
    name: 'Evidence Retriever',
    role: 'Queries the knowledge base for relevant evidence',
    model: 'llama-3.1-8b-instant',
    icon: <Database size={15} strokeWidth={1.7} />,
  },
  data_analyst: {
    name: 'Data Analyst',
    role: 'Extracts quantitative metrics from your field data',
    model: 'llama-3.1-8b-instant',
    icon: <BarChart3 size={15} strokeWidth={1.7} />,
  },
  intervention_adapter: {
    name: 'Intervention Adapter',
    role: 'Adapts the evidence to your local context',
    model: 'llama-3.3-70b-versatile',
    icon: <Sprout size={15} strokeWidth={1.7} />,
  },
  risk_mne_agent: {
    name: 'Risk & M&E',
    role: 'Flags risks, mitigations, and defines KPIs',
    model: 'llama-3.3-70b-versatile',
    icon: <ShieldCheck size={15} strokeWidth={1.7} />,
  },
  synthesizer: {
    name: 'Synthesizer',
    role: 'Assembles the final implementation-ready program',
    model: 'gemini-2.5-flash',
    icon: <Layers size={15} strokeWidth={1.7} />,
  },
}

const STATUS_LABEL: Record<AgentState['status'], string> = {
  pending: 'Waiting',
  running: 'Running',
  done:    'Done',
  error:   'Error',
}

export default function PipelineView({ agents }: { agents: AgentState[] }) {
  return (
    <div className="w-full">
      {agents.map((agent, i) => {
        const meta = AGENT_META[agent.id] ?? { name: agent.id, role: '', model: '', icon: null }
        const isLast = i === agents.length - 1

        return (
          <div key={agent.id} className="flex gap-0">
            {/* Left column: node circle + connector line */}
            <div className="flex w-14 shrink-0 flex-col items-center">
              <div
                className="animate-rise"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <NodeCircle status={agent.status} />
              </div>
              {!isLast && <Connector status={agent.status} />}
            </div>

            {/* Right column: info card */}
            <div
              className={`ml-4 flex-1 animate-rise rounded-2xl border px-5 py-4 transition-all duration-500 ${nodeCardClass(agent.status)} ${isLast ? 'mb-0' : 'mb-3'}`}
              style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${nodeIconBadgeClass(agent.status)}`}>
                    {meta.icon}
                  </span>
                  <h3 className="font-display text-[16px] font-semibold leading-snug tracking-headline text-mist">
                    {meta.name}
                  </h3>
                </div>
                <StatusPill status={agent.status} />
              </div>

              {/* Role description */}
              {meta.role && (
                <p className="mt-2 text-[13px] leading-relaxed text-mist-muted">
                  {meta.role}
                </p>
              )}

              {/* Footer: model badge + progress bar */}
              <div className="mt-3 flex items-center gap-3">
                {meta.model && (
                  <code className={`inline-block shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide transition-colors duration-300 ${modelBadgeClass(agent.status)}`}>
                    {meta.model}
                  </code>
                )}
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  {agent.status === 'running' && (
                    <div className="h-full w-2/5 rounded-full bg-leaf/70 animate-travel" />
                  )}
                  {agent.status === 'done' && (
                    <div className="h-full w-full rounded-full bg-leaf/50 transition-all duration-700" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Node circle ───────────────────────────────────────────────────────────────

function NodeCircle({ status }: { status: AgentState['status'] }) {
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${nodeCircleClass(status)}`}>
      <NodeIcon status={status} />
    </span>
  )
}

function NodeIcon({ status }: { status: AgentState['status'] }) {
  if (status === 'done')    return <Check size={18} strokeWidth={2.5} className="text-white" />
  if (status === 'running') return <Loader2 size={18} strokeWidth={2} className="animate-spin text-leaf" />
  if (status === 'error')   return <AlertTriangle size={16} strokeWidth={2} className="text-red-400" />
  return <Circle size={14} strokeWidth={2} className="text-white/50" />
}

function nodeCircleClass(status: AgentState['status']): string {
  switch (status) {
    case 'done':    return 'bg-leaf shadow-glow'
    case 'running': return 'border-2 border-leaf bg-leaf/20 shadow-glow animate-pulse-glow'
    case 'error':   return 'border-2 border-red-400 bg-red-500/20'
    default:        return 'border-2 border-white/40 bg-white/10'
  }
}

// ── Connector line ────────────────────────────────────────────────────────────

function Connector({ status }: { status: AgentState['status'] }) {
  return (
    <div className={`w-0.5 flex-1 overflow-hidden rounded-full transition-colors duration-500 ${connectorBaseClass(status)}`}>
      {status === 'running' && (
        <div className="h-1/3 w-full rounded-full bg-leaf/70 animate-travel" />
      )}
    </div>
  )
}

function connectorBaseClass(status: AgentState['status']): string {
  switch (status) {
    case 'done':  return 'bg-leaf/60'
    case 'error': return 'bg-red-400/30'
    default:      return 'bg-white/20'
  }
}

// ── Info card styles ──────────────────────────────────────────────────────────

function nodeCardClass(status: AgentState['status']): string {
  switch (status) {
    case 'done':    return 'border-leaf/30 bg-leaf/10'
    case 'running': return 'border-leaf/60 bg-leaf/5 shadow-glow'
    case 'error':   return 'border-red-400/40 bg-red-500/10'
    default:        return 'border-white/25 bg-white/10'
  }
}

function nodeIconBadgeClass(status: AgentState['status']): string {
  switch (status) {
    case 'done':    return 'bg-leaf/30 text-leaf'
    case 'running': return 'bg-leaf/20 text-leaf'
    case 'error':   return 'bg-red-500/20 text-red-400'
    default:        return 'bg-white/15 text-mist'
  }
}

function modelBadgeClass(status: AgentState['status']): string {
  switch (status) {
    case 'done':    return 'bg-leaf/20 text-leaf'
    case 'running': return 'bg-leaf/10 text-leaf/80'
    case 'error':   return 'bg-red-500/20 text-red-400'
    default:        return 'bg-white/15 text-mist'
  }
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: AgentState['status'] }) {
  const tone =
    status === 'done'    ? 'bg-leaf/20 text-leaf' :
    status === 'running' ? 'bg-leaf/10 text-leaf animate-pulse' :
    status === 'error'   ? 'bg-red-500/20 text-red-400' :
                           'bg-white/20 text-mist'

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-label transition-all duration-300 ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
