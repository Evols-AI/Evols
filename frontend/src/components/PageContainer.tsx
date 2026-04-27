import { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 ${className}`}>
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
    <div className={`flex flex-wrap items-start justify-between gap-4 mb-8 ${className}`}>
      <div>
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-7 h-7 text-[#A78BFA]" />}
          <h1 className="text-xl font-medium text-[#0A0A0B] dark:text-[#FAFAFA]">
            {title}
          </h1>
        </div>
        {displayText && (
          <p className="mt-2 text-sm text-[#52525B] dark:text-[#A1A1AA]">
            {displayText}
          </p>
        )}
      </div>
      {action && (
        <div>
          {typeof action === 'object' && action !== null && 'label' in action ? (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] transition-colors"
            >
              {action.icon && <action.icon className="w-4 h-4" />}
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

  const hoverClass = hover
    ? 'cursor-pointer hover:border-[#A78BFA]/30 dark:hover:border-[#A78BFA]/30 hover:shadow-sm transition-all'
    : ''

  return (
    <div
      className={`rounded-xl border border-black/[0.07] dark:border-white/[0.06] bg-white dark:bg-[#111113] ${paddingMap[padding]} ${hoverClass} ${className}`}
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
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {illustration ? (
        <img src={illustration} alt={title} className="w-64 mx-auto mb-6 drop-shadow-lg" />
      ) : Icon ? (
        <div className="mb-6 p-4 rounded-2xl bg-[#A78BFA]/10">
          <Icon className="w-12 h-12 text-[#A78BFA]" />
        </div>
      ) : null}
      <h3 className="text-lg font-medium text-[#0A0A0B] dark:text-[#FAFAFA] mb-3">
        {title}
      </h3>
      <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] max-w-sm mb-6">
        {description}
      </p>
      {action && (
        <div>
          {typeof action === 'object' && action !== null && 'label' in action ? (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] transition-colors"
            >
              {action.icon && <action.icon className="w-4 h-4" />}
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
    blue:   'text-[#A78BFA] bg-[#A78BFA]/10',
    green:  'text-emerald-500 bg-emerald-500/10',
    purple: 'text-[#A78BFA] bg-[#A78BFA]/10',
    orange: 'text-orange-500 bg-orange-500/10',
    red:    'text-red-500 bg-red-500/10',
  }

  const trendColors = {
    up:      'text-emerald-500',
    down:    'text-red-500',
    neutral: 'text-[#71717A]',
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
            {title}
          </p>
          <p className="text-3xl font-medium text-[#0A0A0B] dark:text-[#FAFAFA] mb-1">
            {value}
          </p>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 text-sm">
              {trend && trendValue && (
                <span className={trendColors[trend]}>
                  {trend === 'up' && '↑'}{trend === 'down' && '↓'} {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="text-[#52525B] dark:text-[#A1A1AA]">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

interface LoadingProps {
  text?: string
}

export function Loading({ text = 'Loading...' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#A78BFA]/20 border-t-[#A78BFA] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#52525B] dark:text-[#A1A1AA]">{text}</p>
      </div>
    </div>
  )
}
