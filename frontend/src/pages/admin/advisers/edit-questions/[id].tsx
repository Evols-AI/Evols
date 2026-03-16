import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Save, Plus, X, GripVertical } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'

interface Question {
  id: string
  type: 'text' | 'textarea' | 'number' | 'select'
  question: string
  placeholder?: string
  options?: string[]
  required: boolean
}

export default function EditQuestions() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [adviserName, setAdviserName] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])

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
      setAdviserName(adviser.name)
      setQuestions(adviser.initial_questions || [])
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load adviser')
    } finally {
      setLoading(false)
    }
  }

  const saveQuestions = async () => {
    setSaving(true)
    try {
      await api.put(`/advisers/admin/custom/${id}`, {
        initial_questions: questions
      })

      alert('Questions updated successfully!')
      router.push(`/admin/advisers/edit/${id}`)
    } catch (err: any) {
      alert(`Failed to update questions: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      type: 'text',
      question: '',
      placeholder: '',
      required: false
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const updated = [...questions]
      ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
      setQuestions(updated)
    } else if (direction === 'down' && index < questions.length - 1) {
      const updated = [...questions]
      ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
      setQuestions(updated)
    }
  }

  const addOption = (questionIndex: number) => {
    const updated = [...questions]
    const question = updated[questionIndex]
    if (question.type === 'select') {
      question.options = [...(question.options || []), '']
      setQuestions(updated)
    }
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions]
    const question = updated[questionIndex]
    if (question.options) {
      question.options[optionIndex] = value
      setQuestions(updated)
    }
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions]
    const question = updated[questionIndex]
    if (question.options) {
      question.options = question.options.filter((_, i) => i !== optionIndex)
      setQuestions(updated)
    }
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
        <title>Edit Questions - {adviserName} - Evols Admin</title>
      </Head>

      <Header user={user} currentPage="advisers" />

      <PageContainer>
        <button
          onClick={() => router.push(`/admin/advisers/edit/${id}`)}
          className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Adviser Settings
        </button>

        <PageHeader
          title={`Edit Questions: ${adviserName}`}
          description="Configure the initial questions to gather context from users"
        />

        {error && !error.includes('Access denied') && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Questions List */}
          {questions.map((question, qIndex) => (
            <Card key={question.id}>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Question {qIndex + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveQuestion(qIndex, 'up')}
                      disabled={qIndex === 0}
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveQuestion(qIndex, 'down')}
                      disabled={qIndex === questions.length - 1}
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeQuestion(qIndex)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      title="Delete"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Question Type
                    </label>
                    <select
                      value={question.type}
                      onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`required-${qIndex}`}
                      checked={question.required}
                      onChange={(e) => updateQuestion(qIndex, 'required', e.target.checked)}
                      className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`required-${qIndex}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Required
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Question Text
                  </label>
                  <input
                    type="text"
                    value={question.question}
                    onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    placeholder="What do you want to ask?"
                  />
                </div>

                {question.type !== 'select' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={question.placeholder || ''}
                      onChange={(e) => updateQuestion(qIndex, 'placeholder', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="Hint text..."
                    />
                  </div>
                )}

                {question.type === 'select' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Options
                      </label>
                      <button
                        onClick={() => addOption(qIndex)}
                        className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                      >
                        Add Option
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(question.options || []).map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                            placeholder={`Option ${oIndex + 1}`}
                          />
                          <button
                            onClick={() => removeOption(qIndex, oIndex)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {questions.length === 0 && (
            <Card>
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No questions yet</p>
                <button
                  onClick={addQuestion}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Add First Question
                </button>
              </div>
            </Card>
          )}

          {/* Add Question Button */}
          {questions.length > 0 && (
            <button
              onClick={addQuestion}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Question
            </button>
          )}

          {/* Save Button */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={saveQuestions}
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
                  Save Questions
                </>
              )}
            </button>
            <button
              onClick={() => router.push(`/admin/advisers/edit/${id}`)}
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
