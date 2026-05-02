import Link from 'next/link'
import { LogoWordmark } from '@/components/Logo'

const PRIMARY = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Features',     href: '/#features' },
  { label: 'Blog',         href: '/blog' },
  { label: 'Docs',         href: '/docs' },
]

const SECONDARY = [
  { label: 'Sign in',  href: '/login' },
  { label: 'Support',  href: '/support' },
  { label: 'Book a demo', href: '/book-demo' },
]

export default function Footer() {
  return (
    <footer className="relative border-t border-border/60 mt-20">
      {/* Editorial sign-off */}
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr] gap-10">
          <div>
            <LogoWordmark iconSize={32} variant="pulse" />
            <p
              className="mt-5 text-base text-muted-foreground max-w-md leading-relaxed font-display italic"
              style={{ fontStyle: 'italic' }}
            >
              The calm, AI-native ProductOS. Knowledge, context, and coordination
              — your team's AI brain.
            </p>
          </div>

          <div>
            <p className="text-overline uppercase tracking-[0.08em] text-xs text-muted-foreground/80 mb-3">Product</p>
            <ul className="space-y-2.5">
              {PRIMARY.map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-foreground/80 hover:text-foreground transition-colors duration-fast">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-overline uppercase tracking-[0.08em] text-xs text-muted-foreground/80 mb-3">More</p>
            <ul className="space-y-2.5">
              {SECONDARY.map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-foreground/80 hover:text-foreground transition-colors duration-fast">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/80">© 2026 Evols. Build calmly. Ship the brain.</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-mint)' }} />
            All systems normal
          </div>
        </div>
      </div>
    </footer>
  )
}
