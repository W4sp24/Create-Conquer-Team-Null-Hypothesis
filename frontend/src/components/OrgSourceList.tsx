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
      <p className="mb-4 text-[13px] leading-relaxed text-secondary animate-fade-in">
        Your organization's knowledge base — queried by the evidence retriever.
      </p>

      <div className="flex-1 space-y-2.5 overflow-y-auto smooth-scroll">
        {loading && <SkeletonCards />}

        {!loading && sources.length === 0 && (
          <p className="text-[13px] text-secondary animate-slide-in-up">
            No org sources yet. Add field reports and program docs from the
            Sources screen.
          </p>
        )}

        {!loading &&
          sources.map((s, index) => (
            <div
              key={s.filename}
              className="group rounded-xl border border-hairline bg-canvas/60 px-3 py-3 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-leaf/50 hover:bg-leaf-soft hover:shadow-md animate-slide-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf-soft text-forest shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white group-hover:shadow-glow">
                  <FileText size={15} strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-primary transition-colors duration-200 group-hover:text-forest-deep">
                    {s.filename}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-secondary">
                    <span className="rounded bg-cream px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest shadow-sm transition-all duration-200 group-hover:bg-leaf group-hover:text-white">
                      {fileType(s.filename)}
                    </span>
                    <span className="transition-colors duration-200 group-hover:text-forest">
                      {s.chunk_count} chunks
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      <Link
        to="/sources"
        className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-forest transition-all duration-300 hover:text-forest-deep hover:scale-105"
      >
        manage sources
        <ArrowRight
          size={14}
          strokeWidth={1.7}
          className="transition-transform duration-300 group-hover:translate-x-1"
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
          className="shimmer h-[60px] rounded-xl border border-hairline bg-leaf-soft/50 animate-slide-in-up"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </>
  )
}
