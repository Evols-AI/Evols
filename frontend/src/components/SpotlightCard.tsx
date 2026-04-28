import { useRef, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface SpotlightCardProps {
  children: React.ReactNode
  className?: string
}

export default function SpotlightCard({ children, className = '' }: SpotlightCardProps) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('mousemove', handleMouseMove)
    return () => el.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  return (
    <div
      ref={ref}
      className={`
        group/card relative h-full overflow-hidden rounded-2xl p-px
        ${dark ? 'bg-white/[0.07]' : 'bg-black/[0.08]'}
        before:pointer-events-none before:absolute before:-left-40 before:-top-40 before:z-10
        before:h-80 before:w-80
        before:translate-x-[var(--mouse-x,0px)] before:translate-y-[var(--mouse-y,0px)]
        before:rounded-full before:bg-primary/70 before:opacity-0 before:blur-3xl
        before:transition-opacity before:duration-500
        after:pointer-events-none after:absolute after:-left-48 after:-top-48 after:z-30
        after:h-64 after:w-64
        after:translate-x-[var(--mouse-x,0px)] after:translate-y-[var(--mouse-y,0px)]
        after:rounded-full after:bg-primary after:opacity-0 after:blur-3xl
        after:transition-opacity after:duration-500
        hover:after:opacity-15 hover:before:opacity-100
        ${className}
      `}
    >
      <div className="relative z-20 h-full overflow-hidden rounded-[inherit] bg-card">
        {children}
      </div>
    </div>
  )
}
