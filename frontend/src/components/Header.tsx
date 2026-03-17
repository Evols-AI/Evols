import Link from 'next/link'
import { useRouter } from 'next/router'
import { Moon, Sun, FlaskConical, Settings, MessageSquare, Users, ChevronDown, LogOut, BookOpen, Shield, LifeBuoy, Sparkles, Database, Wand2, UsersRound } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoIcon } from '@/components/Logo'
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
    { href: '/context', label: 'Context', key: 'context', icon: Database },
    { href: '/personas', label: 'Personas', key: 'personas', icon: Users },
    { href: '/workbench', label: 'Workbench', key: 'workbench', highlight: true, icon: Sparkles },
  ]

  const adminNavItems = [
    { href: '/admin/tenants', label: 'Admin Panel', key: 'admin', icon: Shield },
    { href: '/admin/support', label: 'Support', key: 'support', icon: LifeBuoy },
    { href: '/admin/advisers', label: 'Skills', key: 'advisers-admin', icon: Wand2 },
    { href: '/admin/advisers-platform', label: 'Skills Analytics', key: 'advisers-platform', icon: Sparkles },
  ]

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <LogoIcon size={48} />
              <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                Evols
              </span>
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
                      className={`flex items-center gap-1.5 text-sm transition-colors ${
                        isActive
                          ? 'text-blue-500 dark:text-blue-300 font-semibold'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {item.label}
                    </Link>
                  )
                })}
                {fullUser?.role === 'TENANT_ADMIN' && (
                  <Link
                    href="/admin/advisers"
                    className={`flex items-center gap-1.5 text-sm transition-colors ${
                      currentPage === 'advisers-admin' || router.pathname.startsWith('/admin/advisers')
                        ? 'text-blue-500 dark:text-blue-300 font-semibold'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Skills
                  </Link>
                )}
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
                      className={`flex items-center gap-1.5 text-sm transition-colors ${
                        isActive
                          ? 'text-blue-500 dark:text-blue-300 font-semibold'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                      }`}
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
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Sun className="w-5 h-5 text-gray-300" />
              )}
            </button>
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <span>{user.full_name || user.email || 'User'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    {/* Tenant Switcher - only shown for multi-tenant users */}
                    <div className="px-2 py-1">
                      <TenantSwitcher />
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                    {fullUser?.role === 'TENANT_ADMIN' && (
                      <Link
                        href="/settings?tab=team"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <UsersRound className="w-4 h-4" />
                        Team
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
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
