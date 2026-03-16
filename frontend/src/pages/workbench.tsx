import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Send, Loader2, Sparkles, Plus, MessageSquare, Trash2, ChevronRight, History } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Adviser {
  id: number
  type: string
  name: string
  description: string
  icon: string
  is_custom: boolean
}

interface Message {
  id: number
  role: string
  content: string
  adviser?: {
    id: number
    type: string
    name: string
    description: string
    icon: string
  }
  created_at: string
}

interface Conversation {
  id: string
  name: string | null
  last_message_at: string | null
  created_at: string
  message_count: number
  last_message_preview: string | null
}

export default function Workbench() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showHistorySidebar, setShowHistorySidebar] = useState(false)

  // @mention autocomplete
  const [showAdviserPicker, setShowAdviserPicker] = useState(false)
  const [advisers, setAdvisers] = useState<Adviser[]>([])
  const [adviserSearchQuery, setAdviserSearchQuery] = useState('')
  const [mentionStartPos, setMentionStartPos] = useState<number>(0)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadConversations()
    loadAdvisers()

    // Check for skill query parameter and pre-fill input
    const { skill } = router.query
    if (skill && typeof skill === 'string') {
      setInputMessage(`@${skill} `)
      inputRef.current?.focus()
    }
  }, [router, router.query])

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Watch for @ symbol in input
  useEffect(() => {
    const lastAtSymbol = inputMessage.lastIndexOf('@')
    if (lastAtSymbol !== -1 && lastAtSymbol === inputMessage.length - 1) {
      setShowAdviserPicker(true)
      setMentionStartPos(lastAtSymbol)
      setAdviserSearchQuery('')
    } else if (lastAtSymbol !== -1 && showAdviserPicker) {
      const query = inputMessage.substring(lastAtSymbol + 1)
      if (query.includes(' ')) {
        setShowAdviserPicker(false)
      } else {
        setAdviserSearchQuery(query)
      }
    } else {
      setShowAdviserPicker(false)
    }
  }, [inputMessage])

  const loadConversations = async () => {
    try {
      const response = await api.get('/copilot/conversations')
      setConversations(response.data)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load conversations:', err)
      setLoading(false)
    }
  }

  const loadAdvisers = async () => {
    try {
      const response = await api.get('/copilot/advisers')
      setAdvisers(response.data)
    } catch (err: any) {
      console.error('Failed to load advisers:', err)
    }
  }

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await api.get(`/copilot/conversations/${conversationId}`)
      setMessages(response.data.messages)
      setActiveConversation(conversationId)
    } catch (err: any) {
      alert(`Failed to load conversation: ${err.response?.data?.detail || err.message}`)
    }
  }

  const createNewConversation = () => {
    setActiveConversation(null)
    setMessages([])
    inputRef.current?.focus()
  }

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this conversation?')) return

    try {
      await api.delete(`/copilot/conversations/${conversationId}`)
      await loadConversations()
      if (activeConversation === conversationId) {
        setActiveConversation(null)
        setMessages([])
      }
    } catch (err: any) {
      alert(`Failed to delete: ${err.response?.data?.detail || err.message}`)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || sending) return

    const userMessage = inputMessage
    setInputMessage('')
    setSending(true)

    // Optimistically add user message to UI
    const optimisticMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimisticMessage])

    // Add thinking indicator
    const thinkingMessage: Message = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '...',
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, thinkingMessage])

    try {
      const response = await api.post('/copilot/chat', {
        message: userMessage,
        conversation_id: activeConversation
      })

      // Update conversation ID if this was a new conversation
      if (!activeConversation) {
        setActiveConversation(response.data.conversation_id)
        await loadConversations()
      }

      // Replace optimistic messages with real messages
      setMessages(prev => [
        ...prev.slice(0, -2),
        { ...optimisticMessage, id: response.data.message.id - 1 }, // Assume user message ID is one less
        response.data.message
      ])

      // Reload conversation list to update last message
      await loadConversations()
    } catch (err: any) {
      alert(`Failed to send message: ${err.response?.data?.detail || err.message}`)
      // Remove optimistic messages on error
      setMessages(prev => prev.slice(0, -2))
    } finally {
      setSending(false)
    }
  }

  const insertMention = (adviser: Adviser) => {
    const beforeMention = inputMessage.substring(0, mentionStartPos)
    const mention = `@${adviser.name.toLowerCase().replace(/\s+/g, '_')} `
    setInputMessage(beforeMention + mention)
    setShowAdviserPicker(false)
    inputRef.current?.focus()
  }

  const filteredAdvisers = advisers.filter(adviser =>
    adviser.name.toLowerCase().includes(adviserSearchQuery.toLowerCase()) ||
    adviser.description.toLowerCase().includes(adviserSearchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Workbench — Evols</title>
      </Head>

      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
        <Header user={user} currentPage="workbench" />

        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar - Conversation History (Toggleable) */}
          {showHistorySidebar && (
            <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">History</h2>
                  <button
                    onClick={() => setShowHistorySidebar(false)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition"
                    title="Close"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Start chatting to begin</p>
                </div>
              ) : (
                <div className="py-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`mx-2 mb-2 p-3 rounded-lg cursor-pointer transition group ${
                        activeConversation === conv.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {conv.name || 'New Conversation'}
                          </h3>
                          {conv.last_message_preview && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {conv.last_message_preview}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {formatDate(conv.last_message_at || conv.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Workbench
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHistorySidebar(!showHistorySidebar)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                    title="Toggle history"
                  >
                    <History className="w-4 h-4" />
                    <span className="text-sm font-medium">History</span>
                  </button>
                  <button
                    onClick={createNewConversation}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 py-6">
                {messages.length === 0 ? (
                  <div className="text-center py-16">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 text-blue-500 opacity-50" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Welcome to Workbench
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Your AI workspace for product management
                    </p>
                    <div className="max-w-2xl mx-auto text-left space-y-3 text-sm text-gray-600 dark:text-gray-400">
                      <p>• Ask questions about your roadmap, features, and customers</p>
                      <p>• Use @mentions to invoke specialized skills (@roadmap_planner, @rice_calculator, etc.)</p>
                      <p>• Get data-driven recommendations backed by your product data</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((msg, idx) => (
                      <div
                        key={msg.id || idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {msg.role === 'assistant' && msg.adviser && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                              <span className="text-lg">{msg.adviser.icon}</span>
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                {msg.adviser.name}
                              </span>
                              {msg.content === '...' && (
                                <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-auto" />
                              )}
                            </div>
                          )}
                          {msg.role === 'assistant' && !msg.adviser && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                              <Sparkles className="w-4 h-4 text-blue-500" />
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                Evols AI
                              </span>
                            </div>
                          )}
                          <div className="prose dark:prose-invert prose-sm max-w-none">
                            {msg.content === '...' ? (
                              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Thinking...</span>
                              </div>
                            ) : msg.role === 'assistant' ? (
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-2 first:mt-0">{children}</h3>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="ml-2">{children}</li>,
                                  code: ({ inline, children, ...props }: any) =>
                                    inline ? (
                                      <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm" {...props}>
                                        {children}
                                      </code>
                                    ) : (
                                      <code className="block bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm overflow-x-auto" {...props}>
                                        {children}
                                      </code>
                                    ),
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-3">
                                      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                                        {children}
                                      </table>
                                    </div>
                                  ),
                                  thead: ({ children }) => <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>,
                                  tbody: ({ children }) => <tbody>{children}</tbody>,
                                  tr: ({ children }) => <tr className="border-b border-gray-300 dark:border-gray-600">{children}</tr>,
                                  th: ({ children }) => (
                                    <th className="px-4 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600">
                                      {children}
                                    </th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
                                      {children}
                                    </td>
                                  ),
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
                                      {children}
                                    </blockquote>
                                  ),
                                  hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            ) : (
                              <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-6 py-4">
              <div className="max-w-4xl mx-auto relative">
                {/* @mention Autocomplete */}
                {showAdviserPicker && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {filteredAdvisers.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No skills found
                      </div>
                    ) : (
                      filteredAdvisers.map((adviser) => (
                        <div
                          key={`${adviser.type}-${adviser.id}`}
                          onClick={() => insertMention(adviser)}
                          className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <span className="text-2xl">{adviser.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {adviser.name}
                              </span>
                              {adviser.is_custom && (
                                <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                  Custom
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {adviser.description}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder="Ask me anything... (use @ to mention skills)"
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={1}
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || sending}
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

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Pro tip: Type @ to invoke specialized skills for roadmaps, PRDs, RICE scoring, and more
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
