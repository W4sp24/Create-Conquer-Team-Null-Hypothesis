import { Check, Loader2, AlertTriangle, Circle } from 'lucide-react'
import type { AgentState } from '../hooks/useAgentStream'

/** Display metadata per agent id (mirrors the backend pipeline + CLAUDE.md). */
const AGENT_META: Record<string, { name: string; model: string; role: string }> = {
  evidence_retriever: {
    name: 'Evidence Retriever',
    model: 'llama-3.1-8b-instant',
    role: 'Queries the knowledge base for relevant evidence',
  },
  data_analyst: {
    name: 'Data Analyst',
    model: 'llama-3.1-8b-instant',
    role: 'Extracts quantitative metrics from your field data',
  },
  intervention_adapter: {
    name: 'Intervention Adapter',
    model: 'llama-3.3-70b-versatile',
    role: 'Adapts the evidence to your local context',
  },
  risk_mne_agent: {
    name: 'Risk & M&E',
    model: 'openai/gpt-oss-20b',
    role: 'Flags risks, mitigations, and defines KPIs',
  },
  synthesizer: {
    name: 'Synthesizer',
    model: 'gemini-2.5-flash',
    role: 'Assembles the final implementation-ready program',
  },
}

const STATUS_LABEL: Record<AgentState['status'], string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  error: 'Error',
}

export default function AgentCard({ agent, index = 0 }: { agent: AgentState; index?: number }) {
  const meta = AGENT_META[agent.id] ?? {
    name: agent.id,
    model: '',
    role: '',
  }
  const { status } = agent

  const ring =
    status === 'done'
      ? 'border-leaf/60 bg-leaf-soft'
      : status === 'running'
        ? 'border-leaf bg-white animate-pulse-glow'
        : status === 'error'
          ? 'border-red-300 bg-red-50'
          : 'border-hairline bg-canvas/60'

  return (
    <div
      className={`card-surface flex items-start gap-4 rounded-card border p-5 transition-all duration-500 animate-slide-in-up ${ring}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <StatusIcon status={status} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate font-display text-[17px] font-semibold tracking-headline text-primary">
            {meta.name}
          </h3>
          <StatusPill status={status} />
        </div>
        {meta.role && (
          <p className="mt-1 text-[13px] leading-relaxed text-secondary">{meta.role}</p>
        )}
        {meta.model && (
          <code className="mt-2 inline-block rounded bg-cream px-1.5 py-0.5 text-[11px] font-medium text-forest">
            {meta.model}
          </code>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: AgentState['status'] }) {
  const base = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm'
  if (status === 'done') {
    return (
      <span className={`${base} bg-leaf text-white shadow-glow`}>
        <Check size={18} strokeWidth={2.2} />
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className={`${base} bg-leaf-soft text-forest`}>
        <Loader2 size={18} strokeWidth={2} className="animate-spin" />
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className={`${base} bg-red-100 text-red-600`}>
        <AlertTriangle size={18} strokeWidth={2} />
      </span>
    )
  }
  return (
    <span className={`${base} bg-cream text-secondary`}>
      <Circle size={16} strokeWidth={2} />
    </span>
  )
}

function StatusPill({ status }: { status: AgentState['status'] }) {
  const tone =
    status === 'done'
      ? 'bg-leaf text-white'
      : status === 'running'
        ? 'bg-leaf-soft text-forest'
        : status === 'error'
          ? 'bg-red-100 text-red-600'
          : 'bg-cream text-secondary'
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-label ${tone}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
