import { createServiceClient } from '@/src/lib/supabase/server'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
}

/**
 * Rate limiting implementation using Supabase
 * Tracks requests per user (authenticated) or IP (guests)
 */
export class RateLimiter {
  private readonly windowMs: number = 60 * 1000 // 1 minute window
  private readonly maxRequests: number = 10 // 10 requests per minute

  constructor(options?: { windowMs?: number; maxRequests?: number }) {
    if (options?.windowMs) this.windowMs = options.windowMs
    if (options?.maxRequests) this.maxRequests = options.maxRequests
  }

  /**
   * Check and update rate limit for a given identifier
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const supabase = await createServiceClient()
    const now = new Date()
    const windowStart = new Date(now.getTime() - this.windowMs)

    // Hash the identifier for privacy (especially for IPs)
    const hashedId = await this.hashIdentifier(identifier)

    // Check current window
    const { data: existingLimit, error: fetchError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('ip_hash', hashedId)
      .gte('window_start', windowStart.toISOString())
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Rate limit check error:', fetchError)
      // On error, allow the request but log it
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: new Date(now.getTime() + this.windowMs),
      }
    }

    if (existingLimit) {
      // Existing rate limit found
      const remaining = this.maxRequests - existingLimit.count

      if (remaining <= 0) {
        // Rate limit exceeded
        return {
          success: false,
          limit: this.maxRequests,
          remaining: 0,
          reset: new Date(existingLimit.window_start.getTime() + this.windowMs),
        }
      }

      // Increment counter
      const { error: updateError } = await supabase
        .from('rate_limits')
        .update({ count: existingLimit.count + 1 })
        .eq('ip_hash', hashedId)
        .eq('window_start', existingLimit.window_start)

      if (updateError) {
        console.error('Rate limit update error:', updateError)
      }

      return {
        success: true,
        limit: this.maxRequests,
        remaining: remaining - 1,
        reset: new Date(existingLimit.window_start.getTime() + this.windowMs),
      }
    } else {
      // No existing limit, create new one
      const { error: insertError } = await supabase.from('rate_limits').insert({
        ip_hash: hashedId,
        window_start: now.toISOString(),
        count: 1,
      })

      if (insertError) {
        console.error('Rate limit insert error:', insertError)
      }

      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: new Date(now.getTime() + this.windowMs),
      }
    }
  }

  /**
   * Clean up old rate limit records
   */
  async cleanup(): Promise<void> {
    const supabase = await createServiceClient()
    const cutoff = new Date(Date.now() - this.windowMs * 2) // Keep 2 windows for safety

    const { error } = await supabase
      .from('rate_limits')
      .delete()
      .lt('window_start', cutoff.toISOString())

    if (error) {
      console.error('Rate limit cleanup error:', error)
    }
  }

  /**
   * Hash an identifier for privacy
   */
  private async hashIdentifier(identifier: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(identifier)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }
}

/**
 * Get identifier for rate limiting
 * Uses user ID for authenticated users, IP for guests
 */
export function getRateLimitIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`
  }

  // Get IP from various headers (works with proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfIp = request.headers.get('cf-connecting-ip') // Cloudflare

  const ip = forwarded?.split(',')[0] || realIp || cfIp || 'unknown'
  return `ip:${ip}`
}

// Export singleton instance with default settings
export const rateLimiter = new RateLimiter()
