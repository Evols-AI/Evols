/**
 * Demo Product Warning Utility
 * Shows confirmation before running LLM-powered operations on demo products
 */

interface Product {
  id: number
  name: string
  is_demo: boolean
}

/**
 * Check if any selected products are demo products and show warning
 * @param selectedProductIds - Array of selected product IDs
 * @param products - Array of all products
 * @param operationName - Name of the operation (e.g., "refresh personas", "upload feedback")
 * @returns true if user confirms (or no demo products selected), false if user cancels
 */
export async function confirmDemoOperation(
  selectedProductIds: number[],
  products: Product[],
  operationName: string
): Promise<boolean> {
  // Check if any selected products are demo products
  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id))
  const hasDemoProduct = selectedProducts.some(p => p.is_demo)

  if (!hasDemoProduct) {
    return true // No demo products, proceed without warning
  }

  // Show confirmation dialog
  const demoProductNames = selectedProducts
    .filter(p => p.is_demo)
    .map(p => p.name)
    .join(', ')

  const message = `⚠️ Demo Product Warning

You are about to ${operationName} for: ${demoProductNames}

This operation uses AI (LLM) and will consume credits from your configured LLM provider. You will be billed by your LLM provider for this operation.

Demo products are meant for exploration and may incur unnecessary costs.

Are you sure you want to continue?`

  return confirm(message)
}

/**
 * Get demo product names from selected products
 * @param selectedProductIds - Array of selected product IDs
 * @param products - Array of all products
 * @returns Comma-separated list of demo product names
 */
export function getDemoProductNames(
  selectedProductIds: number[],
  products: Product[]
): string {
  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id))
  const demoProducts = selectedProducts.filter(p => p.is_demo)
  return demoProducts.map(p => p.name).join(', ')
}
