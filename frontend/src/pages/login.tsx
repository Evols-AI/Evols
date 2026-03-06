import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'
import { isAuthenticated } from '@/utils/auth'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/login', {
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

        // Redirect to dashboard
        window.location.href = '/dashboard'
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
              <Link href="/" className="inline-flex items-center justify-center space-x-2 mb-8">
                <LogoIcon size={60} />
                <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                  Evols
                </span>
              </Link>
              <svg viewBox="0 0 300 350" className="w-full max-w-md mb-8 drop-shadow-xl">
                <defs>
                  <linearGradient id="loginGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#6366f1',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#8b5cf6',stopOpacity:1}} />
                  </linearGradient>
                </defs>
                <circle cx="150" cy="150" r="120" fill="url(#loginGrad)" opacity="0.1"/>
                <path d="M 100 180 L 100 140 Q 100 100 150 100 Q 200 100 200 140 L 200 180" stroke="#6366f1" strokeWidth="12" fill="none" strokeLinecap="round"/>
                <rect x="80" y="170" width="140" height="100" rx="12" fill="url(#loginGrad)"/>
                <circle cx="150" cy="210" r="15" fill="white" opacity="0.9"/>
                <rect x="145" y="210" width="10" height="30" fill="white" opacity="0.9"/>
                <circle cx="150" cy="300" r="8" fill="#10b981"/>
                <path d="M 146 300 L 149 303 L 154 296" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
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
                <Link href="/" className="inline-flex items-center justify-center space-x-2 mb-2">
                  <LogoIcon size={60} />
                  <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                    Evols
                  </span>
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
