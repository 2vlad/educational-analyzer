/**
 * Debug logging utility that respects DEBUG and LOG_LEVEL environment variables
 * Only outputs debug information when DEBUG=true or LOG_LEVEL=debug
 */

import { env } from '@/src/config/env'

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const

type LogLevel = keyof typeof LOG_LEVELS

class DebugLogger {
  private isDebug: boolean
  private logLevel: LogLevel

  constructor() {
    this.isDebug = env.isServer ? (env.server?.DEBUG ?? false) : false
    this.logLevel = env.isServer ? (env.server?.LOG_LEVEL ?? 'info') : 'info'
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.logLevel]
  }

  debug(...args: any[]) {
    if (this.isDebug || this.logLevel === 'debug') {
      console.log('[DEBUG]', ...args)
    }
  }

  info(...args: any[]) {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args)
    }
  }

  warn(...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args)
    }
  }

  error(...args: any[]) {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args)
    }
  }

  // Special method for large payloads - only logs when DEBUG=true
  payload(label: string, data: any, maxLength: number = 200) {
    if (this.isDebug) {
      const preview =
        typeof data === 'string'
          ? data.substring(0, maxLength)
          : JSON.stringify(data).substring(0, maxLength)
      console.log(`[DEBUG:PAYLOAD] ${label}:`, preview + (preview.length >= maxLength ? '...' : ''))
    }
  }

  // Log only in development
  dev(...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEV]', ...args)
    }
  }
}

export const debug = new DebugLogger()
