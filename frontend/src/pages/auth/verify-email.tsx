import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { CheckCircle, XCircle, Loader, Mail } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'

export default function VerifyEmail() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (router.isReady && router.query.token) {
      verifyEmail(router.query.token as string)
    } else if (router.isReady && !router.query.token) {
      setStatus('error')
      setError('No verification token provided')
    }
  }, [router.isReady, router.query.token])

  const verifyEmail = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
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

        setStatus('success')

        // Redirect after 2 seconds
        setTimeout(() => {
          setRedirecting(true)
          router.push('/workbench')
        }, 2000)
      } else {
        setStatus('error')
        setError(data.detail || 'Verification failed. The link may be invalid or expired.')
      }
    } catch (err) {
      setStatus('error')
      setError('Unable to connect to the server. Please try again later.')
    }
  }

  return (
    <>
      <Head>
        <title>Verify Email - Evols</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center space-x-2 mb-4">
              <LogoIcon size={60} />
              <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                Evols
              </span>
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            {status === 'loading' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <Loader className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Verifying your email...
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Please wait while we verify your email address and set up your account.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                    <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Email Verified!
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Your account has been successfully created. {redirecting ? 'Redirecting you to the dashboard...' : 'You will be redirected shortly.'}
                </p>
                {!redirecting && (
                  <Link
                    href="/workbench"
                    className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-medium rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                  >
                    Go to Dashboard
                  </Link>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
                    <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Verification Failed
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {error}
                </p>
                <div className="space-y-3">
                  <Link
                    href="/register"
                    className="block w-full px-6 py-3 bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-medium rounded-full shadow-lg transform transition-all duration-300 hover:scale-105"
                  >
                    Try Registering Again
                  </Link>
                  <Link
                    href="/login"
                    className="block w-full px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-full hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-all duration-300"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              Need help?{' '}
              <Link href="/support" className="text-blue-600 dark:text-blue-400 hover:underline">
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
