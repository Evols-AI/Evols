import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoWordmark } from '@/components/Logo'

export default function VerifyEmail() {
  const router = useRouter()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    document.body.style.background = ''
    document.body.style.backgroundImage = 'none'
  }, [dark])

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
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
        setStatus('success')
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

  const textPrimary = 'text-foreground'
  const textMuted = 'text-muted-foreground'

  return (
    <>
      <Head>
        <title>Verify email · Evols</title>
      </Head>

      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors bg-background`}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center mb-4">
              <LogoWordmark iconSize={52} />
            </Link>
          </div>

          <div className={`rounded-2xl p-8 border bg-card border-border`}>
            {status === 'loading' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <Loader className="w-12 h-12 text-primary animate-spin" />
                </div>
                <h2 className={`text-2xl font-medium mb-3 ${textPrimary}`}>
                  Verifying your email...
                </h2>
                <p className={textMuted}>
                  Please wait while we verify your email address and set up your account.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <div className="rounded-full bg-chart-3/15 p-3">
                    <CheckCircle className="w-12 h-12 text-chart-3" />
                  </div>
                </div>
                <h2 className={`text-2xl font-medium mb-3 ${textPrimary}`}>
                  Email Verified!
                </h2>
                <p className={`mb-6 ${textMuted}`}>
                  Your account has been successfully created. {redirecting ? 'Redirecting you to the dashboard...' : 'You will be redirected shortly.'}
                </p>
                {!redirecting && (
                  <Link
                    href="/workbench"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-medium rounded-lg transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <div className="rounded-full bg-destructive/100/10 p-3">
                    <XCircle className="w-12 h-12 text-destructive" />
                  </div>
                </div>
                <h2 className={`text-2xl font-medium mb-3 ${textPrimary}`}>
                  Verification Failed
                </h2>
                <p className={`mb-6 ${textMuted}`}>{error}</p>
                <div className="space-y-3">
                  <Link
                    href="/register"
                    className="block w-full px-6 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-medium rounded-lg text-center transition-colors"
                  >
                    Try Registering Again
                  </Link>
                  <Link
                    href="/login"
                    className={`block w-full px-6 py-3 border rounded-lg font-medium text-center transition-colors ${dark ? 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'}`}
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className={`mt-6 text-center text-sm ${textMuted}`}>
            <p>
              Need help?{' '}
              <Link href="/support" className="text-primary hover:text-primary transition-colors">
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
