/**
 * AI Primitives
 * ─────────────
 * A small set of building blocks for AI-touched surfaces. Designed to plug into
 * the existing Indigo Spectrum palette — single primary color, no gradients.
 *
 *   <AIThinking label="Working" />        Dots animation while a model is thinking
 *   <AIShimmer>Streaming…</AIShimmer>     Subtle shimmer over text while streaming
 *   <AIStreamLine />                      Thin horizontal bar that pulses during stream
 *   <ToolUseChip tool="WebSearch" />      Chip that names the tool the model just used
 *   <CitationPill index={1} ... />        Numbered citation pill anchored to a source
 *   <ConfidenceBar value={0.78} />        Confidence indicator (0..1)
 *   <ThinkingSurface>…</ThinkingSurface>  Card variant with a tinted ring for AI output
 *   <Halo size={64} />                    A soft, single-color halo around an element
 *
 * Every primitive uses tokenized colors (`hsl(var(--primary))`, `hsl(var(--border))`,
 * etc.) so it inherits whatever theme is active. No gradients, no extra brand colors.
 */

import { ReactNode, CSSProperties } from 'react'
import clsx from 'clsx'

/* ── AIThinking ─────────────────────────────────────────────────────────── */

interface AIThinkingProps {
  label?: string
  className?: string
}

export function AIThinking({ label = 'Thinking', className }: AIThinkingProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 text-sm text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex gap-1" aria-hidden="true">
        <span className="ai-thinking-dot" style={{ animationDelay: '0ms' }} />
        <span className="ai-thinking-dot" style={{ animationDelay: '160ms' }} />
        <span className="ai-thinking-dot" style={{ animationDelay: '320ms' }} />
      </span>
      <span>{label}…</span>
    </span>
  )
}

/* ── AIShimmer ──────────────────────────────────────────────────────────── */

interface AIShimmerProps {
  children: ReactNode
  className?: string
}

/**
 * Subtle shimmer effect on the children's text. Use sparingly — only while the
 * model is actively producing output. Uses the existing `.animate-shimmer`
 * keyframes from globals.css.
 */
export function AIShimmer({ children, className }: AIShimmerProps) {
  return (
    <span className={clsx('ai-shimmer', className)}>
      {children}
    </span>
  )
}

/* ── AIStreamLine ───────────────────────────────────────────────────────── */

interface AIStreamLineProps {
  className?: string
}

/**
 * A 2px tall horizontal bar that gently pulses. Sits above or below a streaming
 * response to communicate "still working".
 */
export function AIStreamLine({ className }: AIStreamLineProps) {
  return (
    <div
      className={clsx('ai-stream-line', className)}
      role="progressbar"
      aria-label="Streaming response"
    />
  )
}

/* ── ToolUseChip ────────────────────────────────────────────────────────── */

interface ToolUseChipProps {
  tool: string
  icon?: ReactNode
  status?: 'running' | 'done' | 'error'
  className?: string
}

/**
 * Names a tool the model just called. Uses badge styling — kept neutral so
 * multiple chips can sit in a row without becoming visual noise.
 */
export function ToolUseChip({
  tool,
  icon,
  status = 'done',
  className,
}: ToolUseChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'text-xs font-medium',
        'bg-muted text-muted-foreground',
        'border border-border',
        status === 'running' && 'tool-chip-running',
        status === 'error' && 'border-destructive/40 text-destructive',
        className,
      )}
    >
      {icon && <span className="w-3.5 h-3.5 inline-flex">{icon}</span>}
      <span>{tool}</span>
    </span>
  )
}

/* ── CitationPill ───────────────────────────────────────────────────────── */

interface CitationPillProps {
  index: number
  source?: string
  href?: string
  className?: string
}

/**
 * A small numbered pill anchored next to a claim. Hovering reveals the source
 * name. If `href` is provided, the pill becomes a link.
 */
export function CitationPill({
  index,
  source,
  href,
  className,
}: CitationPillProps) {
  const inner = (
    <span
      className={clsx(
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5',
        'rounded-full text-[0.6875rem] font-semibold tabular-nums',
        'bg-primary/10 text-primary',
        'border border-primary/20',
        'transition-colors hover:bg-primary/15',
        className,
      )}
      title={source}
    >
      {index}
    </span>
  )

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
      {inner}
    </a>
  ) : (
    inner
  )
}

/* ── ConfidenceBar ──────────────────────────────────────────────────────── */

interface ConfidenceBarProps {
  /** 0..1 */
  value: number
  label?: string
  className?: string
}

/**
 * A two-tone confidence indicator. Uses primary for the filled portion, muted
 * for the rest. No gradient — just a flat fill.
 */
export function ConfidenceBar({ value, label, className }: ConfidenceBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ── ThinkingSurface ────────────────────────────────────────────────────── */

interface ThinkingSurfaceProps {
  children: ReactNode
  active?: boolean
  className?: string
}

/**
 * Card surface for AI output. When `active`, the border gets a soft primary
 * tint to signal "this is being generated right now." Otherwise identical to a
 * regular `.card` so it lives alongside non-AI content without screaming.
 */
export function ThinkingSurface({
  children,
  active = false,
  className,
}: ThinkingSurfaceProps) {
  return (
    <div
      className={clsx(
        'card p-5',
        active && 'thinking-surface-active',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ── Halo ───────────────────────────────────────────────────────────────── */

interface HaloProps {
  size?: number
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Wraps a child (icon, avatar, logomark) in a soft single-color halo. The halo
 * is drawn with `box-shadow` on a ring-shaped pseudo-element so it doesn't
 * affect layout. No gradients.
 */
export function Halo({ size = 48, children, className, style }: HaloProps) {
  return (
    <span
      className={clsx('halo-ring', className)}
      style={{ width: size, height: size, ...style }}
    >
      {children}
    </span>
  )
}
