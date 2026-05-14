import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { isAuthenticated } from '@/utils/auth'
import { useTheme } from '@/contexts/ThemeContext'
import { trackEvent, identifyUser } from '@/lib/analytics'
import { AUTH_EVENTS } from '@/lib/analytics-events'

export default function Login() {
  const router = useRouter()
  const { theme } = useTheme()
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

  // Handle social login callback — ?social_token=<jwt> lands here after OAuth round-trip
  useEffect(() => {
    if (!router.isReady) return
    const params = new URLSearchParams(window.location.search)
    const socialToken = params.get('social_token')
    if (!socialToken) return

    // Remove the token from the URL immediately so it doesn't linger
    params.delete('social_token')
    const cleanSearch = params.toString()
    const newUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '')
    window.history.replaceState({}, '', newUrl)

    // Store token and fetch user profile
    localStorage.setItem('token', socialToken)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
    fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${socialToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        localStorage.setItem('user', JSON.stringify({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          tenant_id: data.tenant_id,
          role: data.role,
        }))
        const nextUrl = params.get('next') || '/workbench'
        if (data.role === 'SUPER_ADMIN') {
          window.location.href = '/admin/tenants'
        } else {
          window.location.href = nextUrl
        }
      })
      .catch(() => {
        setError('Social login failed. Please try again.')
        setCheckingAuth(false)
      })
  }, [router.isReady])

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
        trackEvent(AUTH_EVENTS.LOGIN_SUCCESS, {
          method: 'email',
          role: data.role,
          tenant_id: data.tenant_id,
        })
        identifyUser({
          id: data.user_id,
          email: data.email,
          tenant_id: data.tenant_id,
          role: data.role,
          full_name: data.full_name,
        })
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
        trackEvent(AUTH_EVENTS.LOGIN_FAILED, {
          error: data.detail || 'Invalid credentials',
        })
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
  const socialBtnClass = `flex items-center justify-center gap-3 w-full border border-border rounded-lg py-3 px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors`

  return (
    <>
      <Head>
        <title>Login - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className={`min-h-screen flex flex-col transition-colors bg-background`}>
        <Header variant="landing" />
        <div className="flex-grow flex items-center justify-center px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center w-full max-w-6xl">
            {/* Left Column */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <img src="/login.svg" alt="Login illustration" className="w-full max-w-md mb-10 drop-shadow-lg" />
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

                {/* Social login buttons */}
                <div className="space-y-3 mb-6">
                  <button
                    type="button"
                    className={socialBtnClass}
                    onClick={() => { window.location.href = '/api/v1/auth/social/google' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    className={socialBtnClass}
                    onClick={() => { window.location.href = '/api/v1/auth/social/github' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="currentColor" d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.52 11.52 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12Z"/>
                    </svg>
                    Continue with GitHub
                  </button>
                </div>

                {/* Divider */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-muted-foreground">or sign in with email</span>
                  </div>
                </div>

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

        <Footer />
      </div>
    </>
  )
}
