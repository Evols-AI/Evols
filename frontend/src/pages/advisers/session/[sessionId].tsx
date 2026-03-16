import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { MessageSquare, Send, ThumbsUp, ThumbsDown, ArrowLeft, Loader2, Sparkles, Star, Download, FileText, FileJson, History } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Loading } from '@/components/PageContainer'

interface SessionData {
  session_id: string
  phase: string
  initial_questions?: any[]
  context_data?: any
  output_data?: any
  messages?: any[]
}

interface Message {
  role: string
  content: string
  created_at: string
}

export default function AdviserSession() {
  const router = useRouter()
  const { sessionId } = router.query
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatMessage, setChatMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (sessionId) {
      loadSession()
    }
  }, [router, sessionId])

  useEffect(() => {
    // Scroll to bottom when messages change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages])

  const loadSession = async () => {
    try {
      const response = await api.get(`/advisers/sessions/${sessionId}`)
      setSession(response.data)
    } catch (err: any) {
      alert(`Failed to load session: ${err.response?.data?.detail || err.message}`)
      router.push('/advisers')
    } finally {
      setLoading(false)
    }
  }

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !sessionId || sending) return

    const userMessage = chatMessage
    setChatMessage('')
    setSending(true)

    try {
      const response = await api.post(`/advisers/sessions/${sessionId}/chat`, {
        message: userMessage
      })

      // Reload session to get updated messages and output
      await loadSession()
    } catch (err: any) {
      alert(`Failed to send message: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSending(false)
    }
  }

  const submitEvaluation = async (helpful: boolean) => {
    if (!sessionId) return

    try {
      await api.post(`/advisers/sessions/${sessionId}/evaluate`, {
        rating: rating || undefined,
        helpful,
        feedback_text: feedbackText || undefined
      })

      alert('Thank you for your feedback!')
      router.push('/advisers/history')
    } catch (err: any) {
      alert(`Failed to submit feedback: ${err.response?.data?.detail || err.message}`)
    }
  }

  const exportMarkdown = () => {
    if (!sessionId) return
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/advisers/sessions/${sessionId}/export/markdown`, '_blank')
  }

  const exportJson = () => {
    if (!sessionId) return
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/advisers/sessions/${sessionId}/export/json`, '_blank')
  }

  if (loading) {
    return <Loading />
  }

  if (!session) {
    return null
  }

  // All phases: Conversational Chat Interface
  return (
    <>
      <Head>
        <title>Adviser Session - Evols</title>
      </Head>

      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
        <Header user={user} currentPage="advisers" />

        {/* Chat Container */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Bar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/advisers')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Back</span>
                </button>
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Adviser Chat
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/advisers/history')}
                  className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition"
                  title="Session History"
                >
                  <History className="w-4 h-4" />
                </button>
                {session.phase === 'completed' && (
                  <span className="px-3 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                    Completed
                  </span>
                )}
                {session.output_data && (
                  <>
                    <button
                      onClick={exportMarkdown}
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition"
                      title="Export as Markdown"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={exportJson}
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition"
                      title="Export as JSON"
                    >
                      <FileJson className="w-4 h-4" />
                    </button>
                  </>
                )}
                {session.phase !== 'completed' && session.output_data && (
                  <button
                    onClick={() => setShowEvaluation(true)}
                    className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium"
                  >
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
              {session.messages && session.messages.length > 0 ? (
                session.messages.map((msg: Message, idx: number) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                            AI Adviser
                          </span>
                        </div>
                      )}
                      <div className="prose dark:prose-invert prose-sm max-w-none">
                        <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-16">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Welcome to your AI Adviser session</p>
                  <p className="text-sm">The adviser will start by asking you some questions</p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input Area */}
          {session.phase !== 'completed' && (
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder="Type your response..."
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={sending}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatMessage.trim() || sending}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-medium flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Modal */}
      {showEvaluation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              How was this session?
            </h2>

            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Rate your experience:</p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        rating && star <= rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Any feedback? (optional)
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="What could be improved?"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEvaluation(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => submitEvaluation(true)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
