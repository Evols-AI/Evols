import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, AlertCircle, Moon, Sun } from 'lucide-react'
import { LogoWordmark } from '@/components/Logo'
import { isAuthenticated } from '@/utils/auth'
import { useTheme } from '@/contexts/ThemeContext'

export default function Login() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const isOidcCallback = router.query.oidc_callback === '1'
  const oidcRedirectUri = (router.query.redirect_uri as string) || ''
  const oidcState = (router.query.state as string) || ''

  useEffect(() => {
    document.body.style.background = dark ? '#0A0A0B' : '#F7F7F8'
    document.body.style.backgroundImage = 'none'
  }, [dark])

  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated() && !isOidcCallback) {
        const user = localStorage.getItem('user')
        if (user) {
          const userData = JSON.parse(user)
          if (userData.role === 'SUPER_ADMIN') {
            router.replace('/admin/tenants')
          } else {
            router.replace('/workbench')
          }
        } else {
          router.replace('/workbench')
        }
      } else {
        setCheckingAuth(false)
      }
    }
    if (router.isReady) checkAuth()
  }, [router, isOidcCallback])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (response.ok) {
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user', JSON.stringify({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          tenant_id: data.tenant_id,
          role: data.role,
        }))
        if (isOidcCallback && oidcRedirectUri) {
          const callbackParams = new URLSearchParams({ token: data.access_token, redirect_uri: oidcRedirectUri })
          if (oidcState) callbackParams.set('state', oidcState)
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || ''
          window.location.href = `${backendUrl}/api/v1/oidc/callback?${callbackParams.toString()}`
          return
        }
        const nextUrl = new URLSearchParams(window.location.search).get('next')
        if (data.role === 'SUPER_ADMIN') {
          window.location.href = '/admin/tenants'
        } else {
          window.location.href = nextUrl || '/workbench'
        }
      } else {
        setError(data.detail || 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      setError('Unable to connect to the server. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) return null

  const inputClass = `block w-full pl-10 pr-3 py-3 border rounded-lg text-sm transition-colors outline-none ${
    dark
      ? 'border-white/[0.08] bg-white/[0.04] text-[#FAFAFA] placeholder-[#71717A] focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/30'
      : 'border-black/[0.1] bg-white text-[#0A0A0B] placeholder-[#A1A1AA] focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/30'
  }`
  const labelClass = `block text-sm font-medium mb-2 ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`
  const iconClass = `h-5 w-5 ${dark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`

  return (
    <>
      <Head>
        <title>Login - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className={`min-h-screen flex flex-col transition-colors ${dark ? 'bg-[#0A0A0B]' : 'bg-[#F7F7F8]'}`}>
        <nav className={`fixed top-0 left-0 right-0 z-50 border-b ${dark ? 'border-white/[0.06]' : 'border-black/[0.07]'} backdrop-blur-xl ${dark ? 'bg-[#0A0A0B]/80' : 'bg-white/80'} transition-colors duration-300`}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/">
              <LogoWordmark iconSize={36} />
            </Link>
            <div className="flex items-center space-x-4">
              <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" aria-label="Toggle theme">
                {theme === 'light' ? <Moon className="w-5 h-5 text-[#52525B]" /> : <Sun className="w-5 h-5 text-[#A1A1AA]" />}
              </button>
              <Link href="/register" className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-2 px-5 rounded-lg text-sm font-medium transition-colors">
                Get Early Access
              </Link>
            </div>
          </div>
        </nav>
        <div className="h-16" />
        <div className="flex-grow flex items-center justify-center px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center w-full max-w-6xl">
            {/* Left Column */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <img
                src="/Authentication-rafiki.svg"
                alt="Authentication illustration"
                className="w-full max-w-md mb-10 drop-shadow-lg"
              />
              <div className="text-center">
                <h2 className={`text-3xl font-medium mb-4 ${dark ? 'text-[#FAFAFA]' : 'text-[#0A0A0B]'}`}>
                  Welcome Back!
                </h2>
                <p className={`max-w-md ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                  Access your AI-powered product decision platform and continue making data-driven decisions.
                </p>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="w-full">
              <div className={`rounded-2xl p-8 border ${dark ? 'bg-[#111113] border-white/[0.06]' : 'bg-white border-black/[0.07]'}`}>
                {error && (
                  <div className={`mb-6 p-4 border rounded-lg flex items-start space-x-3 ${dark ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className={labelClass}>Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className={iconClass} />
                      </div>
                      <input id="email" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass} placeholder="you@company.com" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className={labelClass}>Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className={iconClass} />
                      </div>
                      <input id="password" type="password" required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass} placeholder="••••••••" />
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3 px-6 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="mt-6 text-center text-sm">
                  <p className={dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}>
                    Don't have an account?{' '}
                    <Link href="/register" className="text-[#A78BFA] hover:text-[#8B5CF6] font-medium transition-colors">
                      Sign up
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={`border-t ${dark ? 'border-white/[0.06]' : 'border-black/[0.07]'} py-12 w-full transition-colors duration-300`}>
          <div className={`max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 ${dark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
            <LogoWordmark iconSize={32} />
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <Link href="/docs" className="text-sm transition-colors duration-150 hover:text-[#A78BFA]">Docs</Link>
              <Link href="/support" className="text-sm transition-colors duration-150 hover:text-[#A78BFA]">Support</Link>
              <Link href="/register" className="text-sm transition-colors duration-150 hover:text-[#A78BFA]">Sign Up</Link>
            </div>
            <p className="text-xs">© 2026 Evols AI</p>
          </div>
        </footer>
      </div>
    </>
  )
}
