import { useEffect, useRef, useState } from 'react'
import type { SSEEvent } from '../types'

export type AgentStatus = 'pending' | 'running' | 'done' | 'error'

export interface AgentState {
  id: string
  status: AgentStatus
}

/** Pipeline agents in execution order — used to seed the cards as `pending`. */
export const PIPELINE_AGENTS: string[] = [
  'evidence_retriever',
  'data_analyst',
  'intervention_adapter',
  'risk_mne_agent',
  'synthesizer',
]

const LAST_AGENT = 'synthesizer'

function seed(): AgentState[] {
  return PIPELINE_AGENTS.map((id) => ({ id, status: 'pending' as AgentStatus }))
}

/**
 * Subscribe to the backend SSE stream for a run and track per-agent status.
 *
 * The backend (`GET /stream/{run_id}`) emits a NAMED event `agent_status` whose
 * data is an `SSEEvent` JSON. The stream closes (no "all done" event) once the
 * synthesizer finishes — `EventSource` would auto-reconnect on that close, so we
 * detect completion (synthesizer `done`, or a `pipeline` error) and close the
 * connection ourselves.
 */
export function useAgentStream(runId: string | null) {
  const [agents, setAgents] = useState<AgentState[]>(seed)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!runId) return

    // Reset for a fresh run.
    setAgents(seed())
    setDone(false)
    setError(false)
    doneRef.current = false

    const API_BASE = import.meta.env.VITE_API_URL ?? '/api'
    const es = new EventSource(`${API_BASE}/stream/${encodeURIComponent(runId)}`)

    const finish = (failed: boolean) => {
      if (doneRef.current) return
      doneRef.current = true
      if (failed) setError(true)
      setDone(true)
      es.close()
    }

    es.addEventListener('agent_status', (e: MessageEvent) => {
      let evt: SSEEvent
      try {
        evt = JSON.parse(e.data) as SSEEvent
      } catch {
        return
      }

      if (evt.agent === 'pipeline' && evt.status === 'error') {
        finish(true)
        return
      }

      setAgents((prev) =>
        prev.map((a) =>
          a.id === evt.agent ? { ...a, status: evt.status as AgentStatus } : a,
        ),
      )

      if (evt.agent === LAST_AGENT && (evt.status === 'done' || evt.status === 'error')) {
        finish(evt.status === 'error')
      }
    })

    es.onerror = () => {
      // Fires when the stream closes. A normal end arrives after we've already
      // marked completion; otherwise it's a real failure. Either way, stop here
      // so EventSource doesn't reconnect.
      finish(!doneRef.current)
    }

    return () => {
      doneRef.current = true
      es.close()
    }
  }, [runId])

  return { agents, done, error }
}
