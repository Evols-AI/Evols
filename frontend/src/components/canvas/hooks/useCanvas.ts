import { useState, useCallback, useEffect } from 'react'

export interface Artifact {
  id: string
  type: 'flowchart' | 'prd' | 'wireframe' | 'document'
  title: string
  content: any
  position: { x: number; y: number }
  size: { width: number; height: number }
  conversationId: string
  messageId: string
  createdAt: string
  updatedAt: string
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export function useCanvas(conversationId: string) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null)
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 50, y: 50, zoom: 1 })

  // Load artifacts for conversation
  useEffect(() => {
    if (conversationId) {
      loadArtifacts(conversationId)
    }
  }, [conversationId])

  const loadArtifacts = async (conversationId: string) => {
    try {
      // TODO: Replace with actual API call
      const storedArtifacts = localStorage.getItem(`artifacts-${conversationId}`)
      if (storedArtifacts) {
        setArtifacts(JSON.parse(storedArtifacts))
      }
    } catch (error) {
      console.error('Failed to load artifacts:', error)
    }
  }

  const clearAllArtifacts = useCallback(() => {
    setArtifacts([])
    if (conversationId) {
      localStorage.removeItem(`artifacts-${conversationId}`)
    }
  }, [conversationId])

  const saveArtifacts = useCallback((newArtifacts: Artifact[]) => {
    if (conversationId) {
      localStorage.setItem(`artifacts-${conversationId}`, JSON.stringify(newArtifacts))
    }
  }, [conversationId])

  const addArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const updatedArtifacts = [...artifacts, newArtifact]
    setArtifacts(updatedArtifacts)
    saveArtifacts(updatedArtifacts)

    return newArtifact.id
  }, [artifacts, saveArtifacts])

  const updateArtifact = useCallback((id: string, updates: Partial<Artifact>) => {
    const updatedArtifacts = artifacts.map(artifact =>
      artifact.id === id
        ? { ...artifact, ...updates, updatedAt: new Date().toISOString() }
        : artifact
    )
    setArtifacts(updatedArtifacts)
    saveArtifacts(updatedArtifacts)
  }, [artifacts, saveArtifacts])

  const deleteArtifact = useCallback((id: string) => {
    const updatedArtifacts = artifacts.filter(artifact => artifact.id !== id)
    setArtifacts(updatedArtifacts)
    saveArtifacts(updatedArtifacts)

    if (selectedArtifact === id) {
      setSelectedArtifact(null)
    }
  }, [artifacts, selectedArtifact, saveArtifacts])

  const selectArtifact = useCallback((id: string | null) => {
    setSelectedArtifact(id)
  }, [])

  const expandArtifact = useCallback((id: string | null) => {
    setExpandedArtifact(id)
  }, [])

  const closeExpandedArtifact = useCallback(() => {
    setExpandedArtifact(null)
  }, [])

  const zoomIn = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: Math.min(2, prev.zoom + 0.2)
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: Math.max(0.1, prev.zoom - 0.2)
    }))
  }, [])

  const fitToScreen = useCallback(() => {
    if (artifacts.length === 0) {
      setViewport({ x: 50, y: 50, zoom: 1 })
      return
    }

    // Calculate bounds of all artifacts
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    artifacts.forEach(artifact => {
      minX = Math.min(minX, artifact.position.x)
      minY = Math.min(minY, artifact.position.y)
      maxX = Math.max(maxX, artifact.position.x + artifact.size.width)
      maxY = Math.max(maxY, artifact.position.y + artifact.size.height)
    })

    const width = maxX - minX
    const height = maxY - minY
    const padding = 50

    // Calculate zoom to fit all artifacts with padding
    const containerWidth = window.innerWidth * 0.6 // Assuming canvas takes 60% width
    const containerHeight = window.innerHeight - 200 // Account for headers

    const zoomX = (containerWidth - padding * 2) / width
    const zoomY = (containerHeight - padding * 2) / height
    const zoom = Math.min(1, Math.min(zoomX, zoomY))

    setViewport({
      x: -minX * zoom + padding,
      y: -minY * zoom + padding,
      zoom
    })
  }, [artifacts])

  return {
    artifacts,
    selectedArtifact,
    expandedArtifact,
    viewport,
    setViewport,
    addArtifact,
    updateArtifact,
    deleteArtifact,
    selectArtifact,
    expandArtifact,
    closeExpandedArtifact,
    clearAllArtifacts,
    zoomIn,
    zoomOut,
    fitToScreen
  }
}