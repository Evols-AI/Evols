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
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`page-header ${className}`}>
      <div>
        <h1 className="page-title">
          {title}
        </h1>
        {subtitle && (
          <p className="page-subtitle mt-2">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingMap = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <div className={`card ${paddingMap[padding]} ${className}`}>
      {children}
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  illustration?: string  // URL to illustration image
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, illustration, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {illustration ? (
        <img
          src={illustration}
          alt={title}
          className="w-64 mx-auto mb-6 drop-shadow-lg"
        />
      ) : icon ? (
        <div className="empty-state-icon">{icon}</div>
      ) : null}
      <h3 className="empty-state-title">
        {title}
      </h3>
      <p className="empty-state-description">
        {description}
      </p>
      {action && <div>{action}</div>}
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
