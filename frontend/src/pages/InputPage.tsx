import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  FolderOpen,
  ListChecks,
  MessagesSquare,
  RotateCcw,
  Sprout,
  X,
} from 'lucide-react'
import type {
  ChatMessage,
  ChipState,
  ContextField,
  ContextFieldKey,
  ReviewNavState,
  UploadPreview,
} from '../types'
import { sendChat, uploadExcel } from '../lib/api'
import { parsePastedTable } from '../lib/mock'
import OrgSourceList from '../components/OrgSourceList'
import ChatBox from '../components/ChatBox'
import ContextStatus from '../components/ContextStatus'
import Spark from '../components/Spark'
import FloatingParticles from '../components/FloatingParticles'

const STORAGE_KEY = 'anikonsulta:chat-state'

const INITIAL_MESSAGE: ChatMessage = {
  role: 'system',
  content:
    "Upload your field data as a spreadsheet, or describe the program you need. I’ll ask for whatever context is missing.",
}

interface PersistedChatState {
  messages: ChatMessage[]
  captured: string[]
  fieldValues: Record<string, string>
  missingRequired: string[]
  ready: boolean
  contextRichness: number
}

function loadPersistedChat(): PersistedChatState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedChatState
  } catch {
    return null
  }
}

const FIELD_CONFIG: { key: ContextFieldKey; label: string; required: boolean }[] = [
  { key: 'goal', label: 'Program goal', required: true },
  { key: 'region', label: 'Region & conditions', required: true },
  { key: 'crop', label: 'Crop / activity', required: true },
  { key: 'beneficiaries', label: 'Beneficiaries', required: true },
  { key: 'budget', label: 'Budget', required: false },
  { key: 'staff', label: 'Staff', required: false },
]

const RICHNESS_WEIGHTS: Record<string, number> = { goal: 15, region: 20, crop: 20, beneficiaries: 20, budget: 20, staff: 15 }

const CROP_NAME_TOKENS = new Set(['crop', 'commodity', 'activity', 'livelihood', 'product', 'species', 'variety'])
const REGION_NAME_TOKENS = new Set(['region', 'province', 'location', 'area', 'district', 'municipality', 'barangay', 'place', 'site', 'zone', 'address', 'city', 'town'])
const BUDGET_NAME_TOKENS = new Set(['budget', 'fund', 'funding', 'cost', 'amount', 'allocation', 'expense'])
const STAFF_NAME_TOKENS = new Set(['staff', 'worker', 'employee', 'personnel', 'extension', 'agent', 'officer'])

const CROP_VALUES = new Set([
  'rice', 'corn', 'maize', 'palay', 'cassava', 'wheat', 'sorghum', 'sugarcane',
  'coconut', 'banana', 'mango', 'pineapple', 'coffee', 'cacao', 'abaca', 'tobacco',
  'vegetables', 'vegetable', 'legumes', 'mongo', 'peanut', 'soybean', 'camote',
  'gabi', 'ube', 'kangkong', 'pechay', 'fishing', 'aquaculture', 'livestock',
  'poultry', 'cattle', 'swine', 'goat', 'carabao', 'farming', 'agriculture',
])

function colTokens(header: string): Set<string> {
  return new Set(header.toLowerCase().split(/[\s_\-/]+/))
}

function firstVal(header: string, sampleRows: Record<string, unknown>[]): string {
  return String(sampleRows[0]?.[header] ?? '').trim()
}

function detectExcelContext(preview: UploadPreview): { fields: string[]; values: Record<string, string> } {
  const fields: string[] = []
  const values: Record<string, string> = {}

  if (preview.rows > 0) {
    fields.push('beneficiaries')
    values['beneficiaries'] = `${preview.rows.toLocaleString()} (from survey rows)`
  }

  function fullCount(header: string): number {
    return preview.excelData.filter(r => {
      const v = r.data[header]
      return v !== null && v !== undefined && String(v).trim() !== ''
    }).length
  }

  for (const header of preview.headers) {
    const tokens = colTokens(header)
    const val = firstVal(header, preview.sampleRows)

    if (!fields.includes('crop') && [...tokens].some(t => CROP_NAME_TOKENS.has(t)) && val) {
      fields.push('crop'); values['crop'] = val
    }
    if (!fields.includes('region') && [...tokens].some(t => REGION_NAME_TOKENS.has(t)) && val) {
      fields.push('region'); values['region'] = val
    }
    if (!fields.includes('budget') && [...tokens].some(t => BUDGET_NAME_TOKENS.has(t)) && val) {
      fields.push('budget'); values['budget'] = val
    }
    if (!fields.includes('staff') && [...tokens].some(t => STAFF_NAME_TOKENS.has(t))) {
      const count = fullCount(header)
      if (count > 0) {
        fields.push('staff')
        values['staff'] = `${count} (from ${header})`
      }
    }
  }

  if (!fields.includes('crop')) {
    for (const header of preview.headers) {
      const val = firstVal(header, preview.sampleRows)
      if (val && CROP_VALUES.has(val.toLowerCase())) {
        fields.push('crop'); values['crop'] = val
        break
      }
    }
  }

  return { fields, values }
}

function computeRichness(captured: string[], hasExcel: boolean): number {
  const score = Object.entries(RICHNESS_WEIGHTS)
    .filter(([k]) => captured.includes(k))
    .reduce((s, [, v]) => s + v, 0)
  return Math.min(score + (hasExcel ? 5 : 0), 100)
}

interface Attachment {
  state: ChipState
  preview: UploadPreview | null
  errorMessage?: string
}

export default function InputPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as ReviewNavState | null

  const persisted = navState ? null : loadPersistedChat()

  const [messages, setMessages] = useState<ChatMessage[]>(
    navState?.messages ?? persisted?.messages ?? [INITIAL_MESSAGE],
  )
  const [preview, setPreview] = useState<UploadPreview | null>(navState?.preview ?? null)
  const [attachment, setAttachment] = useState<Attachment | null>(
    navState?.preview ? { state: 'parsed', preview: navState.preview } : null,
  )
  const [captured, setCaptured] = useState<string[]>(
    navState?.captured ?? persisted?.captured ?? [],
  )
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    navState?.fieldValues ?? persisted?.fieldValues ?? {},
  )
  const [missingRequired, setMissingRequired] = useState<string[]>(
    navState?.missingRequired ?? persisted?.missingRequired ?? ['region', 'crop', 'beneficiaries'],
  )
  const [ready, setReady] = useState(navState?.ready ?? persisted?.ready ?? false)
  const [contextRichness, setContextRichness] = useState(
    navState ? 0 : (persisted?.contextRichness ?? 0),
  )
  // Always show guide on page load — user can toggle with the nav button
  const [showExplainer, setShowExplainer] = useState(true)

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const state: PersistedChatState = { messages, captured, fieldValues, missingRequired, ready, contextRichness }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [messages, captured, fieldValues, missingRequired, ready])

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY)
    setMessages([INITIAL_MESSAGE])
    setPreview(null)
    setAttachment(null)
    setCaptured([])
    setFieldValues({})
    setMissingRequired(['region', 'crop', 'beneficiaries'])
    setReady(false)
    setContextRichness(0)
  }

  const fields: ContextField[] = useMemo(
    () =>
      FIELD_CONFIG.map((cfg) => ({
        key: cfg.key,
        label: cfg.label,
        required: cfg.required,
        captured: captured.includes(cfg.key),
        detail: fieldValues[cfg.key],
      })),
    [captured, fieldValues],
  )

  async function runChatTurn(
    history: ChatMessage[],
    current: UploadPreview | null,
    capturedOverride?: string[],
  ) {
    const REQUIRED = ['goal', 'region', 'crop', 'beneficiaries']
    const res = await sendChat(history, current, capturedOverride ?? captured)
    const mergedCaptured = [...new Set([...(capturedOverride ?? captured), ...res.captured_fields])]
    setMessages((prev) => [...prev, { role: 'system', content: res.reply }])
    setCaptured(mergedCaptured)
    setFieldValues((prev) => ({ ...prev, ...res.field_values }))
    setMissingRequired(res.missing_required)
    setReady(REQUIRED.every((f) => mergedCaptured.includes(f)))
    setContextRichness(res.context_richness)
  }

  function confirmMessage(p: UploadPreview): ChatMessage {
    return {
      role: 'system',
      content: `Spreadsheet ready: ${p.rows.toLocaleString()} rows × ${p.cols} columns. Add any extra context, or press "Generate program" when you're ready.`,
    }
  }

  function applyExcelDetection(result: UploadPreview, currentCaptured: string[]): string[] {
    const REQUIRED = ['goal', 'region', 'crop', 'beneficiaries']
    const { fields: autoFields, values: autoValues } = detectExcelContext(result)
    if (autoFields.length === 0) return currentCaptured
    const merged = [...new Set([...currentCaptured, ...autoFields])]
    setCaptured(merged)
    setFieldValues((prev) => ({ ...prev, ...autoValues }))
    setContextRichness(computeRichness(merged, true))
    setReady(REQUIRED.every((f) => merged.includes(f)))
    return merged
  }

  async function handleFile(file: File) {
    setAttachment({ state: 'uploading', preview: null })
    try {
      const result = await uploadExcel(file)
      setPreview(result)
      setAttachment({ state: 'parsed', preview: result })
      const mergedCaptured = applyExcelDetection(result, captured)
      const next = [...messages, confirmMessage(result)]
      setMessages(next)
      await runChatTurn(next, result, mergedCaptured)
    } catch (err) {
      setAttachment({
        state: 'error',
        preview: null,
        errorMessage: err instanceof Error ? err.message : "couldn't read file",
      })
    }
  }

  async function handlePasteTable(text: string) {
    setAttachment({ state: 'uploading', preview: null })
    try {
      const result = parsePastedTable(text)
      setPreview(result)
      setAttachment({ state: 'parsed', preview: result })
      const mergedCaptured = applyExcelDetection(result, captured)
      const next = [...messages, confirmMessage(result)]
      setMessages(next)
      await runChatTurn(next, result, mergedCaptured)
    } catch (err) {
      setAttachment({
        state: 'error',
        preview: null,
        errorMessage: err instanceof Error ? err.message : "couldn't read pasted data",
      })
    }
  }

  async function handleSend(text: string) {
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    await runChatTurn(next, preview)
  }

  function goToReview() {
    if (!ready) return
    const reviewState: ReviewNavState = {
      messages,
      preview,
      captured,
      fieldValues,
      missingRequired,
      ready,
    }
    navigate('/review', { state: reviewState })
  }

  const chat = (
    <ChatBox
      messages={messages}
      attachment={attachment}
      ready={ready}
      missingRequired={missingRequired}
      onSend={handleSend}
      onFile={handleFile}
      onPasteTable={handlePasteTable}
      onGenerate={goToReview}
      onRemoveAttachment={() => {
        setAttachment(null)
        setPreview(null)
      }}
    />
  )
  const context = <ContextStatus fields={fields} richness={contextRichness} onReview={goToReview} />

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <FloatingParticles />
      <TopNav showExplainer={showExplainer} onToggleExplainer={() => setShowExplainer(v => !v)} />

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] min-h-0 flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6">
        {showExplainer && (
          <ExplainerBanner onClose={() => setShowExplainer(false)} />
        )}

        {/* Desktop: 3-column workspace */}
        <div className="hidden min-h-0 flex-1 gap-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:grid-rows-[1fr]">
          <PanelCard
            icon={<FolderOpen size={16} strokeWidth={1.6} />}
            label="Sources"
            className="animate-rise delay-2"
            bodyClassName="overflow-y-auto"
          >
            <OrgSourceList />
          </PanelCard>

          <PanelCard
            icon={<MessagesSquare size={16} strokeWidth={1.6} />}
            label="Chat"
            className="animate-rise delay-3"
            bodyClassName="flex-1"
            headerAction={
              messages.length > 1 ? (
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset conversation"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-secondary transition-all duration-200 hover:bg-cream hover:text-primary"
                >
                  <RotateCcw size={13} strokeWidth={1.8} />
                  Reset
                </button>
              ) : null
            }
          >
            {chat}
          </PanelCard>

          <PanelCard
            icon={<ListChecks size={16} strokeWidth={1.6} />}
            label="Context Status"
            className="animate-rise delay-4"
            bodyClassName="overflow-y-auto"
          >
            {context}
          </PanelCard>
        </div>

        {/* Tablet / mobile: stacked */}
        <div className="flex flex-col gap-4 overflow-y-auto pb-4 lg:hidden">
          <PanelCard
            icon={<MessagesSquare size={16} strokeWidth={1.6} />}
            label="Chat"
            className="min-h-[480px] max-h-[680px]"
            bodyClassName="flex-1"
            headerAction={
              messages.length > 1 ? (
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset conversation"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-secondary transition-all duration-200 hover:bg-cream hover:text-primary"
                >
                  <RotateCcw size={13} strokeWidth={1.8} />
                  Reset
                </button>
              ) : null
            }
          >
            {chat}
          </PanelCard>
          <PanelCard
            icon={<ListChecks size={16} strokeWidth={1.6} />}
            label="Context Status"
          >
            {context}
          </PanelCard>
          <PanelCard
            icon={<FolderOpen size={16} strokeWidth={1.6} />}
            label="Sources"
          >
            <OrgSourceList />
          </PanelCard>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 border-t border-white/10 bg-forest-ink/80 px-6 py-2 text-center text-[11px] text-mist-muted">
        <span className="font-semibold text-mist">Null Hypothesis</span>
        {' · '}
        Built for the IBM Hackathon · Prototype — for demonstration purposes only · Not for production use
      </footer>
    </div>
  )
}

// ── Top navigation ────────────────────────────────────────────────────────────

function TopNav({
  showExplainer,
  onToggleExplainer,
}: {
  showExplainer: boolean
  onToggleExplainer: () => void
}) {
  return (
    <header className="glass sticky top-0 z-20 border-b border-white/10 bg-forest-deep/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5 transition-transform hover:scale-105">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf text-white shadow-glow transition-all duration-300 group-hover:shadow-glow-lg group-hover:rotate-12">
            <Sprout size={18} strokeWidth={1.7} />
          </span>
          <span className="font-display text-[21px] font-semibold tracking-headline text-white">
            AniKonsulta
          </span>
        </Link>

        <nav className="glass hidden items-center gap-1 rounded-full border border-white/20 bg-white/10 px-1.5 py-1.5 text-[13px] sm:flex">
          <span className="rounded-full bg-leaf px-3.5 py-1.5 font-medium text-white shadow-glow transition-all duration-300">
            Input
          </span>
          <Link
            to="/status"
            className="rounded-full px-3.5 py-1.5 text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105"
          >
            Agents
          </Link>
          <Link
            to="/output"
            className="rounded-full px-3.5 py-1.5 text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105"
          >
            Output
          </Link>
          <Link
            to="/sources"
            className="rounded-full px-3.5 py-1.5 text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105"
          >
            Sources
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleExplainer}
            className="pill border border-white/20 bg-white/10 px-3 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:border-leaf hover:bg-white/20"
          >
            {showExplainer ? 'Hide guide' : 'Guide'}
          </button>
          <Link
            to="/sources"
            className="pill border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-all duration-300 hover:border-leaf hover:bg-white/20 hover:scale-105 hover:shadow-glow"
          >
            Manage sources
          </Link>
        </div>
      </div>
    </header>
  )
}

// ── Explainer banner ──────────────────────────────────────────────────────────

const STEPS = [
  {
    label: 'Chat / Upload',
    detail:
      'Upload your field data (.xlsx) or describe your situation in the chat. The assistant asks for anything missing — region, crop, beneficiaries, and goal.',
  },
  {
    label: 'Review',
    detail:
      'Once all required fields appear in Context Status, click "Generate program →" in the chat to reach the review screen. Confirm or go back to add more detail.',
  },
  {
    label: 'Agents',
    detail:
      'Five specialist agents run live in parallel — evidence retrieval, data analysis, intervention adaptation, risk assessment, and synthesis.',
  },
  {
    label: 'Program',
    detail:
      'Your program appears with KPIs, risk flags, budget estimate, citations, and an "Adaptations made" section showing exactly what was tailored for your context.',
  },
]

function ExplainerBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-5 rounded-card border border-white/10 bg-forest-ink p-5 animate-rise">
      {/* Prototype warning */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold-soft/10 px-3 py-2">
        <AlertTriangle size={14} strokeWidth={1.8} className="shrink-0 text-gold" />
        <span className="text-[12px] text-gold">
          Prototype — expect occasional bugs. Refresh and retry if something stalls.
        </span>
      </div>

      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[15px] font-semibold text-mist">How to use AniKonsulta</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="flex h-7 w-7 items-center justify-center rounded-full text-mist-muted transition-colors hover:bg-white/10 hover:text-mist"
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>

      {/* Step flow */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-leaf text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <span className="text-[12px] font-medium text-mist">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight size={12} strokeWidth={2} className="text-mist-muted" />
            )}
          </div>
        ))}
      </div>

      {/* Expanded steps */}
      <ol className="space-y-2">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-leaf/20 text-[10px] font-bold text-leaf-bright">
              {i + 1}
            </span>
            <p className="text-[12px] leading-relaxed text-mist-muted">{s.detail}</p>
          </li>
        ))}
      </ol>

      {/* Tips */}
      <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-mist-muted">
        <span className="font-medium text-mist">Tips:</span>{' '}
        The chat reads your spreadsheet and can answer questions about the data · Upload PDFs or reports via Sources to give agents more context · Use Compare View to see how the program changes across two different local contexts
      </p>
    </div>
  )
}

// ── Panel card wrapper ────────────────────────────────────────────────────────

function PanelCard({
  icon,
  label,
  children,
  className = '',
  bodyClassName = '',
  headerAction,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  headerAction?: React.ReactNode
}) {
  return (
    <section className={`card-surface group flex h-full flex-col overflow-hidden transition-all duration-500 hover:shadow-card-hover ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-hairline bg-gradient-to-r from-leaf-soft/50 to-transparent px-5 py-3 transition-all duration-300 group-hover:from-leaf-soft">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf-soft text-forest transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-glow">
          {icon}
        </span>
        <span className="text-label font-semibold uppercase tracking-label text-forest transition-colors duration-300 group-hover:text-forest-deep">
          {label}
        </span>
        {headerAction
          ? <div className="ml-auto">{headerAction}</div>
          : <Spark size={10} className="ml-auto text-leaf opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:animate-sparkle" />
        }
      </div>
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden p-4 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
