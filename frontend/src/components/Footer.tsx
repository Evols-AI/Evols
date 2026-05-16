import Link from 'next/link'
import { FaLinkedin, FaGithub, FaXTwitter } from 'react-icons/fa6'
import { LogoWordmark } from '@/components/Logo'

const COLUMNS = [
  {
    heading: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Glossary', href: '/glossary' },
      { label: 'Support', href: '/support' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/116584015', external: true, icon: FaLinkedin },
      { label: 'GitHub', href: 'https://github.com/evols-ai', external: true, icon: FaGithub },
      { label: 'X (Twitter)', href: 'https://x.com/EvolsAI', external: true, icon: FaXTwitter },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Acceptable Use', href: '/acceptable-use' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-border py-6">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-5">
          {/* Brand column */}
          <div className="flex flex-col gap-1.5">
            <LogoWordmark iconSize={24} />
            <p className="text-xs text-muted-foreground leading-snug">
              The team AI brain that eliminates knowledge fragmentation across AI coding sessions.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map(col => (
            <div key={col.heading}>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2">
                {col.heading}
              </p>
              <ul className="space-y-1">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      {...('external' in l && l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      {'icon' in l && l.icon && <l.icon className="w-3 h-3 flex-shrink-0" />}
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">© 2026 Evols AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
