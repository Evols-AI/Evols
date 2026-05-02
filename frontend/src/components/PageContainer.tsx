import { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 ${className}`}>
      {children}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  description?: string
  icon?: any
  action?: ReactNode | { label: string; onClick: () => void; icon?: any }
  className?: string
}

export function PageHeader({ title, subtitle, description, icon, action, className = '' }: PageHeaderProps) {
  const displayText = description || subtitle
  const Icon = icon

  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 mb-10 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="grid place-items-center w-9 h-9 rounded-lg border border-border/80 bg-card">
              <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
            </div>
          )}
          <h1 className="text-2xl md:text-3xl font-medium tracking-[-0.022em] text-foreground">
            {title}
          </h1>
        </div>
        {displayText && (
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {displayText}
          </p>
        )}
      </div>
      {action && (
        <div>
          {typeof action === 'object' && action !== null && 'label' in action ? (
            <button
              onClick={action.onClick}
              className="btn-primary"
            >
              {action.icon && <action.icon className="w-4 h-4" strokeWidth={1.75} />}
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', padding = 'md', hover = false, onClick }: CardProps) {
  const paddingMap = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  const base = 'rounded-2xl border border-border bg-card shadow-elev-1 transition-all duration-fast ease-evol-out'
  const hoverClass = hover
    ? 'cursor-pointer hover:border-ring/40 hover:shadow-elev-2 hover:-translate-y-0.5'
    : ''

  return (
    <div
      className={`${base} ${paddingMap[padding]} ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface EmptyStateProps {
  icon?: any
  illustration?: string
  title: string
  description: string
  action?: ReactNode | { label: string; onClick: () => void; icon?: any }
}

export function EmptyState({ icon, illustration, title, description, action }: EmptyStateProps) {
  const Icon = icon

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {illustration ? (
        <img src={illustration} alt={title} className="w-64 mx-auto mb-8 drop-shadow-lg" />
      ) : Icon ? (
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-2xl blur-2xl opacity-50"
            style={{ background: 'var(--brand-pulse-soft)' }}
          />
          <div className="relative grid place-items-center w-16 h-16 rounded-2xl border border-border bg-card">
            <Icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
          </div>
        </div>
      ) : null}
      <h3
        className="font-display text-3xl md:text-4xl text-foreground mb-3"
        style={{ fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1.05 }}
      >
        {title}
      </h3>
      <p className="text-sm md:text-base text-muted-foreground max-w-md mb-7 leading-relaxed">
        {description}
      </p>
      {action && (
        <div>
          {typeof action === 'object' && action !== null && 'label' in action ? (
            <button onClick={action.onClick} className="btn-primary">
              {action.icon && <action.icon className="w-4 h-4" strokeWidth={1.75} />}
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

export function StatCard({ title, value, subtitle, icon, trend, trendValue, color = 'blue' }: StatCardProps) {
  const colorMap = {
    blue:   'text-primary bg-primary/12 border-primary/20',
    green:  'text-chart-3 bg-chart-3/12 border-chart-3/20',
    purple: 'text-primary bg-primary/12 border-primary/20',
    orange: 'text-chart-4 bg-chart-4/15 border-chart-4/25',
    red:    'text-destructive bg-destructive/12 border-destructive/20',
  } as const

  const trendColors = {
    up:      'text-chart-3',
    down:    'text-destructive',
    neutral: 'text-muted-foreground',
  } as const

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground/80 mb-2">
            {title}
          </p>
          <p className="text-3xl md:text-4xl font-medium text-foreground tracking-[-0.025em] mb-1">
            {value}
          </p>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 text-sm">
              {trend && trendValue && (
                <span className={`inline-flex items-center gap-0.5 ${trendColors[trend]}`}>
                  {trend === 'up' && '↑'}{trend === 'down' && '↓'} {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="text-muted-foreground">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        <div className={`grid place-items-center w-10 h-10 rounded-lg border ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

interface LoadingProps {
  text?: string
}

export function Loading({ text = 'Loading…' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}
