import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Send, Loader2, Sparkles, Plus, MessageSquare, Trash2, ChevronRight, ChevronLeft, History, Paperclip, X, FileText, Image as ImageIcon, File } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useProducts } from '@/hooks/useProducts'
import OnboardingTour from '@/components/OnboardingTour'

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
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showHistorySidebar, setShowHistorySidebar] = useState(false)
  const [pollingForResponse, setPollingForResponse] = useState(false)

  // @mention autocomplete
  const [showAdviserPicker, setShowAdviserPicker] = useState(false)
  const [advisers, setAdvisers] = useState<Adviser[]>([])
  const [adviserSearchQuery, setAdviserSearchQuery] = useState('')
  const [mentionStartPos, setMentionStartPos] = useState<number>(0)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastLoadedConversationRef = useRef<string | null>(null)

  // File attachments
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])

  // Rotating placeholders for empty state
  const placeholders = [
    "Ask anything about your product - roadmap, strategy, features, customers...",
    "Invoke expert skills with @mentions (browse Skills page to discover 80+ capabilities)",
    "Get AI recommendations grounded in your product strategy and customer intelligence"
  ]
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadConversations()
    loadAdvisers()

    // Check for conversation_id in URL and load it (only if not already loaded)
    const { conversation_id, skill } = router.query
    if (conversation_id && typeof conversation_id === 'string' && conversation_id !== lastLoadedConversationRef.current) {
      loadConversation(conversation_id)
      lastLoadedConversationRef.current = conversation_id
    } else if (skill && typeof skill === 'string' && !conversation_id) {
      // Only pre-fill skill if there's no active conversation
      setInputMessage(`@${skill} `)
      inputRef.current?.focus()
    }
  }, [router, router.query])

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea when input message changes (e.g., pre-filled from URL)
  useEffect(() => {
    if (inputRef.current && inputMessage) {
      autoResizeTextarea(inputRef.current)
    }
  }, [inputMessage])

  // Rotate placeholders every 3 seconds
  useEffect(() => {
    if (messages.length === 0) {
      const interval = setInterval(() => {
        setIsTransitioning(true)
        setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
          setIsTransitioning(false)
        }, 300) // Half of transition duration
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [messages.length, placeholders.length])

  // Cleanup polling on unmount or conversation change
  useEffect(() => {
    return () => {
      // Clear polling interval when component unmounts or conversation changes
      if ((window as any).responsePollingInterval) {
        clearInterval((window as any).responsePollingInterval)
        ;(window as any).responsePollingInterval = null
      }
      setPollingForResponse(false)
    }
  }, [activeConversation])


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
      const response = await api.get('/copilot/skills')
      setAdvisers(response.data)
    } catch (err: any) {
      console.error('Failed to load advisers:', err)
    }
  }

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await api.get(`/copilot/conversations/${conversationId}`)
      const messages = response.data.messages
      setMessages(messages)
      setActiveConversation(conversationId)

      // Update URL to include conversation_id for persistence
      router.push(`/workbench?conversation_id=${conversationId}`, undefined, { shallow: true })

      // Check if AI is still thinking (last message is from user)
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        // Show thinking indicator
        const thinkingMessage: Message = {
          id: Date.now(),
          role: 'assistant',
          content: '...',
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, thinkingMessage])

        // Start polling for the response
        startPollingForResponse(conversationId)
      }
    } catch (err: any) {
      alert(`Failed to load conversation: ${err.response?.data?.detail || err.message}`)
    }
  }

  const startPollingForResponse = (conversationId: string) => {
    setPollingForResponse(true)

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/copilot/conversations/${conversationId}`)
        const latestMessages = response.data.messages

        // Check if we got a new assistant response
        const lastMessage = latestMessages[latestMessages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content !== '...') {
          // Response received! Update messages and stop polling
          setMessages(latestMessages)
          setPollingForResponse(false)
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Polling error:', err)
        // Continue polling even on error
      }
    }, 2000) // Poll every 2 seconds

    // Store interval ID for cleanup
    ;(window as any).responsePollingInterval = pollInterval

    // Safety timeout: stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
      setPollingForResponse(false)
    }, 300000)
  }

  const createNewConversation = () => {
    // Stop any active polling
    if ((window as any).responsePollingInterval) {
      clearInterval((window as any).responsePollingInterval)
      ;(window as any).responsePollingInterval = null
    }
    setPollingForResponse(false)

    setActiveConversation(null)
    setMessages([])
    inputRef.current?.focus()
    lastLoadedConversationRef.current = null

    // Clear conversation_id from URL
    router.push('/workbench', undefined, { shallow: true })
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
        lastLoadedConversationRef.current = null

        // Clear conversation_id from URL
        router.push('/workbench', undefined, { shallow: true })
      }
    } catch (err: any) {
      alert(`Failed to delete: ${err.response?.data?.detail || err.message}`)
    }
  }

  // Auto-resize textarea
  const autoResizeTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'

    // Calculate new height (min 2.5rem for single line, max 12rem for ~8 lines)
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 192)
    textarea.style.height = `${newHeight}px`
  }

  // Handle input change with auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value)
    autoResizeTextarea(e.target)
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      return ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'md', 'csv', 'xls', 'xlsx'].includes(ext || '')
    })

    if (validFiles.length !== files.length) {
      alert('Some files were skipped. Only txt, pdf, png, jpg, jpeg, md, csv, xls, xlsx files are supported.')
    }

    setAttachedFiles(prev => [...prev, ...validFiles])

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Remove attached file
  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Get file icon based on type
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['png', 'jpg', 'jpeg'].includes(ext || '')) {
      return <ImageIcon className="w-4 h-4" />
    }
    if (['txt', 'md', 'csv'].includes(ext || '')) {
      return <FileText className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
  }

  const sendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride || inputMessage
    if (!messageToSend.trim() || sending) return

    const userMessage = messageToSend
    const filesToSend = [...attachedFiles]

    setInputMessage('')
    setAttachedFiles([])
    setSending(true)

    // Reset textarea height after sending
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

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
      // If there are files, send as FormData, otherwise send as JSON
      let response
      if (filesToSend.length > 0) {
        const formData = new FormData()
        formData.append('message', userMessage)
        if (activeConversation) {
          formData.append('conversation_id', activeConversation)
        }
        if (selectedProductIds[0]) {
          formData.append('product_id', selectedProductIds[0].toString())
        }
        filesToSend.forEach((file) => {
          formData.append('files', file)
        })

        response = await api.post('/copilot/chat', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      } else {
        response = await api.post('/copilot/chat', {
          message: userMessage,
          conversation_id: activeConversation,
          product_id: selectedProductIds[0] || null  // Pass current product context
        })
      }

      // Update conversation ID if this was a new conversation
      if (!activeConversation) {
        setActiveConversation(response.data.conversation_id)
        await loadConversations()

        // Update URL to include conversation_id for persistence
        router.push(`/workbench?conversation_id=${response.data.conversation_id}`, undefined, { shallow: true })
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
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsl(var(--primary))' }} />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Workbench — Evols</title>
      </Head>

      <OnboardingTour />

      <div className="flex flex-col h-screen">
        <Header user={user} currentPage="workbench" />

        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col relative">
            {/* Action Bar */}
            <div className="container mx-auto px-8 pt-6 max-w-7xl">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowHistorySidebar(!showHistorySidebar)}
                  className="btn-ghost"
                  title="Toggle history"
                >
                  <History className="w-4 h-4" />
                  <span>History</span>
                </button>
                <button
                  onClick={createNewConversation}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-8 py-6">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Sparkles className="w-20 h-20" />
                    </div>
                    <h2 className="empty-state-title">
                      Welcome to Workbench
                    </h2>
                    <p className="empty-state-description">
                      Your AI workspace for product management
                    </p>

                    {/* Centered Input */}
                    <div className="w-full max-w-3xl mx-auto mb-8">
                      {/* @mention Autocomplete */}
                      {showAdviserPicker && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 card shadow-lg max-h-80 overflow-y-auto z-[60]">
                          {filteredAdvisers.length === 0 ? (
                            <div className="p-4 text-sm text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                              No skills found
                            </div>
                          ) : (
                            filteredAdvisers.map((adviser) => (
                              <div
                                key={`${adviser.type}-${adviser.id}`}
                                onClick={() => insertMention(adviser)}
                                className="flex items-start gap-3 p-3 cursor-pointer transition hover-lift border-b last:border-0"
                                style={{ borderColor: 'hsl(var(--border))' }}
                              >
                                <span className="text-2xl">{adviser.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                                      {adviser.name}
                                    </span>
                                    {adviser.is_custom && (
                                      <span className="badge-purple">
                                        Custom
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                    {adviser.description}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      <div className="relative">
                        {/* File Attachments Display */}
                        {attachedFiles.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {attachedFiles.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                                style={{
                                  background: 'hsl(var(--muted))',
                                  borderColor: 'hsl(var(--border))'
                                }}
                              >
                                {getFileIcon(file.name)}
                                <span className="text-sm truncate max-w-[200px]" style={{ color: 'hsl(var(--foreground))' }}>
                                  {file.name}
                                </span>
                                <button
                                  onClick={() => removeFile(index)}
                                  className="ml-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                                  style={{ color: 'hsl(var(--muted-foreground))' }}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Input Container */}
                        <div className="card p-2">
                          <div className="relative">
                            <textarea
                              ref={inputRef}
                              value={inputMessage}
                              onChange={handleInputChange}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  sendMessage()
                                }
                              }}
                              className="w-full resize-none overflow-hidden bg-transparent border-none focus:outline-none focus:ring-0 px-2 py-2"
                              style={{
                                minHeight: '2.5rem',
                                color: 'hsl(var(--foreground))',
                                fontSize: '0.9375rem'
                              }}
                              rows={1}
                              disabled={sending || pollingForResponse}
                            />
                            {/* Animated Placeholder Overlay */}
                            {!inputMessage && (
                              <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-center px-2"
                                style={{
                                  color: 'hsl(var(--muted-foreground) / 0.6)',
                                  transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
                                  opacity: isTransitioning ? 0 : 1,
                                  transform: isTransitioning ? 'translateY(-10px)' : 'translateY(0)'
                                }}
                              >
                                {placeholders[placeholderIndex]}
                              </div>
                            )}
                          </div>

                          {/* Bottom Bar with Buttons */}
                          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                            <div className="flex items-center gap-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".txt,.pdf,.png,.jpg,.jpeg,.md,.csv,.xls,.xlsx"
                                onChange={handleFileSelect}
                                className="hidden"
                              />
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending || pollingForResponse}
                                className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ color: 'hsl(var(--muted-foreground))' }}
                                title="Attach files"
                              >
                                <Paperclip className="w-5 h-5" />
                              </button>
                            </div>

                            <button
                              onClick={() => sendMessage()}
                              disabled={!inputMessage.trim() || sending || pollingForResponse}
                              className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              style={{
                                background: inputMessage.trim() && !sending && !pollingForResponse
                                  ? 'hsl(var(--primary))'
                                  : 'hsl(var(--muted))',
                                color: inputMessage.trim() && !sending && !pollingForResponse
                                  ? 'hsl(var(--primary-foreground))'
                                  : 'hsl(var(--muted-foreground))'
                              }}
                            >
                              {(sending || pollingForResponse) ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-sm font-medium">Sending</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4" />
                                  <span className="text-sm font-medium">Send</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Setup CTA */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => sendMessage("@pm-setup Let's set up my PM workspace.")}
                        className="btn-secondary px-6 py-2.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        Set up my PM OS
                      </button>
                      <p className="text-xs mt-3 text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Quick setup to capture your role, team, and projects
                      </p>
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
                          className="max-w-[75%] rounded-2xl px-5 py-3 border"
                          style={
                            msg.role === 'user'
                              ? {
                                  background: 'hsl(var(--primary))',
                                  color: 'hsl(var(--primary-foreground))',
                                  borderColor: 'hsl(var(--primary))'
                                }
                              : {
                                  background: 'hsl(var(--card))',
                                  color: 'hsl(var(--card-foreground))',
                                  borderColor: 'hsl(var(--border))'
                                }
                          }
                        >
                          {msg.role === 'assistant' && msg.adviser && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                              <span className="text-lg">{msg.adviser.icon}</span>
                              <span className="text-xs font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                {msg.adviser.name}
                              </span>
                              {msg.content === '...' && (
                                <Loader2 className="w-3 h-3 animate-spin ml-auto" style={{ color: 'hsl(var(--muted-foreground))' }} />
                              )}
                            </div>
                          )}
                          {msg.role === 'assistant' && !msg.adviser && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                              <Sparkles className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
                              <span className="text-xs font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                Evols AI
                              </span>
                            </div>
                          )}
                          <div className="prose dark:prose-invert prose-sm max-w-none">
                            {msg.content === '...' ? (
                              <div className="flex items-center gap-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
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

            {/* Input Area - Only show when there are messages */}
            {messages.length > 0 && (
              <div className="px-8 py-6 relative">
                <div className="max-w-4xl mx-auto relative">
                  {/* @mention Autocomplete */}
                  {showAdviserPicker && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 card shadow-lg max-h-80 overflow-y-auto z-[60]">
                      {filteredAdvisers.length === 0 ? (
                        <div className="p-4 text-sm text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          No skills found
                        </div>
                      ) : (
                        filteredAdvisers.map((adviser) => (
                          <div
                            key={`${adviser.type}-${adviser.id}`}
                            onClick={() => insertMention(adviser)}
                            className="flex items-start gap-3 p-3 cursor-pointer transition hover-lift border-b last:border-0"
                            style={{ borderColor: 'hsl(var(--border))' }}
                          >
                            <span className="text-2xl">{adviser.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                                  {adviser.name}
                                </span>
                                {adviser.is_custom && (
                                  <span className="badge-purple">
                                    Custom
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                {adviser.description}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* File Attachments Display */}
                  {attachedFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {attachedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                          style={{
                            background: 'hsl(var(--muted))',
                            borderColor: 'hsl(var(--border))'
                          }}
                        >
                          {getFileIcon(file.name)}
                          <span className="text-sm truncate max-w-[200px]" style={{ color: 'hsl(var(--foreground))' }}>
                            {file.name}
                          </span>
                          <button
                            onClick={() => removeFile(index)}
                            className="ml-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                            style={{ color: 'hsl(var(--muted-foreground))' }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input Container */}
                  <div className="card p-2">
                    <textarea
                      ref={inputRef}
                      value={inputMessage}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      placeholder="Ask me anything... (use @ to mention skills)"
                      className="w-full resize-none overflow-hidden bg-transparent border-none focus:outline-none focus:ring-0 px-2 py-2"
                      style={{
                        minHeight: '2.5rem',
                        color: 'hsl(var(--foreground))',
                        fontSize: '0.9375rem'
                      }}
                      rows={1}
                      disabled={sending || pollingForResponse}
                    />

                    {/* Bottom Bar with Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".txt,.pdf,.png,.jpg,.jpeg,.md,.csv,.xls,.xlsx"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending || pollingForResponse}
                          className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ color: 'hsl(var(--muted-foreground))' }}
                          title="Attach files"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                      </div>

                      <button
                        onClick={() => sendMessage()}
                        disabled={!inputMessage.trim() || sending || pollingForResponse}
                        className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        style={{
                          background: inputMessage.trim() && !sending && !pollingForResponse
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--muted))',
                          color: inputMessage.trim() && !sending && !pollingForResponse
                            ? 'hsl(var(--primary-foreground))'
                            : 'hsl(var(--muted-foreground))'
                        }}
                      >
                        {(sending || pollingForResponse) ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm font-medium">Sending</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span className="text-sm font-medium">Send</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Pro tip: Type @ to invoke skills, or browse the Skills page to discover all capabilities
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Conversation History (Toggleable) */}
          {showHistorySidebar && (
            <div className="w-80 border-l flex flex-col relative z-10" style={{
              background: 'hsl(var(--card) / 0.95)',
              borderColor: 'hsl(var(--border))',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}>
              {/* Sidebar Header */}
              <div className="p-4 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>History</h2>
                  <button
                    onClick={() => setShowHistorySidebar(false)}
                    className="p-1.5 rounded transition hover-lift"
                    title="Close"
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
                  </button>
                </div>
              </div>

              {/* Conversation List */}
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs mt-1">Start chatting to begin</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {conversations.map((conv) => {
                      const isActive = activeConversation === conv.id
                      return (
                        <div
                          key={conv.id}
                          onClick={() => loadConversation(conv.id)}
                          className="mx-2 mb-2 p-3 rounded-xl cursor-pointer transition group border"
                          style={{
                            background: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                            borderColor: isActive ? 'hsl(var(--primary) / 0.3)' : 'transparent'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2" style={{ color: 'hsl(var(--foreground))' }}>
                                {conv.last_message_preview || 'Empty conversation'}
                              </p>
                              <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
                                {formatDate(conv.last_message_at || conv.created_at)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => deleteConversation(conv.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded transition hover-lift"
                              style={{ color: 'hsl(var(--destructive))' }}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
