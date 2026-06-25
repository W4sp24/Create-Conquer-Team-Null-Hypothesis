interface ConfirmationSealProps {
  size?: number
  className?: string
}

/**
 * The one signature "confirmed" icon for this feature — a circular seal/stamp,
 * not a generic checkmark. Always paired with text per the accessibility floor;
 * never used as the sole signal of state. Colors via `currentColor`, so it
 * inherits whatever text-color class wraps it (gold on dark backgrounds,
 * forest on white cards), matching how lucide-react icons are used elsewhere.
 */
export default function ConfirmationSeal({ size = 14, className = '' }: ConfirmationSealProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="2.2 2.6"
        opacity="0.55"
      />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
