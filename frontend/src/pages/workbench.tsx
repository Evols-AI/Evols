import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { Send, Loader2, Sparkles, Plus, MessageSquare, Trash2, ChevronRight, ChevronLeft, History, Paperclip, X, FileText, Image as ImageIcon, File, Layers, Edit3, Save } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useProducts } from '@/hooks/useProducts'
import OnboardingTour from '@/components/OnboardingTour'
import { useCanvas } from '@/components/canvas/hooks/useCanvas'
import { ArtifactRenderer } from '@/components/canvas/ArtifactRenderer'

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
  const [expandedArtifact, setExpandedArtifact] = useState<any>(null)
  const [artifactPanelWidth, setArtifactPanelWidth] = useState(600)
  const [isResizing, setIsResizing] = useState(false)
  const [pollingForResponse, setPollingForResponse] = useState(false)

  // Artifact editing state
  const [isEditingFlowchart, setIsEditingFlowchart] = useState(false)
  const [isEditingDocument, setIsEditingDocument] = useState(false)
  const [editingCancelled, setEditingCancelled] = useState(false)

  // Navigation confirmation modal state
  const [showNavigationModal, setShowNavigationModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<any>(null)

  // @mention autocomplete
  const [showAdviserPicker, setShowAdviserPicker] = useState(false)
  const [advisers, setAdvisers] = useState<Adviser[]>([])
  const [adviserSearchQuery, setAdviserSearchQuery] = useState('')
  const [mentionStartPos, setMentionStartPos] = useState<number>(0)
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastLoadedConversationRef = useRef<string | null>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  // Canvas integration - get all canvas functions (keeping for artifact storage)
  const canvasHook = useCanvas(activeConversation || '')
  const { addArtifact, updateArtifact, artifacts } = canvasHook

  // LLM-based artifact classification
  const classifyArtifacts = async (content: string): Promise<Array<{ type: string; title: string; contentStart: string; contentEnd: string }>> => {
    try {
      const response = await api.post('/copilot/classify-artifacts', {
        content: content
      })

      return response.data.artifacts || []
    } catch (error) {
      console.error('Artifact classification failed, falling back to pattern matching:', error)
      return []
    }
  }

  // Extract content section based on start and end markers
  const extractContent = (fullContent: string, startMarker: string, endMarker: string): string => {
    const startIndex = startMarker ? fullContent.indexOf(startMarker) : 0
    const endIndex = endMarker ? fullContent.indexOf(endMarker, startIndex + 1) : fullContent.length

    if (startIndex === -1) return fullContent

    const extractedContent = fullContent.substring(
      startIndex,
      endIndex === -1 ? fullContent.length : endIndex
    ).trim()

    return extractedContent || fullContent
  }

  // Extract artifacts from AI response and add to canvas
  const processAIResponse = async (message: Message) => {
    if (message.role !== 'assistant') return

    // Check for artifact markers in the message
    const content = message.content
    const artifacts: Array<{ type: string; title: string; content: any }> = []

    // Look for explicit code block markers first (keep for backward compatibility)
    const documentMatches = content.match(/```(?:document|doc)\n([\s\S]*?)\n```/g)
    const flowchartMatches = content.match(/```flowchart\n([\s\S]*?)\n```/g)
    const prdMatches = content.match(/```prd\n([\s\S]*?)\n```/g)

    // Process explicit markers
    if (documentMatches) {
      documentMatches.forEach((match, index) => {
        const documentContent = match.replace(/```(?:document|doc)\n|\n```/g, '')
        artifacts.push({
          type: 'document',
          title: `Document ${index + 1}`,
          content: { text: documentContent }
        })
      })
    }

    if (flowchartMatches) {
      flowchartMatches.forEach((match, index) => {
        const flowchartContent = match.replace(/```flowchart\n|\n```/g, '')
        artifacts.push({
          type: 'flowchart',
          title: `Flowchart ${index + 1}`,
          content: parseTextToFlowchart(flowchartContent)
        })
      })
    }

    if (prdMatches) {
      prdMatches.forEach((match, index) => {
        const prdContent = match.replace(/```prd\n|\n```/g, '')
        artifacts.push({
          type: 'prd',
          title: `PRD ${index + 1}`,
          content: { sections: [{ title: 'Content', content: prdContent }] }
        })
      })
    }

    // LLM-based intelligent artifact detection (ONLY if no explicit markers were found)
    if (!documentMatches && !flowchartMatches && !prdMatches) {
      try {
        // Use LLM to classify artifacts intelligently
        const classifiedArtifacts = await classifyArtifacts(content)

        for (const artifact of classifiedArtifacts) {
          const { type, title, contentStart, contentEnd } = artifact

          if (type === 'flowchart') {
            // Extract flowchart content and parse it
            const flowchartContent = extractContent(content, contentStart, contentEnd)
            const flowchartData = parseTextToFlowchart(flowchartContent)

            if (flowchartData.nodes.length > 0) {
              artifacts.push({
                type: 'flowchart',
                title: title || 'Process Flowchart',
                content: flowchartData
              })
            } else {
              // Fallback to document if flowchart parsing fails
              artifacts.push({
                type: 'document',
                title: title || 'Process Documentation',
                content: { text: flowchartContent }
              })
            }
          } else if (type === 'document') {
            // Extract document content and structure it
            const documentContent = extractContent(content, contentStart, contentEnd)
            const sections = []
            const lines = documentContent.split('\n')
            let currentSection = { title: 'Overview', content: '' }

            for (const line of lines) {
              if (line.match(/^#{1,3}\s+/) || line.match(/^\*\*\d+\.\s+/)) {
                if (currentSection.content.trim()) {
                  sections.push(currentSection)
                }
                currentSection = {
                  title: line.replace(/^#{1,3}\s+/, '').replace(/^\*\*\d+\.\s+/, '').replace(/\*\*$/, ''),
                  content: ''
                }
              } else {
                currentSection.content += line + '\n'
              }
            }

            if (currentSection.content.trim()) {
              sections.push(currentSection)
            }

            artifacts.push({
              type: 'document',
              title: title || 'Generated Document',
              content: {
                text: documentContent,
                sections: sections.length > 1 ? sections : [{ title: 'Content', content: documentContent }]
              }
            })
          }
        }
      } catch (error) {
        console.error('LLM artifact classification failed, using fallback:', error)

        // Fallback: Create document for substantial content
        if (content.length > 300 && (content.includes('\n\n') || content.includes('##') || content.includes('**'))) {
          artifacts.push({
            type: 'document',
            title: 'Generated Document',
            content: { text: content }
          })
        }
      }
    }

    // Add artifacts to canvas with smart positioning
    artifacts.forEach(artifact => {
      if (activeConversation) {
        const index = artifacts.indexOf(artifact)
        const position = calculateArtifactPosition(index, artifacts.length)

        addArtifact({
          type: artifact.type as any,
          title: artifact.title,
          content: artifact.content,
          position: position,
          size: { width: 400, height: 300 },
          conversationId: activeConversation,
          messageId: message.id.toString()
        })
      }
    })

    // No auto-show needed - artifacts are accessed via buttons
  }

  // Parse text content into flowchart data structure
  const parseTextToFlowchart = (text: string) => {
    const nodes: any[] = []
    const edges: any[] = []

    // Extract steps from text (look for numbered lists, bullet points, or flow indicators)
    const lines = text.split('\n').map(line => line.trim()).filter(line => line)
    const steps: string[] = []

    // First, try to extract from structured text
    for (const line of lines) {
      // Match numbered steps (1. 2. etc.)
      if (line.match(/^\d+\.\s+/)) {
        steps.push(line.replace(/^\d+\.\s+/, ''))
        continue
      }

      // Match bullet points (- * etc.)
      if (line.match(/^[-*•]\s+/)) {
        steps.push(line.replace(/^[-*•]\s+/, ''))
        continue
      }

      // Match flow keywords
      if (line.includes('→') || line.includes('->') || line.includes(' then ') || line.includes(' goes to ')) {
        // Split by arrows and flow words
        const flowParts = line.split(/→|->|\s+then\s+|\s+goes\s+to\s+/).map(part => part.trim())
        steps.push(...flowParts.filter(part => part.length > 3))
        continue
      }

      // Match lines that describe steps or actions in notification/process flows
      if (line.match(/^(notification|user|system|when|if|after|important|available|delivered|manage|learn)/i) ||
          line.includes(' is received') || line.includes(' is ') || line.includes(' can ') || line.includes(' will ') ||
          line.includes(' delivered') || line.includes(' filtered') || line.includes(' checked') ||
          line.includes('based on') || line.includes('go through') || line.includes('learns from')) {
        steps.push(line)
      }
    }

    // If no structured steps found, try to parse from paragraph text
    if (steps.length === 0) {
      const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)

      for (const sentence of sentences) {
        // Look for action-oriented sentences in notification/process flows
        if (sentence.match(/(notification|user|system|check|deliver|manage|learn|receive|filter|analyze|send|priority|context|channel|setting)/i)) {
          steps.push(sentence)
        }
      }
    }

    // Special handling for journey mapping and process flows
    if (steps.length === 0) {
      // Handle journey stages (Stage/Description tables)
      if (text.includes('Stage') && text.includes('Description')) {
        const stageMatches = text.match(/^(Awareness|Consideration|Acquisition|Onboarding|Engagement|Retention|Advocacy)/gm)
        if (stageMatches) {
          steps.push(...stageMatches.map(stage => `${stage} Stage`))
        }
      }

      // Handle notification system flows
      if (text.toLowerCase().includes('notification') && (text.includes('key steps') || text.includes('process'))) {
        const processSteps = [
          'Notification Received',
          'Filter & Prioritize',
          'Content Analysis',
          'Check User Context',
          'Select Delivery Channel',
          'Deliver Notification',
          'User Management',
          'System Learning'
        ]
        steps.push(...processSteps)
      }

      // Handle touchpoint/journey mapping
      if (text.includes('touchpoint') || text.includes('customer journey')) {
        const journeySteps = [
          'User Awareness',
          'Consider Options',
          'Make Decision',
          'First Experience',
          'Build Habit',
          'Long-term Engagement'
        ]
        steps.push(...journeySteps)
      }

      // General process extraction from paragraphs
      if (steps.length === 0 && text.length > 200) {
        const processWords = ['step', 'stage', 'phase', 'process', 'flow', 'journey']
        const hasProcessLanguage = processWords.some(word => text.toLowerCase().includes(word))

        if (hasProcessLanguage) {
          // Extract key action words and create generic process steps
          const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
          const actionSentences = sentences.filter(s =>
            s.match(/(received?|process|check|deliver|manage|learn|analyze|filter|select|enable|create)/i)
          ).slice(0, 6)

          if (actionSentences.length > 0) {
            steps.push(...actionSentences)
          }
        }
      }
    }

    // Clean and limit steps
    const uniqueSteps = [...new Set(steps)]
      .map(step => step.replace(/^(and |then |next |after that )/i, ''))
      .filter(step => step.length > 5 && step.length < 200)
      .slice(0, 8) // Limit to 8 nodes for clarity

    // Create nodes with better positioning
    uniqueSteps.forEach((step, index) => {
      // Create shorter labels for nodes
      let label = step
      if (step.length > 50) {
        const words = step.split(' ')
        label = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '')
      }

      // Position nodes in a more logical flow layout
      const cols = Math.min(3, Math.ceil(uniqueSteps.length / 3))
      const col = index % cols
      const row = Math.floor(index / cols)

      nodes.push({
        id: `node-${index}`,
        label: label,
        x: 30 + col * 120,
        y: 30 + row * 60
      })
    })

    // Create connections between sequential nodes
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        from: nodes[i].id,
        to: nodes[i + 1].id,
        label: ''
      })
    }

    // Special handling for feedback loops and decision points
    const lowerText = text.toLowerCase()
    if (lowerText.includes('learning') || lowerText.includes('adapts') || lowerText.includes('improves')) {
      const lastIndex = nodes.length - 1
      if (lastIndex > 2) {
        // Connect last node back to an earlier node for learning loop
        edges.push({
          from: nodes[lastIndex].id,
          to: nodes[Math.floor(lastIndex / 2)].id,
          label: 'feedback loop'
        })
      }
    }

    // Add decision branches if text suggests alternatives
    if (lowerText.includes('if available') || lowerText.includes('if important') || lowerText.includes('context')) {
      const midIndex = Math.floor(nodes.length / 2)
      if (midIndex > 0 && midIndex < nodes.length - 1) {
        // Add alternative path
        edges.push({
          from: nodes[midIndex].id,
          to: nodes[nodes.length - 1].id,
          label: 'alternative'
        })
      }
    }

    return {
      description: `Interactive flowchart showing the process flow`,
      nodes,
      edges
    }
  }

  // Calculate smart positioning for artifacts to avoid overlaps
  const calculateArtifactPosition = (index: number, totalArtifacts: number) => {
    const artifactWidth = 400
    const artifactHeight = 300
    const padding = 50
    const startX = 80
    const startY = 80

    // For single artifact, center it nicely
    if (totalArtifacts === 1) {
      return { x: startX + 100, y: startY + 50 }
    }

    // For 2 artifacts, place them side by side with proper spacing
    if (totalArtifacts === 2) {
      return {
        x: startX + (index * (artifactWidth + padding)),
        y: startY + 50
      }
    }

    // For 3+ artifacts, use a grid layout
    const maxCols = Math.min(3, Math.ceil(Math.sqrt(totalArtifacts))) // Max 3 columns
    const col = index % maxCols
    const row = Math.floor(index / maxCols)

    return {
      x: startX + col * (artifactWidth + padding),
      y: startY + row * (artifactHeight + padding)
    }
  }

  // Generate summary for AI responses that have artifacts
  const generateMessageSummary = (message: Message): string => {
    const messageArtifacts = getMessageArtifacts(message.id.toString())
    if (messageArtifacts.length === 0) return message.content

    // For flowchart artifacts, show a brief description
    const hasFlowchart = messageArtifacts.some(a => a.type === 'flowchart')
    if (hasFlowchart) {
      return `I've created a visual flowchart diagram based on your request. The diagram shows the key steps and connections in the process.\n\n*[Interactive flowchart available in Canvas for editing and refinement]*`
    }

    // Create a summary that replaces long content with brief descriptions
    let summary = message.content

    // If message is very long and has artifacts, show a condensed version
    if (summary.length > 800 && messageArtifacts.length > 0) {
      const firstLines = summary.split('\n').slice(0, 3).join('\n')
      return `${firstLines}\n\n*[Content has been moved to Canvas artifacts for better editing experience]*`
    }

    return summary
  }


  // Check if a message has associated artifacts
  const getMessageArtifacts = (messageId: string) => {
    return artifacts.filter(artifact => artifact.messageId === messageId.toString())
  }

  // Open artifact in right panel
  // Helper function to check if any artifact is currently being edited
  const isAnyArtifactBeingEdited = () => {
    return isEditingFlowchart || isEditingDocument
  }

  // Helper function to get which artifact type is being edited
  const getEditingArtifactType = () => {
    if (isEditingFlowchart) return 'flowchart'
    if (isEditingDocument) return 'document'
    return null
  }

  const openArtifactForMessage = (messageId: string) => {
    const messageArtifacts = getMessageArtifacts(messageId)
    if (messageArtifacts.length === 0) return

    const targetArtifact = messageArtifacts[0]

    // Check if we're currently editing an artifact
    if (isAnyArtifactBeingEdited() && expandedArtifact) {
      // Show confirmation modal
      setPendingNavigation(targetArtifact)
      setShowNavigationModal(true)
    } else {
      // No editing in progress, navigate directly
      setExpandedArtifact(targetArtifact)
    }
  }

  // Resizer functionality for artifact panel
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()

    const startX = e.clientX
    const startWidth = artifactPanelWidth

    const handleMouseMove = (e: MouseEvent) => {
      const diff = startX - e.clientX
      const newWidth = Math.min(Math.max(400, startWidth + diff), window.innerWidth - 400)
      setArtifactPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Save artifact changes
  const handleArtifactSave = (updatedContent: any) => {
    if (expandedArtifact && !editingCancelled) {
      updateArtifact(expandedArtifact.id, {
        content: updatedContent
      })
      // Also update the expanded artifact state to reflect changes immediately
      setExpandedArtifact({
        ...expandedArtifact,
        content: updatedContent,
        updatedAt: new Date().toISOString()
      })
      console.log('Artifact saved:', expandedArtifact.id, updatedContent)
    } else if (editingCancelled) {
      console.log('Save prevented due to cancellation')
    }
  }

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
      // Calculate position relative to input container
      if (inputContainerRef.current) {
        const rect = inputContainerRef.current.getBoundingClientRect()
        setPickerPosition({
          top: rect.top - 10,
          left: rect.left,
          width: rect.width
        })
      }
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

      // Note: Artifacts are only processed for NEW messages, not when loading existing conversations
      // This prevents unnecessary LLM calls when opening conversations

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

          // Process AI response for artifacts
          await processAIResponse(lastMessage)
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

      // Process AI response for artifacts
      await processAIResponse(response.data.message)

      // Reload conversation list to update last message
      await loadConversations()
    } catch (err: any) {
      // Backend now saves error messages to the conversation, so we just reload
      // to show the error message in the chat instead of a pop-up alert
      if (activeConversation) {
        // Reload conversation to get the error message
        await loadConversation(activeConversation)
      } else {
        // If this was a new conversation that failed, just remove optimistic messages
        setMessages(prev => prev.slice(0, -2))
        alert(`Failed to send message: ${err.response?.data?.detail || err.message}`)
      }
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
        <title>Workbench - Evols</title>
      </Head>

      <OnboardingTour />

      <div className="flex flex-col h-screen">
        <Header user={user} currentPage="workbench" />

        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar - Conversation History (Toggleable) */}
          {showHistorySidebar && (
            <div className="w-80 border-r flex flex-col relative z-10" style={{
              background: 'hsl(var(--card) / 0.95)',
              borderColor: 'hsl(var(--border))',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}>
              {/* Sidebar Header */}
              <div className="p-4 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm" style={{ color: 'hsl(var(--foreground))' }}>History</h2>
                  <button
                    onClick={() => setShowHistorySidebar(false)}
                    className="p-1.5 rounded transition hover-lift"
                    title="Close"
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
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
                    <div className="w-full max-w-3xl mx-auto mb-8" ref={inputContainerRef}>
                      {/* @mention Autocomplete */}
                      {showAdviserPicker && pickerPosition && typeof document !== 'undefined' && createPortal(
                        <div
                          className="fixed card shadow-lg max-h-80 overflow-y-auto z-[9999]"
                          style={{
                            top: `${pickerPosition.top}px`,
                            left: `${pickerPosition.left}px`,
                            width: `${pickerPosition.width}px`,
                            transform: 'translateY(-100%)'
                          }}
                        >
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
                        </div>,
                        document.body
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
                              <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
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
                              <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
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
                                  h1: ({ children }) => <h1 className="text-xl mb-3 mt-4 first:mt-0">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-lg mb-2 mt-3 first:mt-0">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-base mb-2 mt-2 first:mt-0">{children}</h3>,
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
                                    <th className="px-4 py-2 text-left border border-gray-300 dark:border-gray-600">
                                      {children}
                                    </th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
                                      {children}
                                    </td>
                                  ),
                                  strong: ({ children }) => <strong className="">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
                                      {children}
                                    </blockquote>
                                  ),
                                  hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
                                }}
                              >
                                {generateMessageSummary(msg)}
                              </ReactMarkdown>
                            ) : (
                              <p className="whitespace-pre-wrap m-0">{generateMessageSummary(msg)}</p>
                            )}
                          </div>

                          {/* Artifact View Button */}
                          {msg.role === 'assistant' && getMessageArtifacts(msg.id.toString()).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                              <button
                                onClick={() => openArtifactForMessage(msg.id.toString())}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              >
                                <Layers className="w-3 h-3" />
                                <span>View {getMessageArtifacts(msg.id.toString()).length} artifact{getMessageArtifacts(msg.id.toString()).length === 1 ? '' : 's'}</span>
                              </button>
                            </div>
                          )}
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
                <div className="max-w-4xl mx-auto relative" ref={inputContainerRef}>
                  {/* @mention Autocomplete */}
                  {showAdviserPicker && pickerPosition && typeof document !== 'undefined' && createPortal(
                    <div
                      className="fixed card shadow-lg max-h-80 overflow-y-auto z-[9999]"
                      style={{
                        top: `${pickerPosition.top}px`,
                        left: `${pickerPosition.left}px`,
                        width: `${pickerPosition.width}px`,
                        transform: 'translateY(-100%)'
                      }}
                    >
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
                    </div>,
                    document.body
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

          {/* Right Sidebar - Artifact Viewer (Toggleable) */}
          {expandedArtifact && (
            <div className="border-l flex flex-col relative z-10" style={{
              width: `${artifactPanelWidth}px`,
              background: 'hsl(var(--card) / 0.95)',
              borderColor: 'hsl(var(--border))',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}>
              {/* Resize Handle */}
              <div
                className={`absolute left-0 top-0 h-full w-1 cursor-col-resize transition-all duration-200 z-20 ${
                  isResizing
                    ? 'bg-blue-500 shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 hover:shadow-md'
                }`}
                style={{ marginLeft: '-2px' }}
                onMouseDown={handleResizeStart}
                title="Drag to resize panel"
              />
              {/* Invisible wider hit area for easier grabbing */}
              <div
                className="absolute left-0 top-0 h-full w-3 cursor-col-resize z-19"
                style={{ marginLeft: '-6px' }}
                onMouseDown={handleResizeStart}
              />
              {/* Artifact Header */}
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))' }}>
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                    {expandedArtifact.title}
                  </h2>
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded capitalize text-gray-600 dark:text-gray-300">
                    {expandedArtifact.type}
                  </span>
                  {(() => {
                    // Show "Edit Mode" only if the current artifact is being edited
                    const currentlyEditing = expandedArtifact.type === 'flowchart' ? isEditingFlowchart :
                                           (expandedArtifact.type === 'document' || expandedArtifact.type === 'prd') ? isEditingDocument :
                                           false;
                    return currentlyEditing && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                        Edit Mode
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {/* Universal Edit Controls */}
                  {(expandedArtifact.type === 'flowchart' || expandedArtifact.type === 'document' || expandedArtifact.type === 'prd') && (() => {
                    // Determine if the current artifact is being edited
                    const currentlyEditing = expandedArtifact.type === 'flowchart' ? isEditingFlowchart :
                                           (expandedArtifact.type === 'document' || expandedArtifact.type === 'prd') ? isEditingDocument :
                                           false;

                    return (
                    <>
                      {!currentlyEditing ? (
                        <button
                          onClick={() => {
                            setEditingCancelled(false) // Reset cancellation flag when starting to edit
                            if (expandedArtifact.type === 'flowchart') {
                              setIsEditingFlowchart(true)
                            } else {
                              setIsEditingDocument(true)
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              console.log('Save button clicked for artifact:', expandedArtifact?.type)

                              // Save current editing state - we'll need to get it from the components
                              // For now, just exit editing mode and the components should save their state
                              setIsEditingFlowchart(false)
                              setIsEditingDocument(false)
                              setEditingCancelled(false)
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              console.log('Cancel button clicked for artifact:', expandedArtifact?.type)
                              // Set cancellation flag and exit editing
                              setEditingCancelled(true)
                              setIsEditingFlowchart(false)
                              setIsEditingDocument(false)
                              // Reset cancellation flag after exiting
                              setTimeout(() => setEditingCancelled(false), 100)
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                    );
                  })()}
                  <button
                    onClick={() => {
                      // Check if we're currently editing an artifact
                      if (isAnyArtifactBeingEdited()) {
                        // Show confirmation modal for closing
                        setPendingNavigation(null) // null means close, not navigate
                        setShowNavigationModal(true)
                      } else {
                        // No editing in progress, close directly
                        setExpandedArtifact(null)
                        setIsEditingFlowchart(false)
                        setIsEditingDocument(false)
                      }
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Artifact Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto">
                  <ArtifactRenderer
                    artifact={expandedArtifact}
                    expanded
                    onSave={handleArtifactSave}
                    editingState={expandedArtifact.type === 'flowchart' ? isEditingFlowchart :
                                 (expandedArtifact.type === 'document' || expandedArtifact.type === 'prd') ? isEditingDocument :
                                 undefined}
                    editingCancelled={editingCancelled}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Confirmation Modal */}
      {showNavigationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Unsaved Changes
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You have unsaved changes in your {getEditingArtifactType()}. What would you like to do?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  // Save the current changes first
                  console.log('Save and navigate clicked')

                  // Trigger save by exiting edit mode normally
                  setIsEditingFlowchart(false)
                  setIsEditingDocument(false)
                  setEditingCancelled(false)

                  // Close modal
                  setShowNavigationModal(false)

                  // Navigate after a brief delay to let save complete
                  setTimeout(() => {
                    if (pendingNavigation) {
                      setExpandedArtifact(pendingNavigation)
                    } else {
                      setExpandedArtifact(null)
                    }
                    setPendingNavigation(null)
                  }, 100)
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save & Continue
              </button>

              <button
                onClick={() => {
                  // Discard changes and navigate
                  console.log('Discard and navigate clicked')

                  // Set cancellation flag to discard changes
                  setEditingCancelled(true)
                  setIsEditingFlowchart(false)
                  setIsEditingDocument(false)

                  // Close modal
                  setShowNavigationModal(false)

                  // Navigate after a brief delay
                  setTimeout(() => {
                    if (pendingNavigation) {
                      setExpandedArtifact(pendingNavigation)
                    } else {
                      setExpandedArtifact(null)
                    }
                    setPendingNavigation(null)
                    setEditingCancelled(false)
                  }, 100)
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Discard & Continue
              </button>

              <button
                onClick={() => {
                  // Stay in current view
                  setShowNavigationModal(false)
                  setPendingNavigation(null)
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
