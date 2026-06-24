import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Paperclip, ArrowUp, Sprout } from 'lucide-react'
import type { ChatMessage, ChipState, UploadPreview } from '../types'
import ExcelUploader from './ExcelUploader'

interface Attachment {
  state: ChipState
  preview: UploadPreview | null
  errorMessage?: string
}

interface ChatBoxProps {
  messages: ChatMessage[]
  attachment: Attachment | null
  onSend: (text: string) => void
  onFile: (file: File) => void
  onRemoveAttachment: () => void
}

const ACCEPTED = ['.xlsx', '.xls', '.csv']

export default function ChatBox({
  messages,
  attachment,
  onSend,
  onFile,
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
      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <Message key={i} message={m} />
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
        {attachment && (
          <ExcelUploader
            state={attachment.state}
            preview={attachment.preview}
            errorMessage={attachment.errorMessage}
            onRemove={onRemoveAttachment}
          />
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-hairline bg-canvas/70 px-3 py-2.5 transition-colors focus-within:border-leaf focus-within:bg-panel">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach spreadsheet"
            className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-leaf-soft hover:text-forest"
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
            rows={1}
            placeholder="Describe your context, or drop a spreadsheet…"
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-body text-primary outline-none placeholder:text-secondary"
          />

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send"
            className={
              text.trim()
                ? 'flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-white transition-all hover:bg-forest-deep'
                : 'flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl border border-hairline text-secondary'
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
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-leaf bg-leaf-soft/85">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-forest">
            <Sprout size={18} strokeWidth={1.7} />
            Drop spreadsheet to attach
          </span>
        </div>
      )}
    </div>
  )
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'system') {
    return (
      <div className="flex gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-white">
          <Sprout size={15} strokeWidth={1.7} />
        </span>
        <p className="max-w-[88%] rounded-2xl rounded-tl-sm bg-cream px-4 py-2.5 text-body text-primary">
          {message.content}
        </p>
      </div>
    )
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-forest px-4 py-2.5 text-body text-white">
        {message.content}
      </div>
    </div>
  )
}

function isAccepted(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ACCEPTED.some((ext) => lower.endsWith(ext))
}
