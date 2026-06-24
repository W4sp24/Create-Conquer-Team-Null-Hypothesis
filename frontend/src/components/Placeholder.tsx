import { Link } from 'react-router-dom'
import { ArrowLeft, Sprout } from 'lucide-react'
import Spark from './Spark'

interface PlaceholderProps {
  label: string
  title: string
  body: string
}

export default function Placeholder({ label, title, body }: PlaceholderProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-forest-deep/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf text-white">
              <Sprout size={18} strokeWidth={1.7} />
            </span>
            <span className="font-display text-[21px] font-semibold tracking-headline text-white">
              AniKonsulta
            </span>
          </Link>
          <Link
            to="/"
            className="pill border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-medium text-white hover:border-leaf hover:bg-white/20"
          >
            <ArrowLeft size={15} strokeWidth={1.7} />
            Input
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="animate-rise relative max-w-md overflow-hidden rounded-card bg-forest-deep px-10 py-12 text-center text-white shadow-feature">
          <Spark size={16} className="absolute right-8 top-7 text-leaf/70" />
          <Spark size={10} className="absolute left-10 top-14 text-white/20" />
          <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-leaf-soft">
            <Spark size={11} className="text-leaf" />
            {label}
          </div>
          <h1 className="mb-4 font-display text-[34px] font-semibold leading-tight tracking-headline">
            {title}
          </h1>
          <p className="text-body text-white/70">{body}</p>
        </div>
      </main>
    </div>
  )
}
