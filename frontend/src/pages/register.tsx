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

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated()) {
        router.replace('/dashboard')
      } else {
        setCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router])

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

    if (formData.tenant_slug.length < 3) {
      setError('Company slug must be at least 3 characters')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          tenant_slug: formData.tenant_slug,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Store token and user data
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user', JSON.stringify({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          tenant_id: data.tenant_id,
          role: data.role,
        }))

        // Redirect to dashboard
        router.push('/dashboard')
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
        <title>Sign Up - ProductOS</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Illustration */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <svg viewBox="0 0 300 350" className="w-full max-w-md mb-8 drop-shadow-xl">
                <defs>
                  <linearGradient id="signupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#6366f1',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#8b5cf6',stopOpacity:1}} />
                  </linearGradient>
                </defs>
                <circle cx="150" cy="150" r="120" fill="url(#signupGrad)" opacity="0.1"/>
                <circle cx="150" cy="120" r="45" fill="url(#signupGrad)"/>
                <circle cx="150" cy="110" r="25" fill="white" opacity="0.3"/>
                <path d="M 120 145 Q 150 135 180 145" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.3"/>
                <rect x="70" y="180" width="160" height="120" rx="12" fill="url(#signupGrad)" opacity="0.8"/>
                <rect x="90" y="200" width="120" height="12" rx="3" fill="white" opacity="0.3"/>
                <rect x="90" y="225" width="100" height="12" rx="3" fill="white" opacity="0.3"/>
                <rect x="90" y="250" width="110" height="12" rx="3" fill="white" opacity="0.3"/>
                <circle cx="200" cy="265" r="30" fill="#10b981"/>
                <path d="M 185 265 L 195 275 L 215 250" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
              </svg>
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Join ProductOS Today
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
                  <LogoIcon size={48} />
                  <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    ProductOS
                  </span>
                </Link>
                <p className="text-gray-600 dark:text-gray-300">Create your account</p>
              </div>

              {/* Register Form */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
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

              {/* Company Slug */}
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
                    required
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
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

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
