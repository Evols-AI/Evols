/**
 * Utility functions for formatting display values
 */

/**
 * Formats a snake_case category to Title-Case-With-Hyphens
 * @example formatCategory('feature_request') => 'Feature-Request'
 * @example formatCategory('bug') => 'Bug'
 * @example formatCategory('tech_debt') => 'Tech-Debt'
 */
export function formatCategory(category: string | undefined | null): string {
  if (!category) return 'Uncategorized'

  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-')
}

/**
 * Category color mappings for display
 */
export const categoryColors: Record<string, string> = {
  'Feature-Request': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Bug': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Tech-Debt': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Improvement': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Question': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Praise': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Complaint': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Garbage': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

/**
 * Get color class for a category (handles both formatted and raw values)
 */
export function getCategoryColor(category: string | undefined | null): string {
  if (!category) return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'

  const formatted = formatCategory(category)
  return categoryColors[formatted] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}
