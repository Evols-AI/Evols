import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Mail, Lock, User, Building, AlertCircle, CheckCircle } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'
import { isAuthenticated } from '@/utils/auth'

export default function Register() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    tenant_slug: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [verificationPending, setVerificationPending] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')

  // Redirect to workbench if already authenticated
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

  // Check for invite token in URL
  useEffect(() => {
    if (router.isReady && router.query.invite) {
      setInviteToken(router.query.invite as string)
    }
  }, [router.isReady, router.query.invite])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; setFormData(prev => ({
      ...prev,
      [name]: value,
      // Auto-generate tenant slug from company name
      ...(name === 'tenant_slug' && { tenant_slug: value.toLowerCase().replace(/[^a-z0-9]/g, '-') })
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    // Only validate tenant_slug if no invite token
    if (!inviteToken && formData.tenant_slug.length < 3) {
      setError('Company slug must be at least 3 characters')
      return
    }

    setLoading(true)

    try {
      const requestBody: any = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
      }

      // Add invite_token or tenant_slug based on what's available
      if (inviteToken) {
        requestBody.invite_token = inviteToken
      } else {
        requestBody.tenant_slug = formData.tenant_slug
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (response.status === 201) {
        // Immediate registration (with invite) - 201 Created
        // Store token and user data
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user', JSON.stringify({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          tenant_id: data.tenant_id,
          role: data.role,
        }))

        // Redirect to workbench
        router.push('/workbench')
      } else if (response.status === 202) {
        // Verification pending - 202 Accepted
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

  // Show nothing while checking authentication to prevent flicker
  if (checkingAuth) {
    return null
  }

  return (
    <>
      <Head>
        <title>Sign Up - Evols</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Illustration */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              {/* Logo */}
              <Link href="/" className="inline-flex items-center justify-center space-x-2 mb-8">
                <LogoIcon size={60} />
                <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                  Evols
                </span>
              </Link>
              <svg viewBox="0 0 300 350" className="w-full max-w-md mb-10 drop-shadow-lg">
                <defs>
                  <linearGradient id="signupGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                  <linearGradient id="signupGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                  <filter id="signupGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.2" />
                  </filter>
                </defs>

                {/* Background Ring */}
                <circle cx="150" cy="175" r="120" fill="url(#signupGrad2)" opacity="0.1" filter="url(#signupGlow)">
                  <animateTransform attributeName="transform" type="rotate" values="0 150 175; 360 150 175" dur="20s" repeatCount="indefinite" />
                </circle>

                {/* Floating Plus Icons */}
                <g fill="#ec4899" opacity="0.6">
                  <path d="M 40 100 L 45 100 L 45 110 L 55 110 L 55 115 L 45 115 L 45 125 L 40 125 L 40 115 L 30 115 L 30 110 L 40 110 Z">
                    <animateTransform attributeName="transform" type="translate" values="0,0; 0,-15; 0,0" dur="4s" repeatCount="indefinite" />
                  </path>
                  <path d="M 250 220 L 255 220 L 255 230 L 265 230 L 265 235 L 255 235 L 255 245 L 250 245 L 250 235 L 240 235 L 240 230 L 250 230 Z">
                    <animateTransform attributeName="transform" type="translate" values="0,0; 0,-10; 0,0" dur="3s" repeatCount="indefinite" />
                  </path>
                </g>

                {/* Main Registration Card */}
                <rect x="70" y="100" width="160" height="150" rx="16" fill="white" className="dark:fill-gray-800" stroke="url(#signupGrad1)" strokeWidth="3" />

                {/* User Avatar Placeholder */}
                <circle cx="150" cy="140" r="24" fill="url(#signupGrad2)" />
                <circle cx="150" cy="132" r="10" fill="white" opacity="0.8" />
                <path d="M 134 152 Q 150 144 166 152 A 12 12 0 0 1 150 164 Z" fill="white" opacity="0.8" />

                {/* Form Fields */}
                <rect x="90" y="180" width="120" height="12" rx="6" fill="#f3f4f6" className="dark:fill-gray-700" />
                <rect x="90" y="200" width="100" height="12" rx="6" fill="#f3f4f6" className="dark:fill-gray-700" />
                <rect x="90" y="220" width="120" height="12" rx="6" fill="#f3f4f6" className="dark:fill-gray-700" />

                {/* Verified / Check Badge overlay */}
                <g filter="url(#badgeShadow)" transform="translate(195, 215)">
                  <circle cx="20" cy="20" r="20" fill="#10b981" />
                  <path d="M 12 20 L 18 26 L 28 14" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <animateTransform attributeName="transform" type="translate" values="195,215; 195,210; 195,215" dur="4s" repeatCount="indefinite" />
                </g>

                {/* Connecting Node Line */}
                <path d="M 200 120 Q 230 100 240 70" stroke="url(#signupGrad1)" strokeWidth="3" fill="none" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="10;0" dur="1s" repeatCount="indefinite" />
                </path>
                <circle cx="240" cy="70" r="8" fill="#8b5cf6" filter="url(#signupGlow)" />
              </svg>
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Join Evols Today
                </h2>
                <p className="text-gray-600 dark:text-gray-300 max-w-md">
                  Start making confident product decisions backed by AI-powered insights and customer feedback analysis.
                </p>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="w-full">
              {/* Logo */}
              <div className="text-center mb-8 lg:hidden">
                <Link href="/" className="inline-flex items-center justify-center space-x-2 mb-2">
                  <LogoIcon size={60} />
                  <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                    Evols
                  </span>
                </Link>
                <p className="text-gray-600 dark:text-gray-300">Create your account</p>
              </div>

              {/* Register Form */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                {verificationPending ? (
                  // Show verification pending message
                  <div className="text-center py-8">
                    <div className="flex justify-center mb-6">
                      <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                        <Mail className="w-12 h-12 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      Check Your Email
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      We've sent a verification link to <strong>{verificationEmail}</strong>
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Click the link in the email to complete your registration and create your workspace.
                        The link will expire in 24 hours.
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Didn't receive the email? Check your spam folder or{' '}
                      <button
                        onClick={() => {
                          setVerificationPending(false)
                          setVerificationEmail('')
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        try again
                      </button>
                    </p>
                  </div>
                ) : (
                  <>
                    {inviteToken && (
                      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                            You've been invited!
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Complete the form below to accept the invitation and join the team.
                          </p>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input id="full_name"
                        name="full_name"
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={handleChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Alex Johnson"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  {/* Company Slug - Only show if no invite token */}
                  {!inviteToken && (
                    <div>
                      <label htmlFor="tenant_slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Company Slug
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Building className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <input id="tenant_slug"
                          name="tenant_slug"
                          type="text"
                          required={!inviteToken}
                          value={formData.tenant_slug}
                          onChange={handleChange}
                          className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="my-company"
                          pattern="[a-z0-9-]{3,}"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Lowercase letters, numbers, and hyphens only (min 3 characters)
                      </p>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input id="password"
                        name="password"
                        type="password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        minLength={8}
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-500 ease-in-out hover:scale-110 hover:brightness-110 hover:animate-pulse active:animate-bounce disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100"
                  >
                    {loading ? (inviteToken ? 'Joining...' : 'Creating Account...') : (inviteToken ? 'Accept Invitation' : 'Create Account')}
                  </button>
                </form>
                  </>
                )}

                {/* Links */}
                <div className="mt-6 text-center text-sm">
                  <p className="text-gray-600 dark:text-gray-300">
                    Already have an account?{' '}
                    <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>

              {/* Free Tier Info */}
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-300">
                    <strong>Free Tier:</strong> Up to 5 users. Bring your own LLM API keys (OpenAI, Azure, or Anthropic).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
