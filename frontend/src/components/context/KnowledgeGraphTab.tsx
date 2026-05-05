'use client'

/**
 * KnowledgeGraphTab — Sigma.js (WebGL) + Force Atlas 2
 *
 * Rendering:   Sigma.js WebGL — handles 10k+ nodes at 60fps
 * Layout:      Force Atlas 2 in a web worker — proper cluster separation,
 *              high-degree nodes gravitate to cluster centers naturally
 * Loading:     Two-phase: /graph/hubs (fast) → stub dots for unloaded neighbors
 *              → /graph/node/:id on click to expand
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Graph from 'graphology'
import Sigma from 'sigma'
import type { Attributes } from 'graphology-types'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import api, { apiClient } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'
import { Loading, Card, EmptyState } from '@/components/PageContainer'
import {
  Loader2, AlertCircle, Network, Upload, Pencil, GitMerge, X, ZoomIn, ZoomOut, Maximize2, MessageSquare,
} from 'lucide-react'

// ── Colour palette ─────────────────────────────────────────────────────────────
// Resolved at runtime from CSS variables — we read them once after mount.

const TYPE_HEX: Record<string, string> = {}

// Resolved theme colors — populated by resolveColors() at mount
const THEME: Record<string, string> = {}

// Resolve a CSS variable to a hex color string that Sigma's WebGL parser accepts.
// Sigma only supports #rrggbb and rgb() — hsl() silently becomes black.
// We use a temporary canvas to let the browser do the HSL→RGB conversion.
function cssVarToHex(varName: string): string {
  const s = getComputedStyle(document.documentElement)
  const parts = s.getPropertyValue(varName).trim().split(/\s+/)
  const hslStr = `hsl(${parts[0]}, ${parts[1] ?? '0%'}, ${parts[2] ?? '50%'})`
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = hslStr
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function cssVarToHexAlpha(varName: string, alpha: number): string {
  const hex = cssVarToHex(varName)
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}

function resolveColors() {
  if (typeof window === 'undefined') return
  // map CSS var names to entity type keys
  const map: Record<string, string[]> = {
    '--chart-1': ['person', 'persona', 'customerpersona', 'stakeholder'],
    '--chart-2': ['organization', 'competitor', 'market'],
    '--chart-3': ['product', 'feature', 'technology'],
    '--chart-4': ['metric', 'businessgoal', 'project', 'featurerequest'],
    '--chart-5': ['decision', 'event', 'meeting'],
    '--chart-6': ['concept', 'location', 'knowledge'],
    '--destructive': ['painpoint', 'risk'],
  }
  for (const [cssVar, types] of Object.entries(map)) {
    const color = cssVarToHex(cssVar)
    for (const t of types) TYPE_HEX[t] = color
  }
  TYPE_HEX['default'] = cssVarToHex('--muted-foreground')

  // Theme-adaptive colors for Sigma — must be hex or rgb(), NOT hsl()
  THEME.labelColor = cssVarToHex('--foreground')
  THEME.edgeColor = cssVarToHex('--muted-foreground')
  THEME.stubEdgeColor = cssVarToHexAlpha('--muted-foreground', 0.45)
}

function colorFor(entityType: string): string {
  const key = entityType?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  return TYPE_HEX[key] ?? TYPE_HEX['default'] ?? '#888'
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  persona: 'Customer Persona',
  customerpersona: 'Customer Persona',
}
function entityTypeLabel(entityType: string): string {
  const key = entityType?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  return ENTITY_TYPE_LABELS[key] ?? entityType
}

// Brighter version for labels / borders — sigma uses hex so we inline fallbacks
const TYPE_COLOR_FALLBACK: Record<string, string> = {
  person: '#a78bfa', persona: '#a78bfa', customerpersona: '#a78bfa', stakeholder: '#a78bfa',
  organization: '#7b9fd4', competitor: '#7b9fd4', market: '#7b9fd4',
  product: '#60b8e8', feature: '#60b8e8', technology: '#60b8e8',
  metric: '#4db8a8', businessgoal: '#4db8a8', project: '#4db8a8', featurerequest: '#4db8a8',
  decision: '#f472b6', event: '#f472b6', meeting: '#f472b6',
  concept: '#fbbf24', location: '#fbbf24', knowledge: '#fbbf24',
  painpoint: '#f87171', risk: '#f87171',
  default: '#94a3b8',
}
function colorHex(entityType: string): string {
  const key = entityType?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  return TYPE_COLOR_FALLBACK[key] ?? TYPE_COLOR_FALLBACK['default']
}

// ── Confidence ─────────────────────────────────────────────────────────────────

const SEP = '<SEP>'

function computeConfidence(rawNode: any, degreeMap: Record<string, number>): number {
  const attrs = rawNode.properties?.attributes
  const llmConfRaw = attrs?.confidence ?? null
  const llmConf: number | null =
    typeof llmConfRaw === 'number' ? llmConfRaw
    : typeof llmConfRaw === 'string' && llmConfRaw !== 'null' ? parseFloat(llmConfRaw) : null
  const llmScore = llmConf !== null && !isNaN(llmConf) ? Math.min(Math.max(llmConf, 0), 1) : null
  const sourceCount = Math.max(1, (rawNode.properties?.source_id ?? '').split(SEP).filter(Boolean).length)
  const sourceScore = Math.min(sourceCount / 5, 1)
  const degreeScore = Math.min((degreeMap[rawNode.id] ?? 0) / 8, 1)
  const descScore = Math.min((rawNode.properties?.description ?? '').length / 300, 1)
  return llmScore !== null
    ? 0.25 * llmScore + 0.35 * sourceScore + 0.25 * degreeScore + 0.15 * descScore
    : 0.4 * sourceScore + 0.3 * degreeScore + 0.3 * descScore
}
function confidenceLabel(s: number) { return s >= 0.75 ? 'High' : s >= 0.45 ? 'Medium' : 'Low' }
function confidenceColor(s: number) {
  return s >= 0.75 ? '#4db8a8' : s >= 0.45 ? '#fbbf24' : '#f87171'
}

// ── Node data stored in graphology ─────────────────────────────────────────────

interface NodeAttrs extends Attributes {
  // sigma display
  x: number; y: number; size: number; color: string; label: string
  // our metadata
  isStub: boolean
  entityType: string
  description: string
  confidence: number
  sourceCount: number
  degree: number
  descLength: number
  attributes: any
  isPersonal: boolean
  loading?: boolean
}

interface EdgeAttrs extends Attributes {
  label: string
  color: string
  size: number
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditEntityModal({ nodeId, nodeData, onClose, onSaved }:
  { nodeId: string; nodeData: NodeAttrs; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(nodeData.label)
  const [description, setDescription] = useState(nodeData.description)
  const [entityType, setEntityType] = useState(nodeData.entityType)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const rename = name.trim() !== nodeId
      const updatedData: Record<string, any> = { description, entity_type: entityType }
      if (rename) updatedData.entity_name = name.trim()
      await api.graph.editEntity({ entity_name: nodeId, updated_data: updatedData, allow_rename: rename, allow_merge: rename })
      onSaved()
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Edit Entity</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none" />
            {name.trim() !== nodeId && name.trim() && (
              <p className="text-xs text-chart-4 mt-1">Renaming "{nodeId}" → "{name.trim()}". If that name already exists, the two nodes will be merged.</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entity Type</label>
            <input value={entityType} onChange={e => setEntityType(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none capitalize" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none resize-none" />
          </div>
        </div>
        {error && <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{error}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary/85 text-primary-foreground disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Merge modal ────────────────────────────────────────────────────────────────

function MergeEntitiesModal({ sourceNames, onClose, onMerged }:
  { sourceNames: string[]; onClose: () => void; onMerged: () => void }) {
  const [target, setTarget] = useState(sourceNames[0] ?? '')
  const [customTarget, setCustomTarget] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finalTarget = useCustom ? customTarget.trim() : target

  const merge = async () => {
    if (!finalTarget) { setError('Select or enter a target entity name'); return }
    const sources = sourceNames.filter(n => n !== finalTarget)
    if (sources.length === 0) { setError('Source and target cannot be the same'); return }
    setMerging(true); setError(null)
    try {
      await api.graph.mergeEntities({ entities_to_change: sources, entity_to_change_into: finalTarget })
      onMerged()
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? 'Merge failed') }
    finally { setMerging(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Merge Entities</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">All relationships will be transferred to the target. Sources will be deleted.</p>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Entities to merge (sources)</label>
          <div className="flex flex-wrap gap-1.5">
            {sourceNames.map(n => <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border">{n}</span>)}
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Merge into (target — will be kept)</label>
          {!useCustom
            ? <select value={target} onChange={e => setTarget(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none">
                {sourceNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            : <input value={customTarget} onChange={e => setCustomTarget(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
                placeholder="Enter existing entity name…" />
          }
          <button className="text-xs text-primary hover:underline mt-1" onClick={() => setUseCustom(!useCustom)}>
            {useCustom ? '← Pick from selection' : 'Merge into a different existing entity…'}
          </button>
        </div>
        {error && <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2 mb-3"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition">Cancel</button>
          <button onClick={merge} disabled={merging} className="px-4 py-2 text-sm rounded-lg bg-primary/85 text-primary-foreground disabled:opacity-50 flex items-center gap-2">
            {merging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}<GitMerge className="w-3.5 h-3.5" />Merge
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Node detail panel ──────────────────────────────────────────────────────────

function SignalRow({ label, tooltip, score, weight }: { label: string; tooltip: string; score: number; weight: number }) {
  const pct = Math.round(score * 100)
  return (
    <div title={tooltip}>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span><span className="tabular-nums">{pct}% <span className="opacity-50">×{weight}</span></span>
      </div>
      <div className="rounded-full overflow-hidden h-1 bg-muted">
        <div style={{ width: `${pct}%`, background: confidenceColor(score) }} className="h-full rounded-full" />
      </div>
    </div>
  )
}

interface SelectedNodeInfo {
  id: string
  attrs: NodeAttrs
}

function NodeDetail({ info, onClose, onEdit, onMerge }:
  { info: SelectedNodeInfo | null; onClose: () => void; onEdit: (id: string, attrs: NodeAttrs) => void; onMerge: (id: string) => void }) {
  if (!info || info.attrs.isStub) return null
  const { id, attrs } = info
  const col = colorHex(attrs.entityType)
  const conf = attrs.confidence ?? 0
  const llmConfRaw = attrs.attributes?.confidence ?? null
  const llmConf = typeof llmConfRaw === 'number' ? llmConfRaw
    : typeof llmConfRaw === 'string' && llmConfRaw !== 'null' ? parseFloat(llmConfRaw) : null
  const llmScore = llmConf !== null && !isNaN(llmConf) ? Math.min(Math.max(llmConf, 0), 1) : null
  const sourceScore = Math.min((attrs.sourceCount ?? 1) / 5, 1)
  const degreeScore = Math.min((attrs.degree ?? 0) / 8, 1)
  const descScore = Math.min((attrs.descLength ?? 0) / 300, 1)

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-card border border-border rounded-xl shadow-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <span style={{ background: `${col}20`, color: col, borderColor: `${col}50` }}
          className="text-xs font-semibold px-2 py-0.5 rounded-full border capitalize">
          {entityTypeLabel(attrs.entityType) || 'entity'}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>
      <h3 className="font-semibold text-sm mb-1">{attrs.label}</h3>
      {attrs.degree > 0 && <span className="text-[10px] text-muted-foreground mb-2 block">{attrs.degree} connections</span>}
      {attrs.description && <p className="text-xs text-muted-foreground leading-relaxed">{attrs.description}</p>}
      {attrs.attributes && (
        <div className="mt-2 flex flex-wrap gap-1">
          {attrs.attributes.sentiment && attrs.attributes.sentiment !== 'null' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              /^positive$/i.test(attrs.attributes.sentiment) ? 'bg-chart-3/20 text-chart-3' :
              /^negative$/i.test(attrs.attributes.sentiment) ? 'bg-destructive/15 text-destructive' :
              'bg-muted text-muted-foreground'}`}>{attrs.attributes.sentiment}</span>
          )}
          {attrs.attributes.urgency && attrs.attributes.urgency !== 'null' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              /^critical$/i.test(attrs.attributes.urgency) ? 'bg-destructive/20 text-destructive' :
              /^high$/i.test(attrs.attributes.urgency) ? 'bg-destructive/10 text-destructive' :
              'bg-muted text-muted-foreground'}`}>{attrs.attributes.urgency} urgency</span>
          )}
          {attrs.attributes.business_impact && attrs.attributes.business_impact !== 'null' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
              impact: {attrs.attributes.business_impact}
            </span>
          )}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-xs font-semibold" style={{ color: confidenceColor(conf) }}>
            {confidenceLabel(conf)} · {Math.round(conf * 100)}%
          </span>
        </div>
        <div className="rounded-full overflow-hidden h-1.5 bg-muted mb-3">
          <div style={{ width: `${Math.round(conf * 100)}%`, background: confidenceColor(conf) }} className="h-full rounded-full" />
        </div>
        <div className="space-y-1.5">
          {llmScore !== null && <SignalRow label="LLM certainty" tooltip="Confidence assigned by the LLM during extraction." score={llmScore} weight={0.25} />}
          <SignalRow label="Source corroboration" tooltip={`Appears in ${attrs.sourceCount ?? 1} document chunk(s).`} score={sourceScore} weight={llmScore !== null ? 0.35 : 0.4} />
          <SignalRow label="Relationship density" tooltip={`Connected to ${attrs.degree ?? 0} other entities.`} score={degreeScore} weight={llmScore !== null ? 0.25 : 0.3} />
          <SignalRow label="Description richness" tooltip={`Description is ${attrs.descLength ?? 0} characters.`} score={descScore} weight={llmScore !== null ? 0.15 : 0.3} />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border flex gap-2">
        <button onClick={() => onEdit(id, attrs)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition">
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button onClick={() => onMerge(id)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition">
          <GitMerge className="w-3 h-3" /> Merge into…
        </button>
      </div>
    </div>
  )
}

// ── Query panel ────────────────────────────────────────────────────────────────

function QueryPanel() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'local' | 'global' | 'hybrid'>('hybrid')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await apiClient.get('/api/v1/graph/query', { params: { q: query, mode }, validateStatus: () => true })
      if (res.status !== 200) { setError(res.data?.detail ?? `Query failed (${res.status})`); return }
      const d = res.data
      setResult(typeof d === 'string' ? d : d?.response ?? JSON.stringify(d))
    } catch (e: any) { setError(e?.message ?? 'Query failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="border-t border-border p-4 bg-muted/30">
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="Ask the knowledge graph anything…"
            className="w-full pl-4 pr-4 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none" />
        </div>
        <select value={mode} onChange={e => setMode(e.target.value as any)}
          className="text-sm border border-border rounded-lg bg-input text-foreground px-2 py-2 focus:ring-2 focus:ring-ring/50 outline-none">
          <option value="hybrid">Hybrid</option>
          <option value="local">Local</option>
          <option value="global">Global</option>
        </select>
        <button onClick={run} disabled={loading || !query.trim()}
          className="px-4 py-2 bg-primary/85 text-primary-foreground text-sm rounded-lg disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
        </button>
      </div>
      {error && <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
      {result && <div className="text-sm text-foreground bg-card rounded-lg p-3 border border-border whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{result}</div>}
    </div>
  )
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function Legend({ types }: { types: string[] }) {
  if (!types.length) return null
  return (
    <div className="absolute top-4 left-4 z-10 bg-card/90 border border-border rounded-lg p-3 shadow text-xs space-y-1.5 max-h-56 overflow-y-auto backdrop-blur-sm">
      {types.map(t => (
        <div key={t} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorHex(t) }} />
          <span className="capitalize text-foreground/80">{entityTypeLabel(t)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface KnowledgeGraphTabProps {
  typeFilter: Set<string>
  onTypeFilterChange: (next: Set<string>) => void
  searchTerm?: string
}

export default function KnowledgeGraphTab({ typeFilter, searchTerm = '' }: KnowledgeGraphTabProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const sigmaRef = useRef<Sigma<NodeAttrs, EdgeAttrs> | null>(null)
  const graphRef = useRef<Graph<NodeAttrs, EdgeAttrs>>(new Graph({ multi: false, type: 'directed' }))
  const fa2Ref = useRef<FA2Layout | null>(null)
  const stubsRef = useRef<Record<string, { id: string; entity_type: string; label: string; degree: number }>>({})
  const fetchingRef = useRef<Set<string>>(new Set())
  const degreeMapRef = useRef<Record<string, number>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalNodes, setTotalNodes] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [showEdgeLabels, setShowEdgeLabels] = useState(false)
  const [showPersonalOnly, setShowPersonalOnly] = useState(false)
  const [layoutRunning, setLayoutRunning] = useState(false)
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null)
  const [editInfo, setEditInfo] = useState<{ id: string; attrs: NodeAttrs } | null>(null)
  const [mergeIds, setMergeIds] = useState<string[] | null>(null)
  const [showQuery, setShowQuery] = useState(false)
  const [graphBuilt, setGraphBuilt] = useState(0)
  const queryPanelRef = useRef<HTMLDivElement>(null)

  // ── Apply type filter + search as Sigma reducers ─────────────────────────────
  const applyReducers = useCallback(() => {
    const sigma = sigmaRef.current
    if (!sigma) return
    const tf = typeFilter
    const q = searchTerm.trim().toLowerCase()

    sigma.setSetting('nodeReducer', (nodeId, attrs) => {
      const a = attrs as NodeAttrs
      const typeMatch = tf.size === 0 || tf.has(a.entityType)
      const searchMatch = !q || a.label.toLowerCase().includes(q) || a.entityType.toLowerCase().includes(q)
      if (!typeMatch || (!searchMatch && !a.isStub)) {
        return { ...a, hidden: true }
      }
      // Personal filter: dim non-personal nodes instead of hiding (keeps structure visible)
      if (showPersonalOnly && !a.isPersonal) {
        return { ...a, color: a.color + '30', label: '' }
      }
      // Highlight personal nodes with a ring
      if (showPersonalOnly && a.isPersonal) {
        return { ...a, borderColor: '#60b8e8', size: (a.size ?? 4) + 2 }
      }
      return a
    })

    sigma.setSetting('edgeReducer', (edgeId, attrs) => {
      const a = attrs as EdgeAttrs
      return showEdgeLabels ? a : { ...a, label: '' }
    })

    sigma.refresh()
  }, [typeFilter, searchTerm, showEdgeLabels, showPersonalOnly])

  useEffect(() => { applyReducers() }, [applyReducers])

  // ── Expand stub on click ─────────────────────────────────────────────────────
  const expandStub = useCallback(async (nodeId: string) => {
    const g = graphRef.current
    if (!g.hasNode(nodeId)) return
    const attrs = g.getNodeAttributes(nodeId) as NodeAttrs
    if (!attrs.isStub) return
    if (fetchingRef.current.has(nodeId)) return
    fetchingRef.current.add(nodeId)

    // Mark loading
    g.setNodeAttribute(nodeId, 'color', '#666')
    sigmaRef.current?.refresh()

    try {
      const res = await api.graph.getNode(nodeId)
      const { node: rawNode, neighbors, edges: newEdges } = res.data
      const dm = degreeMapRef.current
      const conf = computeConfidence(rawNode, dm)
      const col = colorHex(rawNode.properties?.entity_type ?? 'default')

      // Upgrade to full node in place (keep position)
      const pos = g.getNodeAttributes(nodeId)
      g.mergeNodeAttributes(nodeId, {
        size: 6 + Math.min((dm[nodeId] ?? 0) * 0.8, 10),
        color: col,
        label: rawNode.properties?.entity_id ?? nodeId,
        isStub: false,
        entityType: rawNode.properties?.entity_type ?? 'default',
        description: rawNode.properties?.description ?? '',
        confidence: conf,
        sourceCount: Math.max(1, (rawNode.properties?.source_id ?? '').split(SEP).filter(Boolean).length),
        degree: dm[nodeId] ?? 0,
        descLength: (rawNode.properties?.description ?? '').length,
        attributes: rawNode.properties?.attributes ?? null,
        loading: false,
      })

      // Add newly discovered stubs
      for (const nb of neighbors) {
        if (!g.hasNode(nb.id)) {
          const stub = stubsRef.current[nb.id]
          if (!stub) continue
          const angle = Math.random() * 2 * Math.PI
          const r = 0.3 + Math.random() * 0.2
          g.addNode(nb.id, {
            x: (pos.x as number) + r * Math.cos(angle),
            y: (pos.y as number) + r * Math.sin(angle),
            size: 3,
            color: colorHex(stub.entity_type),
            label: stub.label,
            isStub: true,
            entityType: stub.entity_type,
            description: '',
            confidence: 0,
            sourceCount: 1,
            degree: stub.degree,
            descLength: 0,
            attributes: null,
            isPersonal: false,
          })
        }
      }

      // Add new edges
      for (const e of newEdges) {
        if (g.hasNode(e.source) && g.hasNode(e.target)) {
          g.mergeEdgeWithKey(e.id, e.source, e.target, {
            label: e.properties?.keywords?.split(',')[0]?.trim() ?? '',
            color: THEME.edgeColor ?? '#94a3b8',
            size: 1.5,
          })
        }
      }

      setLoadedCount(c => c + 1)
      sigmaRef.current?.refresh()
    } catch {
      g.setNodeAttribute(nodeId, 'color', colorHex('default'))
      sigmaRef.current?.refresh()
    } finally {
      fetchingRef.current.delete(nodeId)
    }
  }, [])

  // ── Minimap ───────────────────────────────────────────────────────────────────
  const drawMinimap = useCallback(() => {
    const canvas = minimapRef.current
    const sigma = sigmaRef.current
    const g = graphRef.current
    if (!canvas || !sigma || g.order === 0) return
    const W = canvas.width, H = canvas.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Compute graph bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    g.forEachNode((_, attrs) => {
      const a = attrs as NodeAttrs
      if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x
      if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y
    })
    const gW = maxX - minX || 1, gH = maxY - minY || 1
    const pad = 6
    const scaleX = (W - pad * 2) / gW, scaleY = (H - pad * 2) / gH
    const scale = Math.min(scaleX, scaleY)
    const ox = pad + (W - pad * 2 - gW * scale) / 2
    const oy = pad + (H - pad * 2 - gH * scale) / 2

    const toMX = (x: number) => ox + (x - minX) * scale
    const toMY = (y: number) => oy + (y - minY) * scale

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = 'rgba(15,23,42,0.75)'
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, 6); ctx.fill(); ctx.stroke()

    // Edges
    ctx.strokeStyle = 'rgba(148,163,184,0.25)'
    ctx.lineWidth = 0.5
    g.forEachEdge((_, _a, src, tgt) => {
      const s = g.getNodeAttributes(src) as NodeAttrs
      const t = g.getNodeAttributes(tgt) as NodeAttrs
      ctx.beginPath(); ctx.moveTo(toMX(s.x), toMY(s.y)); ctx.lineTo(toMX(t.x), toMY(t.y)); ctx.stroke()
    })

    // Nodes
    g.forEachNode((_, attrs) => {
      const a = attrs as NodeAttrs
      ctx.beginPath()
      ctx.arc(toMX(a.x), toMY(a.y), a.isStub ? 1 : 2, 0, Math.PI * 2)
      ctx.fillStyle = a.color ?? '#94a3b8'
      ctx.fill()
    })

    // Viewport rectangle
    const cam = sigma.getCamera()
    const ratio = cam.ratio
    const { width: vW, height: vH } = sigma.getDimensions()
    const half = { w: (vW / 2) * ratio, h: (vH / 2) * ratio }
    const vx1 = toMX(cam.x - half.w), vy1 = toMY(cam.y - half.h)
    const vx2 = toMX(cam.x + half.w), vy2 = toMY(cam.y + half.h)
    ctx.strokeStyle = 'rgba(99,179,237,0.8)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.rect(vx1, vy1, vx2 - vx1, vy2 - vy1); ctx.stroke()
  }, [])

  // ── Init Sigma ───────────────────────────────────────────────────────────────
  const initSigma = useCallback(() => {
    if (!containerRef.current) return
    if (sigmaRef.current) { sigmaRef.current.kill(); sigmaRef.current = null }

    resolveColors()

    const sigma = new Sigma(graphRef.current, containerRef.current, {
      renderEdgeLabels: showEdgeLabels,
      defaultEdgeColor: THEME.edgeColor ?? '#94a3b8',
      defaultNodeColor: '#94a3b8',
      labelFont: 'Manrope, sans-serif',
      labelSize: 10,
      labelWeight: '600',
      labelColor: { color: THEME.labelColor ?? '#1e293b' },
      labelRenderedSizeThreshold: 6,
      edgeLabelFont: 'Manrope, sans-serif',
      edgeLabelSize: 8,
      edgeLabelColor: { color: THEME.labelColor ?? '#1e293b' },
      minCameraRatio: 0.05,
      maxCameraRatio: 20,
      defaultEdgeType: 'arrow',
    })

    sigma.on('clickNode', ({ node }) => {
      const attrs = graphRef.current.getNodeAttributes(node) as NodeAttrs
      if (attrs.isStub) {
        expandStub(node)
      } else {
        setSelectedNode({ id: node, attrs })
      }
    })

    sigma.on('clickStage', () => setSelectedNode(null))

    // Redraw minimap whenever camera moves
    sigma.getCamera().on('updated', drawMinimap)
    sigma.on('afterRender', drawMinimap)

    sigmaRef.current = sigma
  }, [expandStub, showEdgeLabels, drawMinimap])

  // ── Build graph data (no Sigma yet) ─────────────────────────────────────────
  const buildGraph = useCallback(async () => {
    const g = graphRef.current
    g.clear()

    const res = await api.graph.getHubs(50)
    if (res.status === 401) {
      localStorage.removeItem('token'); localStorage.removeItem('user')
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
      return
    }

    const rawNodes: any[] = res.data?.nodes ?? []
    const rawEdges: any[] = res.data?.edges ?? []
    const stubs: Record<string, any> = res.data?.stubs ?? {}
    const total: number = res.data?.total_nodes ?? rawNodes.length

    stubsRef.current = stubs

    const dm: Record<string, number> = {}
    for (const e of rawEdges) {
      dm[e.source] = (dm[e.source] ?? 0) + 1
      dm[e.target] = (dm[e.target] ?? 0) + 1
    }
    degreeMapRef.current = dm

    // Seed hub nodes on a circle proportional to graph size
    const n = rawNodes.length
    const initR = Math.max(10, Math.sqrt(n) * 4)
    rawNodes.forEach((rawNode, i) => {
      const a = (2 * Math.PI * i) / n
      const degree = dm[rawNode.id] ?? 0
      g.mergeNode(rawNode.id, {
        x: initR * Math.cos(a),
        y: initR * Math.sin(a),
        size: 4 + Math.min(degree * 0.5, 8),
        color: colorHex(rawNode.properties?.entity_type ?? 'default'),
        label: rawNode.properties?.entity_id ?? rawNode.id,
        isStub: false,
        entityType: rawNode.properties?.entity_type ?? 'default',
        description: rawNode.properties?.description ?? '',
        confidence: computeConfidence(rawNode, dm),
        sourceCount: Math.max(1, (rawNode.properties?.source_id ?? '').split(SEP).filter(Boolean).length),
        degree,
        descLength: (rawNode.properties?.description ?? '').length,
        attributes: rawNode.properties?.attributes ?? null,
        isPersonal: rawNode.properties?.is_personal ?? false,
      })
    })

    const hubIds = new Set(rawNodes.map((rn: any) => rn.id))

    // Hub-hub edges (with labels)
    const hubHubEdgeIds = new Set<string>()
    for (const e of rawEdges) {
      if (hubIds.has(e.source) && hubIds.has(e.target)) {
        hubHubEdgeIds.add(e.id)
        g.mergeEdgeWithKey(e.id, e.source, e.target, {
          label: e.properties?.keywords?.split(',')[0]?.trim() ?? '',
          color: THEME.edgeColor ?? '#94a3b8',
          size: 1.5,
        })
      }
    }

    // Stub dots — each grouped around their anchor hub
    const stubsByHub: Record<string, string[]> = {}
    for (const [sid, stub] of Object.entries(stubs) as [string, any][]) {
      const anchorId = stub.hub_anchor ?? (() => {
        const e = rawEdges.find((re: any) =>
          (re.source === sid && hubIds.has(re.target)) ||
          (re.target === sid && hubIds.has(re.source))
        )
        return e ? (hubIds.has(e.source) ? e.source : e.target) : null
      })()
      if (!anchorId) continue
      stubsByHub[anchorId] = stubsByHub[anchorId] ?? []
      stubsByHub[anchorId].push(sid)
    }

    for (const [hubId, stubList] of Object.entries(stubsByHub)) {
      const hubPos = g.getNodeAttributes(hubId) as NodeAttrs
      const orbitR = Math.max(3, (stubList.length * 1.4) / (2 * Math.PI))
      stubList.forEach((sid, i) => {
        if (g.hasNode(sid) && !(g.getNodeAttribute(sid, 'isStub') as boolean)) return
        const stub = (stubs as any)[sid]
        const a = (2 * Math.PI * i) / stubList.length
        g.mergeNode(sid, {
          x: hubPos.x + orbitR * Math.cos(a),
          y: hubPos.y + orbitR * Math.sin(a),
          size: 2,
          color: colorHex(stub.entity_type),
          label: stub.label,
          isStub: true,
          entityType: stub.entity_type,
          description: '',
          confidence: 0,
          sourceCount: 1,
          degree: stub.degree ?? 0,
          descLength: 0,
          attributes: null,
          isPersonal: stub.is_personal ?? false,
        })
      })
    }

    // Hub-stub edges — only add edges not already added as hub-hub (preserves their labels)
    for (const e of rawEdges) {
      if (!hubHubEdgeIds.has(e.id) && g.hasNode(e.source) && g.hasNode(e.target)) {
        g.mergeEdgeWithKey(e.id, e.source, e.target, {
          label: '',
          color: THEME.stubEdgeColor ?? '#64748b',
          size: 0.8,
        })
      }
    }

    return { rawNodes, total }
  }, [])

  // ── Load graph ───────────────────────────────────────────────────────────────
  const loadGraph = useCallback(async () => {
    if (fa2Ref.current) { fa2Ref.current.stop(); fa2Ref.current = null }
    setLayoutRunning(false)
    setLoading(true); setError(null)

    try {
      const result = await buildGraph()
      if (!result) return
      const { rawNodes, total } = result
      const g = graphRef.current
      const nodeCount = g.order

      const types = [...new Set(rawNodes.map((n: any) => n.properties?.entity_type).filter(Boolean))] as string[]
      setEntityTypes(types)
      setTotalNodes(total)
      setLoadedCount(rawNodes.length)

      // Run FA2 layout BEFORE showing Sigma — avoids users seeing chaotic animation
      setLayoutRunning(true)
      await new Promise<void>(resolve => {
        const fa2 = new FA2Layout(g, {
          settings: {
            gravity: 2,               // strong enough to keep clusters from flying off
            scalingRatio: 10,
            strongGravityMode: true,  // gravity proportional to distance → keeps nodes in window
            barnesHutOptimize: nodeCount > 150,
            slowDown: Math.max(1, Math.log(nodeCount + 1)),
            linLogMode: false,
            outboundAttractionDistribution: false,
          },
        })
        fa2Ref.current = fa2
        fa2.start()
        const runMs = Math.min(3000 + nodeCount * 8, 10000)
        setTimeout(() => {
          fa2.stop()
          fa2Ref.current = null
          resolve()
        }, runMs)
      })

      setLayoutRunning(false)

      // Signal that graph data is ready — initSigma runs after loading→false
      // so containerRef.current is guaranteed to be in the DOM.
      setGraphBuilt(n => n + 1)

    } catch (e: any) { setError(e?.message ?? 'Failed to load knowledge graph') }
    finally { setLoading(false) }
  }, [buildGraph, initSigma, drawMinimap])

  // Init Sigma after the loading spinner is gone — containerRef is in the DOM at this point.
  useEffect(() => {
    if (loading || graphBuilt === 0) return
    initSigma()
    setTimeout(() => {
      sigmaRef.current?.refresh()
      sigmaRef.current?.getCamera().animatedReset()
      drawMinimap()
    }, 50)
    setTimeout(() => {
      sigmaRef.current?.refresh()
      sigmaRef.current?.getCamera().animatedReset()
    }, 400)
  }, [loading, graphBuilt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadGraph()
    return () => {
      fa2Ref.current?.stop()
      sigmaRef.current?.kill()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle edge labels
  useEffect(() => {
    sigmaRef.current?.setSetting('renderEdgeLabels', showEdgeLabels)
    sigmaRef.current?.refresh()
  }, [showEdgeLabels])

  // Re-resolve colors when theme changes — update Sigma settings AND existing edge colors
  useEffect(() => {
    resolveColors()
    const sigma = sigmaRef.current
    const g = graphRef.current
    if (!sigma) return

    // Update Sigma display settings
    sigma.setSetting('labelColor', { color: THEME.labelColor ?? '#1e293b' })
    sigma.setSetting('edgeLabelColor', { color: THEME.labelColor ?? '#1e293b' })
    sigma.setSetting('defaultEdgeColor', THEME.edgeColor ?? '#94a3b8')

    // Re-color existing edges in the graph (explicit color attrs override defaultEdgeColor)
    g.forEachEdge((edgeId, attrs) => {
      const a = attrs as EdgeAttrs
      // Hub-stub edges are thinner (size 0.8); hub-hub are 1.5
      const isStubEdge = (a.size ?? 1) < 1
      g.setEdgeAttribute(edgeId, 'color', isStubEdge
        ? (THEME.stubEdgeColor ?? '#64748b')
        : (THEME.edgeColor ?? '#94a3b8')
      )
    })

    sigma.refresh()
    drawMinimap()
  }, [theme, drawMinimap])

  const syncAll = useCallback(async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await apiClient.post('/api/v1/graph/sync', {}, { validateStatus: () => true })
      if (res.status === 200) {
        const d = res.data.details
        setSyncResult(`Synced — ${d.context_sources} sources, ${d.extracted_entities} entities, ${d.work_contexts} work contexts, ${d.meeting_notes} meetings, ${d.pm_decisions} decisions.`)
        setTimeout(() => { loadGraph(); setSyncResult(null) }, 3000)
      } else { setSyncResult(res.data?.detail ?? `Sync failed (${res.status})`) }
    } catch (e: any) { setSyncResult(e?.message ?? 'Sync failed') }
    finally { setSyncing(false) }
  }, [loadGraph])

  const zoomIn = () => sigmaRef.current?.getCamera().animatedZoom({ factor: 1.5 })
  const zoomOut = () => sigmaRef.current?.getCamera().animatedUnzoom({ factor: 1.5 })
  const fitGraph = () => sigmaRef.current?.getCamera().animatedReset()

  const stubCount = graphRef.current.nodes().filter(n => {
    try { return graphRef.current.getNodeAttribute(n, 'isStub') } catch { return false }
  }).length

  if (loading) return <Card><Loading text="Loading knowledge graph…" /></Card>
  if (error) return (
    <Card>
      <EmptyState icon={AlertCircle} title="Failed to load knowledge graph" description={error}
        action={<button onClick={loadGraph} className="text-sm text-primary hover:underline">Retry</button>} />
    </Card>
  )
  if (totalNodes === 0) return (
    <Card>
      <EmptyState icon={Network} title="No knowledge graph data yet"
        description="Sync your existing context sources, extracted entities, personas, and work context into the graph."
        action={
          <div className="flex flex-col items-center gap-2">
            <button onClick={syncAll} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-primary/85 text-primary-foreground text-sm rounded-lg disabled:opacity-50">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {syncing ? 'Syncing…' : 'Sync All Data to Graph'}
            </button>
            {syncResult && <p className="text-xs text-center max-w-md text-chart-3">{syncResult}</p>}
          </div>
        } />
    </Card>
  )

  return (
    <>
      <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card">
        {/* Toolbar */}
        <div className="relative flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Knowledge Graph</span>
            <span>{loadedCount} loaded</span>
            {stubCount > 0 && <span>{stubCount} unloaded · click dots to expand</span>}
            <span>{totalNodes} total</span>
            {layoutRunning && (
              <span className="flex items-center gap-1 text-primary">
                <Loader2 className="w-3 h-3 animate-spin" /> Layouting…
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Edge labels toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-muted-foreground">Edge Labels</span>
              <button
                role="switch" aria-checked={showEdgeLabels}
                onClick={() => setShowEdgeLabels(v => !v)}
                className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors focus:outline-none ${showEdgeLabels ? 'bg-primary border-primary' : 'bg-muted border-border'}`}>
                <span className={`pointer-events-none block h-3 w-3 rounded-full bg-white shadow transition-transform mt-[1px] ${showEdgeLabels ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </label>

            {/* My contributions toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-muted-foreground">My Data</span>
              <button
                role="switch" aria-checked={showPersonalOnly}
                onClick={() => setShowPersonalOnly(v => !v)}
                className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors focus:outline-none ${showPersonalOnly ? 'bg-chart-3 border-chart-3' : 'bg-muted border-border'}`}>
                <span className={`pointer-events-none block h-3 w-3 rounded-full bg-white shadow transition-transform mt-[1px] ${showPersonalOnly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </label>

            <button
              onClick={() => {
                setShowQuery(v => {
                  if (!v) setTimeout(() => queryPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
                  return !v
                })
              }}
              className={`flex items-center gap-1.5 text-xs transition ${showQuery ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Ask the knowledge graph a question">
              <MessageSquare className="w-3.5 h-3.5" /> Ask AI
            </button>

            <button onClick={syncAll} disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-primary disabled:opacity-50 transition"
              title="Push all context sources, entities, personas, and work context into the graph">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {syncing ? 'Syncing…' : 'Sync Data'}
            </button>
          </div>
          {syncResult && (
            <div className="absolute top-10 right-4 z-20 bg-chart-3/10 border border-chart-3/30 rounded-lg px-3 py-2 text-xs text-chart-3 max-w-sm shadow">{syncResult}</div>
          )}
        </div>

        {/* Graph canvas */}
        <div className="relative" style={{ height: '75vh', minHeight: 520 }}>
          <div ref={containerRef} className="w-full h-full" />

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
            <button onClick={zoomIn} className="w-8 h-8 bg-card border border-border rounded-lg flex items-center justify-center hover:bg-muted shadow-sm">
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={zoomOut} className="w-8 h-8 bg-card border border-border rounded-lg flex items-center justify-center hover:bg-muted shadow-sm">
              <ZoomOut className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={fitGraph} className="w-8 h-8 bg-card border border-border rounded-lg flex items-center justify-center hover:bg-muted shadow-sm">
              <Maximize2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Minimap */}
          <canvas
            ref={minimapRef}
            width={160} height={120}
            className="absolute bottom-4 left-4 z-10 rounded-lg pointer-events-none"
            style={{ width: 160, height: 120 }}
          />

          <Legend types={entityTypes} />

          <NodeDetail
            info={selectedNode}
            onClose={() => setSelectedNode(null)}
            onEdit={(id, attrs) => { setEditInfo({ id, attrs }); setSelectedNode(null) }}
            onMerge={id => { setMergeIds([id]); setSelectedNode(null) }}
          />
        </div>

        {showQuery && (
          <div ref={queryPanelRef}>
            <QueryPanel />
          </div>
        )}
      </div>

      {editInfo && (
        <EditEntityModal
          nodeId={editInfo.id}
          nodeData={editInfo.attrs}
          onClose={() => setEditInfo(null)}
          onSaved={() => { setEditInfo(null); loadGraph() }}
        />
      )}
      {mergeIds && (
        <MergeEntitiesModal
          sourceNames={mergeIds}
          onClose={() => setMergeIds(null)}
          onMerged={() => { setMergeIds(null); loadGraph() }}
        />
      )}
    </>
  )
}
