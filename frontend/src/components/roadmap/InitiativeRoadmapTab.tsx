import React, { useState, useEffect } from 'react'
import { Grip, Edit2 } from 'lucide-react'
import { formatPercentage } from '@/utils/roadmap'
import { api } from '@/services/api'
import { InitiativeEditModal } from './InitiativeEditModal'

interface InitiativeRoadmapTabProps {
  initiatives: any[]
  projects: any[]
  onRefresh: () => void
}

export function InitiativeRoadmapTab({ initiatives, projects, onRefresh }: InitiativeRoadmapTabProps) {
  const [localInitiatives, setLocalInitiatives] = useState(initiatives)
  const [draggedInitiative, setDraggedInitiative] = useState<any | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingInitiative, setEditingInitiative] = useState<any | null>(null)

  // Categorize by status (treat null/undefined as backlog)
  const nowInitiatives = localInitiatives.filter(i => i.status === 'in_progress')
  const nextInitiatives = localInitiatives.filter(i => i.status === 'planned')
  const laterInitiatives = localInitiatives.filter(i =>
    !i.status || i.status === 'backlog' || i.status === 'idea'
  )

  const handleDrop = async (newStatus: string) => {
    if (!draggedInitiative) return

    // Check if status actually changed
    const currentStatus = draggedInitiative.status || 'backlog'
    if (currentStatus === newStatus) {
      setDraggedInitiative(null)
      return // No change, don't update
    }

    // Optimistic update
    setLocalInitiatives(prev =>
      prev.map(i => i.id === draggedInitiative.id ? { ...i, status: newStatus } : i)
    )

    setIsUpdating(true)

    try {
      // Try to update via API
      await api.updateInitiative(draggedInitiative.id, { status: newStatus })
      // Refresh data from server
      onRefresh()
    } catch (error) {
      console.error('Failed to update initiative status:', error)
      // Revert on error
      setLocalInitiatives(initiatives)
      alert('Failed to update initiative status. Changes reverted.')
    } finally {
      setIsUpdating(false)
      setDraggedInitiative(null)
    }
  }

  // Sync local state with parent when not updating
  useEffect(() => {
    if (!isUpdating) {
      setLocalInitiatives(initiatives)
    }
  }, [initiatives, isUpdating])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SwimlaneColumn
        title="Now"
        subtitle="In Progress"
        status="in_progress"
        initiatives={nowInitiatives}
        projects={projects}
        onDrop={() => handleDrop('in_progress')}
        onDragStart={setDraggedInitiative}
        onEdit={setEditingInitiative}
        isDisabled={isUpdating}
      />
      <SwimlaneColumn
        title="Next"
        subtitle="Planned"
        status="planned"
        initiatives={nextInitiatives}
        projects={projects}
        onDrop={() => handleDrop('planned')}
        onDragStart={setDraggedInitiative}
        onEdit={setEditingInitiative}
        isDisabled={isUpdating}
      />
      <SwimlaneColumn
        title="Later"
        subtitle="Backlog"
        status="backlog"
        initiatives={laterInitiatives}
        projects={projects}
        onDrop={() => handleDrop('backlog')}
        onDragStart={setDraggedInitiative}
        onEdit={setEditingInitiative}
        isDisabled={isUpdating}
      />

      {/* Edit Modal */}
      {editingInitiative && (
        <InitiativeEditModal
          initiative={editingInitiative}
          onClose={() => setEditingInitiative(null)}
          onSaved={() => {
            onRefresh()
            setEditingInitiative(null)
          }}
        />
      )}
    </div>
  )
}

interface SwimlaneColumnProps {
  title: string
  subtitle: string
  status: string
  initiatives: any[]
  projects: any[]
  onDrop: () => void
  onDragStart: (initiative: any) => void
  onEdit: (initiative: any) => void
  isDisabled: boolean
}

function SwimlaneColumn({
  title,
  subtitle,
  status,
  initiatives,
  projects,
  onDrop,
  onDragStart,
  onEdit,
  isDisabled,
}: SwimlaneColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const statusColors = {
    in_progress: 'border-green-500 bg-green-50 dark:bg-green-900/10',
    planned: 'border-blue-500 bg-blue-50 dark:bg-blue-900/10',
    backlog: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10',
  }

  return (
    <div
      className={`rounded-lg p-4 min-h-[600px] transition-all ${
        isDragOver
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : statusColors[status as keyof typeof statusColors] || 'bg-gray-50 dark:bg-gray-800/50'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!isDisabled) setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        if (!isDisabled) {
          setIsDragOver(false)
          onDrop()
        }
      }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-3">
        {initiatives.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-500">
            Drag initiatives here
          </div>
        ) : (
          initiatives.map(initiative => (
            <InitiativeSwimCard
              key={initiative.id}
              initiative={initiative}
              projects={projects}
              onDragStart={() => onDragStart(initiative)}
              onEdit={onEdit}
              isDisabled={isDisabled}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface InitiativeSwimCardProps {
  initiative: any
  projects: any[]
  onDragStart: () => void
  isDisabled: boolean
  onEdit: (initiative: any) => void
}

function InitiativeSwimCard({ initiative, projects, onDragStart, isDisabled, onEdit }: InitiativeSwimCardProps) {
  const projectCount = projects.filter(p => p.initiative_id === initiative.id).length
  const themes = initiative.themes || []
  const avgUrgency = themes.length > 0
    ? themes.reduce((sum: number, t: any) => sum + (t.urgency_score || 0), 0) / themes.length
    : 0

  return (
    <div
      draggable={!isDisabled}
      onDragStart={onDragStart}
      className={`bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transition-all ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-move hover:shadow-md hover:border-indigo-500'
      }`}
    >
      <div className="flex items-start gap-2">
        <Grip className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {initiative.title}
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(initiative)
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
              title="Edit initiative"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {initiative.description || 'No description'}
          </p>

          {/* Themes */}
          {themes.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {themes.length} theme{themes.length > 1 ? 's' : ''}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {projectCount} project{projectCount !== 1 ? 's' : ''}
            </span>
            {avgUrgency > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                {formatPercentage(avgUrgency)} urgent
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
