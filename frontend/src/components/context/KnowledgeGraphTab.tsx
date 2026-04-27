import React, { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  MarkerType, NodeProps, Handle, Position, BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { apiClient } from '@/services/api'
import { Loading } from '@/components/PageContainer'
import { Loader2, Search, RefreshCw, AlertCircle, Network, Upload } from 'lucide-react'

// ── Entity type colours (includes new PM types) ───────────────────────────────

// Uses CSS variable references so nodes respond to light/dark theme automatically.
// bg uses alpha channel on chart vars; border/text use the chart var directly.
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  // chart-5 periwinkle
  person:         { bg: 'hsl(var(--chart-5) / 0.12)', border: 'hsl(var(--chart-5))', text: 'hsl(var(--chart-5))' },
  decision:       { bg: 'hsl(var(--chart-5) / 0.12)', border: 'hsl(var(--chart-5))', text: 'hsl(var(--chart-5))' },
  // chart-3 teal
  organization:   { bg: 'hsl(var(--chart-3) / 0.12)', border: 'hsl(var(--chart-3))', text: 'hsl(var(--chart-3))' },
  product:        { bg: 'hsl(var(--chart-3) / 0.12)', border: 'hsl(var(--chart-3))', text: 'hsl(var(--chart-3))' },
  feature:        { bg: 'hsl(var(--chart-3) / 0.12)', border: 'hsl(var(--chart-3))', text: 'hsl(var(--chart-3))' },
  // chart-1 amethyst
  persona:        { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  businessgoal:   { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  project:        { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  concept:        { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  location:       { bg: 'hsl(var(--chart-1) / 0.12)', border: 'hsl(var(--chart-1))', text: 'hsl(var(--chart-1))' },
  // chart-2 rose
  competitor:     { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  technology:     { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  market:         { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  event:          { bg: 'hsl(var(--chart-2) / 0.12)', border: 'hsl(var(--chart-2))', text: 'hsl(var(--chart-2))' },
  // chart-4 gold
  featurerequest: { bg: 'hsl(var(--chart-4) / 0.15)', border: 'hsl(var(--chart-4))', text: 'hsl(var(--chart-4))' },
  metric:         { bg: 'hsl(var(--chart-4) / 0.15)', border: 'hsl(var(--chart-4))', text: 'hsl(var(--chart-4))' },
  // destructive
  painpoint:      { bg: 'hsl(var(--destructive) / 0.10)', border: 'hsl(var(--destructive))', text: 'hsl(var(--destructive))' },
  // muted default
  meeting:        { bg: 'hsl(var(--muted))', border: 'hsl(var(--border))', text: 'hsl(var(--muted-foreground))' },
  default:        { bg: 'hsl(var(--muted))', border: 'hsl(var(--border))', text: 'hsl(var(--muted-foreground))' },
}

function colorFor(entityType: string) {
  const key = entityType?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  return TYPE_COLORS[key] ?? TYPE_COLORS.default
}

// ── Confidence score ──────────────────────────────────────────────────────────
// Derived from three signals already present in the graph response — no extra API calls.

const SEP = '<SEP>'

function computeConfidence(
  rawNode: any,
  degreeMap: Record<string, number>,
): number {
  // Signal 1 — LLM extraction certainty: directly stated by the model during extraction.
  // Present only on nodes processed after ENTITY_ATTRIBUTES was configured. Null = unknown.
  const attrs = rawNode.properties?.attributes
  const llmConfRaw = attrs?.confidence ?? null
  const llmConf: number | null =
    typeof llmConfRaw === 'number'
      ? llmConfRaw
      : typeof llmConfRaw === 'string' && llmConfRaw !== 'null'
        ? parseFloat(llmConfRaw)
        : null
  const llmScore = llmConf !== null && !isNaN(llmConf) ? Math.min(Math.max(llmConf, 0), 1.0) : null

  // Signal 2 — source corroboration: how many distinct document chunks mention this entity.
  const sourceId: string = rawNode.properties?.source_id ?? ''
  const sourceCount = sourceId ? sourceId.split(SEP).filter(Boolean).length : 1
  const sourceScore = Math.min(sourceCount / 5, 1.0) // 5+ sources → 1.0

  // Signal 3 — relationship degree: well-connected entities are more contextually grounded.
  const degree = degreeMap[rawNode.id] ?? 0
  const degreeScore = Math.min(degree / 8, 1.0) // 8+ edges → 1.0

  // Signal 4 — description density: longer descriptions indicate more evidence at extraction time.
  const desc: string = rawNode.properties?.description ?? ''
  const descScore = Math.min(desc.length / 300, 1.0)

  if (llmScore !== null) {
    // 4-signal formula when LLM confidence is available
    return 0.25 * llmScore + 0.35 * sourceScore + 0.25 * degreeScore + 0.15 * descScore
  }
  // Fallback 3-signal formula for nodes processed before ENTITY_ATTRIBUTES was configured
  return 0.4 * sourceScore + 0.3 * degreeScore + 0.3 * descScore
}

function confidenceLabel(score: number): string {
  if (score >= 0.75) return 'High'
  if (score >= 0.45) return 'Medium'
  return 'Low'
}

function confidenceColor(score: number): string {
  if (score >= 0.75) return 'hsl(var(--chart-3))'
  if (score >= 0.45) return 'hsl(var(--chart-4))'
  return 'hsl(var(--destructive))'
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
      {data.entityType && (
        <div className="opacity-60 capitalize mt-0.5">{data.entityType}</div>
      )}
      {/* Thin confidence bar at bottom of node */}
      <div className="mt-1.5 rounded-full overflow-hidden h-0.5 bg-black/10">
        <div
          style={{ width: `${Math.round(conf * 100)}%`, background: confidenceColor(conf) }}
          className="h-full rounded-full transition-all"
        />
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
      position: {
        x: (i % cols) * 210 + Math.random() * 30,
        y: Math.floor(i / cols) * 130 + Math.random() * 20,
      },
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

// ── Selected node detail panel ────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const label = confidenceLabel(score)
  const color = confidenceColor(score)
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Confidence</span>
        <span className="text-xs font-semibold" style={{ color }}>{label} · {pct}%</span>
      </div>
      <div className="rounded-full overflow-hidden h-1.5 bg-muted">
        <div
          style={{ width: `${pct}%`, background: color }}
          className="h-full rounded-full transition-all"
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        <ScorePill label="Sources" value={Math.round((score / 0.4) * 100 * 0.4)} raw />
        <ScorePill label="Relations" value={Math.round((score / 0.3) * 100 * 0.3)} raw />
        <ScorePill label="Richness" value={Math.round((score / 0.3) * 100 * 0.3)} raw />
      </div>
    </div>
  )
}

function ScorePill({ label, value, raw }: { label: string; value: number; raw?: boolean }) {
  return (
    <div className="bg-muted rounded px-1 py-1">
      <div className="text-muted-foreground text-[10px]">{label}</div>
      <div className="text-foreground text-xs font-medium">{value}%</div>
    </div>
  )
}

function NodeDetail({ node, onClose }: { node: Node | null; onClose: () => void }) {
  if (!node) return null
  const c = colorFor(node.data.entityType)
  const conf: number = node.data.confidence ?? 0

  // Recompute signal scores for display
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
        <span
          style={{ background: c.bg, color: c.text, borderColor: c.border }}
          className="text-xs font-semibold px-2 py-0.5 rounded-full border capitalize"
        >
          {node.data.entityType || 'entity'}
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
        >×</button>
      </div>

      <h3 className="font-semibold text-foreground text-sm mb-2">
        {node.data.label}
      </h3>

      {node.data.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {node.data.description}
        </p>
      )}

      {/* Domain attributes from ENTITY_ATTRIBUTES extraction */}
      {attrs && Object.keys(attrs).filter(k => k !== 'confidence' && attrs[k] !== null && attrs[k] !== 'null').length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {attrs.sentiment && attrs.sentiment !== 'null' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              attrs.sentiment === 'negative' ? 'bg-destructive/10 text-destructive'
              : attrs.sentiment === 'positive' ? 'bg-chart-3/15 text-chart-3'
              : 'bg-muted text-muted-foreground'
            }`}>{attrs.sentiment}</span>
          )}
          {attrs.urgency && attrs.urgency !== 'null' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              attrs.urgency === 'high' ? 'bg-destructive/10 text-destructive'
              : attrs.urgency === 'medium' ? 'bg-chart-4/20 text-chart-4'
              : 'bg-muted text-muted-foreground'
            }`}>{attrs.urgency} urgency</span>
          )}
          {attrs.business_impact && attrs.business_impact !== 'null' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary font-medium" title={attrs.business_impact}>
              impact: {String(attrs.business_impact).slice(0, 30)}{String(attrs.business_impact).length > 30 ? '…' : ''}
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
          <span
            className="text-xs font-semibold"
            style={{ color: confidenceColor(conf) }}
          >
            {confidenceLabel(conf)} · {Math.round(conf * 100)}%
          </span>
        </div>
        {/* Overall bar */}
        <div className="rounded-full overflow-hidden h-1.5 bg-muted mb-3">
          <div
            style={{ width: `${Math.round(conf * 100)}%`, background: confidenceColor(conf) }}
            className="h-full rounded-full"
          />
        </div>
        {/* Signal breakdown */}
        <div className="space-y-1.5">
          {hasLlmSignal && (
            <SignalRow
              label="LLM certainty"
              tooltip="Confidence assigned by the LLM during extraction, based on how explicitly the entity was stated in the source text."
              score={llmScore!}
              weight={0.25}
            />
          )}
          <SignalRow
            label="Source corroboration"
            tooltip={`Appears in ${node.data.sourceCount ?? 1} document chunk(s). More sources = higher confidence.`}
            score={sourceScore}
            weight={hasLlmSignal ? 0.35 : 0.4}
          />
          <SignalRow
            label="Relationship density"
            tooltip={`Connected to ${node.data.degree ?? 0} other entities. More connections = more contextually grounded.`}
            score={degreeScore}
            weight={hasLlmSignal ? 0.25 : 0.3}
          />
          <SignalRow
            label="Description richness"
            tooltip={`Description is ${node.data.descLength ?? 0} characters. Longer = LLM had more evidence.`}
            score={descScore}
            weight={hasLlmSignal ? 0.15 : 0.3}
          />
        </div>
      </div>
    </div>
  )
}

function SignalRow({
  label, tooltip, score, weight,
}: {
  label: string; tooltip: string; score: number; weight: number
}) {
  const pct = Math.round(score * 100)
  return (
    <div title={tooltip}>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span className="tabular-nums">{pct}% <span className="opacity-50">×{weight}</span></span>
      </div>
      <div className="rounded-full overflow-hidden h-1 bg-muted">
        <div
          style={{ width: `${pct}%`, background: confidenceColor(score) }}
          className="h-full rounded-full"
        />
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
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiClient.get('/api/v1/graph/query', {
        params: { q: query, mode },
        validateStatus: () => true,
      })
      if (res.status !== 200) {
        setError(res.data?.detail ?? `Query failed (${res.status})`)
        return
      }
      const data = res.data
      setResult(typeof data === 'string' ? data : data?.response ?? JSON.stringify(data))
    } catch (e: any) {
      setError(e?.message ?? 'Query failed')
    } finally {
      setLoading(false)
    }
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
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
          className="text-sm border border-border rounded-lg bg-input text-foreground px-2 py-2 focus:ring-2 focus:ring-ring/50 outline-none"
        >
          <option value="hybrid">Hybrid</option>
          <option value="local">Local</option>
          <option value="global">Global</option>
        </select>
        <button
          onClick={runQuery}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-primary/85 text-primary-foreground text-sm rounded-lg hover:bg-primary/85 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive dark:text-destructive bg-destructive/10 dark:bg-destructive/15 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {result && (
        <div className="text-sm text-foreground bg-card rounded-lg p-3 border border-border whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {result}
        </div>
      )}
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

export default function KnowledgeGraphTab() {
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

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/api/v1/graph/graph', {
        params: { label: '*', max_depth: 3 },
        validateStatus: () => true,
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
        return
      }
      if (res.status !== 200) {
        setError(res.data?.detail ?? `Server error (${res.status})`)
        return
      }
      const data = res.data
      const rawNodes: any[] = data?.nodes ?? []
      const rawEdges: any[] = data?.edges ?? []

      const degreeMap = buildDegreeMap(rawEdges)
      setNodes(layoutNodes(rawNodes, degreeMap))
      setEdges(buildEdges(rawEdges))
      setNodeCount(rawNodes.length)
      setEdgeCount(rawEdges.length)

      const types = [...new Set(rawNodes.map((n) => n.properties?.entity_type).filter(Boolean))] as string[]
      setEntityTypes(types)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load knowledge graph')
    } finally {
      setLoading(false)
    }
  }, [])

  const syncAll = useCallback(async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await apiClient.post('/api/v1/graph/sync', {}, { validateStatus: () => true })
      if (res.status === 200) {
        const d = res.data.details
        setSyncResult(
          `Synced — ${d.context_sources} sources, ${d.extracted_entities} entities, ` +
          `${d.personas} personas, ${d.work_contexts} work contexts, ` +
          `${d.meeting_notes} meetings, ${d.pm_decisions} decisions. ` +
          `LightRAG is processing in the background.`
        )
        setTimeout(() => { loadGraph(); setSyncResult(null) }, 5000)
      } else {
        setSyncResult(res.data?.detail ?? `Sync failed (${res.status})`)
      }
    } catch (e: any) {
      setSyncResult(e?.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [loadGraph])

  useEffect(() => { loadGraph() }, [loadGraph])

  if (loading) {
    return <Loading text="Loading knowledge graph…" />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-muted-foreground">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm">{error}</p>
        <button onClick={loadGraph} className="text-sm text-primary hover:underline">Retry</button>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-muted-foreground">
        <Network className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">No knowledge graph data yet</p>
        <p className="text-xs text-center max-w-sm">
          Sync your existing context sources, extracted entities, personas, and work context into the graph.
        </p>
        <button
          onClick={syncAll}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-primary/85 text-primary-foreground text-sm rounded-lg hover:bg-primary/85 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {syncing ? 'Syncing…' : 'Sync All Data to Graph'}
        </button>
        {syncResult && (
          <p className="text-xs text-center max-w-md text-chart-3">{syncResult}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="relative flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Knowledge Graph</span>
          <span>{nodeCount} entities</span>
          <span>{edgeCount} relationships</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncAll}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary dark:text-primary disabled:opacity-50 transition"
            title="Push all context sources, entities, personas, and work context into the graph"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {syncing ? 'Syncing…' : 'Sync Data'}
          </button>
          <button
            onClick={loadGraph}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
        {syncResult && (
          <div className="absolute top-10 right-4 z-20 bg-chart-3/10 border border-chart-3/30 rounded-lg px-3 py-2 text-xs text-chart-3 max-w-sm shadow">
            {syncResult}
          </div>
        )}
      </div>

      {/* Graph canvas */}
      <div className="relative" style={{ height: 520 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          onNodeClick={(_, node) => setSelectedNode(node)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => colorFor(n.data?.entityType).border}
            maskColor="rgba(0,0,0,0.05)"
            style={{ background: 'hsl(var(--card))' }}
          />
        </ReactFlow>
        <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
        <Legend types={entityTypes} />
      </div>

      {/* Query panel */}
      <QueryPanel />
    </div>
  )
}
