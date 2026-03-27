/**
 * Tenant Switcher Component
 * Allows multi-tenant users to switch between organizations
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { api } from '@/services/api'
import { Building2, Check, Loader, ChevronDown } from 'lucide-react'
import { getCurrentUser } from '@/utils/auth'

interface Tenant {
  tenant_id: number
  tenant_name: string
  tenant_slug: string
  role: string
  is_active: boolean
  joined_at: string
}

export function TenantSwitcher() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      setLoading(true)
      const response = await api.get('/users/me/tenants')
      setTenants(response.data || [])
    } catch (error) {
      console.error('Failed to load tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchTenant = async (tenantId: number) => {
    if (tenantId === currentUser?.tenant_id) {
      setShowDropdown(false)
      return
    }

    try {
      setSwitching(true)
      const response = await api.post('/users/me/switch-tenant', { tenant_id: tenantId })

      // Update token and user data
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('user', JSON.stringify({
        id: response.data.user_id,
        email: response.data.email,
        full_name: response.data.full_name,
        tenant_id: response.data.tenant_id,
        role: response.data.role,
      }))

      // Reload the page to update context
      window.location.reload()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to switch tenant')
      setSwitching(false)
    }
  }

  // Don't show if user belongs to only one tenant
  if (loading || tenants.length <= 1) {
    return null
  }

  const currentTenant = tenants.find(t => t.tenant_id === currentUser?.tenant_id)

  return (
    <div className="relative px-2 pt-1 pb-2 border-b mb-1" style={{ borderColor: 'hsl(var(--border))' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full"
        disabled={switching}
      >
        <Building2 className="w-4 h-4" />
        <div className="flex-1 text-left">
          <div className="font-medium">{currentTenant?.tenant_name || 'Switch Organization'}</div>
          {currentTenant && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {currentTenant.role.replace('_', ' ')}
            </div>
          )}
        </div>
        {switching ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        )}
      </button>

      {showDropdown && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            Your Organizations
          </div>
          {tenants.map((tenant) => (
            <button
              key={tenant.tenant_id}
              onClick={() => switchTenant(tenant.tenant_id)}
              className={`flex items-center gap-3 w-full px-3 py-2 text-sm text-left transition-colors ${
                tenant.tenant_id === currentUser?.tenant_id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              disabled={switching}
            >
              <div className="flex-1">
                <div className="font-medium">{tenant.tenant_name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {tenant.role.replace('_', ' ')}
                </div>
              </div>
              {tenant.tenant_id === currentUser?.tenant_id && (
                <Check className="w-4 h-4" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
