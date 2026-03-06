/**
 * Roadmap utility functions for data transformation and visualization
 */

// Color generation for consistent initiative colors
export function getInitiativeColor(initiativeId: number): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ]
  return colors[initiativeId % colors.length]
}

// Calculate average urgency from themes
export function calculateAverageUrgency(themes: any[]): number {
  if (!themes || themes.length === 0) return 0
  const sum = themes.reduce((acc, t) => acc + (t.urgency_score || 0), 0)
  return sum / themes.length
}

// Calculate average impact from themes
export function calculateAverageImpact(themes: any[]): number {
  if (!themes || themes.length === 0) return 0
  const sum = themes.reduce((acc, t) => acc + (t.impact_score || 0), 0)
  return sum / themes.length
}

// Map effort to bubble size for scatter chart
export function effortToSize(effort: string): number {
  const sizeMap: Record<string, number> = {
    small: 10,
    medium: 20,
    large: 30,
    xlarge: 40,
  }
  return sizeMap[effort.toLowerCase()] || 10
}

// Map effort to numeric score (for calculations)
export function effortToScore(effort: string): number {
  const scoreMap: Record<string, number> = {
    small: 1,
    medium: 2,
    large: 4,
    xlarge: 8,
  }
  return scoreMap[effort.toLowerCase()] || 1
}

// Status color mapping for badges
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    backlog: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    idea: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    launched: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    paused: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  }
  return colorMap[status.toLowerCase()] || colorMap.backlog
}

// Effort color mapping for badges
export function getEffortColor(effort: string): string {
  const colorMap: Record<string, string> = {
    small: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    large: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    xlarge: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  }
  return colorMap[effort.toLowerCase()] || colorMap.medium
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

// Detect dark mode
export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

// Get chart colors for dark mode
export function getChartColors() {
  const dark = isDarkMode()
  return {
    grid: dark ? '#374151' : '#e5e7eb',
    text: dark ? '#d1d5db' : '#374151',
    background: dark ? '#1f2937' : '#ffffff',
  }
}
