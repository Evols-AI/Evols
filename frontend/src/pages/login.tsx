import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { LogoIcon, LogoWordmark } from '@/components/Logo'
import { isAuthenticated } from '@/utils/auth'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Redirect to workbench if already authenticated
  useEffect(() => {
    const checkAuth = () => {
      if (isAuthenticated()) {
        const user = localStorage.getItem('user')
        if (user) {
          const userData = JSON.parse(user)
          // SUPER_ADMIN goes to Admin Panel, others to Workbench
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
    checkAuth()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
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

        // Redirect based on role: SUPER_ADMIN to Admin Panel, others to Workbench
        if (data.role === 'SUPER_ADMIN') {
          window.location.href = '/admin/tenants'
        } else {
          window.location.href = '/workbench'
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

  // Show nothing while checking authentication to prevent flicker
  if (checkingAuth) {
    return null
  }

  return (
    <>
      <Head>
        <title>Login - Evols</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Illustration */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              {/* Logo */}
              <Link href="/" className="mb-8">
                <LogoWordmark iconSize={60} />
              </Link>
              <svg viewBox="0 0 300 350" className="w-full max-w-md mb-10 drop-shadow-lg">
                <defs>
                  <linearGradient id="loginGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="loginGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                  <filter id="loginGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.2" />
                  </filter>
                </defs>

                {/* Background Ring */}
                <circle cx="150" cy="175" r="120" fill="url(#loginGrad1)" opacity="0.1" filter="url(#loginGlow)">
                  <animateTransform attributeName="transform" type="rotate" values="360 150 175; 0 150 175" dur="20s" repeatCount="indefinite" />
                </circle>

                {/* Floating Key Particles */}
                <g fill="#f59e0b" opacity="0.7">
                  <circle cx="60" cy="100" r="6">
                    <animateTransform attributeName="transform" type="translate" values="0,0; 0,-15; 0,0" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="240" cy="120" r="8">
                    <animateTransform attributeName="transform" type="translate" values="0,0; -10,10; 0,0" dur="4s" repeatCount="indefinite" />
                  </circle>
                </g>

                {/* Main Lock Base */}
                {/* Shackle */}
                <path d="M 100 170 L 100 130 C 100 90 200 90 200 130 L 200 170" stroke="url(#loginGrad1)" strokeWidth="16" fill="none" strokeLinecap="round" />

                {/* Lock Body */}
                <rect x="70" y="160" width="160" height="110" rx="16" fill="white" className="dark:fill-gray-800" stroke="url(#loginGrad1)" strokeWidth="3" />
                <rect x="70" y="160" width="160" height="110" rx="16" fill="url(#loginGrad1)" opacity="0.05" />

                {/* Keyhole */}
                <circle cx="150" cy="200" r="16" fill="url(#loginGrad1)" />
                <path d="M 142 205 L 158 205 L 154 230 L 146 230 Z" fill="url(#loginGrad1)" />

                {/* Glowing Auth Badges */}
                <g filter="url(#badgeShadow)" transform="translate(195, 230)">
                  <circle cx="20" cy="20" r="20" fill="url(#loginGrad2)" />
                  <path d="M 12 20 L 18 26 L 28 14" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <animateTransform attributeName="transform" type="translate" values="195,230; 195,225; 195,230" dur="4s" repeatCount="indefinite" />
                </g>

                {/* Scanning Laser Effect */}
                <rect x="75" y="170" width="150" height="4" fill="#10b981" filter="url(#loginGlow)" opacity="0.6">
                  <animate attributeName="y" values="170; 260; 170" dur="3s" repeatCount="indefinite" />
                </rect>
              </svg>
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Welcome Back!
                </h2>
                <p className="text-gray-600 dark:text-gray-300 max-w-md">
                  Access your AI-powered product decision platform and continue making data-driven decisions.
                </p>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="w-full">
              {/* Logo */}
              <div className="text-center mb-8 lg:hidden">
                <Link href="/" className="mb-2">
                  <LogoWordmark iconSize={60} />
                </Link>
                <p className="text-gray-600 dark:text-gray-300">Sign in to your account</p>
              </div>

              {/* Login Form */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                {/* Links */}
                <div className="mt-6 text-center text-sm">
                  <p className="text-gray-600 dark:text-gray-300">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                      Sign up
                    </Link>
                  </p>
                </div>
              </div>

              {/* Demo Credentials */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                  <strong>Demo:</strong> First time? Create an account to get started!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
