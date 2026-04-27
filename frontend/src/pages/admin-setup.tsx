import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { AlertCircle, CheckCircle, Shield } from 'lucide-react'

export default function AdminSetup() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    creationToken: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
          is_super_admin: true,
          tenant_slug: formData.creationToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create SUPER_ADMIN')
      }

      setSuccess(true)

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login')
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Admin Setup - Evols</title>
      </Head>

      <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <span className="text-5xl text-primary">
                Evols<span className="text-muted-foreground font-medium">.ai</span>
              </span>
            </div>
            <h1 className="text-3xl text-foreground mb-2">
              Platform Admin Setup
            </h1>
            <p className="text-muted-foreground">
              Create the first SUPER_ADMIN account for your Evols deployment
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-primary/85 dark:text-primary">
                <p className="mb-1">One-time Setup</p>
                <p>This page can only be used once to create the first SUPER_ADMIN. You'll need the creation token from your deployment configuration.</p>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="bg-chart-3/10 border border-chart-3/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-chart-3" />
                <div className="text-sm text-chart-3">
                  <p className="">SUPER_ADMIN created successfully!</p>
                  <p>Redirecting to login...</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive dark:text-destructive mt-0.5" />
                <div className="text-sm text-destructive">
                  <p className="">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {!success && (
            <form onSubmit={handleSubmit} className="bg-card rounded-lg shadow-lg p-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 focus:border-transparent"
                  placeholder="admin@company.com"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 focus:border-transparent"
                  placeholder="Platform Administrator"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 focus:border-transparent"
                  placeholder="Minimum 8 characters"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 focus:border-transparent"
                  placeholder="Re-enter password"
                />
              </div>

              {/* Creation Token */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Creation Token
                </label>
                <input
                  type="password"
                  required
                  value={formData.creationToken}
                  onChange={(e) => setFormData({ ...formData, creationToken: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 focus:border-transparent font-mono"
                  placeholder="From SUPER_ADMIN_CREATION_TOKEN env variable"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This token is set in your deployment configuration (Kubernetes Secret or environment variable)
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/85 text-primary-foreground py-3 px-6 rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Admin...
                  </span>
                ) : (
                  'Create SUPER_ADMIN'
                )}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>After setup, you can manage additional admins and tenants from the admin panel</p>
          </div>
        </div>
      </div>
    </>
  )
}
