import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, MessageSquare, ArrowRight, History, Zap } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'

interface Skill {
  id: number
  type: string
  name: string
  description: string
  icon: string
  is_custom: boolean
  category?: string
}

export default function Skills() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewingSkill, setViewingSkill] = useState<any>(null)
  const [loadingSkillDetails, setLoadingSkillDetails] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadSkills()
  }, [router])

  const loadSkills = async () => {
    try {
      const response = await api.get('/copilot/skills')
      setSkills(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load skills')
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
          description="Expert-curated skills to help with specific product management tasks"
          icon={Zap}
          action={{
            label: 'View History',
            onClick: () => router.push('/skills/history'),
            icon: History
          }}
        />

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
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
              {[
                { id: 'all', name: 'All Skills', count: skills.length },
                { id: 'discovery', name: 'Discovery', count: skills.filter((a: Skill) => a.category === 'discovery').length },
                { id: 'strategy', name: 'Strategy', count: skills.filter((a: Skill) => a.category === 'strategy').length },
                { id: 'execution', name: 'Execution', count: skills.filter((a: Skill) => a.category === 'execution').length },
                { id: 'market-research', name: 'Market Research', count: skills.filter((a: Skill) => a.category === 'market-research').length },
                { id: 'go-to-market', name: 'Go-to-Market', count: skills.filter((a: Skill) => a.category === 'go-to-market').length },
                { id: 'marketing-growth', name: 'Marketing & Growth', count: skills.filter((a: Skill) => a.category === 'marketing-growth').length },
                { id: 'data-analytics', name: 'Data & Analytics', count: skills.filter((a: Skill) => a.category === 'data-analytics').length },
                { id: 'os-infrastructure', name: 'PM OS', count: skills.filter((a: Skill) => a.category === 'os-infrastructure').length },
                { id: 'toolkit', name: 'Toolkit', count: skills.filter((a: Skill) => a.category === 'toolkit').length },
              ].filter(cat => cat.id === 'all' || cat.count > 0).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}
                >
                  {cat.name} {cat.count > 0 && `(${cat.count})`}
                </button>
              ))}
            </div>

            {/* Skills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {skills.filter((skill: Skill) =>
                selectedCategory === 'all' || skill.category === selectedCategory
              ).map((skill: Skill) => (
              <Card key={`${skill.type}-${skill.id}`} hover onClick={() => viewSkillDetails(skill.name)}>
                <div className="p-5">
                  {/* Icon, Name & Badge - Same Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-3xl flex-shrink-0">{skill.icon}</div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                        {skill.name}
                      </h3>
                    </div>
                    {skill.is_custom && (
                      <span className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 whitespace-nowrap">
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {skill.description}
                  </p>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openInWorkbench(skill.name)
                    }}
                    className="btn-primary w-full justify-center"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Open in Workbench
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
          </>
        )}

        {/* Quick Info */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                How Skills Work
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{viewingSkill.icon || '⚡'}</div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      {viewingSkill.name}
                    </h2>
                    {viewingSkill.category && (
                      <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 capitalize">
                        {viewingSkill.category.replace(/-/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setViewingSkill(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {viewingSkill.description}
                  </p>
                </div>

                {viewingSkill.instructions && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Instructions</h3>
                    <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                      {viewingSkill.instructions}
                    </pre>
                  </div>
                )}

                {viewingSkill.tools && viewingSkill.tools.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Available Tools</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewingSkill.tools.map((tool: string, i: number) => (
                        <span key={i} className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-center text-gray-600 dark:text-gray-400">Loading skill details...</p>
          </div>
        </div>
      )}
    </>
  )
}
