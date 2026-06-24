import { Link, useLocation } from 'react-router-dom'
import { Sprout } from 'lucide-react'

const LINKS: { to: string; label: string }[] = [
  { to: '/', label: 'Input' },
  { to: '/status', label: 'Agents' },
  { to: '/output', label: 'Output' },
  { to: '/sources', label: 'Sources' },
]

/** Shared top navigation bar (forest header) used across the inner screens. */
export default function TopNav() {
  const { pathname } = useLocation()

  return (
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

        <nav className="glass hidden items-center gap-1 rounded-full border border-white/20 bg-white/10 px-1.5 py-1.5 text-[13px] sm:flex">
          {LINKS.map((l) => {
            const active = l.to === '/' ? pathname === '/' : pathname.startsWith(l.to)
            return active ? (
              <span
                key={l.to}
                className="rounded-full bg-leaf px-3.5 py-1.5 font-medium text-white shadow-glow"
              >
                {l.label}
              </span>
            ) : (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full px-3.5 py-1.5 text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105"
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
