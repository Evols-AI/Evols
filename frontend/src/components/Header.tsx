import Link from 'next/link'
import { useRouter } from 'next/router'
import { Moon, Sun, Settings, Users, ChevronDown, LogOut, Shield, LifeBuoy, Sparkles, UsersRound, Zap, Briefcase, Brain } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoWordmark } from '@/components/Logo'
import { useState, useRef, useEffect } from 'react'
import { TenantSwitcher } from '@/components/TenantSwitcher'
import { getCurrentUser } from '@/utils/auth'

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Docs', href: '/docs' },
]

interface HeaderProps {
  user?: {
    full_name?: string
    email?: string
  } | null
  currentPage?: string
  variant?: 'app' | 'landing'
}

export default function Header({ user, currentPage, variant = 'app' }: HeaderProps) {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fullUser = getCurrentUser()

  const textMuted = 'hsl(var(--muted-foreground))'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const navItems = [
    { href: '/workbench', label: 'Workbench', key: 'workbench', icon: Sparkles },
    { href: '/work-context', label: 'Work Context', key: 'work-context', icon: Briefcase },
    { href: '/context', label: 'Knowledge', key: 'context', icon: Brain },
    { href: '/skills', label: 'Skills', key: 'skills', icon: Zap },
  ]

  const adminNavItems = [
    { href: '/admin/tenants', label: 'Admin Panel', key: 'admin', icon: Shield },
    { href: '/admin/support', label: 'Support', key: 'support', icon: LifeBuoy },
  ]

  const position = variant === 'landing' ? 'fixed' : 'sticky'

  return (
    <header className={`${position} top-0 left-0 right-0 z-50 border-b border-border bg-background`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Left: logo + app nav */}
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/" className="flex-shrink-0">
            <LogoWordmark iconSize={36} />
          </Link>

          {variant === 'landing' && (
            <nav className="hidden md:flex items-center gap-8">
              {NAV_LINKS.filter(l =>
                (!l.href.startsWith('#') || router.pathname === '/') &&
                !(l.href === '/docs' && router.pathname.startsWith('/docs'))
              ).map(l => (
                <a key={l.label} href={l.href}
                  {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors tracking-[-0.01em]">
                  {l.label}
                </a>
              ))}
            </nav>
          )}

          {variant === 'app' && user && fullUser?.role !== 'SUPER_ADMIN' && (
            <nav className="flex items-center space-x-6">
              {navItems.map((item) => {
                const isActive = currentPage === item.key || router.pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-1.5 text-sm transition-colors font-medium"
                    style={{ color: isActive ? 'hsl(var(--primary))' : textMuted }}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}
          {variant === 'app' && user && fullUser?.role === 'SUPER_ADMIN' && (
            <nav className="flex items-center space-x-6">
              {adminNavItems.map((item) => {
                const isActive = currentPage === item.key || router.pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-1.5 text-sm transition-colors font-medium"
                    style={{ color: isActive ? 'hsl(var(--primary))' : textMuted }}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        {/* Right: theme toggle + landing CTAs or app user menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={toggleTheme} className="w-9 h-9 rounded-lg flex items-center justify-center transition hover-lift" aria-label="Toggle theme">
            {theme === 'light' ? <Moon className="w-4 h-4" style={{ color: textMuted }} /> : <Sun className="w-4 h-4" style={{ color: textMuted }} />}
          </button>

          {variant === 'landing' && (
            <>
              <Link href="/login" className="text-sm px-3 py-1.5 transition-colors" style={{ color: textMuted }}>
                Sign in
              </Link>
              <Link href="/register"
                className="text-sm font-medium px-4 py-2 rounded-lg text-primary-foreground bg-primary hover:bg-primary/85 transition-all tracking-[-0.01em]">
                Get early access
              </Link>
            </>
          )}

          {variant === 'app' && user && (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-sm transition-colors font-medium"
                style={{ color: textMuted }}
              >
                <span>{(user.full_name || user.email || 'User').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg border border-border bg-card py-1 z-[100]">
                  <TenantSwitcher />
                  {fullUser?.role === 'TENANT_ADMIN' && (
                    <Link href="/settings?tab=team"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground transition-colors hover-lift rounded-lg mx-1"
                      onClick={() => setIsDropdownOpen(false)}>
                      <UsersRound className="w-4 h-4" />Team
                    </Link>
                  )}
                  <Link href="/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground transition-colors hover-lift rounded-lg mx-1"
                    onClick={() => setIsDropdownOpen(false)}>
                    <Settings className="w-4 h-4" />Settings
                  </Link>
                  <button onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive transition-colors hover-lift rounded-lg mx-1 text-left">
                    <LogOut className="w-4 h-4" />Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
