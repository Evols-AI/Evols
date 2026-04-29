import React, { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  MarkerType, NodeProps, Handle, Position, BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { apiClient } from '@/services/api'
import api from '@/services/api'
import { Loading, Card, EmptyState } from '@/components/PageContainer'
import { Loader2, Search, AlertCircle, Network, Upload, Pencil, GitMerge, X } from 'lucide-react'

// ── Entity type colours ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  person:         { bg: 'hsl(var(--chart-5) / 0.12)', border: 'hsl(var(--chart-5))', text: 'hsl(var(--chart-5))' },
  decision:       { bg: 'hsl(var(--chart-5) / 0.12)', border: 'hsl(var(--chart-5))', text: 'hsl(var(--chart-5))' },
  organization:   { bg: 'hsl(var(--chart-3) / 0.12)', border: 'hsl(var(--chart-3))', text: 'hsl(var(--chart-3))' },
  product:        { bg: 'hsl(var(--chart-3) / 0.12)', border: 'hsl(var(--chart-3))', text: 'hsl(var(--chart-3))' },
  feature:        { bg: 'hsl(var(--chart-3) / 0.12)', border: 'hsl(var(--chart-3))', text: 'hsl(var(--chart-3))' },
  persona:        { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  businessgoal:   { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  project:        { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  concept:        { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  location:       { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  competitor:     { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  technology:     { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  market:         { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  event:          { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  featurerequest: { bg: 'hsl(var(--chart-4) / 0.15)', border: 'hsl(var(--chart-4))', text: 'hsl(var(--chart-4))' },
  metric:         { bg: 'hsl(var(--chart-4) / 0.15)', border: 'hsl(var(--chart-4))', text: 'hsl(var(--chart-4))' },
  painpoint:      { bg: 'hsl(var(--destructive) / 0.10)', border: 'hsl(var(--destructive))', text: 'hsl(var(--destructive))' },
  meeting:        { bg: 'hsl(var(--muted))', border: 'hsl(var(--border))', text: 'hsl(var(--muted-foreground))' },
  default:        { bg: 'hsl(var(--muted))', border: 'hsl(var(--border))', text: 'hsl(var(--muted-foreground))' },
}

function colorFor(entityType: string) {
  const key = entityType?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  return TYPE_COLORS[key] ?? TYPE_COLORS.default
}

// ── Confidence ────────────────────────────────────────────────────────────────

const SEP = '<SEP>'

function computeConfidence(rawNode: any, degreeMap: Record<string, number>): number {
  const attrs = rawNode.properties?.attributes
  const llmConfRaw = attrs?.confidence ?? null
  const llmConf: number | null =
    typeof llmConfRaw === 'number' ? llmConfRaw
    : typeof llmConfRaw === 'string' && llmConfRaw !== 'null' ? parseFloat(llmConfRaw)
    : null
  const llmScore = llmConf !== null && !isNaN(llmConf) ? Math.min(Math.max(llmConf, 0), 1.0) : null
  const sourceId: string = rawNode.properties?.source_id ?? ''
  const sourceCount = sourceId ? sourceId.split(SEP).filter(Boolean).length : 1
  const sourceScore = Math.min(sourceCount / 5, 1.0)
  const degree = degreeMap[rawNode.id] ?? 0
  const degreeScore = Math.min(degree / 8, 1.0)
  const desc: string = rawNode.properties?.description ?? ''
  const descScore = Math.min(desc.length / 300, 1.0)
  if (llmScore !== null) return 0.25 * llmScore + 0.35 * sourceScore + 0.25 * degreeScore + 0.15 * descScore
  return 0.4 * sourceScore + 0.3 * degreeScore + 0.3 * descScore
}

function confidenceLabel(score: number) { return score >= 0.75 ? 'High' : score >= 0.45 ? 'Medium' : 'Low' }
function confidenceColor(score: number) {
  return score >= 0.75 ? 'hsl(var(--chart-3))' : score >= 0.45 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))'
}

// ── Custom node ───────────────────────────────────────────────────────────────

function EntityNode({ data }: NodeProps) {
  const c = colorFor(data.entityType)
  const conf: number = data.confidence ?? 0
  return (
    <div
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
      className="rounded-lg border-2 px-3 py-2 shadow-sm text-xs font-medium max-w-[140px] text-center cursor-pointer"
      title={data.description}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="truncate font-semibold">{data.label}</div>
      {data.entityType && <div className="opacity-60 capitalize mt-0.5">{data.entityType}</div>}
      <div className="mt-1.5 rounded-full overflow-hidden h-0.5 bg-black/10">
        <div style={{ width: `${Math.round(conf * 100)}%`, background: confidenceColor(conf) }} className="h-full rounded-full" />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const NODE_TYPES = { entity: EntityNode }

// ── Layout ────────────────────────────────────────────────────────────────────

function buildDegreeMap(rawEdges: any[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const e of rawEdges) {
    map[e.source] = (map[e.source] ?? 0) + 1
    map[e.target] = (map[e.target] ?? 0) + 1
  }
  return map
}

function layoutNodes(rawNodes: any[], degreeMap: Record<string, number>): Node[] {
  const cols = Math.ceil(Math.sqrt(rawNodes.length)) || 1
  return rawNodes.map((n, i) => {
    const confidence = computeConfidence(n, degreeMap)
    return {
      id: n.id,
      type: 'entity',
      position: { x: (i % cols) * 210 + Math.random() * 30, y: Math.floor(i / cols) * 130 + Math.random() * 20 },
      data: {
        label: n.properties?.entity_id ?? n.id,
        entityType: n.properties?.entity_type ?? 'default',
        description: n.properties?.description ?? '',
        confidence,
        sourceCount: (n.properties?.source_id ?? '').split(SEP).filter(Boolean).length || 1,
        degree: degreeMap[n.id] ?? 0,
        descLength: (n.properties?.description ?? '').length,
        attributes: n.properties?.attributes ?? null,
      },
    }
  })
}

function buildEdges(rawEdges: any[]): Edge[] {
  return rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.properties?.keywords?.split(',')[0]?.trim() ?? '',
    labelStyle: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
    labelBgStyle: { fill: 'transparent' },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--border))' },
    style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 },
    animated: false,
  }))
}

// ── Edit entity modal ─────────────────────────────────────────────────────────

function EditEntityModal({
  node,
  onClose,
  onSaved,
}: {
  node: Node
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(node.data.label as string)
  const [description, setDescription] = useState(node.data.description as string)
  const [entityType, setEntityType] = useState(node.data.entityType as string)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const originalName = node.id

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const updatedData: Record<string, any> = { description, entity_type: entityType }
      const rename = name.trim() !== originalName
      if (rename) updatedData.entity_name = name.trim()
      await api.graph.editEntity({
        entity_name: originalName,
        updated_data: updatedData,
        allow_rename: rename,
        allow_merge: rename, // merge if target already exists
      })
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Edit Entity</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
              placeholder="Entity name"
            />
            {name.trim() !== originalName && name.trim() && (
              <p className="text-xs text-chart-4 mt-1">
                Renaming "{originalName}" → "{name.trim()}". If that name already exists, the two nodes will be merged.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entity Type</label>
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none capitalize"
              placeholder="e.g. persona, painpoint, feature"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none resize-none"
              placeholder="Describe this entity…"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition text-foreground">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary/85 text-primary-foreground hover:bg-primary/85 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Merge entities modal ──────────────────────────────────────────────────────

function MergeEntitiesModal({
  sourceNames,
  allNodeIds,
  onClose,
  onMerged,
}: {
  sourceNames: string[]
  allNodeIds: string[]
  onClose: () => void
  onMerged: () => void
}) {
  const [target, setTarget] = useState(sourceNames[0] ?? '')
  const [customTarget, setCustomTarget] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalTarget = useCustom ? customTarget.trim() : target

  const merge = async () => {
    if (!finalTarget) { setError('Select or enter a target entity name'); return }
    const sources = sourceNames.filter((n) => n !== finalTarget)
    if (sources.length === 0) { setError('Source and target cannot be the same'); return }
    setMerging(true)
    setError(null)
    try {
      await api.graph.mergeEntities({ entities_to_change: sources, entity_to_change_into: finalTarget })
      onMerged()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Merge failed')
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Merge Entities</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          All relationships from the source entities will be transferred to the target. Sources will be deleted.
        </p>

        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Entities to merge (sources)</label>
          <div className="flex flex-wrap gap-1.5">
            {sourceNames.map((n) => (
              <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground border border-border">{n}</span>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Merge into (target — will be kept)</label>
          {!useCustom ? (
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
            >
              {sourceNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <input
              value={customTarget}
              onChange={(e) => setCustomTarget(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
              placeholder="Enter existing entity name…"
            />
          )}
          <button
            className="text-xs text-primary hover:underline mt-1"
            onClick={() => setUseCustom(!useCustom)}
          >
            {useCustom ? '← Pick from selection' : 'Merge into a different existing entity…'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition text-foreground">Cancel</button>
          <button
            onClick={merge}
            disabled={merging}
            className="px-4 py-2 text-sm rounded-lg bg-primary/85 text-primary-foreground hover:bg-primary/85 disabled:opacity-50 flex items-center gap-2"
          >
            {merging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <GitMerge className="w-3.5 h-3.5" />
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Node detail panel (read + action buttons) ─────────────────────────────────

function SignalRow({ label, tooltip, score, weight }: { label: string; tooltip: string; score: number; weight: number }) {
  const pct = Math.round(score * 100)
  return (
    <div title={tooltip}>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span className="tabular-nums">{pct}% <span className="opacity-50">×{weight}</span></span>
      </div>
      <div className="rounded-full overflow-hidden h-1 bg-muted">
        <div style={{ width: `${pct}%`, background: confidenceColor(score) }} className="h-full rounded-full" />
      </div>
    </div>
  )
}

function NodeDetail({
  node,
  onClose,
  onEdit,
  onMerge,
}: {
  node: Node | null
  onClose: () => void
  onEdit: (node: Node) => void
  onMerge: (node: Node) => void
}) {
  if (!node) return null
  const c = colorFor(node.data.entityType)
  const conf: number = node.data.confidence ?? 0
  const attrs = node.data.attributes
  const llmConfRaw = attrs?.confidence ?? null
  const llmConf = typeof llmConfRaw === 'number' ? llmConfRaw
    : typeof llmConfRaw === 'string' && llmConfRaw !== 'null' ? parseFloat(llmConfRaw) : null
  const llmScore = llmConf !== null && !isNaN(llmConf) ? Math.min(Math.max(llmConf, 0), 1.0) : null
  const hasLlmSignal = llmScore !== null
  const sourceScore = Math.min((node.data.sourceCount ?? 1) / 5, 1.0)
  const degreeScore = Math.min((node.data.degree ?? 0) / 8, 1.0)
  const descScore = Math.min((node.data.descLength ?? 0) / 300, 1.0)

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-card border border-border rounded-xl shadow-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <span style={{ background: c.bg, color: c.text, borderColor: c.border }} className="text-xs font-semibold px-2 py-0.5 rounded-full border capitalize">
          {node.data.entityType || 'entity'}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>

      <h3 className="font-semibold text-foreground text-sm mb-2">{node.data.label}</h3>

      {node.data.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{node.data.description}</p>
      )}

      {attrs && Object.keys(attrs).filter(k => k !== 'confidence' && attrs[k] !== null && attrs[k] !== 'null').length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {attrs.sentiment && attrs.sentiment !== 'null' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              /^positive$/i.test(attrs.sentiment) ? 'bg-chart-3/20 text-chart-3' :
              /mostly_positive/i.test(attrs.sentiment) ? 'bg-chart-3/10 text-chart-3' :
              /^negative$/i.test(attrs.sentiment) ? 'bg-destructive/15 text-destructive' :
              /mostly_negative/i.test(attrs.sentiment) ? 'bg-destructive/10 text-destructive' :
              'bg-muted text-muted-foreground'
            }`}>
              {attrs.sentiment}
            </span>
          )}
          {attrs.urgency && attrs.urgency !== 'null' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              /^critical$/i.test(attrs.urgency) ? 'bg-destructive/20 text-destructive' :
              /^high$/i.test(attrs.urgency) ? 'bg-destructive/10 text-destructive' :
              /^medium$/i.test(attrs.urgency) ? 'bg-chart-4/20 text-chart-4' :
              /^low$/i.test(attrs.urgency) ? 'bg-muted text-muted-foreground' :
              'bg-muted/50 text-muted-foreground/60'
            }`}>
              {attrs.urgency} urgency
            </span>
          )}
          {attrs.business_impact && attrs.business_impact !== 'null' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              /^transformative$/i.test(attrs.business_impact) ? 'bg-chart-1/20 text-chart-1' :
              /^high$/i.test(attrs.business_impact) ? 'bg-chart-1/10 text-chart-1' :
              /^medium$/i.test(attrs.business_impact) ? 'bg-primary/10 text-primary' :
              /^low$/i.test(attrs.business_impact) ? 'bg-muted text-muted-foreground' :
              'bg-muted/50 text-muted-foreground/60'
            }`}>
              impact: {attrs.business_impact}
            </span>
          )}
        </div>
      )}
      {attrs?.context_snippet && attrs.context_snippet !== 'null' && (
        <p className="mt-1.5 text-[10px] text-muted-foreground italic leading-relaxed">
          "{String(attrs.context_snippet).slice(0, 120)}{String(attrs.context_snippet).length > 120 ? '…' : ''}"
        </p>
      )}

      {/* Confidence breakdown */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-xs font-semibold" style={{ color: confidenceColor(conf) }}>{confidenceLabel(conf)} · {Math.round(conf * 100)}%</span>
        </div>
        <div className="rounded-full overflow-hidden h-1.5 bg-muted mb-3">
          <div style={{ width: `${Math.round(conf * 100)}%`, background: confidenceColor(conf) }} className="h-full rounded-full" />
        </div>
        <div className="space-y-1.5">
          {hasLlmSignal && <SignalRow label="LLM certainty" tooltip="Confidence assigned by the LLM during extraction." score={llmScore!} weight={0.25} />}
          <SignalRow label="Source corroboration" tooltip={`Appears in ${node.data.sourceCount ?? 1} document chunk(s).`} score={sourceScore} weight={hasLlmSignal ? 0.35 : 0.4} />
          <SignalRow label="Relationship density" tooltip={`Connected to ${node.data.degree ?? 0} other entities.`} score={degreeScore} weight={hasLlmSignal ? 0.25 : 0.3} />
          <SignalRow label="Description richness" tooltip={`Description is ${node.data.descLength ?? 0} characters.`} score={descScore} weight={hasLlmSignal ? 0.15 : 0.3} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 pt-3 border-t border-border flex gap-2">
        <button
          onClick={() => onEdit(node)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition text-foreground"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={() => onMerge(node)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition text-foreground"
        >
          <GitMerge className="w-3 h-3" /> Merge into…
        </button>
      </div>
    </div>
  )
}

// ── Query panel ───────────────────────────────────────────────────────────────

function QueryPanel() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'local' | 'global' | 'hybrid'>('hybrid')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runQuery = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await apiClient.get('/api/v1/graph/query', { params: { q: query, mode }, validateStatus: () => true })
      if (res.status !== 200) { setError(res.data?.detail ?? `Query failed (${res.status})`); return }
      const data = res.data
      setResult(typeof data === 'string' ? data : data?.response ?? JSON.stringify(data))
    } catch (e: any) { setError(e?.message ?? 'Query failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="border-t border-border p-4 bg-muted/30">
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runQuery()}
            placeholder="Ask the knowledge graph anything…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
          />
        </div>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="text-sm border border-border rounded-lg bg-input text-foreground px-2 py-2 focus:ring-2 focus:ring-ring/50 outline-none">
          <option value="hybrid">Hybrid</option>
          <option value="local">Local</option>
          <option value="global">Global</option>
        </select>
        <button onClick={runQuery} disabled={loading || !query.trim()} className="px-4 py-2 bg-primary/85 text-primary-foreground text-sm rounded-lg hover:bg-primary/85 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
        </button>
      </div>
      {error && <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
      {result && <div className="text-sm text-foreground bg-card rounded-lg p-3 border border-border whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{result}</div>}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ types }: { types: string[] }) {
  if (types.length === 0) return null
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-card border border-border rounded-lg p-3 shadow text-xs space-y-1.5 max-h-48 overflow-y-auto">
      {types.map((t) => {
        const c = colorFor(t)
        return (
          <div key={t} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c.bg, border: `1.5px solid ${c.border}` }} />
            <span className="capitalize text-foreground">{t}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface KnowledgeGraphTabProps {
  typeFilter: Set<string>
  onTypeFilterChange: (next: Set<string>) => void
}

export default function KnowledgeGraphTab({ typeFilter, onTypeFilterChange }: KnowledgeGraphTabProps) {
  const [allNodes, setAllNodes] = useState<Node[]>([])
  const [allEdges, setAllEdges] = useState<Edge[]>([])
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // Edit / merge modal state
  const [editNode, setEditNode] = useState<Node | null>(null)
  const [mergeNode, setMergeNode] = useState<Node | null>(null)
  // Multi-select for bulk merge (ctrl/cmd+click)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadGraph = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiClient.get('/api/v1/graph/graph', { params: { label: '*', max_depth: 3 }, validateStatus: () => true })
      if (res.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; return }
      if (res.status !== 200) { setError(res.data?.detail ?? `Server error (${res.status})`); return }
      const data = res.data
      const rawNodes: any[] = data?.nodes ?? []
      const rawEdges: any[] = data?.edges ?? []
      const degreeMap = buildDegreeMap(rawEdges)
      const builtNodes = layoutNodes(rawNodes, degreeMap)
      const builtEdges = buildEdges(rawEdges)
      setAllNodes(builtNodes); setAllEdges(builtEdges)
      setNodeCount(rawNodes.length); setEdgeCount(rawEdges.length)
      const types = [...new Set(rawNodes.map((n) => n.properties?.entity_type).filter(Boolean))] as string[]
      setEntityTypes(types)
    } catch (e: any) { setError(e?.message ?? 'Failed to load knowledge graph') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (typeFilter.size === 0) { setNodes(allNodes); setEdges(allEdges); return }
    const visibleNodes = allNodes.filter((n) => typeFilter.has(n.data.entityType))
    const visibleIds = new Set(visibleNodes.map((n) => n.id))
    setNodes(visibleNodes)
    setEdges(allEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)))
  }, [allNodes, allEdges, typeFilter])

  const syncAll = useCallback(async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await apiClient.post('/api/v1/graph/sync', {}, { validateStatus: () => true })
      if (res.status === 200) {
        const d = res.data.details
        setSyncResult(`Synced — ${d.context_sources} sources, ${d.extracted_entities} entities, ${d.personas} personas, ${d.work_contexts} work contexts, ${d.meeting_notes} meetings, ${d.pm_decisions} decisions. LightRAG is processing in the background.`)
        setTimeout(() => { loadGraph(); setSyncResult(null) }, 5000)
      } else { setSyncResult(res.data?.detail ?? `Sync failed (${res.status})`) }
    } catch (e: any) { setSyncResult(e?.message ?? 'Sync failed') }
    finally { setSyncing(false) }
  }, [loadGraph])

  useEffect(() => { loadGraph() }, [loadGraph])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setSelectedIds(new Set())
  }, [])

  const handleBulkMerge = () => {
    if (selectedIds.size < 2) return
    // Open merge modal pre-populated with selected nodes
    const fakeNode: Node = {
      id: '__multi__',
      type: 'entity',
      position: { x: 0, y: 0 },
      data: { label: '__multi__', entityType: '' },
    }
    setMergeNode(fakeNode)
  }

  if (loading) return <Card><Loading text="Loading knowledge graph…" /></Card>
  if (error) return (
    <Card>
      <EmptyState
        icon={AlertCircle}
        title="Failed to load knowledge graph"
        description={error}
        action={<button onClick={loadGraph} className="text-sm text-primary hover:underline">Retry</button>}
      />
    </Card>
  )
  if (nodes.length === 0) return (
    <Card>
      <EmptyState
        icon={Network}
        title="No knowledge graph data yet"
        description="Sync your existing context sources, extracted entities, personas, and work context into the graph."
        action={
          <div className="flex flex-col items-center gap-2">
            <button onClick={syncAll} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-primary/85 text-primary-foreground text-sm rounded-lg hover:bg-primary/85 disabled:opacity-50">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {syncing ? 'Syncing…' : 'Sync All Data to Graph'}
            </button>
            {syncResult && <p className="text-xs text-center max-w-md text-chart-3">{syncResult}</p>}
          </div>
        }
      />
    </Card>
  )

  const multiSelectNames = [...selectedIds]

  return (
    <>
      <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card">
        {/* Toolbar */}
        <div className="relative flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Knowledge Graph</span>
            <span>{typeFilter.size === 0 ? nodeCount : nodes.length} entities</span>
            <span>{typeFilter.size === 0 ? edgeCount : edges.length} relationships</span>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size >= 2 && (
              <button
                onClick={handleBulkMerge}
                className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-md px-2.5 py-1.5 hover:bg-primary/5 transition"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Merge {selectedIds.size} selected
              </button>
            )}
            <button
              onClick={syncAll}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary disabled:opacity-50 transition"
              title="Push all context sources, entities, personas, and work context into the graph"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {syncing ? 'Syncing…' : 'Sync Data'}
            </button>
          </div>
          {syncResult && (
            <div className="absolute top-10 right-4 z-20 bg-chart-3/10 border border-chart-3/30 rounded-lg px-3 py-2 text-xs text-chart-3 max-w-sm shadow">{syncResult}</div>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="px-4 py-1.5 bg-primary/5 border-b border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{selectedIds.size} entities selected (Ctrl+click to add more)</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        {/* Graph canvas */}
        <div className="relative" style={{ height: 520 }}>
          <ReactFlow
            nodes={nodes.map(n => ({
              ...n,
              style: selectedIds.has(n.id) ? { outline: '2px solid hsl(var(--primary))', outlineOffset: 2, borderRadius: 8 } : undefined,
            }))}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={NODE_TYPES}
            onNodeClick={(evt, node) => {
              if (evt.ctrlKey || evt.metaKey) {
                setSelectedIds(prev => {
                  const next = new Set(prev)
                  next.has(node.id) ? next.delete(node.id) : next.add(node.id)
                  return next
                })
                setSelectedNode(null)
              } else {
                handleNodeClick(evt, node)
              }
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
            <Controls showInteractive={false} />
            <MiniMap nodeColor={(n) => colorFor(n.data?.entityType).border} maskColor="rgba(0,0,0,0.05)" style={{ background: 'hsl(var(--card))' }} />
          </ReactFlow>
          <NodeDetail
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onEdit={(n) => { setEditNode(n); setSelectedNode(null) }}
            onMerge={(n) => { setMergeNode(n); setSelectedNode(null) }}
          />
          <Legend types={entityTypes} />
        </div>

        <QueryPanel />
      </div>

      {/* Edit modal */}
      {editNode && (
        <EditEntityModal
          node={editNode}
          onClose={() => setEditNode(null)}
          onSaved={() => { setEditNode(null); loadGraph() }}
        />
      )}

      {/* Merge modal — single node "merge into" */}
      {mergeNode && mergeNode.id !== '__multi__' && (
        <MergeEntitiesModal
          sourceNames={[mergeNode.id]}
          allNodeIds={allNodes.map(n => n.id)}
          onClose={() => setMergeNode(null)}
          onMerged={() => { setMergeNode(null); setSelectedNode(null); loadGraph() }}
        />
      )}

      {/* Merge modal — multi-select bulk merge */}
      {mergeNode && mergeNode.id === '__multi__' && (
        <MergeEntitiesModal
          sourceNames={multiSelectNames}
          allNodeIds={allNodes.map(n => n.id)}
          onClose={() => { setMergeNode(null); setSelectedIds(new Set()) }}
          onMerged={() => { setMergeNode(null); setSelectedIds(new Set()); loadGraph() }}
        />
      )}
    </>
  )
}
