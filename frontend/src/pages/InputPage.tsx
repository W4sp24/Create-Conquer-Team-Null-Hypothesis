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
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 py-10 sm:px-6">
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
