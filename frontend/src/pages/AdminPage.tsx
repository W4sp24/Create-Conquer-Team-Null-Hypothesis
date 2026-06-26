import { useEffect, useRef, useState } from 'react'
import { FileText, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react'
import FloatingParticles from '../components/FloatingParticles'
import TopNav from '../components/TopNav'
import {
  deleteSpecializedSource,
  getAdminSpecializedSources,
  ingestSpecialized,
} from '../lib/api'
import type { SourceMetadata } from '../types'

export default function AdminPage() {
  const [sources, setSources] = useState<SourceMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    const data = await getAdminSpecializedSources()
    setSources(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleUpload(file: File) {
    setBusy(true)
    setUploadStatus('uploading')
    const result = await ingestSpecialized(file)
    if (result) {
      setUploadStatus('done')
    } else {
      setUploadStatus('error')
    }
    await refresh()
    setBusy(false)
    setTimeout(() => setUploadStatus('idle'), 3000)
  }

  async function handleDelete(filename: string) {
    setBusy(true)
    await deleteSpecializedSource(filename)
    await refresh()
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <FloatingParticles />
      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-[700px] flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 animate-rise">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-leaf-bright">
            <FolderOpen size={12} className="text-gold" />
            Admin
          </div>
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-headline text-mist">
            Specialized KB
          </h1>
          <p className="mt-2 text-body text-mist-muted">
            Curated evidence base the agents draw from — FAO/CGIAR/IRRI intervention docs,
            risk cases, and budget benchmarks.
          </p>
        </div>

        <section className="card-surface rounded-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-label font-semibold uppercase tracking-label text-forest">
              Specialized sources
            </div>
            <div className="flex items-center gap-2">
              {uploadStatus === 'done' && (
                <span className="text-[12px] font-medium text-leaf">Ingested</span>
              )}
              {uploadStatus === 'error' && (
                <span className="text-[12px] font-medium text-red-500">Failed</span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className={`pill inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all ${
                  busy
                    ? 'cursor-not-allowed border border-leaf/30 bg-leaf-soft text-forest/70'
                    : 'bg-leaf text-white shadow-glow hover:scale-105'
                }`}
              >
                {uploadStatus === 'uploading' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Upload size={13} strokeWidth={1.8} />
                )}
                {uploadStatus === 'uploading' ? 'Ingesting…' : 'Upload'}
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
          </div>

          {loading && <p className="text-[13px] text-secondary">Loading…</p>}

          {!loading && sources.length === 0 && (
            <p className="text-[13px] text-secondary">
              No sources ingested yet. Upload PDFs, DOCX, or TXT files to build the
              specialized knowledge base.
            </p>
          )}

          <div className="space-y-2.5">
            {sources.map((s) => (
              <div
                key={s.filename}
                className="group flex items-start gap-2.5 rounded-xl border border-hairline bg-canvas px-3 py-3 shadow-sm transition-all duration-300 hover:border-leaf/50 hover:bg-leaf-soft"
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
      </main>
    </div>
  )
}
