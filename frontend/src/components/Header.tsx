import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Moon, Sun, Settings, ChevronDown, LogOut, Shield, LifeBuoy,
  Sparkles, UsersRound, Zap, Briefcase, Brain, Command,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoWordmark } from '@/components/Logo'
import { useState, useRef, useEffect } from 'react'
import { TenantSwitcher } from '@/components/TenantSwitcher'
import { getCurrentUser } from '@/utils/auth'

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features',     href: '#features' },
  { label: 'Blog',         href: '/blog' },
  { label: 'Docs',         href: '/docs' },
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [scrolled, setScrolled]             = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fullUser = getCurrentUser()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Topbar gets a glass blur once the user scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const navItems = [
    { href: '/workbench',     label: 'Workbench',    key: 'workbench',    icon: Sparkles },
    { href: '/work-context',  label: 'Work Context', key: 'work-context', icon: Briefcase },
    { href: '/context',       label: 'Knowledge',    key: 'context',      icon: Brain },
    { href: '/skills',        label: 'Skills',       key: 'skills',       icon: Zap },
  ]

  const adminNavItems = [
    { href: '/admin/tenants', label: 'Admin Panel', key: 'admin',   icon: Shield },
    { href: '/admin/support', label: 'Support',     key: 'support', icon: LifeBuoy },
  ]

  const position = variant === 'landing' ? 'fixed' : 'sticky'

  return (
    <header
      className={[
        position,
        'top-0 left-0 right-0 z-50 transition-colors duration-mod ease-evol-out',
        scrolled
          ? 'border-b border-border/80 bg-background/80 backdrop-blur-glass supports-[backdrop-filter]:bg-background/60'
          : 'border-b border-transparent bg-background/0',
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/" className="flex-shrink-0 group" aria-label="Evols home">
            <LogoWordmark
              iconSize={28}
              variant={variant === 'landing' ? 'pulse' : 'solid'}
              className="transition-opacity group-hover:opacity-80"
            />
          </Link>

          {variant === 'landing' && (
            <nav className="hidden md:flex items-center gap-7">
              {NAV_LINKS.filter(l =>
                (!l.href.startsWith('#') || router.pathname === '/') &&
                !(l.href === '/docs' && router.pathname.startsWith('/docs')) &&
                !(l.href === '/blog' && router.pathname.startsWith('/blog'))
              ).map(l => (
                <a
                  key={l.label}
                  href={l.href}
                  {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-fast tracking-[-0.01em]"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          )}

          {variant === 'app' && user && fullUser?.role !== 'SUPER_ADMIN' && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = currentPage === item.key || router.pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'relative flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md',
                      'transition-colors duration-fast',
                      isActive
                        ? 'text-foreground bg-muted/60'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    ].join(' ')}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
                    {item.label}
                    {isActive && (
                      <span
                        className="absolute -bottom-[14px] left-3 right-3 h-px"
                        style={{ background: 'var(--brand-pulse)' }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>
          )}

          {variant === 'app' && user && fullUser?.role === 'SUPER_ADMIN' && (
            <nav className="hidden md:flex items-center gap-1">
              {adminNavItems.map((item) => {
                const isActive = currentPage === item.key || router.pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md',
                      'transition-colors duration-fast',
                      isActive
                        ? 'text-foreground bg-muted/60'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    ].join(' ')}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        {/* Right: theme toggle + landing CTAs / app user menu */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-fast"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light'
              ? <Moon className="w-4 h-4" strokeWidth={1.75} />
              : <Sun  className="w-4 h-4" strokeWidth={1.75} />}
          </button>

          {variant === 'landing' && (
            <>
              <Link
                href="/login"
                className="inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-md text-foreground/85 hover:text-foreground hover:bg-muted/50 transition-colors duration-fast"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="hidden sm:inline-flex text-sm font-medium px-4 py-2 rounded-lg text-white tracking-[-0.01em] transition-all duration-fast hover:-translate-y-px"
                style={{
                  background: 'var(--brand-pulse)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 20px -8px rgba(91,71,229,0.55)',
                }}
              >
                Get early access
              </Link>
            </>
          )}

          {variant === 'app' && user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-sm font-medium px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-fast"
                aria-haspopup="menu"
                aria-expanded={isDropdownOpen}
              >
                <span className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white"
                      style={{ background: 'var(--brand-pulse)' }}>
                  {(user.full_name || user.email || 'U')
                    .split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="hidden sm:inline">
                  {(user.full_name || user.email || 'User').split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                    .join(' ')}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-fast ${isDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={1.75} />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover/95 backdrop-blur-glass shadow-elev-2 py-1 z-[100] animate-fade-in">
                  <TenantSwitcher />
                  {fullUser?.role === 'TENANT_ADMIN' && (
                    <Link
                      href="/settings?tab=team"
                      className="flex items-center gap-2 px-3 py-2 mx-1 text-sm text-foreground rounded-md hover:bg-muted/60 transition-colors duration-fast"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <UsersRound className="w-4 h-4" strokeWidth={1.75} />
                      Team
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2 mx-1 text-sm text-foreground rounded-md hover:bg-muted/60 transition-colors duration-fast"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <Settings className="w-4 h-4" strokeWidth={1.75} />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 mx-1 text-sm text-destructive rounded-md hover:bg-destructive/10 transition-colors duration-fast text-left"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.75} />
                    Logout
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
