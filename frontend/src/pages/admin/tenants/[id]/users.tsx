import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Users, Plus, Trash2, ArrowLeft, Shield, User as UserIcon, ChevronDown } from 'lucide-react'
import { isAuthenticated, getCurrentUser } from '@/utils/auth'
import Header from '@/components/Header'

interface User {
  id: number
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  tenant_id: number | null
  last_login_at: string | null
}

export default function TenantUsers() {
  const router = useRouter()
  const { id } = router.query
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    const userData = getCurrentUser()
    setCurrentUser(userData)

    if (userData?.role !== 'SUPER_ADMIN') {
      setError('Access denied')
      setLoading(false)
      return
    }

    if (id) {
      loadUsers()
    }
  }, [router, id])

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/admin/tenants/${id}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      setUsers(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (formData: any) => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/admin/tenants/${id}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to create user')
      }

      await loadUsers()
      setShowCreateModal(false)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleChangeRole = async (userId: number, newRole: string) => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/admin/tenants/${id}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to update user role')
      }

      await loadUsers()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleDeleteUser = async (userId: number, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/admin/tenants/${id}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: 'Failed to delete user' }))
        throw new Error(data.detail || 'Failed to delete user')
      }

      await loadUsers()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Head>
        <title>Manage Users - Evols</title>
      </Head>

      <Header user={currentUser} currentPage="admin" />

      <div className="min-h-screen bg-muted/30 py-8">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/tenants"
              className="flex items-center gap-2 text-primary dark:text-primary hover:text-primary mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </Link>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl text-foreground mb-2">
                  Tenant Users
                </h1>
                <p className="text-muted-foreground">
                  Manage users for this tenant
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/85"
              >
                <Plus className="w-5 h-5" />
                Add User
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 dark:bg-primary/10 rounded-full flex items-center justify-center">
                          {user.role === 'TENANT_ADMIN' ? (
                            <Shield className="w-5 h-5 text-primary dark:text-primary" />
                          ) : (
                            <UserIcon className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {user.full_name || 'No name'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        className={`px-2 py-1 text-xs rounded border-none cursor-pointer ${
                          user.role === 'TENANT_ADMIN'
                            ? 'bg-chart-1/15 text-chart-1'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <option value="USER">USER</option>
                        <option value="TENANT_ADMIN">TENANT ADMIN</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        user.is_active
                          ? 'bg-chart-3/15 text-chart-3'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {user.last_login_at ? (
                        <div>
                          <div className="text-foreground">
                            {new Date(user.last_login_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(user.last_login_at).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="text-destructive dark:text-destructive hover:text-destructive transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl text-foreground mb-2">No users yet</h3>
                <p className="text-muted-foreground">Add the first user to this tenant</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
        />
      )}
    </>
  )
}

function CreateUserModal({ onClose, onCreate }: { onClose: () => void, onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'USER'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-md w-full p-6">
        <h2 className="page-title text-foreground mb-4">Add User</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="user@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
            >
              <option value="USER">User</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
            </select>
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
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
