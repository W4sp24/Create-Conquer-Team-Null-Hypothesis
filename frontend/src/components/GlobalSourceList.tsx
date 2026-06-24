import { BookMarked, Lock } from 'lucide-react'

/**
 * Left panel of the Sources screen — the curated, read-only global evidence base
 * (FAO/CGIAR/IRRI etc.) that the Evidence Retriever queries alongside org uploads.
 *
 * There is no backend endpoint that lists the specialized collection yet, so this
 * shows the curated corpus statically. (A `GET /sources/specialized` endpoint is a
 * small future addition.)
 */
const GLOBAL_SOURCES: { title: string; org: string; kind: string }[] = [
  { title: 'Save and Grow: Maize, Rice, Wheat', org: 'FAO', kind: 'Intervention' },
  { title: 'System of Rice Intensification — Field Guide', org: 'IRRI', kind: 'Intervention' },
  { title: 'Climate-Smart Agriculture Sourcebook', org: 'FAO', kind: 'Practice' },
  { title: 'Smallholder Risk & Resilience Cases', org: 'CGIAR', kind: 'Risk' },
  { title: 'Program Budget Benchmarks (Livelihood)', org: 'CGIAR', kind: 'Budget' },
]

export default function GlobalSourceList() {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-4 flex items-center gap-1.5 text-[13px] leading-relaxed text-secondary">
        <Lock size={13} strokeWidth={1.7} className="text-forest" />
        Curated global evidence base — read-only.
      </p>

      <div className="flex-1 space-y-2.5 overflow-y-auto smooth-scroll">
        {GLOBAL_SOURCES.map((s, index) => (
          <div
            key={s.title}
            className="group rounded-xl border border-hairline bg-canvas/60 px-3 py-3 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-leaf/50 hover:bg-leaf-soft animate-slide-in-up"
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf-soft text-forest shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white">
                <BookMarked size={15} strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-primary">{s.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-secondary">
                  <span className="rounded bg-cream px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest">
                    {s.kind}
                  </span>
                  <span>{s.org}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
