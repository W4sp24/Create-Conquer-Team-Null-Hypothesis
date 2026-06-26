import { ShieldCheck, AlertTriangle, ShieldAlert, HelpCircle } from 'lucide-react'

const RISK_META: Record<
  string,
  { bg: string; text: string; icon: typeof ShieldCheck; label: string }
> = {
  low: { bg: 'bg-leaf-soft', text: 'text-forest', icon: ShieldCheck, label: 'Low risk' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle, label: 'Medium risk' },
  high: { bg: 'bg-red-100', text: 'text-red-600', icon: ShieldAlert, label: 'High risk' },
  unknown: { bg: 'bg-cream', text: 'text-secondary', icon: HelpCircle, label: 'Risk unknown' },
}

export const RISK_EXPLANATION: Record<string, string> = {
  low: 'No significant barriers to implementation were identified. The operating context is stable, constraints are manageable, and the proposed mitigations are straightforward. The program can proceed as designed with standard monitoring.',
  medium: 'Factors that could disrupt implementation if left unmanaged were identified from your context. The program accounts for these, but review the risk flags and mitigations below before rollout — active monitoring throughout delivery is recommended.',
  high: 'Significant barriers to successful delivery were found in your context. The program design incorporates mitigations, but a small-scale pilot should be run first to test whether they hold before committing to full rollout.',
  unknown: 'Risk could not be reliably estimated — usually because the operating context was too briefly described. Add more detail about local conditions, infrastructure, and past programs to get a reliable score.',
}

/** Risk level shown as color + icon + text together — never color alone. */
export default function RiskBadge({ level }: { level: string }) {
  const meta = RISK_META[level] ?? RISK_META.unknown
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
    >
      <Icon size={14} strokeWidth={2} />
      {meta.label}
    </span>
  )
}
