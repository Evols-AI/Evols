import Link from 'next/link'
import { useRouter } from 'next/router'
import { Moon, Sun, Settings, Users, ChevronDown, LogOut, Shield, LifeBuoy, Sparkles, UsersRound, Zap, Briefcase, Brain } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoWordmark } from '@/components/Logo'
import { useState, useRef, useEffect } from 'react'
import { ProductSelector } from '@/components/ProductSelector'
import { TenantSwitcher } from '@/components/TenantSwitcher'
import { getCurrentUser } from '@/utils/auth'

interface HeaderProps {
  user?: {
    full_name?: string
    email?: string
  } | null
  currentPage?: string
}

export default function Header({ user, currentPage }: HeaderProps) {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fullUser = getCurrentUser()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const navItems = [
    // { href: '/dashboard', label: 'Dashboard', key: 'dashboard', icon: LayoutDashboard }, // Hidden for demo - points to outdated pages
    { href: '/workbench', label: 'Workbench', key: 'workbench', icon: Sparkles },
    { href: '/work-context', label: 'Work Context', key: 'work-context', icon: Briefcase },
    { href: '/context', label: 'Knowledge', key: 'context', icon: Brain },
    { href: '/personas', label: 'Personas', key: 'personas', icon: Users },
    { href: '/skills', label: 'Skills', key: 'skills', icon: Zap },
  ]

  const adminNavItems = [
    { href: '/admin/tenants', label: 'Admin Panel', key: 'admin', icon: Shield },
    { href: '/admin/support', label: 'Support', key: 'support', icon: LifeBuoy },
    { href: '/admin/advisers-platform', label: 'Skills Analytics', key: 'advisers-platform', icon: Sparkles },
  ]

  return (
    <header className="sticky top-0 z-50 border-b" style={{
      background: 'hsl(var(--card) / 0.95)',
      borderColor: 'hsl(var(--border))',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)'
    }}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="group">
              <LogoWordmark iconSize={48} />
            </Link>
            {user && fullUser?.role !== 'SUPER_ADMIN' && <ProductSelector />}
            {user && fullUser?.role !== 'SUPER_ADMIN' && (
              <nav className="flex items-center space-x-6">
                {navItems.map((item) => {
                  const isActive = currentPage === item.key || router.pathname.startsWith(item.href)
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-1.5 text-sm transition-colors font-medium"
                      style={{
                        color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                      }}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}
            {user && fullUser?.role === 'SUPER_ADMIN' && (
              <nav className="flex items-center space-x-6">
                {adminNavItems.map((item) => {
                  const isActive = currentPage === item.key || router.pathname.startsWith(item.href)
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-1.5 text-sm transition-colors font-medium"
                      style={{
                        color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                      }}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition hover-lift"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" style={{ color: 'hsl(var(--muted-foreground))' }} />
              ) : (
                <Sun className="w-5 h-5" style={{ color: 'hsl(var(--muted-foreground))' }} />
              )}
            </button>
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 text-sm transition-colors font-medium"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                >
                  <span>{(user.full_name || user.email || 'User').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg border py-1 z-[100]" style={{
                    background: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))'
                  }}>
                    {/* Tenant Switcher - only shown for multi-tenant users */}
                    <TenantSwitcher />

                    {fullUser?.role === 'TENANT_ADMIN' && (
                      <Link
                        href="/settings?tab=team"
                        className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover-lift rounded-lg mx-1"
                        style={{ color: 'hsl(var(--foreground))' }}
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <UsersRound className="w-4 h-4" />
                        Team
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover-lift rounded-lg mx-1"
                      style={{ color: 'hsl(var(--foreground))' }}
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm transition-colors hover-lift rounded-lg mx-1 text-left"
                      style={{ color: 'hsl(var(--destructive))' }}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
