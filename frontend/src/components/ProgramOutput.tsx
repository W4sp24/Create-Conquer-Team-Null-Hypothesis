import {
  Sparkles,
  Target,
  ListChecks,
  CalendarRange,
  Users,
  ShieldAlert,
  BookMarked,
  Wand2,
} from 'lucide-react'
import type { ProgramOutput as Program } from '../types'
import RiskBadge from './RiskBadge'

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
        <div className="mt-4 flex flex-wrap gap-2">
          <Stat label="Confidence" value={`${Math.round(program.confidence_level * 100)}%`} />
          <RiskBadge level={risk.risk_level} />
          {program.per_beneficiary_cost_usd != null && (
            <Stat label="Cost / beneficiary" value={`$${program.per_beneficiary_cost_usd}`} />
          )}
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
        <Section icon={<BookMarked size={16} strokeWidth={1.7} />} title="Citations" delay={6}>
          <ul className="space-y-1.5">
            {program.citations.map((c, i) => (
              <li key={i} className="text-[13px] text-secondary">
                {c}
              </li>
            ))}
          </ul>
        </Section>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary">
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
