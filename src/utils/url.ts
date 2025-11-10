/**
 * Get the application URL for authentication redirects
 * Uses environment variable in production, falls back to window.location.origin in development
 */
export function getAppUrl(): string {
  // In production or when NEXT_PUBLIC_APP_URL is set, use it
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // Fallback to window.location.origin if available (browser only)
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // Default fallback (shouldn't happen in normal usage)
  return 'http://localhost:3000'
}

/**
 * Get the full callback URL for authentication
 */
export function getAuthCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`
}
