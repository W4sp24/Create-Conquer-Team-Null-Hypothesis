import { useEffect, useState } from 'react'
import { BookMarked, Lock } from 'lucide-react'
import type { SourceMetadata } from '../types'
import { getSpecializedSources } from '../lib/api'

/**
 * Left panel of the Sources screen — the curated, read-only global evidence base
 * (the specialized KB the Evidence Retriever queries alongside org uploads).
 * Driven by the real GET /sources/specialized endpoint; shows an honest empty
 * state until docs are ingested (scripts/ingest_specialized.py).
 */
export default function GlobalSourceList() {
  const [sources, setSources] = useState<SourceMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getSpecializedSources()
      .then((data) => active && setSources(data))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <p className="mb-4 flex items-center gap-1.5 text-[13px] leading-relaxed text-secondary">
        <Lock size={13} strokeWidth={1.7} className="text-forest" />
        Curated global evidence base — read-only.
      </p>

      <div className="flex-1 space-y-2.5 overflow-y-auto smooth-scroll">
        {loading && <SkeletonCards />}

        {!loading && sources.length === 0 && (
          <p className="text-[13px] text-secondary animate-slide-in-up">
            No curated sources ingested yet. Run{' '}
            <code className="rounded bg-cream px-1 py-0.5 text-[12px] text-forest">
              scripts/ingest_specialized.py
            </code>{' '}
            to populate the global evidence base.
          </p>
        )}

        {!loading &&
          sources.map((s, index) => (
            <div
              key={s.filename}
              className="group rounded-xl border border-hairline bg-canvas/60 px-3 py-3 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-leaf/50 hover:bg-leaf-soft animate-slide-in-up"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf-soft text-forest shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white">
                  <BookMarked size={15} strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-primary">{s.filename}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-secondary">
                    <span className="rounded bg-cream px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest">
                      Specialized
                    </span>
                    <span>{s.chunk_count} chunks</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
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
