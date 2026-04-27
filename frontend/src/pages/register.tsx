import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, User, AlertCircle, CheckCircle, Moon, Sun } from 'lucide-react'
import { LogoWordmark } from '@/components/Logo'
import { isAuthenticated } from '@/utils/auth'
import { useTheme } from '@/contexts/ThemeContext'

export default function Register() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [verificationPending, setVerificationPending] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')

  useEffect(() => {
    document.body.style.background = dark ? '#0A0A0B' : '#F7F7F8'
    document.body.style.backgroundImage = 'none'
  }, [dark])

  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated()) {
        router.replace('/workbench')
      } else {
        setCheckingAuth(false)
      }
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
      setError('Passwords do not match')
      return
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
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
        <title>Sign Up - Evols</title>
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
              <Link href="/login" className={`hidden md:block text-sm transition-colors ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'} hover:text-[#A78BFA]`}>Login</Link>
            </div>
          </div>
        </nav>
        <div className="h-16" />
        <div className="flex-grow flex items-center justify-center px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center w-full max-w-6xl">
            {/* Left Column */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <img
                src="/Sign up-amico.svg"
                alt="Sign up illustration"
                className="w-full max-w-md mb-10 drop-shadow-lg"
              />
              <div className="text-center">
                <h2 className={`text-3xl font-medium mb-4 ${dark ? 'text-[#FAFAFA]' : 'text-[#0A0A0B]'}`}>
                  Join Evols Today
                </h2>
                <p className={`max-w-md ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                  Start making confident product decisions backed by AI-powered insights and customer feedback analysis.
                </p>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="w-full">
              <div className={`rounded-2xl p-8 border ${dark ? 'bg-[#111113] border-white/[0.06]' : 'bg-white border-black/[0.07]'}`}>
                {verificationPending ? (
                  <div className="text-center py-8">
                    <div className="flex justify-center mb-6">
                      <div className="rounded-full p-3 bg-[#A78BFA]/10">
                        <Mail className="w-12 h-12 text-[#A78BFA]" />
                      </div>
                    </div>
                    <h3 className={`text-2xl font-medium mb-3 ${dark ? 'text-[#FAFAFA]' : 'text-[#0A0A0B]'}`}>
                      Check Your Email
                    </h3>
                    <p className={`mb-6 ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                      We've sent a verification link to <strong>{verificationEmail}</strong>
                    </p>
                    <div className="border rounded-lg p-4 mb-6 bg-[#A78BFA]/5 border-[#A78BFA]/20">
                      <p className={`text-sm ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                        Click the link in the email to complete your registration and create your workspace.
                        The link will expire in 24 hours.
                      </p>
                    </div>
                    <p className={`text-sm ${dark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
                      Didn't receive the email? Check your spam folder or{' '}
                      <button
                        onClick={() => { setVerificationPending(false); setVerificationEmail('') }}
                        className="text-[#A78BFA] hover:text-[#8B5CF6] transition-colors"
                      >
                        try again
                      </button>
                    </p>
                  </div>
                ) : (
                  <>
                    {inviteToken && (
                      <div className="mb-6 p-4 border rounded-lg flex items-start space-x-3 bg-[#A78BFA]/5 border-[#A78BFA]/20">
                        <CheckCircle className="w-5 h-5 text-[#A78BFA] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className={`text-sm font-medium mb-1 ${dark ? 'text-[#FAFAFA]' : 'text-[#0A0A0B]'}`}>
                            You've been invited!
                          </p>
                          <p className={`text-xs ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                            Complete the form below to accept the invitation and join the team.
                          </p>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className={`mb-6 p-4 border rounded-lg flex items-start space-x-3 ${dark ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-500">{error}</p>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <label htmlFor="full_name" className={labelClass}>Full Name</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className={iconClass} />
                          </div>
                          <input id="full_name" name="full_name" type="text" required
                            value={formData.full_name} onChange={handleChange}
                            className={inputClass} placeholder="Alex Johnson" />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className={labelClass}>Email</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className={iconClass} />
                          </div>
                          <input id="email" name="email" type="email" required
                            value={formData.email} onChange={handleChange}
                            className={inputClass} placeholder="you@company.com" />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="password" className={labelClass}>Password</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className={iconClass} />
                          </div>
                          <input id="password" name="password" type="password" required
                            value={formData.password} onChange={handleChange}
                            className={inputClass} placeholder="••••••••" minLength={8} />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className={iconClass} />
                          </div>
                          <input id="confirmPassword" name="confirmPassword" type="password" required
                            value={formData.confirmPassword} onChange={handleChange}
                            className={inputClass} placeholder="••••••••" />
                        </div>
                      </div>

                      <button type="submit" disabled={loading}
                        className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-3 px-6 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? (inviteToken ? 'Joining...' : 'Creating Account...') : (inviteToken ? 'Accept Invitation' : 'Create Account')}
                      </button>
                    </form>
                  </>
                )}

                <div className="mt-6 text-center text-sm">
                  <p className={dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}>
                    Already have an account?{' '}
                    <Link href="/login" className="text-[#A78BFA] hover:text-[#8B5CF6] font-medium transition-colors">
                      Sign in
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
              <Link href="/login" className="text-sm transition-colors duration-150 hover:text-[#A78BFA]">Login</Link>
            </div>
            <p className="text-xs">© 2026 Evols AI</p>
          </div>
        </footer>
      </div>
    </>
  )
}
