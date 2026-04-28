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
    document.body.style.background = ''
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
      ? 'border-border bg-input text-foreground placeholder-muted-foreground focus:border-ring/50 focus:ring-1 focus:ring-ring/30'
      : 'border-border bg-card text-foreground placeholder-muted-foreground focus:border-ring/50 focus:ring-1 focus:ring-ring/30'
  }`
  const labelClass = `block text-sm font-medium mb-2 text-muted-foreground`
  const iconClass = `h-5 w-5 text-muted-foreground`

  return (
    <>
      <Head>
        <title>Login - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className={`min-h-screen flex flex-col transition-colors bg-background`}>
        <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-border backdrop-blur-xl bg-background/80 transition-colors duration-300`}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/">
              <LogoWordmark iconSize={36} />
            </Link>
            <div className="flex items-center space-x-4">
              <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" aria-label="Toggle theme">
                {theme === 'light' ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
              </button>
              <Link href="/register" className="bg-primary hover:bg-primary/85 text-primary-foreground py-2 px-5 rounded-lg text-sm font-medium transition-colors">
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
                <h2 className={`text-3xl font-medium mb-4 text-foreground`}>
                  Welcome Back!
                </h2>
                <p className={`max-w-md text-muted-foreground`}>
                  Access your team's AI brain and pick up right where you left off.
                </p>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="w-full">
              <div className={`rounded-2xl p-8 border bg-card border-border`}>
                {error && (
                  <div className={`mb-6 p-4 border rounded-lg flex items-start space-x-3 ${dark ? 'bg-destructive/10 border-destructive/20' : 'bg-destructive/10 border-destructive/30'}`}>
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
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
                    className="w-full bg-primary hover:bg-primary/85 text-primary-foreground py-3 px-6 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="mt-6 text-center text-sm">
                  <p className={'text-muted-foreground'}>
                    Don't have an account?{' '}
                    <Link href="/register" className="text-primary hover:text-primary font-medium transition-colors">
                      Sign up
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={`border-t border-border py-12 w-full transition-colors duration-300`}>
          <div className={`max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-muted-foreground`}>
            <LogoWordmark iconSize={32} />
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <Link href="/docs" className="text-sm transition-colors duration-150 hover:text-primary">Docs</Link>
              <Link href="/support" className="text-sm transition-colors duration-150 hover:text-primary">Support</Link>
              <Link href="/register" className="text-sm transition-colors duration-150 hover:text-primary">Sign Up</Link>
            </div>
            <p className="text-xs">© 2026 Evols AI</p>
          </div>
        </footer>
      </div>
    </>
  )
}
