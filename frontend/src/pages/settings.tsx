/**
 * User Settings Page
 * Comprehensive account-level preferences and configuration
 */

import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { useRouter } from 'next/router'
import Header from '@/components/Header'
import { User, Palette, Shield, Bell, Bot, Eye, EyeOff, ChevronDown, RefreshCw, Users, Plus, Trash2 } from 'lucide-react'

type Tab = 'appearance' | 'llm' | 'team'
type LLMProvider = 'openai' | 'anthropic' | 'azure_openai' | 'aws_bedrock'
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
  access_key_id?: string
  secret_access_key?: string
  region?: string
  model_id?: string
}

interface ModelOptions {
  openai_models: string[]
  openai_embedding_models: string[]
  anthropic_models: string[]
  aws_bedrock_models: string[]
  aws_regions: string[]
}

export default function Settings() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<Tab>('appearance')
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    setUser(getCurrentUser())
  }, [])

  // LLM Settings state
  const [currentLLMSettings, setCurrentLLMSettings] = useState<any>(null)
  const [llmProvider, setLLMProvider] = useState<LLMProvider>('openai')
  const [awsAuthMethod, setAwsAuthMethod] = useState<AWSAuthMethod>('api_key')
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({ provider: 'openai', api_key: '', model: 'gpt-4o', embedding_model: 'text-embedding-3-small' })
  const [modelOptions, setModelOptions] = useState<ModelOptions | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)

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

  // Team management state
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)

  const tabs = [
    // { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'appearance' as Tab, label: 'Appearance', icon: Palette },
    // { id: 'security' as Tab, label: 'Security', icon: Shield },
    // { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'llm' as Tab, label: 'LLM Settings', icon: Bot },
    ...(user?.role === 'TENANT_ADMIN' ? [{ id: 'team' as Tab, label: 'Team', icon: Users }] : []),
  ]

  useEffect(() => {
    if (activeTab === 'llm') {
      loadCurrentLLMSettings()
      loadModelOptions()
    } else if (activeTab === 'team') {
      loadTeamMembers()
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
        setLLMConfig({ provider: 'openai', api_key: '', model: 'gpt-4o', embedding_model: 'text-embedding-3-small' })
        break
      case 'anthropic':
        setLLMConfig({ provider: 'anthropic', api_key: '', model: 'claude-3-5-sonnet-20241022' })
        break
      case 'azure_openai':
        setLLMConfig({ provider: 'azure_openai', api_key: '', endpoint: '', deployment_name: '', api_version: '2024-02-01' })
        break
      case 'aws_bedrock':
        setAwsAuthMethod('api_key')
        setLLMConfig({ provider: 'aws_bedrock', aws_auth_method: 'api_key', api_key: '', region: 'us-east-1', model_id: 'anthropic.claude-v2' })
        break
    }
  }

  const handleAWSAuthMethodChange = (method: AWSAuthMethod) => {
    setAwsAuthMethod(method)
    setTestResult(null)
    if (method === 'api_key') {
      setLLMConfig({ provider: 'aws_bedrock', aws_auth_method: 'api_key', api_key: '', region: 'us-east-1', model_id: 'anthropic.claude-v2' })
    } else {
      setLLMConfig({ provider: 'aws_bedrock', aws_auth_method: 'credentials', access_key_id: '', secret_access_key: '', region: 'us-east-1', model_id: 'anthropic.claude-v2' })
    }
  }

  const isConfigValid = () => {
    if (llmProvider === 'aws_bedrock') {
      if (awsAuthMethod === 'api_key') {
        return !!llmConfig.api_key
      } else {
        return !!llmConfig.access_key_id && !!llmConfig.secret_access_key
      }
    }
    return !!llmConfig.api_key
  }

  const handleTestLLMConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await api.testLLMConnection(llmConfig)
      setTestResult({ success: response.data.success, message: response.data.message })
    } catch (error: any) {
      setTestResult({ success: false, message: error.response?.data?.detail || 'Connection test failed.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveLLMSettings = async () => {
    setSaving(true)
    try {
      await api.updateLLMSettings(llmConfig)
      alert('LLM settings saved successfully!')
      await loadCurrentLLMSettings()
    } catch (error: any) {
      alert(`Failed to save settings: ${error.response?.data?.detail || error.message}`)
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

  const handleRefreshModels = async () => {
    setRefreshing(true)
    setRefreshResult(null)

    try {
      // Determine which provider to refresh based on current selection
      let provider = llmProvider
      if (provider === 'anthropic' || provider === 'azure_openai') {
        setRefreshResult('Dynamic model refresh not supported for this provider. Using static model list.')
        return
      }

      const response = await api.refreshModels(provider)

      if (response.data.success) {
        // Reload model options to get the updated list
        await loadModelOptions()

        const modelCount = provider === 'openai'
          ? response.data.models.length + response.data.embedding_models.length
          : response.data.models.length

        setRefreshResult(`✓ Refreshed ${modelCount} models from ${provider}. Cached for 24 hours.`)
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to refresh models'
      setRefreshResult(`✗ ${errorMsg}`)
    } finally {
      setRefreshing(false)
      // Auto-hide result after 5 seconds
      setTimeout(() => setRefreshResult(null), 5000)
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
      const response = await api.getKnowledgeRefreshSettings()
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
      await api.updateKnowledgeRefreshSettings({
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

  const handleAddUser = async (userData: any) => {
    try {
      await api.createUser(userData)
      await loadTeamMembers()
      setShowAddUserModal(false)
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || 'Failed to add user'}`)
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header user={user} currentPage="settings" />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account preferences</p>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 px-6 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap ${
                    isActive ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-600 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
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
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Profile Information</h3>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Full Name</label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">Save Profile</button>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Theme Preferences</h3>
              <div className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Toggle between light and dark theme</p>
                </div>
                <button onClick={toggleTheme} className={`relative inline-flex h-6 w-11 items-center rounded-full ${theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Change Password</h3>
                <div className="space-y-4">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">Update Password</button>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Enable 2FA</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Add extra security layer to your account</p>
                  </div>
                  <button onClick={() => setTwoFactorEnabled(!twoFactorEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${twoFactorEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Notification Preferences</h3>
              <div className="space-y-3">
                {Object.entries({ email_notifications: 'Email Notifications', push_notifications: 'Push Notifications', feedback_alerts: 'Feedback Alerts', theme_updates: 'Theme Updates', decision_reminders: 'Decision Reminders', weekly_digest: 'Weekly Digest' }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <p className="text-gray-900 dark:text-white">{label}</p>
                    <button onClick={() => setNotificationSettings({ ...notificationSettings, [key]: !notificationSettings[key as keyof typeof notificationSettings] })} className={`relative inline-flex h-6 w-11 items-center rounded-full ${notificationSettings[key as keyof typeof notificationSettings] ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${notificationSettings[key as keyof typeof notificationSettings] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors mt-4">Save Preferences</button>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">LLM Configuration</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">BYOK - Bring Your Own Keys. API keys are encrypted at rest.</p>

              {currentLLMSettings && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2">✓ Current Configuration</p>
                  <p className="text-sm text-green-700 dark:text-green-300"><strong>Provider:</strong> {currentLLMSettings.provider}</p>
                  <p className="text-sm text-green-700 dark:text-green-300"><strong>Model:</strong> {currentLLMSettings.model}</p>
                  {currentLLMSettings.api_key_masked && <p className="text-sm text-green-700 dark:text-green-300"><strong>Key:</strong> {currentLLMSettings.api_key_masked}</p>}
                </div>
              )}

              {/* Refresh Models Section */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-400 mb-1">Dynamic Model Lists</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Fetch latest models from your configured provider. Supports OpenAI and AWS Bedrock.
                    </p>
                  </div>
                  <button
                    onClick={handleRefreshModels}
                    disabled={refreshing || !currentLLMSettings}
                    className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh Models'}
                  </button>
                </div>
                {refreshResult && (
                  <div className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                    {refreshResult}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Provider</label>
                <div className="relative">
                  <select
                    value={llmProvider}
                    onChange={(e) => handleLLMProviderChange(e.target.value as LLMProvider)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="aws_bedrock">AWS Bedrock</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                </div>
              </div>

              {llmProvider === 'openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {modelOptions?.openai_models.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {llmProvider === 'anthropic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {modelOptions?.anthropic_models.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {llmProvider === 'azure_openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="API Key"
                        value={llmConfig.api_key}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Endpoint URL *</label>
                    <input
                      type="text"
                      placeholder="https://your-resource.openai.azure.com"
                      value={llmConfig.endpoint}
                      onChange={(e) => setLLMConfig({ ...llmConfig, endpoint: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Deployment Name *</label>
                    <input
                      type="text"
                      placeholder="gpt-4"
                      value={llmConfig.deployment_name}
                      onChange={(e) => setLLMConfig({ ...llmConfig, deployment_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {llmProvider === 'aws_bedrock' && (
                <div className="space-y-4">
                  {/* Authentication Method Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">Authentication Method</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aws_auth_method"
                          value="api_key"
                          checked={awsAuthMethod === 'api_key'}
                          onChange={(e) => handleAWSAuthMethodChange(e.target.value as AWSAuthMethod)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100">API Key</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="aws_auth_method"
                          value="credentials"
                          checked={awsAuthMethod === 'credentials'}
                          onChange={(e) => handleAWSAuthMethodChange(e.target.value as AWSAuthMethod)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100">AWS Credentials (IAM)</span>
                      </label>
                    </div>
                  </div>

                  {/* API Key Method */}
                  {awsAuthMethod === 'api_key' && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">API Key *</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="Enter your AWS Bedrock API key"
                          value={llmConfig.api_key}
                          onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
                        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Access Key ID *</label>
                        <input
                          type="text"
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          value={llmConfig.access_key_id}
                          onChange={(e) => setLLMConfig({ ...llmConfig, access_key_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Secret Access Key *</label>
                        <div className="relative">
                          <input
                            type={showSecretKey ? 'text' : 'password'}
                            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                            value={llmConfig.secret_access_key}
                            onChange={(e) => setLLMConfig({ ...llmConfig, secret_access_key: e.target.value })}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <button
                            onClick={() => setShowSecretKey(!showSecretKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          >
                            {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Common Fields */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Region</label>
                    <div className="relative">
                      <select
                        value={llmConfig.region}
                        onChange={(e) => setLLMConfig({ ...llmConfig, region: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {modelOptions?.aws_regions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Model ID</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model_id}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model_id: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {modelOptions?.aws_bedrock_models.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {testResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-sm ${
                    testResult.success
                      ? 'text-green-800 dark:text-green-400'
                      : 'text-red-800 dark:text-red-400'
                  }`}>
                    {testResult.success ? '✓' : '✗'} {testResult.message}
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleTestLLMConnection}
                  disabled={testing || !isConfigValid()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleSaveLLMSettings}
                  disabled={saving || !isConfigValid()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                {currentLLMSettings && (
                  <button
                    onClick={handleDeleteLLMSettings}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Remove Configuration
                  </button>
                )}
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300"><strong>ℹ️ About Authentication Methods:</strong> AWS Bedrock supports two authentication methods: (1) <strong>API Key</strong> - simpler authentication with a single key, or (2) <strong>AWS Credentials (IAM)</strong> - traditional AWS authentication using Access Key ID + Secret Access Key. Other providers (OpenAI, Anthropic, Azure) use single API keys specific to their platforms.</p>
              </div>

              {/* Persona Auto-Refresh Settings */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Persona Auto-Refresh</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Automatically refresh personas with latest VoC data on a schedule</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Enable Auto-Refresh</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Automatically refresh 'New' personas with latest VoC data on a schedule.
                        Active and Inactive personas are never changed.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={personaRefreshEnabled}
                        onChange={(e) => setPersonaRefreshEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {personaRefreshEnabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                        Refresh Interval (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={personaRefreshDays}
                        onChange={(e) => setPersonaRefreshDays(Number(e.target.value))}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Personas will be refreshed every {personaRefreshDays} day(s)
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleSavePersonaRefreshSettings}
                    disabled={savingPersonaRefresh}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingPersonaRefresh ? 'Saving...' : 'Save Refresh Settings'}
                  </button>

                  {lastRefreshDate && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Last refresh: {new Date(lastRefreshDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Theme Auto-Refresh Settings */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Roadmap Auto-Refresh</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Automatically refresh your product roadmap based on latest customer feedback</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Enable Auto-Refresh</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Automatically regenerate your product roadmap from customer feedback with AI-powered prioritization.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={themeRefreshEnabled}
                        onChange={(e) => setThemeRefreshEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {themeRefreshEnabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                        Refresh Interval (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={themeRefreshDays}
                        onChange={(e) => setThemeRefreshDays(Number(e.target.value))}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Themes will be refreshed every {themeRefreshDays} day(s)
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleSaveThemeRefreshSettings}
                    disabled={savingThemeRefresh}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-purple-800 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingThemeRefresh ? 'Saving...' : 'Save Refresh Settings'}
                  </button>

                  {lastThemeRefreshDate && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Last refresh: {new Date(lastThemeRefreshDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Knowledge Source Auto-Refresh Settings */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Knowledge Source Auto-Refresh</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Automatically refresh knowledge sources to extract latest capabilities on a schedule</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Enable Auto-Refresh
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Automatically re-extract capabilities from all knowledge sources on a schedule
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={knowledgeRefreshEnabled}
                        onChange={(e) => setKnowledgeRefreshEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                    </label>
                  </div>

                  {knowledgeRefreshEnabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                        Refresh Interval (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={knowledgeRefreshDays}
                        onChange={(e) => setKnowledgeRefreshDays(Number(e.target.value))}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Knowledge sources will be refreshed every {knowledgeRefreshDays} day(s)
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleSaveKnowledgeRefreshSettings}
                    disabled={savingKnowledgeRefresh}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 dark:disabled:bg-green-800 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingKnowledgeRefresh ? 'Saving...' : 'Save Refresh Settings'}
                  </button>

                  {lastKnowledgeRefreshDate && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Last refresh: {new Date(lastKnowledgeRefreshDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Team Management Tab */}
          {activeTab === 'team' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage users in your organization</p>
                </div>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              </div>

              {loadingTeam ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 dark:text-gray-400">Loading team members...</div>
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">No team members yet</p>
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Add First User
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {teamMembers.map((member: any) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {member.full_name || 'No name'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {member.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded ${
                              member.role === 'TENANT_ADMIN'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {member.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded ${
                              member.is_active
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {member.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {member.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(member.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-700"
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

              {/* Add User Modal */}
              {showAddUserModal && (
                <AddUserModal
                  onClose={() => setShowAddUserModal(false)}
                  onAdd={handleAddUser}
                />
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

// Add User Modal Component
function AddUserModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: any) => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'USER'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAdd(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add Team Member</h2>

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
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
