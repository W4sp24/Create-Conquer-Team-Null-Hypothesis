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
