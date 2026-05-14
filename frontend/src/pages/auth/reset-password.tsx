import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Lock, AlertCircle, CheckCircle } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useTheme } from '@/contexts/ThemeContext'

type Stage = 'form' | 'success' | 'invalid'

export default function ResetPassword() {
  const router = useRouter()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [stage, setStage] = useState<Stage>('form')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.body.style.background = ''
    document.body.style.backgroundImage = 'none'
  }, [dark])

  useEffect(() => {
    if (!router.isReady) return
    const t = router.query.token as string
    if (!t) {
      setStage('invalid')
    } else {
      setToken(t)
    }
  }, [router.isReady, router.query.token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${apiUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      })
      if (res.ok) {
        setStage('success')
      } else {
        const data = await res.json()
        setError(data.detail || 'Reset failed. The link may have expired.')
        if (res.status === 400) setStage('invalid')
      }
    } catch {
      setError('Unable to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `block w-full pl-10 pr-3 py-3 border rounded-lg text-sm transition-colors outline-none border-border bg-input text-foreground placeholder-muted-foreground focus:border-ring/50 focus:ring-1 focus:ring-ring/30`

  return (
    <>
      <Head>
        <title>Reset Password - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className="min-h-screen flex flex-col transition-colors bg-background pt-16">
        <Header variant="landing" />
        <div className="flex-grow flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="rounded-2xl p-8 border bg-card border-border">

              {stage === 'success' && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full p-3 bg-primary/10">
                      <CheckCircle className="w-10 h-10 text-primary" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Password updated</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your password has been changed. You can now sign in with your new credentials.
                  </p>
                  <Link
                    href="/login"
                    className="block w-full text-center bg-primary hover:bg-primary/85 text-primary-foreground py-3 px-6 rounded-lg font-medium text-sm transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              )}

              {stage === 'invalid' && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full p-3 bg-destructive/10">
                      <AlertCircle className="w-10 h-10 text-destructive" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Link expired or invalid</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    This reset link has expired or is invalid. Reset links are valid for 1 hour.
                  </p>
                  <Link
                    href="/login"
                    className="block w-full text-center bg-primary hover:bg-primary/85 text-primary-foreground py-3 px-6 rounded-lg font-medium text-sm transition-colors"
                  >
                    Back to sign in
                  </Link>
                </div>
              )}

              {stage === 'form' && (
                <>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Set a new password</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Choose a strong password with at least 8 characters.
                  </p>

                  {error && (
                    <div className="mb-4 p-3 border rounded-lg flex items-center gap-2 bg-destructive/10 border-destructive/20">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <p className="text-xs text-destructive">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium mb-2 text-muted-foreground">
                        New password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <input
                          id="new-password"
                          type="password"
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={inputClass}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium mb-2 text-muted-foreground">
                        Confirm password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <input
                          id="confirm-password"
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={inputClass}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary hover:bg-primary/85 text-primary-foreground py-3 px-6 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Updating...' : 'Update password'}
                    </button>
                  </form>

                  <div className="mt-6 text-center text-sm">
                    <Link href="/login" className="text-muted-foreground hover:text-primary transition-colors">
                      Back to sign in
                    </Link>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
