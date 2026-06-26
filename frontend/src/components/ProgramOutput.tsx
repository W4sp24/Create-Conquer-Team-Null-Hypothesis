import {
  Sparkles,
  Target,
  ListChecks,
  CalendarRange,
  Users,
  ShieldAlert,
  BookMarked,
  FolderOpen,
  Wand2,
} from 'lucide-react'
import type { ProgramOutput as Program } from '../types'
import RiskBadge, { RISK_EXPLANATION } from './RiskBadge'

/** Renders a complete generated program. Adaptations Made is emphasized — it is
 *  the core "same need, different context" differentiator. */
export default function ProgramOutput({ program }: { program: Program }) {
  const risk = program.risk_assessment

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-surface rounded-card p-7 animate-rise">
        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-forest">
          <Sparkles size={12} className="text-leaf" />
          Generated Program
        </div>
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-headline text-primary">
          {program.title}
        </h1>
        <p className="mt-3 flex items-start gap-2 text-body text-secondary">
          <Target size={16} strokeWidth={1.7} className="mt-1 shrink-0 text-forest" />
          {program.target_beneficiaries}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Tooltip content="How completely the agents' inputs covered the key dimensions of a strong program design. High confidence (80%+) means recommendations are specific and well-grounded in your data. Low confidence means critical details were missing — the program is still generated but relies more on general best practices than your actual context.">
            <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary cursor-default">
              Confidence:{' '}
              <span className="font-semibold text-primary">{Math.round(program.confidence_level * 100)}%</span>
            </span>
          </Tooltip>
          <Tooltip
            content={
              <>
                <span className="font-semibold block mb-1">Overall implementation risk</span>
                {RISK_EXPLANATION[risk.risk_level] ?? RISK_EXPLANATION.unknown}
                {risk.risk_flags.length > 0 && (
                  <span className="block mt-1.5 text-white/60">
                    {risk.risk_flags.length} specific risk flag{risk.risk_flags.length > 1 ? 's' : ''} identified — see Risk &amp; Mitigation below.
                  </span>
                )}
              </>
            }
          >
            <RiskBadge level={risk.risk_level} />
          </Tooltip>
          {program.per_beneficiary_cost_usd != null && (
            <Tooltip content="Estimated average cost to deliver the full set of program services to one beneficiary over the rollout period. Multiply by your total beneficiary count to project the full budget requirement.">
              <Stat label="Cost / beneficiary" value={`$${program.per_beneficiary_cost_usd}`} />
            </Tooltip>
          )}
          {program.total_budget_estimate && (
            <Stat label="Total budget" value={program.total_budget_estimate} />
          )}
          <GroundingBadge citations={program.citations} />
        </div>
      </div>

      {/* Intervention */}
      <Section icon={<Wand2 size={16} strokeWidth={1.7} />} title="Intervention" delay={1}>
        <h3 className="font-display text-[18px] font-semibold text-primary">
          {program.intervention.intervention_name}
        </h3>
        <p className="mt-2 text-body text-secondary">{program.intervention.description}</p>
        {program.intervention.implementation_steps.length > 0 && (
          <ol className="mt-4 space-y-2">
            {program.intervention.implementation_steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[14px] text-primary">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-[12px] font-semibold text-forest">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Adaptations Made — emphasized */}
      {program.adaptations_made.length > 0 && (
        <section
          className="rounded-card border border-leaf/40 bg-leaf-soft p-7 shadow-card animate-slide-in-up"
          style={{ animationDelay: '0.15s' }}
        >
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-forest">
            <Sparkles size={12} className="text-leaf" />
            Adaptations Made
          </div>
          <p className="mb-4 text-[13px] text-secondary">
            How the generic intervention was reshaped for this specific context.
          </p>
          <ul className="space-y-2.5">
            {program.adaptations_made.map((a, i) => (
              <li key={i} className="flex gap-3 text-[14px] text-primary">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* KPIs */}
      {program.kpis.length > 0 && (
        <Section icon={<ListChecks size={16} strokeWidth={1.7} />} title="Key Performance Indicators" delay={2}>
          <div className="grid gap-3 sm:grid-cols-2">
            {program.kpis.map((kpi, i) => (
              <div key={i} className="rounded-xl border border-hairline bg-canvas/60 p-4">
                <div className="text-[14px] font-semibold text-primary">{kpi.name}</div>
                <div className="mt-1 text-[13px] text-forest">Target: {kpi.target}</div>
                <div className="mt-0.5 text-[12px] text-secondary">{kpi.measurement}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Rollout phases */}
      {program.rollout_phases.length > 0 && (
        <Section icon={<CalendarRange size={16} strokeWidth={1.7} />} title="Rollout Phases" delay={3}>
          <ol className="space-y-3">
            {program.rollout_phases.map((p) => (
              <li key={p.phase} className="rounded-xl border border-hairline bg-canvas/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[15px] font-semibold text-primary">
                    Phase {p.phase}: {p.name}
                  </span>
                  <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-forest">
                    {p.duration}
                  </span>
                </div>
                {p.activities.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.activities.map((act, i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-secondary">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest/50" />
                        {act}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Staff */}
      {program.staff_roles.length > 0 && (
        <Section icon={<Users size={16} strokeWidth={1.7} />} title="Staff Roles" delay={4}>
          <div className="flex flex-wrap gap-2">
            {program.staff_roles.map((role, i) => (
              <span key={i} className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[13px] text-primary">
                {role}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Risk assessment */}
      <Section icon={<ShieldAlert size={16} strokeWidth={1.7} />} title="Risk & Mitigation" delay={5}>
        <div className="grid gap-4 sm:grid-cols-2">
          <RiskList title="Risk flags" items={risk.risk_flags} empty="No flags identified." />
          <RiskList title="Mitigations" items={risk.mitigations} empty="No mitigations listed." />
        </div>
      </Section>

      {/* Citations */}
      {program.citations.length > 0 && (
        <div id="citations">
          <Section icon={<BookMarked size={16} strokeWidth={1.7} />} title="Citations" delay={6}>
            <CitationGroup
              icon={<BookMarked size={14} strokeWidth={1.7} className="text-forest" />}
              label="Specialized knowledge base"
              items={program.citations.filter((c) => c.startsWith('[Global:'))}
            />
            <CitationGroup
              icon={<FolderOpen size={14} strokeWidth={1.7} className="text-forest" />}
              label="Your organization's documents"
              items={program.citations.filter((c) => c.startsWith('[Org:'))}
            />
            {program.citations.every((c) => !c.startsWith('[Global:') && !c.startsWith('[Org:')) && (
              <p className="text-[13px] text-secondary">{program.citations[0]}</p>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({
  icon,
  title,
  delay = 0,
  children,
}: {
  icon: React.ReactNode
  title: string
  delay?: number
  children: React.ReactNode
}) {
  return (
    <section
      className="card-surface rounded-card p-7 animate-slide-in-up"
      style={{ animationDelay: `${delay * 0.05}s` }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf-soft text-forest">
          {icon}
        </span>
        <span className="text-label font-semibold uppercase tracking-label text-forest">{title}</span>
      </div>
      {children}
    </section>
  )
}

function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2.5 w-64 -translate-x-1/2 rounded-xl bg-primary px-3 py-2.5 text-[11px] leading-snug text-white/90 shadow-lg opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100"
      >
        {content}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-primary" />
      </span>
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary cursor-default">
      {label}: <span className="font-semibold capitalize text-primary">{value}</span>
    </span>
  )
}

function RiskList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-label text-secondary">{title}</div>
      {items.length === 0 ? (
        <p className="text-[13px] text-secondary">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-primary">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest/50" />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function countCitationsBySource(citations: string[]): { global: number; org: number; none: boolean } {
  let global = 0
  let org = 0
  for (const c of citations) {
    if (c.startsWith('[Global:')) global++
    else if (c.startsWith('[Org:')) org++
  }
  return { global, org, none: global === 0 && org === 0 }
}

function GroundingBadge({ citations }: { citations: string[] }) {
  const { global, org, none } = countCitationsBySource(citations)

  function scrollToCitations() {
    document.getElementById('citations')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (none) {
    return (
      <Tooltip content="No knowledge base documents were retrieved — recommendations are based on general best practices only. Ingest sources on the Sources page to enable evidence-grounded, citation-backed programs.">
        <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary cursor-default">
          No sources retrieved yet
        </span>
      </Tooltip>
    )
  }

  return (
    <Tooltip
      content={`Recommendations were derived from ${global} curated knowledge base document${global !== 1 ? 's' : ''}${org > 0 ? ` and ${org} of your uploaded document${org !== 1 ? 's' : ''}` : ''}, not generated from general knowledge alone. More source documents give the agents more proven interventions to adapt from. Click to see full citations.`}
    >
      <button
        type="button"
        onClick={scrollToCitations}
        className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary transition-colors hover:border-leaf hover:text-forest"
      >
        Grounded in{' '}
        <span className="font-semibold text-primary">
          {global} specialized{org > 0 ? ` + ${org} your docs` : ''}
        </span>
      </button>
    </Tooltip>
  )
}

function CitationGroup({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode
  label: string
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-label text-secondary">
        {icon}
        {label}
      </div>
      <ul className="space-y-1.5">
        {items.map((c, i) => (
          <li key={i} className="text-[13px] text-secondary">
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}
