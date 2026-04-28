/**
 * Dashboard — Evols Home
 * Quick actions and getting started
 */

import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  ArrowRight, Upload, FlaskConical, BarChart3,
  Database, Brain, Zap
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import Header from '@/components/Header'
import { PageContainer, Card, Loading } from '@/components/PageContainer'
import { AddContextModal } from '@/pages/context'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAddContextModal, setShowAddContextModal] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }
    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (currentUser?.role === 'SUPER_ADMIN') {
      router.replace('/admin/tenants')
      return
    }

    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} currentPage="dashboard" />
        <PageContainer><Loading text="Loading..." /></PageContainer>
      </div>
    )
  }

  return (
    <>
      <Head><title>Dashboard — Evols</title></Head>
      <div className="min-h-screen bg-background">
        <Header user={user} currentPage="dashboard" />

        <PageContainer className="max-w-5xl">
          <div className="page-header">
            <div>
              <h1 className="page-title">
                Good morning, {user?.full_name?.split(' ')[0] || 'there'} 👋
              </h1>
              <p className="page-subtitle">Your team's AI brain for collaboration and coordination.</p>
            </div>
          </div>

          <div className="bg-gradient-to-br bg-primary/5 rounded-lg p-8 border border-primary/30 dark:border-primary/20 mb-8">
            <h2 className="card-header mb-2">🚀 Get started</h2>
            <p className="text-body mb-6 max-w-xl">
              Upload context, explore your knowledge graph, or open the workbench to make evidence-backed product decisions.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { href: '/context', icon: <Upload className="w-6 h-6 text-primary" />, title: 'Upload Context', desc: 'CSV surveys, docs, meeting transcripts' },
                { href: '/context?tab=knowledge_graph', icon: <Brain className="w-6 h-6 text-chart-1" />, title: 'Knowledge Graph', desc: 'Explore AI-extracted entities and insights' },
                { href: '/workbench', icon: <FlaskConical className="w-6 h-6 text-primary" />, title: 'Open Workbench', desc: 'Start a decision brief with AI assistance' },
              ].map(item => (
                <Link key={item.href} href={item.href} className="card-hover p-5">
                  <div className="mb-3">{item.icon}</div>
                  <h3 className="text-heading mb-1">{item.title}</h3>
                  <p className="text-sm text-body">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <h2 className="text-xl text-foreground mb-3">Quick Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setShowAddContextModal(true)}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover-lift w-full text-left"
                >
                  <div className="p-2 rounded-lg flex-shrink-0 bg-chart-1/10">
                    <Database className="w-4 h-4 text-chart-1" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-heading">Add Context</div>
                    <div className="text-xs text-body">Upload feedback, docs, or data</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                </button>

                <Link href="/workbench" className="flex items-center gap-3 p-2.5 rounded-lg hover-lift">
                  <div className="p-2 rounded-lg flex-shrink-0 bg-primary/5 dark:bg-primary/10">
                    <FlaskConical className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-heading">New Decision</div>
                    <div className="text-xs text-body">Use the AI decision workbench</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                </Link>

                <Link href="/skills" className="flex items-center gap-3 p-2.5 rounded-lg hover-lift">
                  <div className="p-2 rounded-lg flex-shrink-0 bg-chart-3/10">
                    <Zap className="w-4 h-4 text-chart-3" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-heading">Browse Skills</div>
                    <div className="text-xs text-body">Explore AI skill library</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                </Link>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl text-foreground mb-3">Knowledge Sources</h2>
              <p className="text-sm text-body mb-4">
                Upload data and Evols will automatically extract entities, build a knowledge graph, and make insights available across all skills.
              </p>
              <Link href="/context" className="flex items-center gap-2 text-sm text-link font-medium">
                View knowledge sources <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Card>
          </div>
        </PageContainer>

        {showAddContextModal && (
          <AddContextModal
            onClose={() => setShowAddContextModal(false)}
            onSuccess={() => setShowAddContextModal(false)}
          />
        )}
      </div>
    </>
  )
}
