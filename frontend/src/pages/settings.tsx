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
import { Loading } from '@/components/PageContainer'
import { User, Shield, Bot, Eye, EyeOff, ChevronDown, RefreshCw, Users, Plus, Trash2, Mail, Clock, CheckCircle, XCircle, Send, AlertCircle, Copy, Check, Key, MessageSquare, Volume2, Database } from 'lucide-react'

type Tab = 'profile' | 'security' | 'notifications' | 'llm' | 'data_refresh' | 'team' | 'chat' | 'speech' | 'data_controls'
type LLMProvider = 'openai' | 'anthropic' | 'azure_openai' | 'aws_bedrock' | 'google_gemini' | 'groq' | 'mistral' | 'cohere' | 'together_ai' | 'ollama' | 'deepseek' | 'xai' | 'openrouter'
type AWSAuthMethod = 'api_key' | 'credentials'

// Providers that have native embedding support in embedding_service.py.
// Anthropic and Google Gemini have no embedding API — the system falls back to
// local sentence_transformers which uses different vector dimensions and will
// silently break LightRAG semantic search if an existing tenant switches to them.
const EMBEDDING_SUPPORTED: LLMProvider[] = ['openai', 'azure_openai', 'aws_bedrock']

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
  ollama_base_url?: string
  [key: string]: any
}

interface ModelOptions {
  openai_models: string[]
  openai_embedding_models: string[]
  anthropic_models: string[]
  aws_bedrock_models: string[]
  aws_regions: string[]
  google_gemini_models: string[]
  groq_models: string[]
  mistral_models: string[]
  cohere_models: string[]
  together_ai_models: string[]
  deepseek_models: string[]
  xai_models: string[]
  openrouter_models: string[]
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
      if (['profile', 'security', 'notifications', 'llm', 'data_refresh', 'team', 'chat', 'speech', 'data_controls'].includes(tabParam)) {
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

  // Knowledge source refresh state
  const [knowledgeRefreshEnabled, setKnowledgeRefreshEnabled] = useState(false)
  const [knowledgeRefreshDays, setKnowledgeRefreshDays] = useState(7)
  const [integrationSyncMinutes, setIntegrationSyncMinutes] = useState(5)
  const [dedupIntervalHours, setDedupIntervalHours] = useState(24)
  const [defaultRetentionPolicy, setDefaultRetentionPolicy] = useState('30_days_encrypted')
  const [lastKnowledgeRefreshDate, setLastKnowledgeRefreshDate] = useState<string | null>(null)
  const [savingKnowledgeRefresh, setSavingKnowledgeRefresh] = useState(false)

  // Graph extraction settings state
  type EntityEntry = { name: string; definition: string | null }
  const DEFAULT_ENTITY_TYPES: EntityEntry[] = [
    { name: 'Person', definition: 'An individual human identified by name, role, or relationship to the team or product.' },
    { name: 'Organization', definition: 'A company, institution, or group that acts as a customer, partner, or stakeholder.' },
    { name: 'Product', definition: 'A software product, service, or platform being built, sold, or evaluated.' },
    { name: 'Feature', definition: 'A specific capability or function of a product, requested or already implemented.' },
    { name: 'PainPoint', definition: 'A problem, frustration, or obstacle experienced by a customer or user.' },
    { name: 'FeatureRequest', definition: 'An explicit ask from a customer or stakeholder for a new or changed product capability.' },
    { name: 'Persona', definition: 'A named archetype representing a segment of users or buyers with shared goals and behaviours.' },
    { name: 'Competitor', definition: 'A company or product competing in the same market space.' },
    { name: 'BusinessGoal', definition: 'A strategic objective or KPI the team or company is working toward.' },
    { name: 'Metric', definition: 'A quantitative measure used to track performance, usage, or health of a product or team.' },
    { name: 'Decision', definition: 'A resolved choice made by the team with documented reasoning and tradeoffs.' },
    { name: 'Meeting', definition: 'A recorded synchronous interaction between team members or with customers.' },
    { name: 'Project', definition: 'An active initiative or workstream with defined scope and milestones.' },
    { name: 'Technology', definition: 'A tool, framework, language, or infrastructure component used or evaluated.' },
    { name: 'Market', definition: 'A target customer segment, vertical, or geographic region the product serves.' },
    { name: 'Task', definition: 'A unit of work or action item assigned to a person or team.' },
  ]
  const DEFAULT_ENTITY_ATTRIBUTES: EntityEntry[] = [
    { name: 'sentiment', definition: 'Emotional tone toward the entity: positive, neutral, or negative.' },
    { name: 'urgency', definition: 'How time-sensitive the mention is: low, medium, or high.' },
    { name: 'business_impact', definition: 'Estimated impact on business outcomes: low, medium, or high.' },
    { name: 'context_snippet', definition: 'A short verbatim quote from the source text that best captures this entity.' },
    { name: 'confidence', definition: 'Extraction confidence score between 0 and 1.' },
  ]
  const [entityTypes, setEntityTypes] = useState<EntityEntry[]>(DEFAULT_ENTITY_TYPES)
  const [entityAttributes, setEntityAttributes] = useState<EntityEntry[]>(DEFAULT_ENTITY_ATTRIBUTES)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeDefinition, setNewTypeDefinition] = useState('')
  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrDefinition, setNewAttrDefinition] = useState('')
  const [editingType, setEditingType] = useState<string | null>(null)
  const [editingAttr, setEditingAttr] = useState<string | null>(null)
  const [loadingGraphExtraction, setLoadingGraphExtraction] = useState(false)
  const [savingGraphExtraction, setSavingGraphExtraction] = useState(false)

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
      loadKnowledgeRefreshSettings()
      loadGraphExtractionSettings()
    } else if (activeTab === 'team') {
      loadTeamMembers()
      loadInvites()
    } else if (activeTab === 'security') {
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
        setLLMConfig({ provider: 'anthropic', api_key: '', model: 'claude-sonnet-4-6' })
        break
      case 'azure_openai':
        setLLMConfig({ provider: 'azure_openai', api_key: '', endpoint: '', deployment_name: '', api_version: '2024-02-01' })
        break
      case 'aws_bedrock':
        setAwsAuthMethod('api_key')
        setLLMConfig({ provider: 'aws_bedrock', aws_auth_method: 'api_key', api_key: '', aws_region: 'us-east-1', model: 'global.anthropic.claude-sonnet-4-6' })
        break
      case 'google_gemini':
        setLLMConfig({ provider: 'google_gemini', api_key: '', model: 'gemini-2.5-flash', temperature: 0.7, top_p: 0.95, top_k: 40 })
        break
      case 'groq':
        setLLMConfig({ provider: 'groq', api_key: '', model: 'llama-3.3-70b-versatile' })
        break
      case 'mistral':
        setLLMConfig({ provider: 'mistral', api_key: '', model: 'mistral-large-latest' })
        break
      case 'cohere':
        setLLMConfig({ provider: 'cohere', api_key: '', model: 'command-r-plus' })
        break
      case 'together_ai':
        setLLMConfig({ provider: 'together_ai', api_key: '', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' })
        break
      case 'ollama':
        setLLMConfig({ provider: 'ollama', model: 'llama3.2', ollama_base_url: 'http://localhost:11434' })
        break
      case 'deepseek':
        setLLMConfig({ provider: 'deepseek', api_key: '', model: 'deepseek/deepseek-v3.2' })
        break
      case 'xai':
        setLLMConfig({ provider: 'xai', api_key: '', model: 'xai/grok-4' })
        break
      case 'openrouter':
        setLLMConfig({ provider: 'openrouter', api_key: '', model: 'openrouter/deepseek/deepseek-r1' })
        break
    }
  }

  const getDefaultModel = (provider: LLMProvider) => {
    switch (provider) {
      case 'openai': return 'gpt-5.4'
      case 'anthropic': return 'claude-sonnet-4-6'
      case 'azure_openai': return ''
      case 'aws_bedrock': return 'global.anthropic.claude-sonnet-4-6'
      case 'google_gemini': return 'gemini-2.5-flash'
      case 'groq': return 'llama-3.3-70b-versatile'
      case 'mistral': return 'mistral-large-latest'
      case 'cohere': return 'command-r-plus'
      case 'together_ai': return 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
      case 'ollama': return 'llama3.2'
      case 'deepseek': return 'deepseek/deepseek-v3.2'
      case 'xai': return 'xai/grok-4'
      case 'openrouter': return 'openrouter/deepseek/deepseek-r1'
      default: return ''
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
    if (llmProvider === 'ollama') {
      return !!llmConfig.ollama_base_url && !!llmConfig.model
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

  const loadKnowledgeRefreshSettings = async () => {
    try {
      const response = await api.getKnowledgeRefreshSettings()
      setKnowledgeRefreshEnabled(response.data.enabled)
      setKnowledgeRefreshDays(response.data.interval_days)
      setIntegrationSyncMinutes(response.data.integration_sync_interval_minutes ?? 5)
      setDedupIntervalHours(response.data.dedup_interval_hours ?? 24)
      setDefaultRetentionPolicy(response.data.default_retention_policy ?? '30_days_encrypted')
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
        integration_sync_interval_minutes: Math.max(5, integrationSyncMinutes),
        dedup_interval_hours: Math.max(1, dedupIntervalHours),
        default_retention_policy: defaultRetentionPolicy,
      })
      await loadKnowledgeRefreshSettings()
      alert('Refresh settings saved successfully!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSavingKnowledgeRefresh(false)
    }
  }

  const loadGraphExtractionSettings = async () => {
    try {
      setLoadingGraphExtraction(true)
      const response = await api.getGraphExtractionSettings()
      if (response.data.entity_types?.length) setEntityTypes(response.data.entity_types)
      if (response.data.entity_attributes?.length) setEntityAttributes(response.data.entity_attributes)
    } catch (error) {
      console.error('Failed to load graph extraction settings:', error)
      // Keep defaults already in state — do not zero out
    } finally {
      setLoadingGraphExtraction(false)
    }
  }

  const handleSaveGraphExtractionSettings = async () => {
    // Auto-commit any pending entry in the add-row inputs before saving
    const pendingTypeName = newTypeName.trim()
    const finalEntityTypes =
      pendingTypeName && !entityTypes.some((t) => t.name === pendingTypeName)
        ? [...entityTypes, { name: pendingTypeName, definition: newTypeDefinition.trim() || null }]
        : entityTypes

    const pendingAttrName = newAttrName.trim()
    const finalEntityAttributes =
      pendingAttrName && !entityAttributes.some((a) => a.name === pendingAttrName)
        ? [...entityAttributes, { name: pendingAttrName, definition: newAttrDefinition.trim() || null }]
        : entityAttributes

    try {
      setSavingGraphExtraction(true)
      await api.updateGraphExtractionSettings({
        entity_types: finalEntityTypes,
        entity_attributes: finalEntityAttributes,
      })
      // Sync state so UI reflects what was actually saved
      setEntityTypes(finalEntityTypes)
      setEntityAttributes(finalEntityAttributes)
      setNewTypeName('')
      setNewTypeDefinition('')
      setNewAttrName('')
      setNewAttrDefinition('')
      alert('Graph extraction settings saved. Changes apply on the next ingestion or manual sync.')
    } catch (error: any) {
      console.error('Failed to save graph extraction settings:', error)
      alert(`Failed to save: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSavingGraphExtraction(false)
    }
  }

  const addEntityType = () => {
    const name = newTypeName.trim()
    if (!name || entityTypes.some((t) => t.name === name)) return
    setEntityTypes([...entityTypes, { name, definition: newTypeDefinition.trim() || null }])
    setNewTypeName('')
    setNewTypeDefinition('')
  }

  const addEntityAttribute = () => {
    const name = newAttrName.trim()
    if (!name || entityAttributes.some((a) => a.name === name)) return
    setEntityAttributes([...entityAttributes, { name, definition: newAttrDefinition.trim() || null }])
    setNewAttrName('')
    setNewAttrDefinition('')
  }

  const updateEntityTypeDefinition = (typeName: string, definition: string) => {
    setEntityTypes(entityTypes.map((t) => t.name === typeName ? { ...t, definition: definition || null } : t))
  }

  const updateEntityAttributeDefinition = (attrName: string, definition: string) => {
    setEntityAttributes(entityAttributes.map((a) => a.name === attrName ? { ...a, definition: definition || null } : a))
  }

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
    if (!confirm(`Revoke "${keyName}"? Any agent using this key will stop working immediately.`)) return
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
    <>
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
            <div className="max-w-2xl space-y-8">
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

              {/* API Keys */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg text-heading">API Keys</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Long-lived keys for the Evols CLI. Configure once in{' '}
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
                  <Loading text="Loading keys..." />
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
              <p className="text-muted-foreground mb-6">BYOK — Bring Your Own Keys. API keys are encrypted at rest.</p>

              {currentLLMSettings && (
                <div className="mb-6 p-4 bg-chart-3/10 border border-chart-3/30 rounded-lg">
                  <p className="text-sm text-chart-3 mb-2">✓ Current Configuration</p>
                  <p className="text-sm text-chart-3"><strong>Provider:</strong> {currentLLMSettings.provider}</p>
                  <p className="text-sm text-chart-3"><strong>Model:</strong> {currentLLMSettings.model}</p>
                  {currentLLMSettings.api_key_masked && <p className="text-sm text-chart-3"><strong>Key:</strong> {currentLLMSettings.api_key_masked}</p>}
                </div>
              )}

              {/* Provider selector */}
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
                    <option value="groq">Groq</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="cohere">Cohere</option>
                    <option value="together_ai">Together AI</option>
                    <option value="ollama">Ollama (Local)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="xai">xAI (Grok)</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Embedding warning for providers without native embedding support */}
              {!EMBEDDING_SUPPORTED.includes(llmProvider) && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    <strong>⚠ Limited embedding support:</strong> {({'anthropic': 'Anthropic', 'google_gemini': 'Google Gemini', 'groq': 'Groq', 'mistral': 'Mistral', 'cohere': 'Cohere', 'together_ai': 'Together AI', 'deepseek': 'DeepSeek', 'xai': 'xAI', 'openrouter': 'OpenRouter', 'ollama': 'Ollama'} as Record<string, string>)[llmProvider] ?? llmProvider} does not provide an embeddings API compatible with Evols.
                    Evols will fall back to a local sentence-transformers model for semantic search, which uses a different vector dimension than OpenAI or Bedrock.
                    If you have existing knowledge data indexed under a different provider, switching here will break semantic search until you re-index.
                    For full embedding support, use OpenAI, Azure OpenAI, or AWS Bedrock.
                  </p>
                </div>
              )}

              {/* OpenAI */}
              {llmProvider === 'openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="sk-..."
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('openai')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.openai_models ?? ['gpt-5.4', 'gpt-5.2', 'gpt-4o', 'gpt-4o-mini']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Embedding Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.embedding_model || 'text-embedding-3-large'}
                        onChange={(e) => setLLMConfig({ ...llmConfig, embedding_model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.openai_embedding_models ?? ['text-embedding-3-large', 'text-embedding-3-small']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Used by LightRAG for semantic search over your team knowledge.</p>
                  </div>
                </div>
              )}

              {/* Anthropic */}
              {llmProvider === 'anthropic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="sk-ant-..."
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('anthropic')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.anthropic_models ?? ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Azure OpenAI */}
              {llmProvider === 'azure_openai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Azure OpenAI key"
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Endpoint URL *</label>
                    <input
                      type="text"
                      placeholder="https://your-resource.openai.azure.com"
                      value={llmConfig.endpoint || ''}
                      onChange={(e) => setLLMConfig({ ...llmConfig, endpoint: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Chat Deployment Name *</label>
                    <input
                      type="text"
                      placeholder="gpt-4o"
                      value={llmConfig.deployment_name || ''}
                      onChange={(e) => setLLMConfig({ ...llmConfig, deployment_name: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Embedding Deployment Name</label>
                    <input
                      type="text"
                      placeholder="text-embedding-3-large"
                      value={llmConfig.embedding_deployment || ''}
                      onChange={(e) => setLLMConfig({ ...llmConfig, embedding_deployment: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Used by LightRAG for semantic search. Leave blank to use the same deployment as chat.</p>
                  </div>
                </div>
              )}

              {/* AWS Bedrock */}
              {llmProvider === 'aws_bedrock' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-3 text-foreground">Authentication Method</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="aws_auth_method" value="api_key" checked={awsAuthMethod === 'api_key'} onChange={(e) => handleAWSAuthMethodChange(e.target.value as AWSAuthMethod)} className="w-4 h-4 text-primary focus:ring-ring/50" />
                        <span className="text-sm text-foreground">API Key</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="aws_auth_method" value="credentials" checked={awsAuthMethod === 'credentials'} onChange={(e) => handleAWSAuthMethodChange(e.target.value as AWSAuthMethod)} className="w-4 h-4 text-primary focus:ring-ring/50" />
                        <span className="text-sm text-foreground">IAM Credentials</span>
                      </label>
                    </div>
                  </div>

                  {awsAuthMethod === 'api_key' && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">API Key *</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="AWS Bedrock API key"
                          value={llmConfig.api_key || ''}
                          onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                        />
                        <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {awsAuthMethod === 'credentials' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">Access Key ID *</label>
                        <input
                          type="text"
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          value={llmConfig.aws_access_key_id || ''}
                          onChange={(e) => setLLMConfig({ ...llmConfig, aws_access_key_id: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">Secret Access Key *</label>
                        <div className="relative">
                          <input
                            type={showSecretKey ? 'text' : 'password'}
                            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                            value={llmConfig.aws_secret_access_key || ''}
                            onChange={(e) => setLLMConfig({ ...llmConfig, aws_secret_access_key: e.target.value })}
                            className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                          />
                          <button onClick={() => setShowSecretKey(!showSecretKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Region</label>
                    <div className="relative">
                      <select
                        value={llmConfig.aws_region || 'us-east-1'}
                        onChange={(e) => setLLMConfig({ ...llmConfig, aws_region: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.aws_regions ?? ['us-east-1', 'us-west-2', 'eu-west-1']).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('aws_bedrock')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.aws_bedrock_models ?? ['global.anthropic.claude-sonnet-4-6']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Embeddings use Amazon Titan (amazon.titan-embed-text-v2:0) automatically.</p>
                  </div>
                </div>
              )}

              {/* Google Gemini */}
              {llmProvider === 'google_gemini' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Google AI Studio API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="AIza..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('google_gemini')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.google_gemini_models ?? ['gemini-2.5-flash', 'gemini-1.5-pro']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-muted-foreground">Temperature</label>
                      <input type="number" min="0" max="1" step="0.1" value={llmConfig.temperature ?? 0.7} onChange={(e) => setLLMConfig({ ...llmConfig, temperature: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring" />
                      <p className="mt-1 text-xs text-muted-foreground">0.0 = deterministic</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-muted-foreground">Top-P</label>
                      <input type="number" min="0" max="1" step="0.05" value={llmConfig.top_p ?? 0.95} onChange={(e) => setLLMConfig({ ...llmConfig, top_p: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-muted-foreground">Top-K</label>
                      <input type="number" min="1" max="100" step="1" value={llmConfig.top_k ?? 40} onChange={(e) => setLLMConfig({ ...llmConfig, top_k: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring" />
                    </div>
                  </div>
                </div>
              )}

              {/* Groq */}
              {llmProvider === 'groq' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Groq API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="gsk_..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Groq Console</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('groq')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.groq_models ?? ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Mistral AI */}
              {llmProvider === 'mistral' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Mistral API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://console.mistral.ai/api-keys/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mistral Console</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('mistral')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.mistral_models ?? ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-nemo']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Cohere */}
              {llmProvider === 'cohere' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Cohere API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://dashboard.cohere.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Cohere Dashboard</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('cohere')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.cohere_models ?? ['command-r-plus', 'command-r', 'command-light']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Together AI */}
              {llmProvider === 'together_ai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Together AI API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://api.together.ai/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Together AI Settings</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('together_ai')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.together_ai_models ?? ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* DeepSeek */}
              {llmProvider === 'deepseek' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">DeepSeek API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">DeepSeek Platform</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('deepseek')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.deepseek_models ?? ['deepseek/deepseek-v3.2', 'deepseek/deepseek-r1', 'deepseek/deepseek-reasoner']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">deepseek-r1 / deepseek-reasoner are reasoning models with longer response times</p>
                  </div>
                </div>
              )}

              {/* xAI (Grok) */}
              {llmProvider === 'xai' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">xAI API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="xai-..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">xAI Console</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('xai')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.xai_models ?? ['xai/grok-4', 'xai/grok-3', 'xai/grok-3-mini']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* OpenRouter */}
              {llmProvider === 'openrouter' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      OpenRouter gives access to 200+ models (DeepSeek, Qwen, Llama, Phi, Mistral, and more) through a single API key.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">OpenRouter API Key *</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmConfig.api_key || ''}
                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                        placeholder="sk-or-..."
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenRouter Keys</a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
                    <div className="relative">
                      <select
                        value={llmConfig.model || getDefaultModel('openrouter')}
                        onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      >
                        {(modelOptions?.openrouter_models ?? ['openrouter/deepseek/deepseek-r1', 'openrouter/meta-llama/llama-3.3-70b-instruct']).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Any model on <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openrouter.ai/models</a> can be entered manually if not listed</p>
                  </div>
                </div>
              )}

              {/* Ollama (Local) */}
              {llmProvider === 'ollama' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Ollama runs models locally. Make sure Ollama is installed and running on the configured base URL before saving.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Ollama Base URL *</label>
                    <input
                      type="text"
                      value={llmConfig.ollama_base_url || 'http://localhost:11434'}
                      onChange={(e) => setLLMConfig({ ...llmConfig, ollama_base_url: e.target.value })}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">URL where Ollama is running (default: http://localhost:11434)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Model *</label>
                    <input
                      type="text"
                      value={llmConfig.model || 'llama3.2'}
                      onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                      placeholder="llama3.2"
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Name of a model you have pulled locally (e.g. llama3.2, mistral, phi3)</p>
                  </div>
                </div>
              )}

              {testResult && (
                <div className={`mt-4 p-4 rounded-lg border ${testResult.success ? 'bg-chart-3/10 border-chart-3/30' : 'bg-destructive/10 border-destructive/30'}`}>
                  <p className={`text-sm ${testResult.success ? 'text-chart-3' : 'text-destructive'}`}>
                    {testResult.success ? '✓' : '✗'} {testResult.message}
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button onClick={handleTestLLMConnection} disabled={testing || !isConfigValid()} className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button onClick={handleSaveLLMSettings} disabled={saving || !isConfigValid()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/85 disabled:bg-primary/40 dark:disabled:bg-primary/40 disabled:cursor-not-allowed transition-colors">
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                {currentLLMSettings && (
                  <button onClick={handleDeleteLLMSettings} className="px-4 py-2 bg-destructive text-primary-foreground rounded-md hover:bg-destructive/85 transition-colors">
                    Remove Configuration
                  </button>
                )}
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
                        checked={knowledgeRefreshEnabled}
                        onChange={(e) => setKnowledgeRefreshEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ring/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {knowledgeRefreshEnabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Re-index Interval (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={knowledgeRefreshDays}
                        onChange={(e) => setKnowledgeRefreshDays(Number(e.target.value))}
                        className="w-32 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Uploaded sources will be re-indexed every {knowledgeRefreshDays} day(s)
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Live Integration Sync Interval (Minutes)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={integrationSyncMinutes}
                      onChange={(e) => setIntegrationSyncMinutes(Math.max(5, Number(e.target.value)))}
                      className="w-32 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Slack, Outlook, Teams, Notion, and other live integrations sync every {integrationSyncMinutes} minute(s). Minimum 5 minutes.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Entity Dedup & Resolution Interval (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={dedupIntervalHours}
                      onChange={(e) => setDedupIntervalHours(Math.max(1, Number(e.target.value)))}
                      className="w-32 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Resolves duplicate entities, merges similar names, and refreshes confidence scores every {dedupIntervalHours} hour(s). Minimum 1 hour. High-volume teams may set this lower.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Raw Data Retention Policy
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Applies to all data sources — uploaded documents and live integrations (Slack, Outlook, GitHub, etc.). The extracted knowledge graph is always kept; this controls how long the original raw text is stored.
                    </p>
                    <div className="space-y-2">
                      {[
                        {
                          value: 'delete_immediately',
                          label: '🔒 Delete immediately',
                          description: 'Raw text deleted as soon as LightRAG finishes extraction. Maximum privacy.',
                        },
                        {
                          value: '30_days_encrypted',
                          label: '🔐 30 days — encrypted',
                          description: 'Raw text kept for 30 days, AES-256 encrypted at rest, then auto-deleted. Recommended for SOC 2 / GDPR.',
                          recommended: true,
                        },
                        {
                          value: '90_days_encrypted',
                          label: '🔐 90 days — encrypted',
                          description: 'Raw text kept for 90 days, AES-256 encrypted at rest, then auto-deleted.',
                        },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            defaultRetentionPolicy === option.value
                              ? 'border-ring bg-primary/5 dark:bg-primary/10'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          <input
                            type="radio"
                            name="defaultRetentionPolicy"
                            value={option.value}
                            checked={defaultRetentionPolicy === option.value}
                            onChange={() => setDefaultRetentionPolicy(option.value)}
                            className="mt-0.5 accent-primary"
                          />
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              {option.label}
                              {option.recommended && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-chart-3/15 text-chart-3 font-medium">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveKnowledgeRefreshSettings}
                    disabled={savingKnowledgeRefresh}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/85 disabled:bg-primary/40 dark:disabled:bg-primary/40 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingKnowledgeRefresh ? 'Saving...' : 'Save Refresh Settings'}
                  </button>

                  {lastKnowledgeRefreshDate && (
                    <p className="text-sm text-muted-foreground">
                      Last refresh: {new Date(lastKnowledgeRefreshDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Knowledge Graph Extraction */}
              <div className="mt-10 pt-8 border-t border-border">
                <h3 className="text-lg mb-1 text-foreground">Knowledge Graph Extraction</h3>
                <p className="text-muted-foreground mb-6">
                  Customise the entity types and attributes LightRAG extracts from your data.
                  Definitions are injected into the AI extraction prompt — the more precise the definition,
                  the better the extraction quality and confidence score.
                  Remove types that don't apply to your business or add new ones specific to your domain.
                </p>

                {loadingGraphExtraction ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Loading extraction settings…
                  </div>
                ) : null}

                <div className={`space-y-10 ${loadingGraphExtraction ? 'opacity-50 pointer-events-none' : ''}`}>
                  {/* Entity Types */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="block text-sm font-medium text-foreground">Entity types</label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Types the LLM will recognise and extract. Pre-populated with Evols defaults — remove, edit, or add your own.
                        </p>
                      </div>
                    </div>
                    <div className="border border-border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-36">Name</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Definition (injected into extraction prompt)</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {entityTypes.map((t) => (
                            <tr key={t.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{t.name}</td>
                              <td className="px-3 py-1.5">
                                {editingType === t.name ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    defaultValue={t.definition ?? ''}
                                    onBlur={(e) => { updateEntityTypeDefinition(t.name, e.target.value); setEditingType(null) }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { updateEntityTypeDefinition(t.name, (e.target as HTMLInputElement).value); setEditingType(null) }
                                      if (e.key === 'Escape') setEditingType(null)
                                    }}
                                    className="w-full px-2 py-1 border border-ring rounded bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                                  />
                                ) : (
                                  <span
                                    className="block text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1 min-h-[1.75rem]"
                                    onClick={() => setEditingType(t.name)}
                                    title="Click to edit definition"
                                  >
                                    {t.definition || <span className="italic text-muted-foreground/50">Click to add definition…</span>}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={() => setEntityTypes(entityTypes.filter((x) => x.name !== t.name))}
                                  className="text-muted-foreground hover:text-destructive transition-colors text-base leading-none"
                                  aria-label={`Remove ${t.name}`}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntityType() } }}
                                placeholder="New type name"
                                className="w-full px-2 py-1 border border-border rounded bg-input text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={newTypeDefinition}
                                onChange={(e) => setNewTypeDefinition(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntityType() } }}
                                placeholder="One-line definition (optional but recommended)"
                                className="w-full px-2 py-1 border border-border rounded bg-input text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={addEntityType}
                                disabled={!newTypeName.trim()}
                                className="text-primary hover:text-primary/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none font-light"
                                aria-label="Add entity type"
                              >
                                +
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Entity Attributes */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="block text-sm font-medium text-foreground">Entity attributes</label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Per-entity fields the LLM will extract as structured metadata. Stored as a JSON block inside each entity description.
                        </p>
                      </div>
                    </div>
                    <div className="border border-border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-36">Attribute key</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Definition (helps the LLM understand what to extract)</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {entityAttributes.map((a) => (
                            <tr key={a.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 font-mono text-foreground whitespace-nowrap">{a.name}</td>
                              <td className="px-3 py-1.5">
                                {editingAttr === a.name ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    defaultValue={a.definition ?? ''}
                                    onBlur={(e) => { updateEntityAttributeDefinition(a.name, e.target.value); setEditingAttr(null) }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { updateEntityAttributeDefinition(a.name, (e.target as HTMLInputElement).value); setEditingAttr(null) }
                                      if (e.key === 'Escape') setEditingAttr(null)
                                    }}
                                    className="w-full px-2 py-1 border border-ring rounded bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                                  />
                                ) : (
                                  <span
                                    className="block text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1 min-h-[1.75rem]"
                                    onClick={() => setEditingAttr(a.name)}
                                    title="Click to edit definition"
                                  >
                                    {a.definition || <span className="italic text-muted-foreground/50">Click to add definition…</span>}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={() => setEntityAttributes(entityAttributes.filter((x) => x.name !== a.name))}
                                  className="text-muted-foreground hover:text-destructive transition-colors text-base leading-none"
                                  aria-label={`Remove ${a.name}`}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={newAttrName}
                                onChange={(e) => setNewAttrName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntityAttribute() } }}
                                placeholder="New attribute key"
                                className="w-full px-2 py-1 border border-border rounded bg-input text-foreground font-mono text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={newAttrDefinition}
                                onChange={(e) => setNewAttrDefinition(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntityAttribute() } }}
                                placeholder="One-line definition (optional but recommended)"
                                className="w-full px-2 py-1 border border-border rounded bg-input text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={addEntityAttribute}
                                disabled={!newAttrName.trim()}
                                className="text-primary hover:text-primary/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none font-light"
                                aria-label="Add entity attribute"
                              >
                                +
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveGraphExtractionSettings}
                    disabled={savingGraphExtraction}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/85 disabled:bg-primary/40 dark:disabled:bg-primary/40 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingGraphExtraction ? 'Saving...' : 'Save Extraction Settings'}
                  </button>
                </div>
              </div>
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
                    <Loading text="Loading team members..." />
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
                    <Loading text="Loading invitations..." />
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

      {/* Invite Modal — rendered outside .card to avoid backdrop-filter stacking context clipping fixed position */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false)
            loadInvites()
          }}
        />
      )}
    </>
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

