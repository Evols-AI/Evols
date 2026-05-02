/**
 * Evols logomark — "the aperture"
 *
 * A halo torus reads as an "o" / an eye / a synapse loop. Stroked, not filled.
 * Inside the torus, a thin arc traces from upper-left to lower-right —
 * the "thought-line." Two variants:
 *   - solid:  single-color, currentColor stroke (default in chrome)
 *   - pulse:  iris → mint gradient stroke (used in marketing, login,
 *             AI dock, splash, persona detail)
 *
 * Both variants accept a `size` prop (px) and inherit currentColor.
 */

import { useId } from 'react'

interface LogoIconProps {
  size?: number
  className?: string
  variant?: 'solid' | 'pulse'
  strokeWidth?: number
  /** When true, the inner thought-line arc slowly traces (used in splash). */
  animate?: boolean
}

export function LogoIcon({
  size = 32,
  className = '',
  variant = 'solid',
  strokeWidth,
  animate = false,
}: LogoIconProps) {
  const id = useId()
  const gradientId = `evols-pulse-${id}`
  const sw = strokeWidth ?? Math.max(1.5, size / 18)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-primary ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6F5BFF" />
          <stop offset="100%" stopColor="#5EEAD4" />
        </linearGradient>
      </defs>

      {/* Outer halo — the aperture */}
      <circle
        cx="24"
        cy="24"
        r="17"
        stroke={variant === 'pulse' ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth={sw}
      />

      {/* Inner thought-line — diagonal arc from upper-left to lower-right */}
      <path
        d="M13 13 C 20 17, 28 31, 35 35"
        stroke={variant === 'pulse' ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth={sw}
        strokeLinecap="round"
        opacity="0.85"
        style={animate ? { strokeDasharray: 60, strokeDashoffset: 0, animation: 'aurora-drift 6s ease-in-out infinite' } : undefined}
      />

      {/* Synapse dot — origin of the thought-line */}
      <circle
        cx="35"
        cy="35"
        r={Math.max(1.4, sw * 0.85)}
        fill={variant === 'pulse' ? `url(#${gradientId})` : 'currentColor'}
      />
    </svg>
  )
}

interface LogoWordmarkProps {
  iconSize?: number
  className?: string
  variant?: 'solid' | 'pulse'
  showIcon?: boolean
  /** When true, only the wordmark is rendered (no mark) — used in compact header contexts. */
  compact?: boolean
}

/** Wordmark — "evols" in Geist, paired with the aperture. Lowercase per brand. */
export function LogoWordmark({
  iconSize = 28,
  className = '',
  variant = 'solid',
  showIcon = true,
  compact = false,
}: LogoWordmarkProps) {
  const fontSize = compact ? iconSize * 0.78 : iconSize * 0.82

  return (
    <div className={`flex items-center ${className}`}>
      {showIcon && <LogoIcon size={iconSize} variant={variant} className="mr-2.5" />}
      <span
        className={`logo-text ${variant === 'pulse' ? 'text-pulse' : 'text-foreground'}`}
        style={{
          fontSize,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1,
        }}
      >
        evols
      </span>
    </div>
  )
}

export default LogoIcon
