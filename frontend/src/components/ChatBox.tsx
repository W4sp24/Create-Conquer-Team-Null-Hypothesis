import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react'
import { Paperclip, ArrowUp, Sprout, ArrowRight, Loader2 } from 'lucide-react'
import type { ChatMessage, ChipState, UploadPreview } from '../types'
import { looksLikeTable } from '../lib/mock'
import ExcelUploader from './ExcelUploader'

interface Attachment {
  state: ChipState
  preview: UploadPreview | null
  errorMessage?: string
}

interface ChatBoxProps {
  messages: ChatMessage[]
  attachment: Attachment | null
  canGenerate: boolean
  running: boolean
  onSend: (text: string) => void
  onFile: (file: File) => void
  onPasteTable: (text: string) => void
  onGenerate: () => void
  onRemoveAttachment: () => void
}

const ACCEPTED = ['.xlsx', '.xls', '.csv']

export default function ChatBox({
  messages,
  attachment,
  canGenerate,
  running,
  onSend,
  onFile,
  onPasteTable,
  onGenerate,
  onRemoveAttachment,
}: ChatBoxProps) {
  const [text, setText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && isAccepted(file.name)) onFile(file)
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    // A pasted spreadsheet file → treat like an upload.
    const file = Array.from(e.clipboardData.files ?? []).find((f) => isAccepted(f.name))
    if (file) {
      e.preventDefault()
      onFile(file)
      return
    }
    // Copied cells from Excel / Sheets come through as tab-delimited text.
    const pasted = e.clipboardData.getData('text/plain')
    if (looksLikeTable(pasted)) {
      e.preventDefault()
      onPasteTable(pasted)
    }
    // Otherwise let it paste into the textarea normally.
  }

  return (
    <div
      className="relative flex h-full min-h-[420px] flex-col"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={handleDrop}
    >
      {/* Message thread */}
      <div className="flex-1 space-y-5 overflow-y-auto pr-1 smooth-scroll">
        {messages.map((m, i) => (
          <Message key={i} message={m} index={i} />
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
        {canGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={running}
            className={
              running
                ? 'flex w-full cursor-wait items-center justify-center gap-2 rounded-2xl border border-hairline bg-canvas/60 px-4 py-3 text-[14px] font-semibold text-secondary'
                : 'glow-on-hover group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-forest to-forest-deep px-4 py-3 text-[14px] font-semibold text-white shadow-card transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-95 animate-slide-in-up'
            }
          >
            {running ? (
              <>
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
                Starting the agents…
              </>
            ) : (
              <>
                <Sprout size={16} strokeWidth={1.8} className="text-leaf-bright" />
                Generate program
                <ArrowRight
                  size={16}
                  strokeWidth={1.8}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </>
            )}
          </button>
        )}

        {attachment && (
          <div className="animate-slide-in-up">
            <ExcelUploader
              state={attachment.state}
              preview={attachment.preview}
              errorMessage={attachment.errorMessage}
              onRemove={onRemoveAttachment}
            />
          </div>
        )}

        <div className="group flex items-end gap-2 rounded-2xl border border-hairline bg-canvas/70 px-3 py-2.5 shadow-sm transition-all duration-300 focus-within:border-leaf focus-within:bg-panel focus-within:shadow-glow">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach spreadsheet"
            className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-all duration-200 hover:scale-110 hover:bg-leaf-soft hover:text-forest hover:shadow-sm"
          >
            <Paperclip size={18} strokeWidth={1.6} />
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            onPaste={handlePaste}
            rows={1}
            placeholder="Describe your context, drop a spreadsheet, or paste cells…"
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-body text-primary outline-none transition-all placeholder:text-secondary"
          />

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send"
            className={
              text.trim()
                ? 'flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-white shadow-sm transition-all duration-300 hover:scale-110 hover:bg-forest-deep hover:shadow-glow active:scale-95'
                : 'flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl border border-hairline text-secondary transition-all duration-200'
            }
          >
            <ArrowUp size={17} strokeWidth={1.8} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />
      </form>

      {/* Drag overlay */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-leaf bg-leaf-soft/85 backdrop-blur-sm animate-fade-in">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-forest animate-bounce-in">
            <Sprout size={18} strokeWidth={1.7} className="animate-float" />
            Drop spreadsheet to attach
          </span>
        </div>
      )}
    </div>
  )
}

function Message({ message, index }: { message: ChatMessage; index: number }) {
  if (message.role === 'system') {
    return (
      <div className="flex gap-2.5 animate-slide-in-right" style={{ animationDelay: `${index * 0.1}s` }}>
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-glow">
          <Sprout size={15} strokeWidth={1.7} />
        </span>
        <p className="max-w-[88%] rounded-2xl rounded-tl-sm bg-cream px-4 py-2.5 text-body text-primary shadow-sm transition-all duration-300 hover:shadow-md">
          {message.content}
        </p>
      </div>
    )
  }
  return (
    <div className="flex justify-end animate-slide-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-forest px-4 py-2.5 text-body text-white shadow-sm transition-all duration-300 hover:shadow-glow">
        {message.content}
      </div>
    </div>
  )
}

function isAccepted(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ACCEPTED.some((ext) => lower.endsWith(ext))
}
