/**
 * ProductOS Logo — custom SVG icon
 * Concept: A decision graph / neural network node — representing connected
 * product decisions, evidence, and outcomes flowing through a central "OS" core.
 * Color: indigo → violet gradient
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
      className={className}
    >
      {/* Gradient for the bars */}
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" /> {/* indigo-600 */}
          <stop offset="100%" stopColor="#7c3aed" /> {/* violet-600 */}
        </linearGradient>
      </defs>

      {/* The Signal Chevron: Abstract 3-tier hierarchy merging into a decision arrow */}
      {/* Theme Bar (Base) */}
      <rect x="6" y="24" width="8" height="10" rx="2" fill="url(#logoGrad)" fillOpacity="0.6" />
      
      {/* Initiative Bar (Strategic) */}
      <rect x="16" y="16" width="8" height="18" rx="2" fill="url(#logoGrad)" fillOpacity="0.8" />
      
      {/* Project Bar (Execution) + The Arrow Head Point */}
      <path 
        d="M26 8C26 6.89543 26.8954 6 28 6H30C31.1046 6 32 6.89543 32 8V34H26V8Z" 
        fill="url(#logoGrad)" 
      />
      
      {/* The "Decisive Point" Sparkle */}
      <circle cx="29" cy="12" r="2.5" fill="white" />
    </svg>

  )
}

/** Full wordmark: icon + "ProductOS" text */
export function LogoWordmark({ iconSize = 32, className = '' }: { iconSize?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
      <span
        className="font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent"
        style={{ fontSize: iconSize * 0.7 }}
      >
        ProductOS
      </span>
    </div>
  )
}

export default LogoIcon
