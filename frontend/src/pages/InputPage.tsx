import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sprout, FolderOpen, MessagesSquare, ListChecks } from 'lucide-react'
import type {
  ChatMessage,
  ChipState,
  ContextField,
  ContextFieldKey,
  ContextPayload,
  UploadPreview,
} from '../types'
import { sendChat, startRun, uploadExcel } from '../lib/api'
import { detectContextFields, mockRunId } from '../lib/mock'
import OrgSourceList from '../components/OrgSourceList'
import ChatBox from '../components/ChatBox'
import ContextStatus from '../components/ContextStatus'
import Spark from '../components/Spark'

const INITIAL_MESSAGE: ChatMessage = {
  role: 'system',
  content:
    'Upload your field data as a spreadsheet, or describe the program you need. I’ll ask for whatever context is missing.',
}

const FIELD_CONFIG: { key: ContextFieldKey; label: string; required: boolean }[] = [
  { key: 'region', label: 'Region & conditions', required: true },
  { key: 'crop', label: 'Crop / activity', required: true },
  { key: 'beneficiaries', label: 'Beneficiaries', required: true },
  { key: 'budget', label: 'Budget', required: false },
  { key: 'staff', label: 'Staff', required: false },
]

interface Attachment {
  state: ChipState
  preview: UploadPreview | null
  errorMessage?: string
}

export default function InputPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [running, setRunning] = useState(false)

  const fields: ContextField[] = useMemo(() => {
    const detected = detectContextFields(preview, messages)
    return FIELD_CONFIG.map((cfg) => ({
      key: cfg.key,
      label: cfg.label,
      required: cfg.required,
      captured: Boolean(detected[cfg.key]),
      detail: detected[cfg.key],
    }))
  }, [preview, messages])

  const ready = fields.filter((f) => f.required).every((f) => f.captured)
  const capturedCount = fields.filter((f) => f.captured).length

  async function askNext(history: ChatMessage[], current: UploadPreview | null) {
    const captured = new Set(
      FIELD_CONFIG.filter((cfg) => detectContextFields(current, history)[cfg.key]).map(
        (cfg) => cfg.key,
      ),
    )
    const question = await sendChat(history, current, captured)
    if (question) {
      setMessages((prev) => [...prev, { role: 'system', content: question }])
    }
  }

  async function handleFile(file: File) {
    setAttachment({ state: 'uploading', preview: null })
    try {
      const result = await uploadExcel(file)
      setPreview(result)
      setAttachment({ state: 'parsed', preview: result })
      await askNext(messages, result)
    } catch (err) {
      setAttachment({
        state: 'error',
        preview: null,
        errorMessage: err instanceof Error ? err.message : 'couldn’t read file',
      })
    }
  }

  async function handleSend(text: string) {
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    await askNext(next, preview)
  }

  async function handleRun() {
    setRunning(true)
    const runId = mockRunId()
    const payload: ContextPayload = {
      run_id: runId,
      excel_data: preview?.excelData ?? [],
      chat_messages: messages,
    }
    try {
      const id = await startRun(payload)
      navigate(`/status?run=${encodeURIComponent(id)}`)
    } catch {
      setRunning(false)
    }
  }

  const chat = (
    <ChatBox
      messages={messages}
      attachment={attachment}
      onSend={handleSend}
      onFile={handleFile}
      onRemoveAttachment={() => {
        setAttachment(null)
        setPreview(null)
      }}
    />
  )
  const context = (
    <ContextStatus
      fields={fields}
      ready={ready}
      running={running}
      onRun={handleRun}
    />
  )

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-10 sm:px-6">
        <Hero capturedCount={capturedCount} total={FIELD_CONFIG.length} />

        {/* Desktop: 3-column workspace of rich cards */}
        <div className="hidden gap-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_320px]">
          <PanelCard
            icon={<FolderOpen size={16} strokeWidth={1.6} />}
            label="Sources"
            className="animate-rise delay-2"
          >
            <OrgSourceList />
          </PanelCard>

          <PanelCard
            icon={<MessagesSquare size={16} strokeWidth={1.6} />}
            label="Chat"
            className="animate-rise delay-3 min-h-[560px]"
            bodyClassName="flex-1"
          >
            {chat}
          </PanelCard>

          <PanelCard
            icon={<ListChecks size={16} strokeWidth={1.6} />}
            label="Context Status"
            className="animate-rise delay-4"
          >
            {context}
          </PanelCard>
        </div>

        {/* Tablet / mobile: stacked, chat first */}
        <div className="flex flex-col gap-4 lg:hidden">
          <PanelCard
            icon={<MessagesSquare size={16} strokeWidth={1.6} />}
            label="Chat"
            className="min-h-[480px]"
            bodyClassName="flex-1"
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
    </div>
  )
}

// ── Top navigation ─────────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline/70 bg-canvas/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-3.5 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-white">
            <Sprout size={17} strokeWidth={1.7} />
          </span>
          <span className="font-display text-[19px] font-semibold tracking-headline text-primary">
            AIS
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-hairline bg-panel/70 px-1.5 py-1.5 text-[13px] sm:flex">
          <span className="rounded-full bg-forest px-3.5 py-1.5 font-medium text-white">
            Input
          </span>
          <Link
            to="/status"
            className="rounded-full px-3.5 py-1.5 text-secondary transition-colors hover:text-primary"
          >
            Agents
          </Link>
          <Link
            to="/output"
            className="rounded-full px-3.5 py-1.5 text-secondary transition-colors hover:text-primary"
          >
            Output
          </Link>
          <Link
            to="/sources"
            className="rounded-full px-3.5 py-1.5 text-secondary transition-colors hover:text-primary"
          >
            Sources
          </Link>
        </nav>

        <Link
          to="/sources"
          className="pill border border-hairline bg-panel px-4 py-2 text-[13px] font-medium text-primary hover:border-forest hover:text-forest"
        >
          Manage sources
        </Link>
      </div>
    </header>
  )
}

// ── Hero feature band (deep green) ───────────────────────────────────────────

function Hero({ capturedCount, total }: { capturedCount: number; total: number }) {
  return (
    <section className="animate-rise delay-1 relative my-6 overflow-hidden rounded-card bg-forest-deep px-7 py-8 text-white shadow-feature sm:px-10 sm:py-10">
      {/* decorative sparks */}
      <Spark size={18} className="absolute right-10 top-8 text-leaf/70" />
      <Spark size={11} className="absolute right-24 top-16 text-leaf/40" />
      <Spark size={13} className="absolute bottom-8 right-16 text-white/20" />
      {/* soft vegetal glow, kept subtle */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-leaf/15 blur-3xl" />

      <div className="relative max-w-2xl">
        <span className="pill mb-5 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-leaf-soft">
          <Spark size={11} className="text-leaf" />
          Adaptive Intervention Synthesizer
        </span>
        <h1 className="font-display text-[34px] font-semibold leading-[1.08] tracking-headline sm:text-[44px]">
          Turn field data into a program{' '}
          <span className="text-leaf-bright">built for your context.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
          Same need, different context, different solution. Drop your spreadsheet,
          add a few words of context, and the agents draft an implementation-ready
          intervention.
        </p>
      </div>

      {/* progress chip */}
      <div className="relative mt-7 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[13px]">
        <span className="text-white/60">Context captured</span>
        <span className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={
                i < capturedCount
                  ? 'h-1.5 w-6 rounded-full bg-leaf-bright transition-colors'
                  : 'h-1.5 w-6 rounded-full bg-white/15 transition-colors'
              }
            />
          ))}
        </span>
        <span className="font-medium text-white">
          {capturedCount}/{total}
        </span>
      </div>
    </section>
  )
}

// ── Panel card wrapper ───────────────────────────────────────────────────────

function PanelCard({
  icon,
  label,
  children,
  className = '',
  bodyClassName = '',
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`card-surface flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf-soft text-forest">
          {icon}
        </span>
        <span className="text-label font-semibold uppercase tracking-label text-forest">
          {label}
        </span>
      </div>
      <div className={`flex flex-col p-5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
