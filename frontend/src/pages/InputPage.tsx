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
import { parsePastedTable } from '../lib/mock'
import OrgSourceList from '../components/OrgSourceList'
import ChatBox from '../components/ChatBox'
import ContextStatus from '../components/ContextStatus'
import Spark from '../components/Spark'
import FloatingParticles from '../components/FloatingParticles'

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
  const [captured, setCaptured] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [showExplainer, setShowExplainer] = useState(
    () => localStorage.getItem('anikonsulta:seen-explainer') !== '1',
  )

  function dismissExplainer() {
    localStorage.setItem('anikonsulta:seen-explainer', '1')
    setShowExplainer(false)
  }

  const fields: ContextField[] = useMemo(
    () =>
      FIELD_CONFIG.map((cfg) => ({
        key: cfg.key,
        label: cfg.label,
        required: cfg.required,
        captured: captured.includes(cfg.key),
        detail: captured.includes(cfg.key) ? 'captured' : undefined,
      })),
    [captured],
  )

  /** Send one chat turn and fold the assistant's reply + state into the UI. */
  async function runChatTurn(history: ChatMessage[], current: UploadPreview | null) {
    const res = await sendChat(history, current)
    setMessages((prev) => [...prev, { role: 'system', content: res.reply }])
    setCaptured(res.captured_fields)
    setReady(res.ready)
  }

  /** Confirmation line so the user always sees the spreadsheet was processed. */
  function confirmMessage(p: UploadPreview): ChatMessage {
    return {
      role: 'system',
      content: `Spreadsheet ready: ${p.rows.toLocaleString()} rows × ${p.cols} columns. Add any extra context, or press “Generate program” when you’re ready.`,
    }
  }

  async function handleFile(file: File) {
    setAttachment({ state: 'uploading', preview: null })
    try {
      const result = await uploadExcel(file)
      setPreview(result)
      setAttachment({ state: 'parsed', preview: result })
      const next = [...messages, confirmMessage(result)]
      setMessages(next)
      await runChatTurn(next, result)
    } catch (err) {
      setAttachment({
        state: 'error',
        preview: null,
        errorMessage: err instanceof Error ? err.message : 'couldn’t read file',
      })
    }
  }

  async function handlePasteTable(text: string) {
    setAttachment({ state: 'uploading', preview: null })
    try {
      const result = parsePastedTable(text)
      setPreview(result)
      setAttachment({ state: 'parsed', preview: result })
      const next = [...messages, confirmMessage(result)]
      setMessages(next)
      await runChatTurn(next, result)
    } catch (err) {
      setAttachment({
        state: 'error',
        preview: null,
        errorMessage: err instanceof Error ? err.message : 'couldn’t read pasted data',
      })
    }
  }

  async function handleSend(text: string) {
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    await runChatTurn(next, preview)
  }

  const canGenerate = ready || preview !== null

  async function handleGenerate() {
    if (!canGenerate || running) return
    setRunning(true)
    const payload: ContextPayload = {
      run_id: crypto.randomUUID(),
      excel_data: preview?.excelData ?? [],
      chat_messages: messages,
    }
    const id = await startRun(payload)
    if (id) {
      navigate(`/status?run=${encodeURIComponent(id)}`)
    } else {
      setRunning(false)
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: "I couldn't start the run — make sure the backend is running." },
      ])
    }
  }

  const chat = (
    <ChatBox
      messages={messages}
      attachment={attachment}
      canGenerate={canGenerate}
      running={running}
      onSend={handleSend}
      onFile={handleFile}
      onPasteTable={handlePasteTable}
      onGenerate={handleGenerate}
      onRemoveAttachment={() => {
        setAttachment(null)
        setPreview(null)
      }}
    />
  )
  const context = <ContextStatus fields={fields} />

  return (
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 py-10 sm:px-6">
        {showExplainer && <ExplainerBanner onDismiss={dismissExplainer} />}
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

        <Link
          to="/sources"
          className="pill border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-all duration-300 hover:border-leaf hover:bg-white/20 hover:scale-105 hover:shadow-glow"
        >
          Manage sources
        </Link>
      </div>
    </header>
  )
}

// ── Explainer banner ──────────────────────────────────────────────────────

function ExplainerBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="card-surface mb-5 flex items-start gap-4 rounded-card border border-leaf/30 bg-leaf-soft/40 p-5 animate-rise">
      <Sprout size={20} strokeWidth={1.7} className="mt-0.5 shrink-0 text-forest" />
      <div className="flex-1">
        <h2 className="font-display text-[15px] font-semibold text-primary">How this works</h2>
        <ol className="mt-2 space-y-1.5 text-[13px] text-secondary">
          <li>1. Upload your field data (Excel) or describe it in chat.</li>
          <li>2. A team of specialist agents analyzes it against verified evidence — you'll watch them work, live.</li>
          <li>3. You get a complete program with every claim traced to a source, plus a list of what was adapted for your context.</li>
        </ol>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-full px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-cream hover:text-primary"
      >
        Got it
      </button>
    </div>
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
    <section className={`card-surface group flex flex-col overflow-hidden transition-all duration-500 hover:shadow-card-hover ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-hairline bg-gradient-to-r from-leaf-soft/50 to-transparent px-5 py-4 transition-all duration-300 group-hover:from-leaf-soft">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf-soft text-forest transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-glow">
          {icon}
        </span>
        <span className="text-label font-semibold uppercase tracking-label text-forest transition-colors duration-300 group-hover:text-forest-deep">
          {label}
        </span>
        <Spark size={10} className="ml-auto text-leaf opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:animate-sparkle" />
      </div>
      <div className={`flex flex-col p-5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
