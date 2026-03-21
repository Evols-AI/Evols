/**
 * Evols Logo — Automated Roadmap Planning
 * Concept: Chaos to Order. Three tiers of product management (Theme, Initiative, Project)
 * automatically aligning into a perfect, strategic "Final Mile" roadmap.
 */

interface LogoIconProps {
  size?: number
  className?: string
}

export function LogoIcon({ size = 32, className = '' }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className}`}
    >
      <defs>
        <linearGradient id="nucleusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" /> {/* purple-400 */}
          <stop offset="100%" stopColor="#3b82f6" /> {/* blue-500 */}
        </linearGradient>
      </defs>

      {/* Quantum Orbits - Static */}
      <g stroke="currentColor" strokeWidth="1.5" className="text-gray-300 dark:text-gray-600">
        <ellipse cx="20" cy="20" rx="16" ry="6" transform="rotate(0 20 20)" />
        <ellipse cx="20" cy="20" rx="16" ry="6" transform="rotate(60 20 20)" />
        <ellipse cx="20" cy="20" rx="16" ry="6" transform="rotate(120 20 20)" />
      </g>

      {/* Sparkle Nucleus (Tapered Star) - Static */}
      <path
        d="M20 12 Q20.5 19.5 28 20 Q20.5 20.5 20 28 Q19.5 20.5 12 20 Q19.5 19.5 20 12 Z"
        fill="url(#nucleusGrad)"
      />
      <circle cx="20" cy="20" r="1.5" fill="white" opacity="0.8" />
    </svg>
  )
}

/** Full wordmark: "Evols" text only */
export function LogoWordmark({ iconSize = 32, className = '' }: { iconSize?: number; className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <span
        className="font-bold tracking-tight bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent"
        style={{ fontSize: iconSize * 0.7 }}
      >
        Evols<span className="text-gray-400 dark:text-gray-500 font-medium">.ai</span>
      </span>
    </div>
  )
}

export default LogoIcon
