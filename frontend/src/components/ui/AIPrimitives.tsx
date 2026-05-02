/**
 * Evols AI primitives — the soul of the design system.
 *
 * These components are reused everywhere AI is happening:
 *   <AIThinking />   pending state, three pulsing dots
 *   <AIShimmer />    a thin gradient slot that pulses to indicate AI can act here
 *   <AIStreamLine />  wraps a streaming line, draws a gradient slider underneath
 *   <ToolUseChip />   inline "the assistant called X" chip
 *   <CitationPill />  numbered [n] reference, hover preview
 *   <ConfidenceBar /> 2px quant signal, color by threshold
 *   <ThinkingSurface />card whose 1px border lights up while streaming
 *   <Halo />          gradient halo ring around a child (avatars, icons)
 *
 * All animations honor prefers-reduced-motion via the global CSS.
 */

import { ReactNode, useId, useState } from 'react'
import { Wrench } from 'lucide-react'

/* ---------- AIThinking — 3 dots, mint pulse ---------- */
export function AIThinking({ label = 'Thinking…', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 text-sm text-muted-foreground ${className}`} role="status" aria-live="polite">
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        <span className="w-1 h-1 rounded-full animate-thinking-1" style={{ background: 'var(--brand-mint)' }} />
        <span className="w-1 h-1 rounded-full animate-thinking-2" style={{ background: 'var(--brand-mint)' }} />
        <span className="w-1 h-1 rounded-full animate-thinking-3" style={{ background: 'var(--brand-mint)' }} />
      </span>
      <span>{label}</span>
    </div>
  )
}

/* ---------- AIShimmer — invisible slot at top of card; reveals on hover ---------- */
export function AIShimmer({
  actions,
  className = '',
}: {
  actions?: { label: string; onClick: () => void }[]
  className?: string
}) {
  return (
    <div className={`group/shimmer relative w-full ${className}`}>
      {/* Idle: 1px gradient slot */}
      <div
        className="h-px w-full opacity-0 group-hover/shimmer:opacity-100 transition-opacity duration-mod"
        style={{ background: 'var(--brand-pulse)' }}
      />
      {/* Hover: action ribbon */}
      {actions && actions.length > 0 && (
        <div className="absolute inset-x-0 top-0 z-10 opacity-0 group-hover/shimmer:opacity-100 transition-opacity duration-mod pointer-events-none group-hover/shimmer:pointer-events-auto">
          <div className="mx-auto flex items-center gap-1 p-1 rounded-b-lg border border-t-0 border-border bg-popover/95 backdrop-blur-glass shadow-elev-2 w-fit">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className="px-2.5 py-1 text-xs text-foreground rounded-md hover:bg-muted transition-colors duration-fast"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- AIStreamLine — wraps a line being streamed in ---------- */
export function AIStreamLine({ children, streaming = true, className = '' }: { children: ReactNode; streaming?: boolean; className?: string }) {
  return (
    <span className={`relative inline-block ${streaming ? 'stream-shimmer' : ''} ${className}`}>
      {children}
    </span>
  )
}

/* ---------- ToolUseChip — "the assistant called X" ---------- */
export function ToolUseChip({
  name,
  durationMs,
  resultCount,
  running = false,
  icon = <Wrench className="w-3 h-3" strokeWidth={1.75} />,
}: {
  name: string
  durationMs?: number
  resultCount?: number
  running?: boolean
  icon?: ReactNode
}) {
  if (running) {
    return (
      <div className="inline-flex flex-col gap-1 my-1">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          {icon} Calling <code className="font-mono text-foreground">{name}</code>…
        </div>
        <div className="h-px w-48 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full"
            style={{
              background: 'var(--brand-pulse)',
              width: '100%',
              animation: 'stream-pass 1.2s cubic-bezier(0.2, 0, 0, 1) infinite',
            }}
          />
        </div>
      </div>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-muted-foreground bg-muted/60 border border-border my-1">
      {icon}
      <span className="text-foreground">{name}</span>
      {typeof durationMs === 'number' && <span>· {durationMs}ms</span>}
      {typeof resultCount === 'number' && <span>· {resultCount} result{resultCount === 1 ? '' : 's'}</span>}
    </span>
  )
}

/* ---------- CitationPill — [n] inline reference, hover preview ---------- */
export function CitationPill({
  index,
  source,
  excerpt,
  onOpen,
}: {
  index: number
  source?: string
  excerpt?: string
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={onOpen}
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 mx-0.5 rounded text-[11px] font-mono text-primary bg-muted hover:bg-primary/15 hover:-translate-y-px transition-all duration-fast"
        aria-label={source ? `Citation ${index}, source: ${source}` : `Citation ${index}`}
      >
        [{index}]
      </button>
      {open && (source || excerpt) && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[320px] z-50 p-3 rounded-lg border border-border bg-popover shadow-elev-2 text-left animate-fade-in"
        >
          {source && <span className="block text-xs font-medium text-foreground mb-1">{source}</span>}
          {excerpt && <span className="block text-xs text-muted-foreground line-clamp-2 leading-snug">{excerpt}</span>}
        </span>
      )}
    </span>
  )
}

/* ---------- ConfidenceBar — quant signal ---------- */
export function ConfidenceBar({
  value,
  showLabel = false,
  className = '',
}: {
  value: number // 0..1
  showLabel?: boolean
  className?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  let color = 'var(--brand-mint)'
  if (pct < 40)      color = 'hsl(var(--chart-4))'   // warning
  else if (pct < 70) color = 'hsl(var(--chart-5))'   // info

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="confidence-bar flex-1">
        <span style={{ width: `${pct}%`, background: color, display: 'block', height: '100%' }} />
      </div>
      {showLabel && <span className="text-xs font-mono text-muted-foreground w-9 text-right">{Math.round(pct)}%</span>}
    </div>
  )
}

/* ---------- ThinkingSurface — card with gradient border that lights while streaming ---------- */
export function ThinkingSurface({
  children,
  state = 'idle',
  className = '',
}: {
  children: ReactNode
  state?: 'idle' | 'streaming' | 'done'
  className?: string
}) {
  return (
    <div className={`thinking-surface p-4 ${className}`} data-state={state}>
      {children}
    </div>
  )
}

/* ---------- Halo — gradient ring around a child ---------- */
export function Halo({ children, size = 40, className = '' }: { children: ReactNode; size?: number; className?: string }) {
  const id = useId()
  return (
    <div
      className={`relative grid place-items-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: 'var(--brand-pulse)',
        padding: 1,
      }}
    >
      <div className="w-full h-full rounded-full bg-background grid place-items-center" id={id}>
        {children}
      </div>
    </div>
  )
}
