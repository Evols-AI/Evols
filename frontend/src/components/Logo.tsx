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
      className={`${className} overflow-visible`}
    >
      <style>
        {`
          @keyframes align-blocks {
            0%, 20% { transform: translateY(2px) translateX(-1px); opacity: 0.7; }
            40%, 60% { transform: translateY(0) translateX(0); opacity: 1; }
            80%, 100% { transform: translateY(2px) translateX(-1px); opacity: 0.7; }
          }
          .block-1 { animation: align-blocks 4s ease-in-out infinite; }
          .block-2 { animation: align-blocks 4s ease-in-out infinite 0.4s; }
          .block-3 { animation: align-blocks 4s ease-in-out infinite 0.8s; }
          
          @keyframes ai-scan {
            0% { transform: translateX(-15px); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateX(35px); opacity: 0; }
          }
          .scan-line {
            animation: ai-scan 4s linear infinite;
          }
          
          @keyframes sparkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          .ai-sparkle {
            animation: sparkle 2s ease-in-out infinite;
          }
        `}
      </style>
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" /> {/* purple-400 */}
          <stop offset="100%" stopColor="#3b82f6" /> {/* blue-500 */}
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* AI Intelligence Scan-beam (Subtle) */}
      <rect
        className="scan-line"
        x="0" y="5" width="2" height="30"
        fill="url(#logoGrad)"
        fillOpacity="0.2"
        filter="url(#glow)"
      />

      {/* THEME Tier (Evidence) */}
      <rect
        className="block-1"
        x="6" y="26" width="7" height="8" rx="1.5"
        fill="url(#logoGrad)"
        fillOpacity="0.5"
      />

      {/* INITIATIVE Tier (Strategy) */}
      <rect
        className="block-2"
        x="15" y="18" width="8" height="16" rx="2"
        fill="url(#logoGrad)"
        fillOpacity="0.8"
      />

      {/* PROJECT Tier (Execution) */}
      <rect
        className="block-3"
        x="25" y="8" width="9" height="26" rx="2.5"
        fill="url(#logoGrad)"
        filter="url(#glow)"
      />

      {/* Connection Connectors (Automated Links) */}
      <path
        d="M13 30 L15 28 M23 22 L25 20"
        stroke="url(#logoGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* The AI Decision Sparkle (The outcome) */}
      <circle
        className="ai-sparkle"
        cx="32" cy="12" r="2.5"
        fill="white"
        style={{ transformOrigin: '32px 12px' }}
      />
    </svg>
  )
}

/** Full wordmark: icon + "Evols" text */
export function LogoWordmark({ iconSize = 32, className = '' }: { iconSize?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
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
