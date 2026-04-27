import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  Sparkles, MessageSquare, ArrowRight, Zap, Save, RotateCcw,
  Eye, Edit3
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'
import { sanitizePreviewContent } from '@/utils/security'

interface Skill {
  name: string
  description: string
  category: string
  has_customization: boolean
}

interface SkillCustomization {
  id: number
  skill_name: string
  custom_instructions?: string
  custom_context?: string
  output_format_preferences?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function Skills() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [customizations, setCustomizations] = useState<SkillCustomization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewingSkill, setViewingSkill] = useState<any>(null)
  const [loadingSkillDetails, setLoadingSkillDetails] = useState(false)

  // Customization modal state
  const [editingSkill, setEditingSkill] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState({
    custom_context: '',
    custom_instructions: '',
    output_format_preferences: ''
  })
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      setError('')
      const [skillsResponse, customizationsResponse] = await Promise.all([
        api.skillCustomizations.getAvailableSkills(),
        api.skillCustomizations.getCustomizations()
      ])
      setSkills(skillsResponse.data)
      setCustomizations(customizationsResponse.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const openInWorkbench = (skillName: string) => {
    // Convert skill name to URL-friendly format (lowercase, replace spaces with underscores)
    const skillSlug = skillName.toLowerCase().replace(/\s+/g, '_')
    router.push(`/workbench?skill=${skillSlug}`)
  }

  const viewSkillDetails = async (skillName: string) => {
    setLoadingSkillDetails(true)
    try {
      const response = await api.get(`/copilot/skills/${skillName}`)
      setViewingSkill(response.data)
    } catch (err: any) {
      alert(`Failed to load skill details: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoadingSkillDetails(false)
    }
  }

  const openCustomizationEditor = async (skillName: string) => {
    setEditingSkill(skillName)
    setShowPreview(false)

    // Load existing customization if it exists
    try {
      const response = await api.skillCustomizations.getCustomization(skillName)
      if (response.data) {
        setFormData({
          custom_context: response.data.custom_context || '',
          custom_instructions: response.data.custom_instructions || '',
          output_format_preferences: response.data.output_format_preferences || ''
        })
      } else {
        resetForm()
      }
    } catch (err) {
      // No existing customization, start fresh
      resetForm()
    }
  }

  const resetForm = () => {
    setFormData({
      custom_context: '',
      custom_instructions: '',
      output_format_preferences: ''
    })
  }

  const previewCustomization = async () => {
    if (!editingSkill) return

    setPreviewing(true)
    try {
      const response = await api.skillCustomizations.previewCustomization(editingSkill, {
        skill_name: editingSkill,
        ...formData
      })
      setPreviewData(response.data)
      setShowPreview(true)
    } catch (err: any) {
      alert(`Preview failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setPreviewing(false)
    }
  }

  const saveCustomization = async () => {
    if (!editingSkill) return

    setSaving(true)
    try {
      await api.skillCustomizations.createCustomization({
        skill_name: editingSkill,
        ...formData
      })

      // Reload data to update the UI
      await loadData()

      // Close editor
      setEditingSkill(null)
      setShowPreview(false)
    } catch (err: any) {
      alert(`Save failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const resetCustomization = async () => {
    if (!editingSkill) return

    if (!confirm(`Reset "${editingSkill}" to default? This will remove all customizations.`)) {
      return
    }

    try {
      await api.skillCustomizations.deleteCustomization(editingSkill)
      await loadData()
      setEditingSkill(null)
      setShowPreview(false)
    } catch (err: any) {
      alert(`Reset failed: ${err.response?.data?.detail || err.message}`)
    }
  }

  const getSkillCustomization = (skillName: string): SkillCustomization | null => {
    return customizations.find(c => c.skill_name === skillName) || null
  }


  return (
    <>
      <Head>
        <title>Skills - Evols</title>
      </Head>

      <div className="min-h-screen">
        <Header user={user} currentPage="skills" />

        {loading ? (
          <PageContainer>
            <Loading />
          </PageContainer>
        ) : (
          <PageContainer>
        <PageHeader
          title="AI Skills"
          description="Expert-curated skills to help streamline daily tasks"
          icon={Zap}
        />

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-destructive dark:text-destructive">{error}</p>
          </div>
        )}

        {skills.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No skills available"
            description="Contact your administrator to set up skills"
          />
        ) : (
          <>
            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              {(() => {
                // Generate categories dynamically from skills data
                const categoryMap = new Map()

                // Count skills per category
                skills.forEach((skill: Skill) => {
                  const category = skill.category
                  categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
                })

                // Create categories array
                const categories = [
                  { id: 'all', name: 'All Skills', count: skills.length }
                ]

                // Add dynamic categories with proper display names
                categoryMap.forEach((count, categoryId) => {
                  const displayName = categoryId
                    .split('-')
                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                    .replace('Os Infrastructure', 'Mechanisms')
                    .replace('Data Analytics', 'Data & Analytics')
                    .replace('Marketing Growth', 'Marketing & Growth')
                    .replace('Go To Market', 'Go-to-Market')
                    .replace('Market Research', 'Market Research')
                    .replace('Daily Discipline', 'Daily Discipline')

                  categories.push({
                    id: categoryId,
                    name: displayName,
                    count: count
                  })
                })

                // Sort categories alphabetically (except "All" which stays first)
                const sortedCategories = [
                  categories[0], // "All Skills"
                  ...categories.slice(1).sort((a, b) => a.name.localeCompare(b.name))
                ]

                return sortedCategories
              })().map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>

            {/* Skills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {skills.filter((skill: Skill) =>
                selectedCategory === 'all' || skill.category === selectedCategory
              ).map((skill: Skill) => {
                const customization = getSkillCustomization(skill.name)
                return (
                  <Card key={skill.name} hover onClick={() => viewSkillDetails(skill.name)}>
                    <div className="p-5">
                      {/* Icon & Name */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-3xl flex-shrink-0">⚡</div>
                        <h3 className="text-lg text-foreground leading-tight">
                          {skill.name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                        </h3>
                      </div>

                      {/* Description */}
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {skill.description}
                      </p>

                      {/* Category & Status Badges */}
                      <div className="flex items-center justify-between mb-4">
                        {skill.category && (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary capitalize">
                            {skill.category.replace(/-/g, ' ')}
                          </span>
                        )}
                        {customization ? (
                          <span className="px-2 py-1 text-xs rounded bg-chart-3/15 text-chart-3 whitespace-nowrap">
                            Custom
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground whitespace-nowrap">
                            Default
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openCustomizationEditor(skill.name)
                          }}
                          className="btn-secondary flex-1 justify-center"
                        >
                          <Edit3 className="w-4 h-4" />
                          Customize
                        </button>
                      </div>
                    </div>
                  </Card>
                )
              })}
          </div>
          </>
        )}

        {/* Quick Info */}
        <div className="mt-8 p-6 bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary dark:text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-foreground mb-1">
                How Skills Work
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Browse and select skills from this directory</li>
                <li>• Click "Open in Workbench" to start using a skill in your AI workspace</li>
                <li>• Each skill guides you with relevant questions and generates tailored recommendations</li>
                <li>• Continue the conversation naturally - you can invoke multiple skills as needed</li>
                <li>• All conversations are saved in Workbench history</li>
              </ul>
            </div>
          </div>
        </div>
          </PageContainer>
        )}
      </div>

      {/* Skill Details Modal */}
      {viewingSkill && !loadingSkillDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setViewingSkill(null)}>
          <div className="bg-card rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{viewingSkill.icon || '⚡'}</div>
                  <div>
                    <h2 className="text-2xl text-foreground mb-1">
                      {viewingSkill.name.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                    </h2>
                    {viewingSkill.category && (
                      <span className="inline-block px-2 py-1 text-xs rounded bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary capitalize">
                        {viewingSkill.category.replace(/-/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setViewingSkill(null)}
                  className="text-muted-foreground hover:text-foreground text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground mb-2">Description</h3>
                  <p className="text-muted-foreground">
                    {viewingSkill.description}
                  </p>
                </div>

                {viewingSkill.instructions && (
                  <div>
                    <h3 className="text-foreground mb-2">Instructions</h3>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 p-4 rounded-lg overflow-x-auto">
                      {viewingSkill.instructions}
                    </pre>
                  </div>
                )}

                {viewingSkill.tools && viewingSkill.tools.length > 0 && (
                  <div>
                    <h3 className="text-foreground mb-2">Available Tools</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewingSkill.tools.map((tool: string, i: number) => (
                        <span key={i} className="px-2 py-1 text-xs rounded bg-primary/10 text-primary dark:text-primary">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      setViewingSkill(null)
                      openInWorkbench(viewingSkill.name)
                    }}
                    className="btn-primary w-full justify-center"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Open in Workbench
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {loadingSkillDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg p-8">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-center text-muted-foreground">Loading skill details...</p>
          </div>
        </div>
      )}

      {/* Customization Editor Modal */}
      {editingSkill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setEditingSkill(null)}>
          <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <Edit3 className="w-6 h-6 text-primary dark:text-primary" />
                <h2 className="text-xl text-foreground">
                  Customize: {editingSkill.split(' ').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  ).join(' ')}
                </h2>
              </div>
              <button
                onClick={() => setEditingSkill(null)}
                className="text-muted-foreground hover:text-foreground text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {!showPreview ? (
                // Form View
                <div className="p-6 space-y-6">
                  {/* Custom Context */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Custom Context
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Tell the AI about your specific situation, company, or domain (e.g., "Our company is in fintech, focus on security and compliance")
                    </p>
                    <textarea
                      value={formData.custom_context}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_context: e.target.value }))}
                      placeholder="Add context about your company, role, or specific situation..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                  </div>

                  {/* Custom Instructions */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Custom Instructions
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Modify how the skill should behave or what it should focus on
                    </p>
                    <textarea
                      value={formData.custom_instructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_instructions: e.target.value }))}
                      placeholder="Add specific instructions for how this skill should work..."
                      rows={4}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                  </div>

                  {/* Output Format Preferences */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Output Format Preferences
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Specify how you want the results formatted (e.g., "Use bullet points", "Include executive summary first")
                    </p>
                    <textarea
                      value={formData.output_format_preferences}
                      onChange={(e) => setFormData(prev => ({ ...prev, output_format_preferences: e.target.value }))}
                      placeholder="Specify your preferred output format..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    />
                  </div>
                </div>
              ) : (
                // Preview View
                <div className="p-6">
                  {previewData && (
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-3">Preview: Merged Instructions</h3>
                      <div className="bg-muted/40 rounded-lg p-4 border border-border">
                        <pre className="text-sm text-foreground whitespace-pre-wrap overflow-x-auto">
                          {sanitizePreviewContent(previewData.merged_instructions)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-border">
              <div className="flex gap-2">
                {showPreview ? (
                  <button
                    onClick={() => setShowPreview(false)}
                    className="btn-secondary"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                ) : (
                  <button
                    onClick={previewCustomization}
                    disabled={previewing}
                    className="btn-secondary"
                  >
                    <Eye className="w-4 h-4" />
                    {previewing ? 'Loading...' : 'Preview'}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {getSkillCustomization(editingSkill!) && (
                  <button
                    onClick={resetCustomization}
                    className="btn-secondary text-chart-4 hover:bg-chart-4/10"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                )}
                <button
                  onClick={saveCustomization}
                  disabled={saving}
                  className="btn-primary"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
