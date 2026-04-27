/**
 * User Settings Page
 * Comprehensive account-level preferences and configuration
 */

import { useState, useEffect, useRef } from 'react'
import { api } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { useRouter } from 'next/router'
import Header from '@/components/Header'
import { User, Shield, Bot, Eye, EyeOff, ChevronDown, RefreshCw, Users, Plus, Trash2, Mail, Clock, CheckCircle, XCircle, Send, AlertCircle, Copy, Check, Key, MessageSquare, Volume2, Database } from 'lucide-react'

type Tab = 'profile' | 'security' | 'notifications' | 'llm' | 'data_refresh' | 'team' | 'api_keys' | 'chat' | 'speech' | 'data_controls'
type LLMProvider = 'openai' | 'anthropic' | 'azure_openai' | 'aws_bedrock' | 'google_gemini'
type AWSAuthMethod = 'api_key' | 'credentials'

interface LLMConfig {
  provider: LLMProvider
  api_key?: string
  model?: string
  embedding_model?: string
  endpoint?: string
  deployment_name?: string
  api_version?: string
  aws_auth_method?: AWSAuthMethod
  aws_access_key_id?: string
  aws_secret_access_key?: string
  aws_region?: string
  [key: string]: any
}

interface ModelOptions {
  openai_models: string[]
  openai_embedding_models: string[]
  anthropic_models: string[]
  aws_bedrock_models: string[]
  aws_regions: string[]
  google_gemini_models: string[]
}

interface Invite {
  id: number
  email: string
  role: string
  token: string
  invited_by: number | null
  is_accepted: boolean
  expires_at: string
  message: string | null
  created_at: string
}

export default function Settings() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    const currentUser = getCurrentUser()
    setUser(currentUser)

    // Initialize profile data
    if (currentUser) {
      setProfileData({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
      })
    }

    // Handle ?tab= query parameter
    if (router.query.tab && typeof router.query.tab === 'string') {
      const tabParam = router.query.tab as Tab
      if (['profile', 'security', 'api_keys', 'notifications', 'llm', 'data_refresh', 'team', 'chat', 'speech', 'data_controls'].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    }
  }, [router.query.tab])

  // LLM Settings state
  const [currentLLMSettings, setCurrentLLMSettings] = useState<any>(null)
  const [llmProvider, setLLMProvider] = useState<LLMProvider>('openai')
  const [awsAuthMethod, setAwsAuthMethod] = useState<AWSAuthMethod>('api_key')
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({ provider: 'openai', api_key: '', model: 'gpt-5.4', embedding_model: 'text-embedding-3-large' })
  const [modelOptions, setModelOptions] = useState<ModelOptions | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)

  // Profile state
  const [profileData, setProfileData] = useState({ full_name: '', email: '' })

  // Security state
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  // Notifications state
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    push_notifications: false,
    feedback_alerts: true,
    theme_updates: true,
    decision_reminders: true,
    weekly_digest: false,
  })

  // Persona refresh state
  const [personaRefreshEnabled, setPersonaRefreshEnabled] = useState(false)
  const [personaRefreshDays, setPersonaRefreshDays] = useState(7)
  const [lastRefreshDate, setLastRefreshDate] = useState<string | null>(null)
  const [savingPersonaRefresh, setSavingPersonaRefresh] = useState(false)

  // Theme refresh state
  const [themeRefreshEnabled, setThemeRefreshEnabled] = useState(false)
  const [themeRefreshDays, setThemeRefreshDays] = useState(7)
  const [lastThemeRefreshDate, setLastThemeRefreshDate] = useState<string | null>(null)
  const [savingThemeRefresh, setSavingThemeRefresh] = useState(false)

  // Knowledge source refresh state
  const [knowledgeRefreshEnabled, setKnowledgeRefreshEnabled] = useState(false)
  const [knowledgeRefreshDays, setKnowledgeRefreshDays] = useState(7)
  const [lastKnowledgeRefreshDate, setLastKnowledgeRefreshDate] = useState<string | null>(null)
  const [savingKnowledgeRefresh, setSavingKnowledgeRefresh] = useState(false)

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loadingApiKeys, setLoadingApiKeys] = useState(false)
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false)
  const [newKeyData, setNewKeyData] = useState<{ key: string; name: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Team management state
  const [teamSubtab, setTeamSubtab] = useState<'members' | 'invites'>('members')
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [copiedToken, setCopiedToken] = useState<number | null>(null)

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'security' as Tab, label: 'Security', icon: Shield },
    { id: 'api_keys' as Tab, label: 'API Keys', icon: Key },
    // { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'llm' as Tab, label: 'LLM Settings', icon: Bot },
    { id: 'data_refresh' as Tab, label: 'Data Refresh', icon: RefreshCw },
    { id: 'chat' as Tab, label: 'Chat', icon: MessageSquare },
    { id: 'speech' as Tab, label: 'Speech', icon: Volume2 },
    { id: 'data_controls' as Tab, label: 'Data Controls', icon: Database },
    ...(user?.role === 'TENANT_ADMIN' ? [{ id: 'team' as Tab, label: 'Team', icon: Users }] : []),
  ]

  useEffect(() => {
    if (activeTab === 'llm') {
      loadCurrentLLMSettings()
      loadModelOptions()
    } else if (activeTab === 'data_refresh') {
      loadPersonaRefreshSettings()
    } else if (activeTab === 'team') {
      loadTeamMembers()
      loadInvites()
    } else if (activeTab === 'api_keys') {
      loadApiKeys()
    }
  }, [activeTab])

  const loadCurrentLLMSettings = async () => {
    try {
      const response = await api.getLLMSettings()
      if (response.data) {
        setCurrentLLMSettings(response.data)
        setLLMProvider(response.data.provider)
      }
    } catch (error: any) {
      console.log('No existing LLM settings')
    }
  }

  const loadModelOptions = async () => {
    try {
      const response = await api.getModelOptions()
      setModelOptions(response.data)
    } catch (error) {
      console.error('Failed to load model options:', error)
    }
  }

  const handleLLMProviderChange = (newProvider: LLMProvider) => {
    setLLMProvider(newProvider)
    setTestResult(null)
    switch (newProvider) {
      case 'openai':
        setLLMConfig({ provider: 'openai', api_key: '', model: 'gpt-5.4', embedding_model: 'text-embedding-3-large' })
        break
      case 'anthropic':
        setLLMConfig({ provider: 'anthropic', api_key: '', model: 'claude-3-5-sonnet-20241022' })
        break
      case 'azure_openai':
        setLLMConfig({ provider: 'azure_openai', api_key: '', endpoint: '', deployment_name: '', api_version: '2024-02-01' })
        break
      case 'aws_bedrock':
        setAwsAuthMethod('api_key')
        setLLMConfig({ provider: 'aws_bedrock', aws_auth_method: 'api_key', api_key: '', aws_region: 'us-east-1', model: 'anthropic.claude-3-5-sonnet-20241022-v2:0' })
        break
      case 'google_gemini':
        setLLMConfig({ provider: 'google_gemini', api_key: '', model: 'gemini-3-flash-preview', temperature: 0.7, top_p: 0.95, top_k: 40 })
        break
    }
  }

  // Get the latest model for each provider
  const getLatestModel = (provider: LLMProvider) => {
    switch (provider) {
      case 'openai':
        return 'GPT-5.4'
      case 'anthropic':
        return 'Claude Sonnet 4.5'
      case 'azure_openai':
        return 'GPT-5.4 (Azure deployment)'
      case 'aws_bedrock':
        return 'Claude Sonnet 4.5 (Bedrock)'
      case 'google_gemini':
        return 'Gemini 3 Flash Preview'
      default:
        return 'Latest model'
    }
  }

  const handleAWSAuthMethodChange = (method: AWSAuthMethod) => {
    setAwsAuthMethod(method)
    setTestResult(null)
    if (method === 'api_key') {
      setLLMConfig({ provider: 'aws_bedrock', aws_auth_method: 'api_key', api_key: '', aws_region: 'us-east-1', model: 'global.anthropic.claude-sonnet-4-6' })
    } else {
      setLLMConfig({ provider: 'aws_bedrock', aws_auth_method: 'credentials', aws_access_key_id: '', aws_secret_access_key: '', aws_region: 'us-east-1', model: 'global.anthropic.claude-sonnet-4-6' })
    }
  }

  const isConfigValid = () => {
    if (llmProvider === 'aws_bedrock') {
      if (awsAuthMethod === 'api_key') {
        return !!llmConfig.api_key
      } else {
        return !!llmConfig.aws_access_key_id && !!llmConfig.aws_secret_access_key
      }
    }
    return !!llmConfig.api_key
  }

  const handleTestLLMConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // Transform config to match backend schema
      const configToSend = { ...llmConfig }
      if (llmConfig.provider === 'aws_bedrock') {
        configToSend.region = llmConfig.aws_region
        configToSend.access_key_id = llmConfig.aws_access_key_id
        configToSend.secret_access_key = llmConfig.aws_secret_access_key
        configToSend.model_id = llmConfig.model
        delete configToSend.aws_region
        delete configToSend.aws_access_key_id
        delete configToSend.aws_secret_access_key
        delete configToSend.model
      }

      const response = await api.testLLMConnection(configToSend)
      setTestResult({ success: response.data.success, message: response.data.message })
    } catch (error: any) {
      // Handle validation errors (422)
      let errorMessage = 'Connection test failed.'
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail
        if (Array.isArray(detail)) {
          // FastAPI validation errors
          errorMessage = detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ')
        } else if (typeof detail === 'string') {
          errorMessage = detail
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail)
        }
      }
      setTestResult({ success: false, message: errorMessage })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveLLMSettings = async () => {
    setSaving(true)
    try {
      // Transform config to match backend schema
      const configToSend = { ...llmConfig }
      if (llmConfig.provider === 'aws_bedrock') {
        configToSend.region = llmConfig.aws_region
        configToSend.access_key_id = llmConfig.aws_access_key_id
        configToSend.secret_access_key = llmConfig.aws_secret_access_key
        configToSend.model_id = llmConfig.model
        delete configToSend.aws_region
        delete configToSend.aws_access_key_id
        delete configToSend.aws_secret_access_key
        delete configToSend.model
      }

      await api.updateLLMSettings(configToSend)
      alert('LLM settings saved successfully!')
      await loadCurrentLLMSettings()
    } catch (error: any) {
      let errorMessage = 'Failed to save settings'
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail
        if (Array.isArray(detail)) {
          errorMessage = detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ')
        } else if (typeof detail === 'string') {
          errorMessage = detail
        }
      }
      alert(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLLMSettings = async () => {
    if (!confirm('Remove your LLM configuration?')) return
    try {
      await api.deleteLLMSettings()
      alert('LLM settings removed')
      setCurrentLLMSettings(null)
    } catch (error: any) {
      alert(`Failed to remove: ${error.response?.data?.detail || error.message}`)
    }
  }


  const handleSaveProfile = async () => {
    try {
      const response = await api.updateMyProfile({
        full_name: profileData.full_name,
      })

      // Update local user data
      const updatedUser = {
        ...user,
        full_name: response.data.full_name,
      }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))

      alert('Profile updated successfully!')
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      alert(`Failed to update profile: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleChangePassword = async () => {
    // Validation
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      alert('Please fill in all password fields')
      return
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('New passwords do not match')
      return
    }

    if (passwordData.new_password.length < 8) {
      alert('New password must be at least 8 characters')
      return
    }

    try {
      await api.changeMyPassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      })

      // Clear password fields
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
      alert('Password changed successfully!')
    } catch (error: any) {
      console.error('Failed to change password:', error)
      alert(`Failed to change password: ${error.response?.data?.detail || error.message}`)
    }
  }

  const loadPersonaRefreshSettings = async () => {
    try {
      const response = await api.getPersonaRefreshSettings()
      setPersonaRefreshEnabled(response.data.enabled)
      setPersonaRefreshDays(response.data.interval_days)
      setLastRefreshDate(response.data.last_refresh_date)
    } catch (error) {
      console.error('Failed to load persona refresh settings:', error)
    }
  }

  const handleSavePersonaRefreshSettings = async () => {
    try {
      setSavingPersonaRefresh(true)
      await api.updatePersonaRefreshSettings({
        enabled: personaRefreshEnabled,
        interval_days: personaRefreshDays,
      })
      await loadPersonaRefreshSettings()
      alert('Persona refresh settings saved successfully!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSavingPersonaRefresh(false)
    }
  }

  const loadThemeRefreshSettings = async () => {
    try {
      const response = await api.getThemeRefreshSettings()
      setThemeRefreshEnabled(response.data.enabled)
      setThemeRefreshDays(response.data.interval_days)
      setLastThemeRefreshDate(response.data.last_refresh_date)
    } catch (error) {
      console.error('Failed to load theme refresh settings:', error)
    }
  }

  const handleSaveThemeRefreshSettings = async () => {
    try {
      setSavingThemeRefresh(true)
      await api.updateThemeRefreshSettings({
        enabled: themeRefreshEnabled,
        interval_days: themeRefreshDays,
      })
      await loadThemeRefreshSettings()
      alert('Theme refresh settings saved successfully!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSavingThemeRefresh(false)
    }
  }

  const loadKnowledgeRefreshSettings = async () => {
    try {
      const response = await api.getThemeRefreshSettings()
      setKnowledgeRefreshEnabled(response.data.enabled)
      setKnowledgeRefreshDays(response.data.interval_days)
      setLastKnowledgeRefreshDate(response.data.last_refresh_date)
    } catch (error) {
      console.error('Failed to load knowledge refresh settings:', error)
    }
  }

  const handleSaveKnowledgeRefreshSettings = async () => {
    try {
      setSavingKnowledgeRefresh(true)
      await api.updateThemeRefreshSettings({
        enabled: knowledgeRefreshEnabled,
        interval_days: knowledgeRefreshDays,
      })
      await loadKnowledgeRefreshSettings()
      alert('Knowledge source refresh settings saved successfully!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSavingKnowledgeRefresh(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'llm') {
      loadPersonaRefreshSettings()
      loadThemeRefreshSettings()
      loadKnowledgeRefreshSettings()
    }
  }, [activeTab])

  // API Keys functions
  const loadApiKeys = async () => {
    try {
      setLoadingApiKeys(true)
      const response = await api.get('/auth/api-keys')
      setApiKeys(response.data || [])
    } catch (error) {
      console.error('Failed to load API keys:', error)
    } finally {
      setLoadingApiKeys(false)
    }
  }

  const handleRevokeApiKey = async (keyId: number, keyName: string) => {
    if (!confirm(`Revoke "${keyName}"? Any plugin using this key will stop working immediately.`)) return
    try {
      await api.delete(`/auth/api-keys/${keyId}`)
      await loadApiKeys()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to revoke key')
    }
  }

  // Team management functions
  const loadTeamMembers = async () => {
    try {
      setLoadingTeam(true)
      const response = await api.getUsers()
      setTeamMembers(response.data || [])
    } catch (error) {
      console.error('Failed to load team members:', error)
    } finally {
      setLoadingTeam(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to remove this user from your team?')) {
      return
    }
    try {
      await api.deleteUser(userId)
      await loadTeamMembers()
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || 'Failed to delete user'}`)
    }
  }

  // Invite management functions
  const loadInvites = async () => {
    try {
      setLoadingInvites(true)
      const response = await api.get('/invites/')
      setInvites(response.data?.invites || [])
    } catch (error) {
      console.error('Failed to load invites:', error)
    } finally {
      setLoadingInvites(false)
    }
  }

  const handleDeleteInvite = async (inviteId: number) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return

    try {
      await api.delete(`/invites/${inviteId}`)
      await loadInvites()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to revoke invitation')
    }
  }

  const handleResendInvite = async (inviteId: number) => {
    try {
      await api.post(`/invites/${inviteId}/resend`, {})
      alert('Invitation resent successfully!')
      await loadInvites()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to resend invitation')
    }
  }

  const copyInviteLink = (token: string, inviteId: number) => {
    const inviteUrl = `${window.location.origin}/register?invite=${token}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedToken(inviteId)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="min-h-screen">
      <Header user={user} currentPage="settings" />
      <div className="page-container">
        <div className="card">
        <div className="border-b" style={{ borderColor: 'hsl(var(--border))' }}>
          <div className="px-8 py-6">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
              <h1 className="page-title mb-0">Settings</h1>
            </div>
            <p className="page-subtitle mt-2">Manage your account preferences</p>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 px-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors"
                  style={{
                    borderColor: isActive ? 'hsl(var(--primary))' : 'transparent',
                    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-4">
              <h3 className="text-lg mb-4 text-foreground">Profile Information</h3>
              <div>
                <label className="block text-sm font-medium mb-2 text-heading">Full Name</label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-heading">Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="input w-full opacity-50 cursor-not-allowed"
                />
                <p className="text-xs text-muted mt-1">Email cannot be changed</p>
              </div>
              <button
                onClick={handleSaveProfile}
                className="btn-primary"
              >
                Save Profile
              </button>
            </div>
          )}

          {/* Appearance tab - Temporarily hidden
          {activeTab === 'appearance' && (
            <div className="max-w-2xl">
              <h3 className="text-lg mb-4 text-foreground">Theme Preferences</h3>
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark theme</p>
                </div>
                <button onClick={toggleTheme} className={`relative inline-flex h-6 w-11 items-center rounded-full ${theme === 'dark' ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-card ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          )}
          */}

          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg mb-4 text-heading">Change Password</h3>
                <div className="space-y-4">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    className="input w-full"
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    className="input w-full"
                  />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    className="input w-full"
                  />
                  <button
                    onClick={handleChangePassword}
                    className="btn-primary"
                  >
                    Update Password
                  </button>
                </div>
              </div>
              {/* Two-Factor Authentication - Coming soon
              <div>
                <h3 className="text-lg mb-4 text-foreground">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Enable 2FA</p>
                    <p className="text-sm text-muted-foreground">Add extra security layer to your account</p>
                  </div>
                  <button onClick={() => setTwoFactorEnabled(!twoFactorEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${twoFactorEnabled ? 'bg-primary' : 'bg-muted'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-card ${twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              */}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl">
              <h3 className="text-lg mb-4 text-foreground">Notification Preferences</h3>
              <div className="space-y-3">
                {Object.entries({ email_notifications: 'Email Notifications', push_notifications: 'Push Notifications', feedback_alerts: 'Feedback Alerts', theme_updates: 'Theme Updates', decision_reminders: 'Decision Reminders', weekly_digest: 'Weekly Digest' }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <p className="text-foreground">{label}</p>
                    <button onClick={() => setNotificationSettings({ ...notificationSettings, [key]: !notificationSettings[key as keyof typeof notificationSettings] })} className={`relative inline-flex h-6 w-11 items-center rounded-full ${notificationSettings[key as keyof typeof notificationSettings] ? 'bg-primary' : 'bg-muted'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-card ${notificationSettings[key as keyof typeof notificationSettings] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/85 transition-colors mt-4">Save Preferences</button>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div>
              <h3 className="text-lg mb-2 text-foreground">LLM Configuration</h3>
              <p className="text-muted-foreground mb-6">BYOK - Bring Your Own Keys. API keys are encrypted at rest.</p>

              {currentLLMSettings && (
                <div className="mb-6 p-4 bg-chart-3/10 border border-chart-3/30 rounded-lg">
                  <p className="text-sm text-chart-3 mb-2">✓ Current Configuration</p>
                  <p className="text-sm text-chart-3"><strong>Provider:</strong> {currentLLMSettings.provider}</p>
                  <p className="text-sm text-chart-3"><strong>Model:</strong> {currentLLMSettings.model}</p>
                  {currentLLMSettings.api_key_masked && <p className="text-sm text-chart-3"><strong>Key:</strong> {currentLLMSettings.api_key_masked}</p>}
                </div>
              )}


              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-foreground">Provider</label>
                <div className="relative">
                  <select
                    value={llmProvider}
                    onChange={(e) => handleLLMProviderChange(e.target.value as LLMProvider)}
                    className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="aws_bedrock">AWS Bedrock</option>
                    <option value="google_gemini">Google Gemini</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {llmProvider === 'openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Model Available</label>
                    <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-foreground">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{getLatestModel('openai')}</span>
                        <span className="text-xs bg-chart-1/15 text-chart-1 px-2 py-1 rounded">
                          Most Effective
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Curated model selection optimized for product management workflows and strategic analysis.
                    </p>
                  </div>
                </div>
              )}

              {llmProvider === 'anthropic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model Available</label>
                    <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-foreground">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{getLatestModel('anthropic')}</span>
                        <span className="text-xs bg-chart-1/15 text-chart-1 px-2 py-1 rounded">
                          Most Effective
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Curated model selection optimized for product management workflows and strategic analysis.
                    </p>
                  </div>
                </div>
              )}

              {llmProvider === 'azure_openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="API Key"
                        value={llmConfig.api_key}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground placeholder:text-muted-foregroundfocus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Endpoint URL *</label>
                    <input
                      type="text"
                      placeholder="https://your-resource.openai.azure.com"
                      value={llmConfig.endpoint}
                      onChange={(e) => setLLMConfig({ ...llmConfig, endpoint: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground placeholder:text-muted-foregroundfocus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Deployment Name *</label>
                    <input
                      type="text"
                      placeholder="gpt-4"
                      value={llmConfig.deployment_name}
                      onChange={(e) => setLLMConfig({ ...llmConfig, deployment_name: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground placeholder:text-muted-foregroundfocus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                  </div>
                </div>
              )}

              {llmProvider === 'aws_bedrock' && (
                <div className="space-y-4">
                  {/* Authentication Method Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-3 text-foreground">Authentication Method</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aws_auth_method"
                          value="api_key"
                          checked={awsAuthMethod === 'api_key'}
                          onChange={(e) => handleAWSAuthMethodChange(e.target.value as AWSAuthMethod)}
                          className="w-4 h-4 text-primary focus:ring-ring/50"
                        />
                        <span className="text-sm text-foreground">API Key</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aws_auth_method"
                          value="credentials"
                          checked={awsAuthMethod === 'credentials'}
                          onChange={(e) => handleAWSAuthMethodChange(e.target.value as AWSAuthMethod)}
                          className="w-4 h-4 text-primary focus:ring-ring/50"
                        />
                        <span className="text-sm text-foreground">AWS Credentials (IAM)</span>
                      </label>
                    </div>
                  </div>

                  {/* API Key Method */}
                  {awsAuthMethod === 'api_key' && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="Enter your AWS Bedrock API key"
                          value={llmConfig.api_key}
                          onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground placeholder:text-muted-foregroundfocus:ring-2 focus:ring-ring/50 focus:border-ring"
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* AWS Credentials Method */}
                  {awsAuthMethod === 'credentials' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">Access Key ID *</label>
                        <input
                          type="text"
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          value={llmConfig.aws_access_key_id}
                          onChange={(e) => setLLMConfig({ ...llmConfig, aws_access_key_id: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground placeholder:text-muted-foregroundfocus:ring-2 focus:ring-ring/50 focus:border-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">Secret Access Key *</label>
                        <div className="relative">
                          <input
                            type={showSecretKey ? 'text' : 'password'}
                            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                            value={llmConfig.aws_secret_access_key}
                            onChange={(e) => setLLMConfig({ ...llmConfig, aws_secret_access_key: e.target.value })}
                            className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground placeholder:text-muted-foregroundfocus:ring-2 focus:ring-ring/50 focus:border-ring"
                          />
                          <button
                            onClick={() => setShowSecretKey(!showSecretKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Common Fields */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Region</label>
                    <div className="relative">
                      <select
                        value={llmConfig.aws_region}
                        onChange={(e) => setLLMConfig({ ...llmConfig, aws_region: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {modelOptions?.aws_regions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Model Available</label>
                    <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-foreground">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{getLatestModel('aws_bedrock')}</span>
                        <span className="text-xs bg-chart-1/15 text-chart-1 px-2 py-1 rounded">
                          Most Effective
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Curated model selection optimized for product management workflows and strategic analysis.
                    </p>
                  </div>
                </div>
              )}

              {llmProvider === 'google_gemini' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Google AI Studio API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="Enter your Google AI Studio API key"
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground placeholder:text-muted-foregroundfocus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Model Available
                    </label>
                    <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-foreground">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{getLatestModel('google_gemini')}</span>
                        <span className="text-xs bg-chart-1/15 text-chart-1 px-2 py-1 rounded">
                          Most Effective
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Curated model selection optimized for product management workflows and strategic analysis.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Temperature
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={llmConfig.temperature || 0.7}
                        onChange={(e) => setLLMConfig({ ...llmConfig, temperature: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">0.0 = deterministic, 1.0 = creative</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Top-P
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={llmConfig.top_p || 0.95}
                        onChange={(e) => setLLMConfig({ ...llmConfig, top_p: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Nucleus sampling parameter</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Top-K
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={llmConfig.top_k || 40}
                        onChange={(e) => setLLMConfig({ ...llmConfig, top_k: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Top-k sampling parameter</p>
                    </div>
                  </div>
                </div>
              )}

              {testResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  testResult.success
                    ? 'bg-chart-3/10 border-chart-3/30'
                    : 'bg-destructive/10 border-destructive/30'
                }`}>
                  <p className={`text-sm ${
                    testResult.success
                      ? 'text-chart-3'
                      : 'text-destructive'
                  }`}>
                    {testResult.success ? '✓' : '✗'} {testResult.message}
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleTestLLMConnection}
                  disabled={testing || !isConfigValid()}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleSaveLLMSettings}
                  disabled={saving || !isConfigValid()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/85 disabled:bg-primary/40 dark:disabled:bg-primary/40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                {currentLLMSettings && (
                  <button
                    onClick={handleDeleteLLMSettings}
                    className="px-4 py-2 bg-destructive text-primary-foreground rounded-md hover:bg-destructive/85 transition-colors"
                  >
                    Remove Configuration
                  </button>
                )}
              </div>

              <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg">
                <p className="text-sm text-primary/85 dark:text-primary"><strong>ℹ️ About Authentication Methods:</strong> AWS Bedrock supports two authentication methods: (1) <strong>API Key</strong> - simpler authentication with a single key, or (2) <strong>AWS Credentials (IAM)</strong> - traditional AWS authentication using Access Key ID + Secret Access Key. Other providers (OpenAI, Anthropic, Azure, Google Gemini) use single API keys specific to their platforms.</p>
              </div>
            </div>
          )}

          {/* Data Refresh Tab */}
          {activeTab === 'data_refresh' && (
            <div>
              <h3 className="text-lg mb-2 text-foreground">Context Intelligence Refresh</h3>
              <p className="text-muted-foreground mb-6">
                Automatically re-extract insights from uploaded context sources on a schedule.
                Use the manual "Refresh Context" button on the Context page for on-demand updates.
              </p>

              {/* Unified Context Refresh Settings */}
              <div className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">Enable Auto-Refresh</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically re-extract entities and insights from all context sources on a schedule.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={personaRefreshEnabled}
                        onChange={(e) => setPersonaRefreshEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ring/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {personaRefreshEnabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Refresh Interval (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={personaRefreshDays}
                        onChange={(e) => setPersonaRefreshDays(Number(e.target.value))}
                        className="w-32 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Context intelligence will be refreshed every {personaRefreshDays} day(s)
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleSavePersonaRefreshSettings}
                    disabled={savingPersonaRefresh}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/85 disabled:bg-primary/40 dark:disabled:bg-primary/40 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingPersonaRefresh ? 'Saving...' : 'Save Refresh Settings'}
                  </button>

                  {lastRefreshDate && (
                    <p className="text-sm text-muted-foreground">
                      Last refresh: {new Date(lastRefreshDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api_keys' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg text-foreground">API Keys</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Long-lived keys for the Evols Claude Code plugin. Configure once in{' '}
                    <code className="text-xs bg-muted text-muted-foreground px-1 py-0.5 rounded">~/.evols/config.json</code>.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateKeyModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85 transition-colors whitespace-nowrap flex-shrink-0 ml-4"
                >
                  <Plus className="w-4 h-4" />
                  New Key
                </button>
              </div>

              {/* Newly-created key banner */}
              {newKeyData && (
                <div className="mb-6 p-4 bg-chart-3/10 border border-chart-3/30 rounded-lg">
                  <p className="text-sm font-medium text-chart-3 mb-2">
                    ✓ Key created — copy it now. It won&apos;t be shown again.
                  </p>
                  <p className="text-xs text-chart-3/80 mb-3">
                    <strong>{newKeyData.name}</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-card text-foreground border border-chart-3/30 rounded px-3 py-2 font-mono break-all">
                      {newKeyData.key}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newKeyData.key)
                        setCopiedKey(true)
                        setTimeout(() => setCopiedKey(false), 2000)
                      }}
                      className="flex-shrink-0 p-2 bg-chart-3 text-primary-foreground rounded hover:bg-chart-3/85 transition-colors"
                      title="Copy key"
                    >
                      {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-chart-3/80 mt-3">
                    Add to <code className="bg-chart-3/10 text-chart-3 px-1 rounded">~/.evols/config.json</code> as{' '}
                    <code className="bg-chart-3/10 text-chart-3 px-1 rounded">&quot;api_key&quot;: &quot;{newKeyData.key.slice(0, 12)}...&quot;</code>
                  </p>
                  <button
                    onClick={() => setNewKeyData(null)}
                    className="mt-3 text-xs text-chart-3 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {loadingApiKeys ? (
                <div className="text-center py-12 text-muted-foreground">Loading keys...</div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <Key className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No API keys yet.</p>
                  <button
                    onClick={() => setShowCreateKeyModal(true)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85"
                  >
                    Create First Key
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {apiKeys.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between px-4 py-3 bg-card">
                      <div>
                        <p className="text-sm font-medium text-foreground">{k.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <code className="font-mono">{k.key_prefix}...</code>
                          {' · '}
                          Created {new Date(k.created_at).toLocaleDateString()}
                          {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                          {!k.is_active && <span className="ml-2 text-destructive">Revoked</span>}
                        </p>
                      </div>
                      {k.is_active && (
                        <button
                          onClick={() => handleRevokeApiKey(k.id, k.name)}
                          className="p-2 text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15 rounded transition-colors"
                          title="Revoke key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showCreateKeyModal && (
                <CreateApiKeyModal
                  onClose={() => setShowCreateKeyModal(false)}
                  onSuccess={(key, name) => {
                    setShowCreateKeyModal(false)
                    setNewKeyData({ key, name })
                    loadApiKeys()
                  }}
                />
              )}
            </div>
          )}

          {/* Team Management Tab */}
          {activeTab === 'team' && (
            <div>
              {/* Team Subtabs */}
              <div className="mb-6 border-b border-border">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setTeamSubtab('members')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      teamSubtab === 'members'
                        ? 'border-primary text-primary dark:text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Team Members ({teamMembers.length})
                    </div>
                  </button>
                  <button
                    onClick={() => setTeamSubtab('invites')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      teamSubtab === 'invites'
                        ? 'border-primary text-primary dark:text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Pending Invites ({invites.filter(i => !i.is_accepted && !isExpired(i.expires_at)).length})
                    </div>
                  </button>
                </nav>
              </div>

              {/* Team Members Subtab */}
              {teamSubtab === 'members' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg text-foreground">Team Members</h3>
                      <p className="text-sm text-muted-foreground">Current members of your organization</p>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Invite Member
                    </button>
                  </div>

                  {loadingTeam ? (
                    <div className="text-center py-12">
                      <div className="text-muted-foreground">Loading team members...</div>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-12 bg-muted/30 rounded-lg border border-border">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-4">No team members yet</p>
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85"
                      >
                        Invite First Member
                      </button>
                    </div>
                  ) : (
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/40 border-b border-border">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {teamMembers.map((member: any) => (
                            <tr key={member.id}>
                              <td className="px-6 py-4">
                                <div className="font-medium text-foreground">
                                  {member.full_name || 'No name'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {member.email}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  member.role === 'TENANT_ADMIN'
                                    ? 'bg-chart-1/15 text-chart-1'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {member.role.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  member.is_active
                                    ? 'bg-chart-3/15 text-chart-3'
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {member.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {member.id !== user?.id && (
                                  <button
                                    onClick={() => handleDeleteUser(member.id)}
                                    className="text-destructive dark:text-destructive hover:text-destructive"
                                    title="Remove user"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Invites Subtab */}
              {teamSubtab === 'invites' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg text-foreground">Pending Invitations</h3>
                      <p className="text-sm text-muted-foreground">Invitations waiting to be accepted</p>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Send Invitation
                    </button>
                  </div>

                  {loadingInvites ? (
                    <div className="text-center py-12">
                      <div className="text-muted-foreground">Loading invitations...</div>
                    </div>
                  ) : invites.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-lg border border-border">
                      <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-4">No pending invitations</p>
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85"
                      >
                        Send First Invitation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {invites.map((invite) => {
                        const expired = isExpired(invite.expires_at)
                        const expiresIn = Math.ceil(
                          (new Date(invite.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        )

                        return (
                          <div
                            key={invite.id}
                            className="bg-card rounded-lg border border-border p-6"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-medium text-foreground">
                                    {invite.email}
                                  </h3>
                                  {invite.is_accepted ? (
                                    <span className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-chart-3/15 text-chart-3">
                                      <CheckCircle className="w-3 h-3" />
                                      Accepted
                                    </span>
                                  ) : expired ? (
                                    <span className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-destructive/10 text-destructive">
                                      <XCircle className="w-3 h-3" />
                                      Expired
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-chart-4/20 text-chart-4">
                                      <Clock className="w-3 h-3" />
                                      Expires in {expiresIn} days
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                                  <span>
                                    Role:{' '}
                                    <span className="font-medium text-foreground">
                                      {invite.role.replace('_', ' ')}
                                    </span>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Sent {new Date(invite.created_at).toLocaleDateString()}
                                  </span>
                                </div>

                                {invite.message && (
                                  <div className="bg-muted/30 rounded p-3 text-sm text-muted-foreground mb-3">
                                    <p className="italic">"{invite.message}"</p>
                                  </div>
                                )}

                                {!invite.is_accepted && !expired && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => copyInviteLink(invite.token, invite.id)}
                                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/70 transition-colors"
                                    >
                                      {copiedToken === invite.id ? (
                                        <>
                                          <Check className="w-4 h-4" />
                                          Copied!
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-4 h-4" />
                                          Copy Link
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {!invite.is_accepted && !expired && (
                                  <button
                                    onClick={() => handleResendInvite(invite.id)}
                                    className="p-2 text-primary dark:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded transition-colors"
                                    title="Resend invitation"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                )}
                                {!invite.is_accepted && (
                                  <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="p-2 text-destructive dark:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15 rounded transition-colors"
                                    title="Revoke invitation"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Invite Modal */}
              {showInviteModal && (
                <InviteModal
                  onClose={() => setShowInviteModal(false)}
                  onSuccess={() => {
                    setShowInviteModal(false)
                    loadInvites()
                  }}
                />
              )}
            </div>
          )}

          {/* Chat Settings Tab */}
          {(activeTab === 'chat' || activeTab === 'speech' || activeTab === 'data_controls') && (
            <LibreChatSettingsTab tab={activeTab} />
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

const LIBRECHAT_PANEL_TAB: Record<string, string> = {
  chat: 'chat',
  speech: 'speech',
  data_controls: 'data',
}

function LibreChatSettingsTab({ tab }: { tab: 'chat' | 'speech' | 'data_controls' }) {
  const { theme } = useTheme()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const panelTab = LIBRECHAT_PANEL_TAB[tab]
  const librechatOrigin = process.env.NEXT_PUBLIC_LIBRECHAT_URL || window.location.origin
  const src = process.env.NEXT_PUBLIC_LIBRECHAT_URL
    ? `${process.env.NEXT_PUBLIC_LIBRECHAT_URL}/settings-panel/${panelTab}`
    : `/workbench/app/settings-panel/${panelTab}`

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const sendTheme = () => {
      iframe.contentWindow?.postMessage({ type: 'evols:theme', theme }, librechatOrigin)
    }
    iframe.addEventListener('load', sendTheme)
    sendTheme()
    return () => iframe.removeEventListener('load', sendTheme)
  }, [theme, src, librechatOrigin])

  return (
    <iframe
      ref={iframeRef}
      src={src}
      className="w-full rounded-lg border-0"
      style={{ height: '600px' }}
      allow="microphone"
      title={`${tab} settings`}
    />
  )
}

// Create API Key Modal
function CreateApiKeyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (key: string, name: string) => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setSaving(true)
    try {
      const response = await api.post('/auth/api-keys', { name: name.trim() })
      onSuccess(response.data.key, response.data.name)
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to create key')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Create API Key</h2>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-destructive dark:text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive dark:text-destructive">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Key Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="e.g. Work MacBook, CI Pipeline"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">Helps you identify which key is which when you have multiple devices.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Invite Modal Component
function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    role: 'USER',
    message: '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)

    try {
      await api.post('/invites/', formData)
      onSuccess()
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-md w-full p-6">
        <h2 className="page-title text-foreground mb-4">
          Invite Team Member
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-destructive dark:text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive dark:text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="colleague@company.com"
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
              <option value="TENANT_ADMIN">Admin</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Users can view and collaborate. Admins can manage team members.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Personal Message (Optional)
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              placeholder="Hey! Join our team to collaborate on product decisions..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

