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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
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

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/tenants"
              className="flex items-center gap-2 text-blue-500 dark:text-blue-300 hover:text-blue-600 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </Link>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Tenant Users
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage users for this tenant
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                <Plus className="w-5 h-5" />
                Add User
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          {user.role === 'TENANT_ADMIN' ? (
                            <Shield className="w-5 h-5 text-blue-500 dark:text-blue-300" />
                          ) : (
                            <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {user.full_name || 'No name'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        className={`px-2 py-1 text-xs rounded border-none cursor-pointer ${
                          user.role === 'TENANT_ADMIN'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <option value="USER">USER</option>
                        <option value="TENANT_ADMIN">TENANT ADMIN</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        user.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
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
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No users yet</h3>
                <p className="text-gray-600 dark:text-gray-400">Add the first user to this tenant</p>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add User</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="user@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="USER">User</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
