import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, User, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { LogoIcon } from '@/components/Logo'
import { isAuthenticated } from '@/utils/auth'

export default function Register() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  })
  const [error, setError]                         = useState('')
  const [loading, setLoading]                     = useState(false)
  const [checkingAuth, setCheckingAuth]           = useState(true)
  const [inviteToken, setInviteToken]             = useState<string | null>(null)
  const [verificationPending, setVerificationPending] = useState(false)
  const [verificationEmail, setVerificationEmail]     = useState('')

  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated()) router.replace('/workbench')
      else                    setCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    if (router.isReady && router.query.invite) {
      setInviteToken(router.query.invite as string)
    }
  }, [router.isReady, router.query.invite])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    setLoading(true)
    try {
      const requestBody: any = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
      }
      if (inviteToken) requestBody.invite_token = inviteToken
      const apiUrl   = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data = await response.json()
      if (response.status === 201) {
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user', JSON.stringify({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          tenant_id: data.tenant_id,
          role: data.role,
        }))
        router.push('/workbench')
      } else if (response.status === 202) {
        setVerificationPending(true)
        setVerificationEmail(data.email)
      } else {
        setError(data.detail || 'Registration failed. Please try again.')
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
        <title>Get early access · Evols</title>
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
                Give your team{' '}
                <br />a shared brain.
              </h2>
              <p className="text-base text-muted-foreground/90 max-w-md leading-relaxed mb-10">
                Knowledge, context, and coordination — in one calm, AI-native place.
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground/85">
                {[
                  'Zero cold start for new teammates',
                  'Auto-compiled team knowledge graph',
                  'Quota visibility across your whole team',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand-pulse)' }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Form column */}
            <div className="w-full">
              <div className="rounded-2xl p-7 md:p-8 border border-border bg-card/95 shadow-elev-2 backdrop-blur-sm">
                {verificationPending ? (
                  <div className="text-center py-6">
                    <div className="grid place-items-center w-14 h-14 rounded-2xl mx-auto mb-6 halo-ring">
                      <Mail className="w-6 h-6 text-primary" strokeWidth={1.75} />
                    </div>
                    <h3
                      className="font-display text-3xl text-foreground mb-3"
                      style={{ fontStyle: 'italic', letterSpacing: '-0.022em' }}
                    >
                      Check your email.
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                      We've sent a verification link to <strong className="text-foreground">{verificationEmail}</strong>.
                      Click it to complete your registration. The link expires in 24 hours.
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                      Didn't get it? Check your spam folder or{' '}
                      <button
                        onClick={() => { setVerificationPending(false); setVerificationEmail('') }}
                        className="text-primary hover:opacity-80 transition-opacity"
                      >
                        try again
                      </button>.
                    </p>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-medium text-foreground mb-1">
                      {inviteToken ? 'Accept invitation' : 'Get early access'}
                    </h1>
                    <p className="text-sm text-muted-foreground mb-6">
                      {inviteToken
                        ? 'Complete your profile to join the team.'
                        : 'Set up your workspace in under a minute.'}
                    </p>

                    {inviteToken && (
                      <div
                        className="mb-5 p-3 border border-primary/30 rounded-lg flex items-start gap-2.5"
                        style={{ background: 'hsl(var(--primary) / 0.08)' }}
                      >
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                        <div>
                          <p className="text-sm font-medium text-foreground mb-0.5">You've been invited.</p>
                          <p className="text-xs text-muted-foreground">
                            Complete the form below to accept and join.
                          </p>
                        </div>
                      </div>
                    )}

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
                      <Field id="full_name" label="Full name" icon={User} value={formData.full_name} onChange={handleChange} placeholder="Alex Johnson" />
                      <Field id="email"     label="Email"     icon={Mail} value={formData.email}     onChange={handleChange} placeholder="you@company.com" type="email" autoComplete="email" />
                      <Field id="password"  label="Password"  icon={Lock} value={formData.password}  onChange={handleChange} placeholder="••••••••"        type="password" autoComplete="new-password" minLength={8} />
                      <Field id="confirmPassword" label="Confirm password" icon={Lock} value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" type="password" autoComplete="new-password" />

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-pulse w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading
                          ? (inviteToken ? 'Joining…' : 'Creating account…')
                          : (
                            <>
                              {inviteToken ? 'Accept invitation' : 'Create account'}
                              <ArrowRight className="w-4 h-4" strokeWidth={2} />
                            </>
                          )}
                      </button>
                    </form>
                  </>
                )}

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:opacity-80 font-medium transition-opacity">
                    Sign in
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

function Field({
  id, label, icon: Icon, value, onChange, placeholder, type = 'text', autoComplete, minLength,
}: {
  id: string
  label: string
  icon: any
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  type?: string
  autoComplete?: string
  minLength?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground/80 mb-2">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" strokeWidth={1.75} />
        <input
          id={id}
          name={id}
          type={type}
          required
          autoComplete={autoComplete}
          minLength={minLength}
          value={value}
          onChange={onChange}
          className="input pl-10"
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
