import Link from 'next/link'
import { LogoWordmark } from '@/components/Logo'

const LINKS = [
  { label: 'Blog', href: '/blog' },
  { label: 'Docs', href: '/docs' },
  { label: 'Support', href: '/support' },
  { label: 'Login', href: '/login' },
]

export default function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <LogoWordmark iconSize={32} />
        <div className="flex items-center gap-6 flex-wrap justify-center">
          {LINKS.map(l => (
            <Link key={l.label} href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              {l.label}
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Evols AI</p>
      </div>
    </footer>
  )
}
