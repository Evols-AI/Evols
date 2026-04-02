import React, { useEffect, useRef, useState } from 'react'
import { Artifact } from './hooks/useCanvas'
import { FileText, GitBranch, Layers, File, Maximize2, Edit3, Plus, Trash2, Move } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Dynamic import for mermaid to avoid SSR issues
let mermaid: any = null
if (typeof window !== 'undefined') {
  import('mermaid').then(m => {
    mermaid = m.default
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      themeVariables: {
        fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }
    })
  })
}

interface ArtifactRendererProps {
  artifact: Artifact
  onExpand?: () => void
  expanded?: boolean
  onSave?: (updatedContent: any) => void
  editingState?: boolean
  editingCancelled?: boolean
}

export function ArtifactRenderer({ artifact, onExpand, expanded = false, onSave, editingState, editingCancelled }: ArtifactRendererProps) {
  const renderContent = () => {
    switch (artifact.type) {
      case 'flowchart':
        return <FlowchartArtifact content={artifact.content} expanded={expanded} onSave={onSave} actualIsEditingOverride={editingState} editingCancelled={editingCancelled} />
      case 'prd':
        return <PRDArtifact content={artifact.content} expanded={expanded} onSave={onSave} editingState={editingState} editingCancelled={editingCancelled} />
      case 'wireframe':
        return <WireframeArtifact content={artifact.content} />
      case 'document':
        return <DocumentArtifact content={artifact.content} expanded={expanded} onSave={onSave} editingState={editingState} editingCancelled={editingCancelled} />
      default:
        return <div className="p-4 text-gray-500">Unknown artifact type</div>
    }
  }

  const getIcon = () => {
    switch (artifact.type) {
      case 'flowchart':
        return <GitBranch className="w-4 h-4" />
      case 'prd':
        return <FileText className="w-4 h-4" />
      case 'wireframe':
        return <Layers className="w-4 h-4" />
      case 'document':
        return <File className="w-4 h-4" />
      default:
        return <File className="w-4 h-4" />
    }
  }

  // For expanded view, render content directly without wrapper to avoid double headers
  if (expanded) {
    return renderContent()
  }

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Artifact Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        {getIcon()}
        <h3 className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
          {artifact.title}
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {artifact.type}
          </div>
          {onExpand && !expanded && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onExpand()
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Expand to edit"
            >
              <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          )}
        </div>
      </div>

      {/* Artifact Content */}
      <div className="w-full h-full overflow-auto">
        {renderContent()}
      </div>
    </div>
  )
}

// Flowchart Artifact Component
function FlowchartArtifact({ content, expanded = false, onSave, actualIsEditingOverride, editingCancelled }: { content: any; expanded?: boolean; onSave?: (content: any) => void; actualIsEditingOverride?: boolean; editingCancelled?: boolean }) {
  const mermaidRef = useRef<HTMLDivElement>(null)
  const rawNodes = content?.nodes || []
  const rawEdges = content?.edges || []
  const [editableNodes, setEditableNodes] = useState(rawNodes)
  const [editableEdges, setEditableEdges] = useState(rawEdges)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectSource, setConnectSource] = useState<string | null>(null)
  // Store original state for cancel functionality
  const [originalNodes, setOriginalNodes] = useState(rawNodes)
  const [originalEdges, setOriginalEdges] = useState(rawEdges)

  // Use editing state override from parent if provided
  const actualIsEditing = actualIsEditingOverride !== undefined ? actualIsEditingOverride : false

  // Update original state when raw content changes
  React.useEffect(() => {
    setOriginalNodes(rawNodes)
    setOriginalEdges(rawEdges)
    setEditableNodes(rawNodes)
    setEditableEdges(rawEdges)
  }, [rawNodes, rawEdges])

  // Handle save/cancel when exiting edit mode
  const prevEditingState = React.useRef(actualIsEditing)
  React.useEffect(() => {
    // When going from editing to not editing
    if (prevEditingState.current === true && actualIsEditing === false) {
      if (editingCancelled) {
        console.log('Flowchart cancel detected - resetting to original state')
        setEditableNodes(originalNodes)
        setEditableEdges(originalEdges)
        setSelectedNode(null)
        setSelectedEdge(null)
        setConnectMode(false)
        setConnectSource(null)
      } else {
        // Save the changes
        console.log('Flowchart save on exit - saving changes')
        if (onSave) {
          onSave({
            ...content,
            nodes: editableNodes,
            edges: editableEdges
          })
        }
      }
    }
    prevEditingState.current = actualIsEditing
  }, [actualIsEditing, editingCancelled, originalNodes, originalEdges, onSave, content, editableNodes, editableEdges])

  // Reset to original state when editing stops (for cancel functionality)
  const prevEditingOverride = React.useRef(actualIsEditingOverride)
  React.useEffect(() => {
    if (prevEditingOverride.current === true && actualIsEditingOverride === false) {
      // Reset to original state when editing is cancelled
      setEditableNodes(originalNodes)
      setEditableEdges(originalEdges)
      setSelectedNode(null)
      setSelectedEdge(null)
      setConnectMode(false)
      setConnectSource(null)
    }
    prevEditingOverride.current = actualIsEditingOverride
  }, [actualIsEditingOverride, originalNodes, originalEdges])

  // Initialize Mermaid with theme detection
  useEffect(() => {
    if (!mermaid) return

    // Detect if we're in dark mode
    const isDarkMode = document.documentElement.classList.contains('dark') ||
                       window.matchMedia('(prefers-color-scheme: dark)').matches

    mermaid.initialize({
      startOnLoad: true,
      theme: isDarkMode ? 'dark' : 'default',
      themeVariables: isDarkMode ? {
        // Dark mode colors
        primaryColor: '#1E40AF',
        primaryTextColor: '#F3F4F6',
        primaryBorderColor: '#3B82F6',
        lineColor: '#9CA3AF',
        secondaryColor: '#1F2937',
        tertiaryColor: '#111827',
        background: '#1F2937',
        mainBkg: '#374151',
        secondBkg: '#4B5563',
        nodeBorder: '#60A5FA',
        clusterBkg: '#374151',
        edgeLabelBackground: '#1F2937',
      } : {
        // Light mode colors
        primaryColor: '#3182CE',
        primaryTextColor: '#2D3748',
        primaryBorderColor: '#2B6CB0',
        lineColor: '#4A5568',
        secondaryColor: '#EBF8FF',
        tertiaryColor: '#F7FAFC',
        background: '#FFFFFF',
        mainBkg: '#EBF8FF',
        secondBkg: '#F7FAFC',
        nodeBorder: '#3182CE',
        clusterBkg: '#F7FAFC',
        edgeLabelBackground: '#FFFFFF',
      },
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        padding: 8,
        nodeSpacing: 25,
        rankSpacing: 40,
        useMaxWidth: true,
      },
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 10,
    })
  }, [])

  // Re-render when theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      if (!mermaid) return

      // Re-initialize Mermaid with new theme
      const isDarkMode = document.documentElement.classList.contains('dark') ||
                         window.matchMedia('(prefers-color-scheme: dark)').matches

      mermaid.initialize({
        startOnLoad: true,
        theme: isDarkMode ? 'dark' : 'default',
        themeVariables: isDarkMode ? {
          // Dark mode colors
          primaryColor: '#1E40AF',
          primaryTextColor: '#F3F4F6',
          primaryBorderColor: '#3B82F6',
          lineColor: '#9CA3AF',
          secondaryColor: '#1F2937',
          tertiaryColor: '#111827',
          background: '#1F2937',
          mainBkg: '#374151',
          secondBkg: '#4B5563',
          nodeBorder: '#60A5FA',
          clusterBkg: '#374151',
          edgeLabelBackground: '#1F2937',
        } : {
          // Light mode colors
          primaryColor: '#3182CE',
          primaryTextColor: '#2D3748',
          primaryBorderColor: '#2B6CB0',
          lineColor: '#4A5568',
          secondaryColor: '#EBF8FF',
          tertiaryColor: '#F7FAFC',
          background: '#FFFFFF',
          mainBkg: '#EBF8FF',
          secondBkg: '#F7FAFC',
          nodeBorder: '#3182CE',
          clusterBkg: '#F7FAFC',
          edgeLabelBackground: '#FFFFFF',
        },
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
          padding: 8,
          nodeSpacing: 25,
          rankSpacing: 40,
          useMaxWidth: true,
        },
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 10,
      })
    }

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          handleThemeChange()
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  // Reset connection mode when editing state changes
  useEffect(() => {
    if (!actualIsEditing) {
      setConnectMode(false)
      setConnectSource(null)
      setSelectedNode(null)
      setSelectedEdge(null)
    }
  }, [actualIsEditing])

  // Apply immediate visual feedback for connect mode
  useEffect(() => {
    if (mermaidRef.current) {
      const svg = mermaidRef.current.querySelector('svg')
      if (svg && actualIsEditing) {
        const nodes = svg.querySelectorAll('.node')

        if (connectMode) {
          // Add connect mode styling to all nodes
          nodes.forEach((node) => {
            const nodeElement = node as SVGElement
            nodeElement.style.cursor = 'pointer'
            nodeElement.setAttribute('title', 'Click to select for connection')
          })
          console.log('Connect mode activated - nodes should be clickable')
        } else {
          // Reset to normal editing mode styling
          nodes.forEach((node) => {
            const nodeElement = node as SVGElement
            nodeElement.style.cursor = 'move'
            nodeElement.style.outline = '2px dashed rgba(59, 130, 246, 0.5)'
            nodeElement.style.outlineOffset = '0'
            nodeElement.setAttribute('title', 'Double-click to edit, drag to move')
          })
          console.log('Normal edit mode - nodes reset to editable state')
        }
      }
    }
  }, [connectMode, actualIsEditing])

  useEffect(() => {
    const nodesToRender = actualIsEditing ? editableNodes : rawNodes
    const edgesToRender = actualIsEditing ? editableEdges : rawEdges

    if (mermaidRef.current && nodesToRender.length > 0) {
      // Convert our node/edge format to Mermaid syntax
      let mermaidCode = 'flowchart TD\n'

      // Create a mapping of clean IDs to original IDs
      const idMapping: { [key: string]: string } = {}

      // Add nodes with clean labels
      nodesToRender.forEach((node: any) => {
        // Sanitize node label for Mermaid
        const cleanLabel = node.label
          .replace(/['"]/g, '')
          .replace(/[^\w\s-]/g, '')
          .substring(0, 50)
          .trim()

        // Create a clean but unique ID for Mermaid
        const cleanId = `n_${node.id.replace(/[^\w]/g, '_')}`
        idMapping[cleanId] = node.id

        mermaidCode += `    ${cleanId}["${cleanLabel || 'Node'}"]\n`
      })

      console.log('ID Mapping for Mermaid:', idMapping)

      console.log('Nodes added to Mermaid code:', nodesToRender.length)

      // Add edges with validation
      edgesToRender.forEach((edge: any) => {
        // Validate edge has valid source and target
        const sourceExists = nodesToRender.some((n: any) => n.id === edge.from)
        const targetExists = nodesToRender.some((n: any) => n.id === edge.to)

        if (sourceExists && targetExists) {
          const cleanFrom = `n_${edge.from.replace(/[^\w]/g, '_')}`
          const cleanTo = `n_${edge.to.replace(/[^\w]/g, '_')}`

          if (edge.label && edge.label.trim()) {
            // Sanitize edge label for Mermaid
            const cleanLabel = edge.label
              .replace(/['"]/g, '')
              .replace(/[|]/g, '')
              .replace(/[^\w\s-]/g, '')
              .substring(0, 30)
              .trim()

            mermaidCode += `    ${cleanFrom} -->|"${cleanLabel}"| ${cleanTo}\n`
          } else {
            mermaidCode += `    ${cleanFrom} --> ${cleanTo}\n`
          }
        } else {
          console.warn('Skipping invalid edge:', edge, { sourceExists, targetExists })
        }
      })

      console.log('Edges added to Mermaid code:', edgesToRender.filter((edge: any) =>
        nodesToRender.some((n: any) => n.id === edge.from) &&
        nodesToRender.some((n: any) => n.id === edge.to)
      ).length)

      console.log('Generated Mermaid code:\n', mermaidCode)

      // Style the nodes
      mermaidCode += `
    classDef default fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2D3748
    classDef startEnd fill:#C6F6D5,stroke:#38A169,stroke-width:2px,color:#1A202C
    classDef process fill:#FED7D7,stroke:#E53E3E,stroke-width:2px,color:#1A202C
      `

      // Clear previous content
      mermaidRef.current.innerHTML = ''

      // Generate unique ID for this diagram
      const diagramId = `mermaid-${Date.now()}`

      // Validate Mermaid code before rendering
      if (nodesToRender.length === 0) {
        console.warn('No nodes to render')
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = '<div class="p-4 text-center text-gray-500">No nodes to display</div>'
        }
        return
      }

      console.log('Attempting to render Mermaid diagram with code:', mermaidCode)

      if (!mermaid) {
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = '<div class="p-4 text-gray-500">Loading diagram...</div>'
        }
        return
      }

      // Render Mermaid diagram
      mermaid.render(diagramId, mermaidCode).then((result: any) => {
        console.log('Mermaid render successful')
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = result.svg

          // Apply responsive and scrollable styling to the SVG
          const svg = mermaidRef.current.querySelector('svg')
          if (svg) {
            // Get original SVG dimensions
            const viewBox = svg.getAttribute('viewBox')
            const originalWidth = svg.getAttribute('width')

            // Make SVG responsive and fit container
            svg.style.width = 'auto'
            svg.style.height = 'auto'
            svg.style.maxWidth = '100%'
            svg.style.maxHeight = '100%'
            svg.style.display = 'block'
            svg.style.margin = '0 auto'

            // If diagram is too wide, allow horizontal scrolling
            const containerWidth = mermaidRef.current.clientWidth
            if (originalWidth && parseInt(originalWidth) > containerWidth) {
              svg.style.minWidth = originalWidth + 'px'
              svg.style.width = originalWidth + 'px'
            }

            // Ensure proper scaling for small containers
            if (viewBox) {
              svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
            }

            // Add global styles for selected and connecting nodes
            if (actualIsEditing && expanded) {
              const style = document.createElement('style')
              style.textContent = `
                .selected-node {
                  filter: drop-shadow(0 0 8px #3b82f6) !important;
                }
                .selected-node rect, .selected-node path {
                  stroke: #3b82f6 !important;
                  stroke-width: 3px !important;
                }
                .connect-source {
                  filter: drop-shadow(0 0 8px #10b981) !important;
                }
                .connect-source rect, .connect-source path {
                  stroke: #10b981 !important;
                  stroke-width: 3px !important;
                }
              `
              document.head.appendChild(style)
            }

            // Add click handlers for editing mode using EVENT DELEGATION
            if (actualIsEditing && expanded) {
              console.log('Setting up node editing handlers using event delegation')

              // Remove any existing delegated listeners
              if ((svg as any)._hasDelegatedListeners) {
                console.log('Skipping - delegated listeners already attached')
                return
              }
              (svg as any)._hasDelegatedListeners = true

              // Use event delegation on the SVG element for both nodes and edges
              svg.addEventListener('click', (e) => {
                e.stopPropagation()

                // Check if we clicked on a node first
                const nodeElement = (e.target as Element).closest('.node') as SVGElement
                if (nodeElement) {
                  const nodeId = nodeElement.getAttribute('data-node-id')
                  if (!nodeId) {
                    console.warn('No node ID found for clicked element')
                    return
                  }

                  console.log('Delegated click detected on node:', nodeId, 'Connect mode:', connectMode)
                  // Clear edge selection when selecting node
                  setSelectedEdge(null)
                  svg.querySelectorAll('.edgePath, .edgeLabel').forEach(e => e.classList.remove('selected-edge'))

                  if (connectMode) {
                  // Handle connection mode
                  if (!connectSource) {
                    // First click in connect mode - select source
                    setConnectSource(nodeId)
                    console.log('Connect source set to:', nodeId)

                    // Visual feedback for source node
                    svg.querySelectorAll('.node').forEach(n => {
                      n.classList.remove('selected-node', 'connect-source')
                    })
                    nodeElement.classList.add('connect-source')
                    nodeElement.style.outline = '3px solid #10b981'
                    nodeElement.style.outlineOffset = '2px'

                  } else if (connectSource !== nodeId) {
                    // Second click in connect mode - create edge
                    const edgeLabel = prompt('Enter edge label (optional):') || ''

                    // Validate edge doesn't already exist
                    const edgeExists = editableEdges.some((edge: any) =>
                      edge.from === connectSource && edge.to === nodeId
                    )

                    if (!edgeExists) {
                      const newEdge = {
                        from: connectSource,
                        to: nodeId,
                        label: edgeLabel.trim()
                      }

                      console.log('Creating edge:', newEdge)

                      // Validate that both nodes exist
                      const sourceExists = editableNodes.some((n: any) => n.id === connectSource)
                      const targetExists = editableNodes.some((n: any) => n.id === nodeId)

                      if (sourceExists && targetExists) {
                        setEditableEdges((prev: any) => {
                          const newEdges = [...prev, newEdge]
                          console.log('Updated edges:', newEdges)
                          return newEdges
                        })
                        console.log('Edge created successfully')
                      } else {
                        alert('Error: Cannot connect nodes. Please try again.')
                      }
                    } else {
                      console.log('Edge already exists, skipping creation')
                      alert('Connection already exists between these nodes')
                    }

                    // Reset connect mode
                    setConnectSource(null)
                    setConnectMode(false)

                    // Clear visual feedback
                    svg.querySelectorAll('.node').forEach(n => {
                      n.classList.remove('selected-node', 'connect-source')
                      ;(n as SVGElement).style.outline = '2px dashed rgba(59, 130, 246, 0.5)'
                      ;(n as SVGElement).style.outlineOffset = '0'
                    })

                  } else {
                    // Clicked same node - cancel connection
                    setConnectSource(null)
                    setConnectMode(false)
                    console.log('Connection cancelled')

                    // Clear visual feedback
                    svg.querySelectorAll('.node').forEach(n => {
                      n.classList.remove('selected-node', 'connect-source')
                      ;(n as SVGElement).style.outline = '2px dashed rgba(59, 130, 246, 0.5)'
                      ;(n as SVGElement).style.outlineOffset = '0'
                    })
                  }
                } else {
                  // Normal selection mode
                  setSelectedNode(nodeId)
                  console.log('Selected node set to:', nodeId)

                  // Update visual selection
                  svg.querySelectorAll('.node').forEach(n => {
                    n.classList.remove('selected-node', 'connect-source')
                    ;(n as SVGElement).style.outline = '2px dashed rgba(59, 130, 246, 0.5)'
                    ;(n as SVGElement).style.outlineOffset = '0'
                  })
                  nodeElement.classList.add('selected-node')

                  // Add strong visual feedback for selected node
                  nodeElement.style.outline = '3px solid #3b82f6'
                  nodeElement.style.outlineOffset = '2px'
                }
                } else {
                  // Debug: Check what was actually clicked
                  console.log('Click target:', e.target)
                  console.log('Available edge classes:', svg.querySelectorAll('[class*="edge"]'))

                  // Check if we clicked on an edge with broader selectors
                  const edgeElement = (e.target as Element).closest('[class*="edge"], .flowchart-link, path[stroke]:not([class*="node"])') as SVGElement
                  if (edgeElement) {
                    console.log('Edge element clicked:', edgeElement)
                    console.log('Element classes:', edgeElement.classList)

                    // Clear node selection when selecting edge
                    setSelectedNode(null)
                    svg.querySelectorAll('.node').forEach(n => {
                      n.classList.remove('selected-node', 'connect-source')
                      ;(n as SVGElement).style.outline = '2px dashed rgba(59, 130, 246, 0.5)'
                      ;(n as SVGElement).style.outlineOffset = '0'
                    })

                    // Parse the edge ID from Mermaid's generated IDs instead of using position
                    const edgeId = edgeElement.id
                    console.log('Edge element ID:', edgeId)

                    // Try to extract from/to from the Mermaid ID (e.g., "L-n_node_0-n_node_1-0")
                    let selectedEdgeId = null

                    if (edgeId && edgeId.startsWith('L-')) {
                      // Parse Mermaid edge ID format: L-n_node_0-n_node_1-0
                      const parts = edgeId.split('-')
                      if (parts.length >= 4) {
                        const fromClean = parts[1] // n_node_0
                        const toClean = parts[2]   // n_node_1

                        // Map back to original IDs using the ID mapping
                        const fromOriginal = idMapping[fromClean]
                        const toOriginal = idMapping[toClean]

                        if (fromOriginal && toOriginal) {
                          selectedEdgeId = `${fromOriginal}-${toOriginal}`
                          console.log('Parsed edge ID from Mermaid:', selectedEdgeId)
                        }
                      }
                    }

                    // Fallback: try to find edge by text content or other methods
                    if (!selectedEdgeId && edgesToRender.length > 0) {
                      // Look for edge with matching label text if it's a label element
                      if (edgeElement.classList.contains('edgeLabel')) {
                        const labelText = edgeElement.textContent?.trim()
                        const matchingEdge = edgesToRender.find((edge: any) => edge.label === labelText)
                        if (matchingEdge) {
                          selectedEdgeId = `${matchingEdge.from}-${matchingEdge.to}`
                          console.log('Found edge by label:', selectedEdgeId)
                        }
                      }

                      // Final fallback - select first edge for testing
                      if (!selectedEdgeId) {
                        const firstEdge = edgesToRender[0]
                        selectedEdgeId = `${firstEdge.from}-${firstEdge.to}`
                        console.log('Fallback selected first edge:', selectedEdgeId)
                      }
                    }

                    if (selectedEdgeId) {
                      setSelectedEdge(selectedEdgeId)
                      console.log('Final selected edge:', selectedEdgeId)

                      // Highlight selected edge
                      const allEdges = svg.querySelectorAll('.edgePath, .edgeLabel, [class*="edge"]')
                      allEdges.forEach(e => e.classList.remove('selected-edge'))
                      edgeElement.classList.add('selected-edge')
                    }
                  } else {
                    console.log('No edge element found on click')
                  }
                }
              })

              // Separate double-click handler with event delegation for both nodes and edges
              svg.addEventListener('dblclick', (e) => {
                e.stopPropagation()
                e.preventDefault()

                // Check if we double-clicked on a node
                const nodeElement = (e.target as Element).closest('.node') as SVGElement
                if (nodeElement) {
                  const nodeId = nodeElement.getAttribute('data-node-id')
                  if (!nodeId) return

                  console.log('=== DELEGATED DOUBLE-CLICK DEBUG ===')
                  console.log('Double-click detected on node:', nodeId)

                  // Find the node in the correct array
                  const currentNode = actualIsEditing
                    ? editableNodes.find((n: any) => n.id === nodeId)
                    : rawNodes.find((n: any) => n.id === nodeId)

                  console.log('Current node found:', currentNode)

                  if (currentNode) {
                    const newLabel = prompt('Edit node label:', currentNode.label)
                    console.log('New label entered:', newLabel)

                    if (newLabel !== null && newLabel.trim()) {
                      setEditableNodes((prev: any) => {
                        const updated = prev.map((node: any) =>
                          node.id === nodeId
                            ? { ...node, label: newLabel.trim() }
                            : node
                        )
                        console.log('Updated nodes after edit:', updated.map((n: any) => ({ id: n.id, label: n.label })))
                        return updated
                      })
                    }
                  } else {
                    console.error('Node not found for editing:', nodeId)
                    alert('Could not find node to edit. Please try again.')
                  }
                } else {
                  // Check if we double-clicked on an edge
                  const edgeElement = (e.target as Element).closest('.edgePath, .edgeLabel') as SVGElement
                  if (edgeElement) {
                    let edgeId = edgeElement.getAttribute('data-edge-id')
                    if (!edgeId) {
                      // Fallback: try to find edge by analyzing position
                      const allEdgePaths = svg.querySelectorAll('.edgePath')
                      const pathIndex = Array.from(allEdgePaths).indexOf(edgeElement.closest('.edgePath') || edgeElement)
                      if (pathIndex >= 0 && pathIndex < edgesToRender.length) {
                        const edgeData = edgesToRender[pathIndex]
                        edgeId = `${edgeData.from}-${edgeData.to}`
                        edgeElement.setAttribute('data-edge-id', edgeId)
                      }
                    }

                    if (edgeId) {
                      const [from, to] = edgeId.split('-')
                      const edgeData = edgesToRender.find((edge: any) => edge.from === from && edge.to === to)

                      if (edgeData) {
                        const newLabel = prompt('Edit edge label:', edgeData.label || '')
                        if (newLabel !== null) {
                          setEditableEdges((prev: any) => prev.map((edge: any) =>
                            edge.from === edgeData.from && edge.to === edgeData.to
                              ? { ...edge, label: newLabel.trim() }
                              : edge
                          ))
                        }
                      }
                    }
                  }
                }
              })

              // Style edges for interaction - make them much more clickable
              const allPaths = svg.querySelectorAll('path[stroke]:not([class*="node"]), .edgePath, [class*="edge"]')
              allPaths.forEach((edge: Element) => {
                const edgeElement = edge as SVGElement
                edgeElement.style.cursor = 'pointer'
                edgeElement.style.strokeWidth = '4px' // Make thicker for easier clicking
                edgeElement.style.pointerEvents = 'stroke'
                // Add a transparent wider stroke area for easier clicking
                edgeElement.style.stroke = edgeElement.style.stroke || '#666'
              })

              console.log('Styled', allPaths.length, 'edge elements for interaction')

              // Add edge selection styles
              if (!document.getElementById('edge-selection-styles')) {
                const edgeStyle = document.createElement('style')
                edgeStyle.id = 'edge-selection-styles'
                edgeStyle.textContent = `
                  .selected-edge {
                    stroke: #ef4444 !important;
                    stroke-width: 3px !important;
                    filter: drop-shadow(0 0 6px #ef4444);
                  }
                `
                document.head.appendChild(edgeStyle)
              }

              // Set up node identification for each node
              const nodes = svg.querySelectorAll('.node')
              nodes.forEach((node) => {
                const nodeElement = node as SVGElement

                // Find the actual node data by matching the Mermaid-generated ID
                let actualNodeId: string | null = null

                // Try to extract the clean ID from Mermaid's generated elements
                const mermaidId = nodeElement.id || nodeElement.getAttribute('id')
                console.log('Processing DOM element with Mermaid ID:', mermaidId)

                if (mermaidId) {
                  // Look for our mapping - find the LONGEST match to avoid conflicts
                  const matchingCleanIds = Object.keys(idMapping).filter(cleanId => mermaidId.includes(cleanId))
                  console.log('Found matching clean IDs:', matchingCleanIds)

                  // Use the longest match to avoid matching shorter IDs that are substrings
                  const originalId = matchingCleanIds.sort((a, b) => b.length - a.length)[0]
                  if (originalId) {
                    actualNodeId = idMapping[originalId]
                    console.log(`Mapped ${mermaidId} -> ${originalId} -> ${actualNodeId}`)
                  }
                }

                // Fallback: try to match by text content
                if (!actualNodeId) {
                  const textElement = nodeElement.querySelector('text, .label, .nodeLabel')
                  const nodeText = textElement?.textContent?.trim()
                  if (nodeText) {
                    const matchingNode = nodesToRender.find((n: any) => n.label === nodeText)
                    if (matchingNode) {
                      actualNodeId = matchingNode.id
                    }
                  }
                }

                if (!actualNodeId) {
                  console.warn('Could not identify node ID for element:', nodeElement)
                  return
                }

                const nodeData = nodesToRender.find((n: any) => n.id === actualNodeId)
                if (!nodeData) {
                  console.warn(`No node data found for ID: ${actualNodeId}`)
                  return
                }

                console.log(`Mapping DOM element to node ID: "${actualNodeId}" with label "${nodeData.label}"`)

                // Store the actual node ID for reliable identification
                nodeElement.setAttribute('data-node-id', actualNodeId)

                // Add visual styling for editable nodes
                if (connectMode) {
                  nodeElement.style.cursor = 'pointer'
                  nodeElement.style.outline = '2px dashed rgba(168, 85, 247, 0.5)'
                  nodeElement.setAttribute('title', 'Click to select for connection')
                } else {
                  nodeElement.style.cursor = 'move'
                  nodeElement.style.outline = '2px dashed rgba(59, 130, 246, 0.5)'
                  nodeElement.setAttribute('title', `Double-click to edit "${nodeData.label}"`)
                }

              })

              // Set up edge identification for better selection
              const edgePaths = svg.querySelectorAll('.edgePath')
              edgePaths.forEach((edgePath, index) => {
                if (index < edgesToRender.length) {
                  const edgeData = edgesToRender[index]
                  const edgeId = `${edgeData.from}-${edgeData.to}`

                  // Set data attribute on the edge path
                  edgePath.setAttribute('data-edge-id', edgeId)

                  // Also set on any associated label elements
                  const edgeLabels = svg.querySelectorAll('.edgeLabel')
                  if (edgeLabels[index]) {
                    edgeLabels[index].setAttribute('data-edge-id', edgeId)
                  }
                }
              })
            }
          }
        }
      }).catch((error: any) => {
        console.error('Mermaid render error:', error)
        console.error('Failed Mermaid code:', mermaidCode)
        console.error('Nodes that caused error:', nodesToRender)
        console.error('Edges that caused error:', edgesToRender)

        // Try to render with nodes only (no edges) to isolate the issue
        const fallbackCode = 'flowchart TD\n' +
          nodesToRender.map((node: any) => {
            const cleanLabel = node.label.replace(/['"]/g, '').substring(0, 50)
            const cleanId = node.id.replace(/[^\w-]/g, '')
            return `    ${cleanId}["${cleanLabel}"]`
          }).join('\n')

        console.log('Attempting fallback render with nodes only:', fallbackCode)

        if (!mermaid) return

        mermaid.render(`${diagramId}-fallback`, fallbackCode).then((result: any) => {
          console.log('Fallback render successful - issue is with edges')
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = result.svg + `
              <div class="absolute top-4 left-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs px-2 py-1 rounded border border-yellow-200 dark:border-yellow-800">
                ⚠️ Showing nodes only - edge rendering failed
              </div>
            `
          }
        }).catch((fallbackError: any) => {
          console.error('Fallback render also failed:', fallbackError)
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = `
              <div class="p-4 text-center text-red-500 dark:text-red-400">
                <div class="mb-2">Error rendering flowchart</div>
                <details class="text-xs text-left">
                  <summary class="cursor-pointer">Debug Info</summary>
                  <pre class="mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded text-left whitespace-pre-wrap">
Primary Error: ${error.message || error}
Fallback Error: ${fallbackError.message || fallbackError}

Nodes: ${nodesToRender.length}
Edges: ${edgesToRender.length}

Generated Code:
${mermaidCode}

Fallback Code:
${fallbackCode}
                  </pre>
                </details>
              </div>
            `
          }
        })
      })
    }

    // Cleanup function to abort all event listeners
    return () => {
      if (mermaidRef.current) {
        const svg = mermaidRef.current.querySelector('svg')
        if (svg && (svg as any)._eventController) {
          (svg as any)._eventController.abort()
        }
      }
    }
  }, [rawNodes, rawEdges, editableNodes, editableEdges, actualIsEditing, connectMode, connectSource, selectedNode])

  if (rawNodes.length === 0) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <div className="text-center">
          <GitBranch className="w-16 h-16 mx-auto mb-4 text-blue-500" />
          <h4 className="text-lg font-medium mb-2">Flowchart</h4>
          <p className="text-sm text-gray-500 mb-4">Interactive flow diagram</p>
          {content?.description && (
            <p className="text-xs text-gray-400">{content.description}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-white dark:bg-gray-900 overflow-hidden flex flex-col flowchart-container">
      {/* Edit Toolbar - Only show in expanded view - REMOVED to consolidate headers */}

      {/* Scrollable Diagram Container */}
      <div className={`flex-1 overflow-auto ${expanded ? 'p-12' : 'p-4'}`}>
        <div
          ref={mermaidRef}
          className="w-full min-h-full flex items-start justify-center mermaid-container"
          style={{
            minHeight: expanded ? '500px' : '400px',
            // Ensure container can expand horizontally for wide diagrams
            minWidth: '100%',
            // Add extra padding for scrolling in expanded view
            paddingBottom: expanded ? '100px' : '20px',
            paddingTop: expanded ? '50px' : '20px',
            paddingLeft: expanded ? '100px' : '20px',
            paddingRight: expanded ? '100px' : '20px'
          }}
        />
      </div>

      {/* Edit Controls - Only show in editing mode */}
      {actualIsEditing && expanded && (
        <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
          <button
            onClick={() => {
              // Add new node with unique ID
              const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
              const newNode = {
                id: newNodeId,
                label: 'New Step',
                x: 100 + editableNodes.length * 150,
                y: 100 + Math.floor(editableNodes.length / 3) * 80
              }
              console.log('Adding new node:', newNode)
              setEditableNodes((prev: any) => {
                const updated = [...prev, newNode]
                console.log('Updated nodes after add:', updated.map((n: any) => ({ id: n.id, label: n.label })))
                return updated
              })
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            title="Add Node"
          >
            <Plus className="w-3 h-3" />
            Add Node
          </button>

          <button
            onClick={() => {
              setConnectMode(!connectMode)
              setConnectSource(null)
              setSelectedNode(null)
              console.log('Connect mode toggled:', !connectMode)
            }}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              connectMode
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40'
                : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40'
            }`}
            title={connectMode ? "Exit Connect Mode" : "Connect Nodes - Click two nodes to connect them"}
          >
            <Move className="w-3 h-3" />
            {connectMode ? 'Exit Connect' : 'Connect Nodes'}
          </button>


          {selectedNode && (
            <button
              onClick={() => {
                console.log('Delete button clicked for node:', selectedNode)
                // Delete selected node
                setEditableNodes((prev: any) => {
                  const filtered = prev.filter((node: any) => node.id !== selectedNode)
                  console.log('Nodes after deletion:', filtered)
                  return filtered
                })
                setEditableEdges((prev: any) => {
                  const filtered = prev.filter((edge: any) =>
                    edge.from !== selectedNode && edge.to !== selectedNode
                  )
                  console.log('Edges after deletion:', filtered)
                  return filtered
                })
                setSelectedNode(null)
                console.log('Node deletion completed')
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              title="Delete Node"
            >
              <Trash2 className="w-3 h-3" />
              Delete Node
            </button>
          )}

          {selectedEdge && (
            <button
              onClick={() => {
                // Parse edge ID by finding where the second part starts
                // Expected format: "node-0-node-2"
                let from, to;

                // Find the position where the second node ID starts (after first complete node-X)
                const secondNodeIndex = selectedEdge.indexOf('-node-', selectedEdge.indexOf('-') + 1)

                if (secondNodeIndex > 0) {
                  from = selectedEdge.substring(0, secondNodeIndex)  // "node-0"
                  to = selectedEdge.substring(secondNodeIndex + 1)    // "node-2"
                } else {
                  // Fallback: try the exact format we expect
                  const parts = selectedEdge.split('-')
                  if (parts.length >= 4) {
                    from = `${parts[0]}-${parts[1]}` // "node-0"
                    to = `${parts[2]}-${parts[3]}`   // "node-2"
                  } else {
                    console.error('Could not parse edge ID:', selectedEdge)
                    return
                  }
                }

                setEditableEdges((prev: any) => {
                  return prev.filter((edge: any) => !(edge.from === from && edge.to === to))
                })
                setSelectedEdge(null)
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              title="Delete Edge"
            >
              <Trash2 className="w-3 h-3" />
              Delete Edge
            </button>
          )}

          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

          <span className="text-xs text-gray-500 dark:text-gray-400">
            {connectMode ? (
              connectSource ? (
                <>🟢 Click target node to connect • Same node to cancel</>
              ) : (
                <>🔗 Click source node to start connection</>
              )
            ) : (
              <>Click nodes to select • Double-click to edit • Use Connect Nodes to link</>
            )}
          </span>
        </div>
      )}

      {/* Description Overlay - Only show in non-expanded view */}
      {content?.description && !expanded && (
        <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg p-3 max-w-sm border border-gray-200 dark:border-gray-700 shadow-lg z-10">
          <p className="text-xs text-gray-600 dark:text-gray-300">{content.description}</p>
        </div>
      )}

      {/* Scroll Hint - Only show in non-expanded view */}
      {!expanded && (
        <div className="absolute top-4 right-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
          <span>Scroll to view full diagram</span>
        </div>
      )}
    </div>
  )
}

// PRD Artifact Component
function PRDArtifact({ content, expanded, onSave, editingState, editingCancelled }: { content: any; expanded?: boolean; onSave?: (updatedContent: any) => void; editingState?: boolean; editingCancelled?: boolean }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')

  // Use external editing state if provided (for expanded view)
  const actualIsEditing = editingState !== undefined ? editingState : isEditing

  useEffect(() => {
    if (actualIsEditing) {
      // Convert sections back to markdown text for editing
      const markdownText = content?.sections?.map((section: any) =>
        `## ${section.title}\n\n${section.content}`
      ).join('\n\n') || content?.text || ''
      setEditedContent(markdownText)
      setOriginalContent(markdownText)
    }
  }, [actualIsEditing, content])

  // Handle save/cancel when exiting edit mode
  const prevEditingState = React.useRef(actualIsEditing)
  useEffect(() => {
    // When going from editing to not editing
    if (prevEditingState.current === true && actualIsEditing === false) {
      if (editingCancelled) {
        console.log('PRD cancel detected - resetting to original content')
        setEditedContent(originalContent)
      } else {
        // Save the changes
        console.log('PRD save on exit - saving changes')
        if (onSave) {
          // Parse edited markdown back into sections
          const sections = []
          const lines = editedContent.split('\n')
          let currentSection = { title: 'Content', content: '' }

          for (const line of lines) {
            if (line.match(/^#{1,3}\s+/)) {
              if (currentSection.content.trim()) {
                sections.push(currentSection)
              }
              currentSection = {
                title: line.replace(/^#{1,3}\s+/, ''),
                content: ''
              }
            } else {
              currentSection.content += line + '\n'
            }
          }

          if (currentSection.content.trim()) {
            sections.push(currentSection)
          }

          onSave({
            ...content,
            sections: sections.length > 0 ? sections : [{ title: 'Content', content: editedContent }],
            text: editedContent
          })
        }
      }
    }
    prevEditingState.current = actualIsEditing
  }, [actualIsEditing, editingCancelled, originalContent, onSave, content, editedContent])

  if (actualIsEditing) {
    return (
      <div className="h-full flex flex-col">
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="flex-1 w-full p-6 border-0 bg-transparent text-gray-900 dark:text-gray-100 text-sm font-mono resize-none focus:outline-none"
          placeholder="Edit your PRD content here..."
          style={{ minHeight: 'calc(100vh - 200px)' }}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4 max-h-full overflow-y-auto">
      {expanded && editingState === undefined && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">PRD Document</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
        </div>
      )}
      <div className="space-y-4">
        {content?.sections?.map((section: any, index: number) => (
          <div key={index} className="border-b pb-4 last:border-b-0">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {section.title}
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {section.content}
            </div>
          </div>
        )) || (
          <div className="text-center py-8">
            <FileText className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h4 className="text-lg font-medium mb-2">Product Requirements Document</h4>
            <p className="text-sm text-gray-500">Structured product specification</p>
            {content?.title && (
              <p className="text-xs text-gray-400 mt-2">{content.title}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Wireframe Artifact Component
function WireframeArtifact({ content }: { content: any }) {
  return (
    <div className="p-4 h-full flex items-center justify-center">
      <div className="text-center">
        <Layers className="w-16 h-16 mx-auto mb-4 text-purple-500" />
        <h4 className="text-lg font-medium mb-2">Wireframe</h4>
        <p className="text-sm text-gray-500 mb-4">UI mockup and layout</p>
        {content?.description && (
          <p className="text-xs text-gray-400">{content.description}</p>
        )}
        {/* TODO: Implement wireframe rendering */}
      </div>
    </div>
  )
}

// Document Artifact Component
function DocumentArtifact({ content, expanded, onSave, editingState, editingCancelled }: { content: any; expanded?: boolean; onSave?: (updatedContent: any) => void; editingState?: boolean; editingCancelled?: boolean }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Undo/Redo history state
  const [history, setHistory] = useState<Array<{content: string, cursor: number}>>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const lastSavedTime = React.useRef<number>(0)

  // Use external editing state if provided (for expanded view)
  const actualIsEditing = editingState !== undefined ? editingState : isEditing

  useEffect(() => {
    if (actualIsEditing) {
      const textContent = content?.text || ''
      setEditedContent(textContent)
      setOriginalContent(textContent)
      // Initialize history with the starting content
      setHistory([{content: textContent, cursor: 0}])
      setHistoryIndex(0)
    }
  }, [actualIsEditing, content])

  // Save to history periodically or on significant changes
  const saveToHistory = (content: string, cursorPos: number) => {
    const now = Date.now()
    // Only save if enough time has passed or if triggered by toolbar action
    if (now - lastSavedTime.current > 1000 || lastSavedTime.current === 0) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push({content, cursor: cursorPos})
        // Limit history size
        return newHistory.slice(-50)
      })
      setHistoryIndex(prev => prev + 1)
      lastSavedTime.current = now
    }
  }

  // Undo function
  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setEditedContent(prevState.content)
      setHistoryIndex(historyIndex - 1)

      // Restore cursor position
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(prevState.cursor, prevState.cursor)
        }
      })
    }
  }

  // Redo function
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setEditedContent(nextState.content)
      setHistoryIndex(historyIndex + 1)

      // Restore cursor position
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(nextState.cursor, nextState.cursor)
        }
      })
    }
  }

  // Keyboard shortcut handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.userAgent.indexOf('Mac') !== -1
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey

    if (ctrlKey && e.key === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        redo()
      } else {
        undo()
      }
    } else if (ctrlKey && e.key === 'y') {
      e.preventDefault()
      redo()
    }
  }

  // Handle text changes and save to history (debounced)
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setEditedContent(newContent)

    // Save to history after a delay
    const cursorPos = e.target.selectionStart
    setTimeout(() => {
      saveToHistory(newContent, cursorPos)
    }, 500)
  }

  // Handle save/cancel when exiting edit mode
  const prevEditingState = React.useRef(actualIsEditing)
  useEffect(() => {
    // When going from editing to not editing
    if (prevEditingState.current === true && actualIsEditing === false) {
      if (editingCancelled) {
        console.log('Document cancel detected - resetting to original content')
        setEditedContent(originalContent)
      } else {
        // Save the changes
        console.log('Document save on exit - saving changes')
        if (onSave) {
          onSave({
            ...content,
            text: editedContent
          })
        }
      }
    }
    prevEditingState.current = actualIsEditing
  }, [actualIsEditing, editingCancelled, originalContent, onSave, content, editedContent])

  // Helper functions for markdown formatting
  const insertMarkdown = (before: string, after: string = '', placeholder: string = '') => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = editedContent.substring(start, end)
    const replacement = selectedText || placeholder

    const newText = editedContent.substring(0, start) + before + replacement + after + editedContent.substring(end)
    setEditedContent(newText)

    // Save this action to history immediately (toolbar actions should be saved)
    lastSavedTime.current = 0 // Force save
    setTimeout(() => {
      const cursorPos = selectedText ?
        start + before.length + replacement.length + after.length :
        start + before.length;
      saveToHistory(newText, cursorPos)
    }, 0)

    // Set cursor position after the content update
    requestAnimationFrame(() => {
      const newCursorPos = selectedText ?
        start + before.length + replacement.length + after.length : // If text was selected, cursor goes after
        start + before.length; // If placeholder, cursor goes inside for editing

      textarea.focus()
      textarea.setSelectionRange(newCursorPos, selectedText ? newCursorPos : newCursorPos + placeholder.length)
    })
  }

  if (actualIsEditing) {
    return (
      <div className="h-full flex flex-col">
        {/* Markdown Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Undo (${navigator.userAgent.indexOf('Mac') !== -1 ? 'Cmd' : 'Ctrl'}+Z)`}
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Redo (${navigator.userAgent.indexOf('Mac') !== -1 ? 'Cmd+Shift+Z' : 'Ctrl+Y'})`}
          >
            ↷
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

          <button
            onClick={() => insertMarkdown('**', '**', 'bold text')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs font-bold"
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => insertMarkdown('*', '*', 'italic text')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs italic"
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => insertMarkdown('`', '`', 'code')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs font-mono bg-gray-200 dark:bg-gray-600"
            title="Inline Code"
          >
            &lt;/&gt;
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
          <button
            onClick={() => insertMarkdown('# ', '', 'Heading 1')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs font-bold"
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => insertMarkdown('## ', '', 'Heading 2')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs font-bold"
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => insertMarkdown('### ', '', 'Heading 3')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs font-bold"
            title="Heading 3"
          >
            H3
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
          <button
            onClick={() => insertMarkdown('- ', '', 'List item')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
            title="Bullet List"
          >
            • List
          </button>
          <button
            onClick={() => insertMarkdown('1. ', '', 'Numbered item')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
            title="Numbered List"
          >
            1. List
          </button>
          <button
            onClick={() => insertMarkdown('[', '](url)', 'link text')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
            title="Link"
          >
            🔗 Link
          </button>
          <button
            onClick={() => insertMarkdown('```\n', '\n```', 'code block')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs font-mono"
            title="Code Block"
          >
            { } Block
          </button>
        </div>

        {/* Editor */}
        <textarea
          ref={textareaRef}
          value={editedContent}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="flex-1 w-full p-6 border-0 bg-transparent text-gray-900 dark:text-gray-100 text-sm font-mono resize-none focus:outline-none"
          placeholder="Edit your document content here... Use the toolbar above for formatting or write markdown directly. Use Ctrl/Cmd+Z to undo."
          style={{ minHeight: 'calc(100vh - 250px)' }}
        />
      </div>
    )
  }
  return (
    <div className="p-6 max-h-full overflow-y-auto">
      {expanded && editingState === undefined && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Document</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
        </div>
      )}
      {content?.text ? (
        <div className="prose dark:prose-invert max-w-none text-sm document-content artifact-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              h1: ({ children }) => <h1 className="text-xl mb-3 mt-4 first:mt-0 font-bold">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg mb-2 mt-3 first:mt-0 font-semibold">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base mb-2 mt-2 first:mt-0 font-medium">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="ml-2">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ inline, children, ...props }: any) =>
                inline ? (
                  <code className="bg-gray-100 dark:bg-gray-700 rounded text-sm inline-code" style={{ display: 'inline', width: 'auto', maxWidth: 'fit-content', padding: '2px 4px', lineHeight: '1', verticalAlign: 'baseline' }} {...props}>
                    {children}
                  </code>
                ) : (
                  <code className="block bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm overflow-x-auto" {...props}>
                    {children}
                  </code>
                ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-3 rounded-lg">
                  <table className="document-table w-full ai-table" style={{ tableLayout: 'auto', borderCollapse: 'separate', borderSpacing: '0' }}>
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => <thead>{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr>{children}</tr>,
              th: ({ children }) => <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>{children}</th>,
              td: ({ children }) => <td style={{ minWidth: '120px' }}>{children}</td>,
            }}
          >
            {content.text}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-center py-8">
          <File className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h4 className="text-lg font-medium mb-2">Document</h4>
          <p className="text-sm text-gray-500">Text-based document</p>
        </div>
      )}
    </div>
  )
}