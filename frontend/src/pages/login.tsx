import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { LogoIcon } from '@/components/Logo'
import { isAuthenticated } from '@/utils/auth'

export default function Login() {
  const router = useRouter()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const isOidcCallback   = router.query.oidc_callback === '1'
  const oidcRedirectUri  = (router.query.redirect_uri as string) || ''
  const oidcState        = (router.query.state as string) || ''

  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated() && !isOidcCallback) {
        const user = localStorage.getItem('user')
        if (user) {
          const userData = JSON.parse(user)
          if (userData.role === 'SUPER_ADMIN') router.replace('/admin/tenants')
          else                                  router.replace('/workbench')
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
      const apiUrl  = process.env.NEXT_PUBLIC_API_URL || ''
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
        if (data.role === 'SUPER_ADMIN') window.location.href = '/admin/tenants'
        else                              window.location.href = nextUrl || '/workbench'
      } else {
        setError(data.detail || 'Login failed. Please check your credentials.')
      }
    } catch {
      setError('Unable to connect to the server. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) return null

  return (
    <>
      <Head>
        <title>Sign in · Evols</title>
      </Head>

      <div className="aurora-bg min-h-screen flex flex-col">
        <Header variant="landing" />

        <main className="flex-grow flex items-center justify-center px-6 pt-32 pb-16">
          <div className="grid lg:grid-cols-[1.1fr,1fr] gap-16 items-center w-full max-w-5xl">
            {/* Editorial left column */}
            <div className="hidden lg:flex flex-col">
              <div className="grid place-items-center w-14 h-14 rounded-2xl mb-8 halo-ring">
                <LogoIcon size={32} variant="pulse" strokeWidth={2} />
              </div>
              <h2
                className="font-display text-5xl text-foreground mb-5"
                style={{ fontStyle: 'italic', letterSpacing: '-0.025em', lineHeight: 1.05 }}
              >
                Welcome back to your<br />team's brain.
              </h2>
              <p className="text-base text-muted-foreground/90 max-w-md leading-relaxed">
                Pick up exactly where your team left off. Every session continues
                the same shared context.
              </p>
            </div>

            {/* Form column */}
            <div className="w-full">
              <div className="rounded-2xl p-7 md:p-8 border border-border bg-card/95 shadow-elev-2 backdrop-blur-sm">
                <h1 className="text-xl font-medium text-foreground mb-1">Sign in</h1>
                <p className="text-sm text-muted-foreground mb-7">
                  Use your work email to access your workspace.
                </p>

                {error && (
                  <div
                    role="alert"
                    className="mb-5 p-3 border border-destructive/30 rounded-lg flex items-start gap-2.5"
                    style={{ background: 'hsl(var(--destructive) / 0.10)' }}
                  >
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground/80 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" strokeWidth={1.75} />
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input pl-10"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground/80 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" strokeWidth={1.75} />
                      <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input pl-10"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-pulse w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Signing in…' : (
                      <>
                        Sign in
                        <ArrowRight className="w-4 h-4" strokeWidth={2} />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link href="/register" className="text-primary hover:opacity-80 font-medium transition-opacity">
                    Create one
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
