/**
 * PageContainer - Unified page layout and styling
 * Provides consistent container, spacing, and typography across all pages
 */

import { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`page-container ${className}`}>
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
    <div className={`page-header ${className}`}>
      <div>
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />}
          <h1 className="page-title mb-0">
            {title}
          </h1>
        </div>
        {displayText && (
          <p className="page-subtitle mt-2">
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
              {action.icon && <action.icon className="w-5 h-5" />}
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

  const hoverClass = hover ? 'cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all' : ''

  return (
    <div
      className={`card ${paddingMap[padding]} ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface EmptyStateProps {
  icon?: any  // Can be a component or ReactNode
  illustration?: string  // URL to illustration image
  title: string
  description: string
  action?: ReactNode | { label: string; onClick: () => void; icon?: any }
}

export function EmptyState({ icon, illustration, title, description, action }: EmptyStateProps) {
  const Icon = icon

  return (
    <div className="empty-state">
      {illustration ? (
        <img
          src={illustration}
          alt={title}
          className="w-64 mx-auto mb-6 drop-shadow-lg"
        />
      ) : Icon ? (
        <div className="empty-state-icon">
          <Icon className="w-16 h-16" />
        </div>
      ) : null}
      <h3 className="empty-state-title">
        {title}
      </h3>
      <p className="empty-state-description">
        {description}
      </p>
      {action && (
        <div>
          {typeof action === 'object' && action !== null && 'label' in action ? (
            <button
              onClick={action.onClick}
              className="btn-primary"
            >
              {action.icon && <action.icon className="w-5 h-5" />}
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
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  }

  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted',
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-body mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-heading mb-1">
            {value}
          </p>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 text-sm">
              {trend && trendValue && (
                <span className={trendColors[trend]}>
                  {trend === 'up' && '↑'} {trend === 'down' && '↓'} {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="text-body">{subtitle}</span>
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
        <div className="loading-spinner mx-auto mb-4"></div>
        <p className="text-body">{text}</p>
      </div>
    </div>
  )
}
