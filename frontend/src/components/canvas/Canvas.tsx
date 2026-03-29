import React, { useRef, useEffect, useState } from 'react'
import { Move, X, Edit, Save, Bold, Italic, Heading, List, Plus, Minus, Trash2, ArrowRight } from 'lucide-react'
import { ArtifactRenderer } from './ArtifactRenderer'
import { useCanvas, Artifact } from './hooks/useCanvas'

interface CanvasProps {
  conversationId: string
  className?: string
  canvasHook?: ReturnType<typeof useCanvas>
}

export function Canvas({ conversationId, className, canvasHook }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Use provided hook or create new one
  const fallbackHook = useCanvas(conversationId)
  const {
    artifacts,
    viewport,
    selectedArtifact,
    expandedArtifact,
    setViewport,
    fitToScreen,
    zoomIn,
    zoomOut,
    selectArtifact,
    expandArtifact,
    closeExpandedArtifact,
    updateArtifact
  } = canvasHook || fallbackHook

  // Pan functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setViewport({
        ...viewport,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Scroll with wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()

    // Scroll the canvas instead of zooming
    const scrollSpeed = 1.2
    const deltaX = e.deltaX * scrollSpeed
    const deltaY = e.deltaY * scrollSpeed

    setViewport({
      ...viewport,
      x: viewport.x - deltaX,
      y: viewport.y - deltaY
    })
  }

  return (
    <div className={`relative bg-gray-50 dark:bg-gray-900 overflow-hidden ${className}`}>
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <button
          onClick={zoomOut}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg transition-colors"
          title="Zoom out"
          disabled={viewport.zoom <= 0.1}
        >
          <Minus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>

        <button
          onClick={() => setViewport({ x: 50, y: 50, zoom: 1 })}
          className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px] text-center border-x border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Reset zoom to 100%"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <button
          onClick={zoomIn}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg transition-colors"
          title="Zoom in"
          disabled={viewport.zoom >= 2}
        >
          <Plus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={canvasRef}
        className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" className="pointer-events-none">
            <defs>
              <pattern
                id="grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Render Artifacts */}
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className={`absolute transition-transform cursor-pointer ${
              selectedArtifact === artifact.id ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              left: artifact.position.x,
              top: artifact.position.y,
              width: artifact.size.width,
              height: artifact.size.height
            }}
            onClick={() => selectArtifact(artifact.id)}
          >
            <ArtifactRenderer
              artifact={artifact}
              onExpand={() => expandArtifact(artifact.id)}
            />
          </div>
        ))}

        {/* Empty State */}
        {artifacts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Move className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Canvas Ready</p>
              <p className="text-sm">Ask the AI to create diagrams, PRDs, or wireframes</p>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Artifact Overlay */}
      {expandedArtifact && (
        <ExpandedArtifactView
          artifact={artifacts.find(a => a.id === expandedArtifact)!}
          onClose={closeExpandedArtifact}
          onUpdate={(updates) => {
            updateArtifact(expandedArtifact, updates)
          }}
        />
      )}
    </div>
  )
}

// Expanded Artifact View Component
interface ExpandedArtifactViewProps {
  artifact: Artifact
  onClose: () => void
  onUpdate: (updates: Partial<Artifact>) => void
}

function ExpandedArtifactView({ artifact, onClose, onUpdate }: ExpandedArtifactViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(artifact.content)

  const handleSave = () => {
    onUpdate({ content: editContent })
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Content */}
      <div className="relative bg-white dark:bg-gray-900 m-8 rounded-lg shadow-2xl flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {artifact.title}
            </h2>
            <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded capitalize text-gray-600 dark:text-gray-300">
              {artifact.type}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isEditing ? (
            <div className="flex-1 flex flex-col overflow-hidden p-6">
              <EditableArtifactContent
                artifact={artifact}
                content={editContent}
                onChange={setEditContent}
              />
            </div>
          ) : (
            <div className="flex-1 p-6 overflow-auto">
              <ArtifactRenderer artifact={artifact} expanded />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Editable Content Component
interface EditableArtifactContentProps {
  artifact: Artifact
  content: any
  onChange: (content: any) => void
}

function EditableArtifactContent({ artifact, content, onChange }: EditableArtifactContentProps) {
  if (artifact.type === 'document') {
    return (
      <div className="h-full flex flex-col">
        <RichTextEditor
          content={content.text || ''}
          onChange={(text) => onChange({ ...content, text })}
          placeholder="Enter document content..."
        />
      </div>
    )
  }

  if (artifact.type === 'prd') {
    return (
      <PRDEditor
        content={content}
        onChange={onChange}
      />
    )
  }

  // For flowcharts and wireframes - visual editors
  if (artifact.type === 'flowchart') {
    return (
      <FlowchartEditor
        content={content}
        onChange={onChange}
      />
    )
  }

  // For wireframes - simple text editing for now, can be enhanced later
  return (
    <textarea
      className="w-full h-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      value={content.description || JSON.stringify(content, null, 2)}
      onChange={(e) => onChange({ ...content, description: e.target.value })}
      placeholder="Enter wireframe description..."
    />
  )
}

// Rich Text Editor Component
interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end)

    onChange(newContent)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={() => insertText('# ', '\n')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
          title="Heading"
        >
          <Heading className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertText('**', '**')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertText('*', '*')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertText('- ', '\n')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
          title="Bullet Point"
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        className="flex-1 p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

// PRD Editor Component
interface PRDEditorProps {
  content: any
  onChange: (content: any) => void
}

function PRDEditor({ content, onChange }: PRDEditorProps) {
  const sections = content.sections || []

  const addSection = () => {
    const newSections = [...sections, { title: 'New Section', content: '' }]
    onChange({ ...content, sections: newSections })
  }

  const removeSection = (index: number) => {
    const newSections = sections.filter((_: any, i: number) => i !== index)
    onChange({ ...content, sections: newSections })
  }

  const updateSection = (index: number, field: string, value: string) => {
    const newSections = [...sections]
    newSections[index] = { ...newSections[index], [field]: value }
    onChange({ ...content, sections: newSections })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">PRD Sections</h3>
        <button
          onClick={addSection}
          className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </div>

      {sections.map((section: any, index: number) => (
        <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <input
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
              value={section.title}
              onChange={(e) => updateSection(index, 'title', e.target.value)}
              placeholder="Section title..."
            />
            <button
              onClick={() => removeSection(index)}
              className="ml-3 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              title="Remove section"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <RichTextEditor
            content={section.content}
            onChange={(newContent) => updateSection(index, 'content', newContent)}
            placeholder="Section content..."
          />
        </div>
      ))}

      {sections.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p className="mb-4">No sections yet. Start building your PRD!</p>
          <button
            onClick={addSection}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Section
          </button>
        </div>
      )}
    </div>
  )
}

// Flowchart Editor Component
interface FlowchartEditorProps {
  content: any
  onChange: (content: any) => void
}

function FlowchartEditor({ content, onChange }: FlowchartEditorProps) {
  const nodes = content.nodes || []
  const edges = content.edges || []

  const addNode = () => {
    const newNode = {
      id: `node-${Date.now()}`,
      label: 'New Node',
      x: Math.random() * 400 + 50,
      y: Math.random() * 300 + 50
    }
    onChange({
      ...content,
      nodes: [...nodes, newNode],
      edges: edges
    })
  }

  const updateNode = (nodeId: string, updates: any) => {
    const newNodes = nodes.map((node: any) =>
      node.id === nodeId ? { ...node, ...updates } : node
    )
    onChange({ ...content, nodes: newNodes, edges })
  }

  const removeNode = (nodeId: string) => {
    const newNodes = nodes.filter((node: any) => node.id !== nodeId)
    const newEdges = edges.filter((edge: any) => edge.from !== nodeId && edge.to !== nodeId)
    onChange({ ...content, nodes: newNodes, edges: newEdges })
  }

  const addConnection = (fromId: string, toId: string) => {
    const existingConnection = edges.find((edge: any) => edge.from === fromId && edge.to === toId)
    if (!existingConnection) {
      const newEdge = { from: fromId, to: toId, label: '' }
      onChange({ ...content, nodes, edges: [...edges, newEdge] })
    }
  }

  const updateConnection = (fromId: string, toId: string, label: string) => {
    const newEdges = edges.map((edge: any) =>
      edge.from === fromId && edge.to === toId ? { ...edge, label } : edge
    )
    onChange({ ...content, nodes, edges: newEdges })
  }

  const removeConnection = (fromId: string, toId: string) => {
    const newEdges = edges.filter((edge: any) => !(edge.from === fromId && edge.to === toId))
    onChange({ ...content, nodes, edges: newEdges })
  }

  return (
    <div className="flex h-full">
      {/* Toolbar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <div className="space-y-4">
          <button
            onClick={addNode}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Node
          </button>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Nodes</h4>
            {nodes.map((node: any) => (
              <div key={node.id} className="p-2 bg-white dark:bg-gray-900 rounded border">
                <div className="flex items-center justify-between mb-2">
                  <input
                    className="flex-1 text-xs p-1 border rounded bg-transparent"
                    value={node.label}
                    onChange={(e) => updateNode(node.id, { label: e.target.value })}
                  />
                  <button
                    onClick={() => removeNode(node.id)}
                    className="ml-1 p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {node.id}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Connections</h4>
            {edges.map((edge: any, index: number) => (
              <div key={index} className="p-2 bg-white dark:bg-gray-900 rounded border">
                <div className="flex items-center gap-1 text-xs mb-1">
                  <span>{edge.from}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span>{edge.to}</span>
                  <button
                    onClick={() => removeConnection(edge.from, edge.to)}
                    className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <input
                  className="w-full text-xs p-1 border rounded bg-transparent"
                  placeholder="Connection label..."
                  value={edge.label}
                  onChange={(e) => updateConnection(edge.from, edge.to, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-white dark:bg-gray-900 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full">
          {/* Render connections */}
          {edges.map((edge: any, index: number) => {
            const fromNode = nodes.find((n: any) => n.id === edge.from)
            const toNode = nodes.find((n: any) => n.id === edge.to)
            if (!fromNode || !toNode) return null

            const fromX = fromNode.x + 60 // Node width/2
            const fromY = fromNode.y + 20 // Node height/2
            const toX = toNode.x + 60
            const toY = toNode.y + 20

            return (
              <g key={index}>
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke="currentColor"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  className="text-gray-600 dark:text-gray-300"
                />
                {edge.label && (
                  <text
                    x={(fromX + toX) / 2}
                    y={(fromY + toY) / 2 - 5}
                    textAnchor="middle"
                    className="text-xs fill-current text-gray-600 dark:text-gray-300"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                className="fill-current text-gray-600 dark:text-gray-300"
              />
            </marker>
          </defs>
        </svg>

        {/* Render nodes */}
        {nodes.map((node: any) => (
          <div
            key={node.id}
            className="absolute bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-300 dark:border-blue-600 rounded-lg p-2 cursor-move select-none"
            style={{
              left: node.x,
              top: node.y,
              width: '120px',
              minHeight: '40px'
            }}
            draggable
            onDragEnd={(e) => {
              const rect = e.currentTarget.parentElement!.getBoundingClientRect()
              const x = e.clientX - rect.left - 60
              const y = e.clientY - rect.top - 20
              updateNode(node.id, { x: Math.max(0, x), y: Math.max(0, y) })
            }}
          >
            <div className="text-xs text-center text-gray-900 dark:text-gray-100">
              {node.label}
            </div>

            {/* Connection points */}
            <div className="absolute -right-2 top-1/2 w-4 h-4 bg-green-400 rounded-full cursor-pointer transform -translate-y-1/2"
              onClick={() => {
                // Simple connection logic - connect to next node for demo
                const nextNode = nodes.find((n: any) => n.id !== node.id)
                if (nextNode) addConnection(node.id, nextNode.id)
              }}
              title="Connect to another node"
            />
          </div>
        ))}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="mb-4">No nodes yet. Add your first flowchart node!</p>
              <button
                onClick={addNode}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Node
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}