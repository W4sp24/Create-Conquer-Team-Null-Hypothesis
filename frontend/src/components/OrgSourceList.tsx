import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ArrowRight } from 'lucide-react'
import type { SourceMetadata } from '../types'
import { getSources } from '../lib/api'

/**
 * Left panel — read-only list of org-KB sources (the corpus the Evidence
 * Retriever queries). The per-run Excel file never appears here; it lives in
 * the chat thread.
 */
export default function OrgSourceList() {
  const [sources, setSources] = useState<SourceMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getSources()
      .then((data) => active && setSources(data))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <p className="mb-4 text-[13px] leading-relaxed text-secondary">
        Your organization’s knowledge base — queried by the evidence retriever.
      </p>

      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {loading && <SkeletonCards />}

        {!loading && sources.length === 0 && (
          <p className="text-[13px] text-secondary">
            No org sources yet. Add field reports and program docs from the
            Sources screen.
          </p>
        )}

        {!loading &&
          sources.map((s) => (
            <div
              key={s.filename}
              className="group rounded-xl border border-hairline bg-canvas/60 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-leaf/50 hover:bg-leaf-soft"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf-soft text-forest transition-colors group-hover:bg-white">
                  <FileText size={15} strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-primary">
                    {s.filename}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-secondary">
                    <span className="rounded bg-cream px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest">
                      {fileType(s.filename)}
                    </span>
                    {s.chunk_count} chunks
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      <Link
        to="/sources"
        className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-forest"
      >
        manage sources
        <ArrowRight
          size={14}
          strokeWidth={1.7}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  )
}

function fileType(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase()
  return ext ?? 'FILE'
}

function SkeletonCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[60px] animate-pulse rounded-xl border border-hairline bg-leaf-soft/50"
        />
      ))}
    </>
  )
}
