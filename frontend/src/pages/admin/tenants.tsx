import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Building2, Plus, Edit, Trash2, Users, AlertCircle } from 'lucide-react'
import { isAuthenticated, getCurrentUser } from '@/utils/auth'
import Header from '@/components/Header'
import { Loading } from '@/components/PageContainer'

interface Tenant {
  id: number
  name: string
  slug: string
  domain: string | null
  is_active: boolean
  is_trial: boolean
  plan_type: string
  max_users: number
  max_storage_gb: number
  user_count: number
  created_at: string
}

export default function TenantsAdmin() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    const userData = getCurrentUser()
    setUser(userData)

    // Check if user is SUPER_ADMIN
    if (userData?.role !== 'SUPER_ADMIN') {
      setError('Access denied. This page is only for SUPER_ADMIN users.')
      setLoading(false)
      return
    }

    loadTenants()
  }, [router])

  const loadTenants = async () => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/admin/tenants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('Failed to load tenants')
      }

      const data = await response.json()
      setTenants(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTenant = async (formData: any) => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/admin/tenants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to create tenant')
      }

      await loadTenants()
      setShowCreateModal(false)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleDeleteTenant = async (tenantId: number, tenantName: string) => {
    if (!confirm(`Are you sure you want to delete tenant "${tenantName}"? This will delete all data!`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/admin/tenants/${tenantId}?force=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to delete tenant')
      }

      await loadTenants()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loading text="Loading tenants..." />
      </div>
    )
  }

  if (error && user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="max-w-md p-6 bg-card rounded-lg shadow-lg">
          <div className="flex items-center gap-3 text-destructive dark:text-destructive mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl">Access Denied</h2>
          </div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/85"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Tenant Management - Evols</title>
      </Head>

      <Header user={user} currentPage="admin" />

      <div className="min-h-screen bg-muted/30 py-8">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl text-foreground mb-2">
                Tenant Management
              </h1>
              <p className="text-muted-foreground">
                Manage all organizations on the platform
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/85"
            >
              <Plus className="w-5 h-5" />
              Create Tenant
            </button>
          </div>

          {/* Tenants Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map(tenant => (
              <div
                key={tenant.id}
                className="bg-card rounded-lg shadow-sm border border-border p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 dark:bg-primary/10 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary dark:text-primary" />
                    </div>
                    <div>
                      <h3 className="text-foreground">{tenant.name}</h3>
                      <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Plan:</span>
                    <span className="font-medium text-foreground capitalize">{tenant.plan_type}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Users:</span>
                    <span className="font-medium text-foreground">{tenant.user_count} / {tenant.max_users}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Storage:</span>
                    <span className="font-medium text-foreground">{tenant.max_storage_gb} GB</span>
                  </div>
                  {tenant.domain && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Domain:</span>
                      <span className="font-medium text-foreground">{tenant.domain}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {tenant.is_trial && (
                    <span className="px-2 py-1 bg-chart-4/20 text-chart-4 text-xs rounded">
                      Trial
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs rounded ${
                    tenant.is_active
                      ? 'bg-chart-3/15 text-chart-3'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {tenant.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/admin/tenants/${tenant.id}/users`)}
                    className="flex-1 flex items-center justify-center gap-2 bg-muted text-muted-foreground px-3 py-2 rounded text-sm hover:bg-muted/70"
                  >
                    <Users className="w-4 h-4" />
                    Users
                  </button>
                  <button
                    onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                    className="px-3 py-2 bg-destructive/10 text-destructive rounded hover:bg-destructive/15"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {tenants.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl text-foreground mb-2">No tenants yet</h3>
              <p className="text-muted-foreground mb-4">Create your first tenant to get started</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/85"
              >
                Create Tenant
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTenant}
        />
      )}
    </>
  )
}

function CreateTenantModal({ onClose, onCreate }: { onClose: () => void, onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    plan_type: 'free',
    max_users: 5,
    max_storage_gb: 10
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-md w-full p-6">
        <h2 className="page-title text-foreground mb-4">Create New Tenant</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Organization Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="Acme Corporation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Slug (URL-friendly)
            </label>
            <input
              type="text"
              required
              pattern="[a-z0-9-]+"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="acme-corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Domain (Optional)
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="acme.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Plan Type
            </label>
            <select
              value={formData.plan_type}
              onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
            >
              <option value="free">Free</option>
              <option value="team">Team</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Max Users
              </label>
              <input
                type="number"
                min="1"
                value={formData.max_users}
                onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Storage (GB)
              </label>
              <input
                type="number"
                min="1"
                value={formData.max_storage_gb}
                onChange={(e) => setFormData({ ...formData, max_storage_gb: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/85"
            >
              Create Tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
