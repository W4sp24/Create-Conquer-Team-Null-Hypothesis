interface SparkProps {
  size?: number
  className?: string
}

/** Decorative 4-point star accent (Rultivo-style), single-color. */
export default function Spark({ size = 16, className }: SparkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 0C12 6 12 6 12 6C12.6 9.5 14.5 11.4 18 12C18 12 18 12 24 12C18 12 18 12 18 12C14.5 12.6 12.6 14.5 12 18C12 18 12 18 12 24C12 18 12 18 12 18C11.4 14.5 9.5 12.6 6 12C6 12 6 12 0 12C6 12 6 12 6 12C9.5 11.4 11.4 9.5 12 6C12 6 12 6 12 0Z"
        fill="currentColor"
      />
    </svg>
  )
}
