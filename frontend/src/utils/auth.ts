/**
 * Authentication utilities
 * Helper functions for managing auth state
 */

export interface User {
  id: number
  email: string
  full_name: string
  tenant_id: number
  role: string
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem('user')
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function setCurrentUser(user: User): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('user', JSON.stringify(user))
}

function isTokenExpired(token: string): boolean {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.')
    if (parts.length !== 3) return true

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]))

    // Check if token has expiration
    if (!payload.exp) return false // If no exp, consider it valid

    // exp is in seconds, Date.now() is in milliseconds
    const expirationTime = payload.exp * 1000
    const currentTime = Date.now()

    // Add 10 second buffer to prevent edge cases
    return currentTime >= (expirationTime - 10000)
  } catch (error) {
    // If we can't decode the token, consider it invalid
    return true
  }
}

export function isAuthenticated(): boolean {
  const token = getAuthToken()
  if (!token) return false

  // Check if token is expired
  if (isTokenExpired(token)) {
    // Clear expired auth data
    removeAuthToken()
    return false
  }

  return true
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) return {}
  return {
    'Authorization': `Bearer ${token}`,
  }
}
