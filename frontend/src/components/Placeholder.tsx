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
      <header className="glass sticky top-0 z-20 border-b border-white/10 bg-forest-deep/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5 transition-transform hover:scale-105">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf text-white shadow-glow transition-all duration-300 group-hover:shadow-glow-lg group-hover:rotate-12">
              <Sprout size={18} strokeWidth={1.7} />
            </span>
            <span className="font-display text-[21px] font-semibold tracking-headline text-white">
              AniKonsulta
            </span>
          </Link>
          <Link
            to="/"
            className="pill border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-all duration-300 hover:border-leaf hover:bg-white/20 hover:scale-105 hover:shadow-glow"
          >
            <ArrowLeft size={15} strokeWidth={1.7} />
            Input
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="animate-rise relative max-w-md overflow-hidden rounded-card bg-forest-deep px-10 py-12 text-center text-white shadow-feature transition-all duration-500 hover:scale-105 hover:shadow-glow-lg">
          <Spark size={16} className="absolute right-8 top-7 text-leaf/70 animate-sparkle" />
          <Spark size={10} className="absolute left-10 top-14 text-white/20 animate-sparkle delay-2" />
          <Spark size={8} className="absolute right-12 bottom-10 text-leaf/50 animate-sparkle delay-3" />
          <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-label text-leaf-soft animate-fade-in delay-1">
            <Spark size={11} className="text-leaf animate-pulse-glow" />
            {label}
          </div>
          <h1 className="mb-4 font-display text-[34px] font-semibold leading-tight tracking-headline animate-slide-in-up delay-2">
            {title}
          </h1>
          <p className="text-body text-white/70 animate-slide-in-up delay-3">{body}</p>
        </div>
      </main>
    </div>
  )
}
