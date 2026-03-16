import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Save, Plus, X, History } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'

const AVAILABLE_TOOLS = [
  'get_personas',
  'get_persona_by_id',
  'get_feedback_items',
  'get_feedback_summary',
  'get_themes',
  'get_features',
  'calculate_rice_score',
  'get_current_date',
]

export default function EditAdviser() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Basic fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Configuration fields
  const [tools, setTools] = useState<string[]>([])
  const [initialQuestions, setInitialQuestions] = useState<any[]>([])
  const [taskDefinitions, setTaskDefinitions] = useState<string[]>([])
  const [instructions, setInstructions] = useState('')
  const [outputTemplate, setOutputTemplate] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (currentUser?.role !== 'TENANT_ADMIN') {
      setError('Access denied. Tenant admin privileges required.')
      setLoading(false)
      return
    }

    if (id) {
      loadAdviser()
    }
  }, [router, id])

  const loadAdviser = async () => {
    try {
      const response = await api.get(`/advisers/admin/custom/${id}`)
      const adviser = response.data
      setName(adviser.name)
      setDescription(adviser.description || '')
      setIcon(adviser.icon || '')
      setIsActive(adviser.is_active)
      setTools(adviser.tools || [])
      setInitialQuestions(adviser.initial_questions || [])
      setTaskDefinitions(adviser.task_definitions || [])
      setInstructions(adviser.instructions || '')
      setOutputTemplate(adviser.output_template || '')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load adviser')
    } finally {
      setLoading(false)
    }
  }

  const saveAdviser = async () => {
    if (!name.trim()) {
      alert('Name is required')
      return
    }

    if (!instructions.trim()) {
      alert('Instructions are required')
      return
    }

    setSaving(true)
    try {
      await api.put(`/advisers/admin/custom/${id}`, {
        name: name.trim(),
        description: description.trim() || null,
        icon: icon.trim() || null,
        is_active: isActive,
        tools,
        initial_questions: initialQuestions,
        task_definitions: taskDefinitions,
        instructions: instructions.trim(),
        output_template: outputTemplate.trim() || null
      })

      alert('Adviser updated successfully!')
      router.push('/admin/advisers')
    } catch (err: any) {
      alert(`Failed to update adviser: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleTool = (toolName: string) => {
    if (tools.includes(toolName)) {
      setTools(tools.filter(t => t !== toolName))
    } else {
      setTools([...tools, toolName])
    }
  }

  const addTaskDefinition = () => {
    setTaskDefinitions([...taskDefinitions, ''])
  }

  const updateTaskDefinition = (index: number, value: string) => {
    const updated = [...taskDefinitions]
    updated[index] = value
    setTaskDefinitions(updated)
  }

  const removeTaskDefinition = (index: number) => {
    setTaskDefinitions(taskDefinitions.filter((_, i) => i !== index))
  }

  if (loading) {
    return <Loading />
  }

  if (error && error.includes('Access denied')) {
    return (
      <>
        <Head>
          <title>Access Denied - Evols</title>
        </Head>
        <Header user={user} currentPage="advisers" />
        <PageContainer>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </PageContainer>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Edit Adviser - Evols Admin</title>
      </Head>

      <Header user={user} currentPage="advisers" />

      <PageContainer>
        <button
          onClick={() => router.push('/admin/advisers')}
          className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Advisers
        </button>

        <PageHeader
          title="Edit Custom Adviser"
          description="Configure your AI adviser's behavior, tools, and prompts"
          action={{
            label: 'View History',
            onClick: () => router.push(`/admin/advisers/versions/${id}`),
            icon: History
          }}
        />

        {error && !error.includes('Access denied') && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <div className="p-6 space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="Adviser name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="What does this adviser help with?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Icon (Emoji)
                </label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="🚀"
                  maxLength={2}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active (visible to users)
                </label>
              </div>
            </div>
          </Card>

          {/* Available Tools */}
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Available Tools</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select which tools the adviser can use to gather data
              </p>

              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_TOOLS.map((toolName) => (
                  <div key={toolName} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`tool-${toolName}`}
                      checked={tools.includes(toolName)}
                      onChange={() => toggleTool(toolName)}
                      className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`tool-${toolName}`} className="text-sm text-gray-700 dark:text-gray-300">
                      {toolName}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Task Definitions */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Definitions</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    High-level tasks the adviser should complete
                  </p>
                </div>
                <button
                  onClick={addTaskDefinition}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>

              <div className="space-y-2">
                {taskDefinitions.map((task, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={task}
                      onChange={(e) => updateTaskDefinition(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                      placeholder="e.g., Analyze customer feedback themes"
                    />
                    <button
                      onClick={() => removeTaskDefinition(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {taskDefinitions.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No tasks defined. Click "Add Task" to add one.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Instructions */}
          <Card>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Instructions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  The main prompt that guides the adviser's behavior <span className="text-red-500">*</span>
                </p>
              </div>

              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                placeholder="You are an expert product manager helping to..."
              />
            </div>
          </Card>

          {/* Output Template */}
          <Card>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Output Template</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Expected output format (JSON structure or template)
                </p>
              </div>

              <textarea
                value={outputTemplate}
                onChange={(e) => setOutputTemplate(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                placeholder='{"analysis": {...}, "recommendations": [...]}'
              />
            </div>
          </Card>

          {/* Initial Questions */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Initial Questions</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {initialQuestions.length} question(s) configured
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/admin/advisers/edit-questions/${id}`)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm"
                >
                  Edit Questions
                </button>
              </div>

              {initialQuestions.length > 0 && (
                <div className="space-y-2">
                  {initialQuestions.slice(0, 3).map((q: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {i + 1}. {q.question}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Type: {q.type} • {q.required ? 'Required' : 'Optional'}
                      </p>
                    </div>
                  ))}
                  {initialQuestions.length > 3 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      ...and {initialQuestions.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={saveAdviser}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors text-base font-medium"
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={() => router.push('/admin/advisers')}
              disabled={saving}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors text-base"
            >
              Cancel
            </button>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
