import { useEffect, useRef, useState } from 'react'
import { FileText, FolderOpen, Trash2, Upload, Loader2 } from 'lucide-react'
import TopNav from '../components/TopNav'
import FloatingParticles from '../components/FloatingParticles'
import GlobalSourceList from '../components/GlobalSourceList'
import { deleteSource, getSources, uploadSource } from '../lib/api'
import type { SourceMetadata } from '../types'

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    const data = await getSources()
    setSources(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleUpload(file: File) {
    setBusy(true)
    await uploadSource(file)
    await refresh()
    setBusy(false)
  }

  async function handleDelete(filename: string) {
    setBusy(true)
    await deleteSource(filename)
    await refresh()
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 animate-rise">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-forest">
            <FolderOpen size={12} className="text-leaf" />
            Sources
          </div>
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-headline text-primary">
            Knowledge base
          </h1>
          <p className="mt-2 text-body text-secondary">
            The Evidence Retriever queries both the curated global base and your organization's
            uploads.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Global (read-only) */}
          <section className="card-surface rounded-card p-6">
            <div className="mb-4 text-label font-semibold uppercase tracking-label text-forest">
              Global (curated)
            </div>
            <GlobalSourceList />
          </section>

          {/* Org uploads (editable) */}
          <section className="card-surface rounded-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-label font-semibold uppercase tracking-label text-forest">
                Organization uploads
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className={`pill inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all ${
                  busy
                    ? 'cursor-not-allowed bg-cream text-secondary'
                    : 'bg-leaf text-white shadow-glow hover:scale-105'
                }`}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} strokeWidth={1.8} />}
                Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                  e.target.value = ''
                }}
              />
            </div>

            {loading && <p className="text-[13px] text-secondary">Loading…</p>}

            {!loading && sources.length === 0 && (
              <p className="text-[13px] text-secondary">
                No org sources yet. Upload field reports, program docs, or context notes
                (.pdf, .docx, .txt).
              </p>
            )}

            <div className="space-y-2.5">
              {sources.map((s) => (
                <div
                  key={s.filename}
                  className="group flex items-start gap-2.5 rounded-xl border border-hairline bg-canvas/60 px-3 py-3 shadow-sm transition-all duration-300 hover:border-leaf/50 hover:bg-leaf-soft"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf-soft text-forest">
                    <FileText size={15} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-primary">{s.filename}</div>
                    <div className="mt-0.5 text-[12px] text-secondary">{s.chunk_count} chunks</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(s.filename)}
                    aria-label={`Delete ${s.filename}`}
                    className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} strokeWidth={1.7} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
