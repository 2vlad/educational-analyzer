import { supabaseAdmin } from '@/src/lib/supabaseServer'
import { InsertSystemLog, LogLevel } from '@/src/types/database'

interface LogMetadata {
  [key: string]: any
}

class Logger {
  private queue: InsertSystemLog[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private isServer = typeof window === 'undefined'

  constructor() {
    // Start flush interval on server
    if (this.isServer) {
      this.startFlushInterval()
    }
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 5000) // Flush every 5 seconds
  }

  private async flush() {
    if (this.queue.length === 0) return

    const logsToFlush = [...this.queue]
    this.queue = []

    try {
      if (this.isServer) {
        await supabaseAdmin.from('system_logs').insert(logsToFlush)
      }
    } catch (error) {
      // Fall back to console if DB insert fails
      console.error('Failed to flush logs to database:', error)
      logsToFlush.forEach((log) => {
        console.log(`[${log.level.toUpperCase()}] ${log.message}`, log.metadata)
      })
    }
  }

  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength) + '...'
  }

  private sanitizeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
    if (!metadata) return undefined

    const sanitized = { ...metadata }

    // Truncate large fields
    if (sanitized.promptSnippet && typeof sanitized.promptSnippet === 'string') {
      sanitized.promptSnippet = this.truncate(sanitized.promptSnippet, 500)
    }
    if (sanitized.contentSnippet && typeof sanitized.contentSnippet === 'string') {
      sanitized.contentSnippet = this.truncate(sanitized.contentSnippet, 500)
    }

    // Redact sensitive keys
    const sensitiveKeys = ['api_key', 'apiKey', 'token', 'password', 'secret']
    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      }
    })

    return sanitized
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata) {
    const sanitizedMetadata = this.sanitizeMetadata(metadata)

    // Always log to console
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, sanitizedMetadata || '')

    // Queue for database insert (server only)
    if (this.isServer) {
      this.queue.push({
        level,
        message,
        metadata: sanitizedMetadata,
      })
    }
  }

  info(message: string, metadata?: LogMetadata) {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata?: LogMetadata) {
    this.log('warn', message, metadata)
  }

  error(message: string, metadata?: LogMetadata) {
    this.log('error', message, metadata)
  }

  // LLM-specific logging methods
  llmRequestStart(metadata: {
    analysisId: string
    metric: string
    model: string
    promptLength: number
    contentLength: number
  }) {
    this.info('LLM_REQUEST_START', metadata)
  }

  llmRequestComplete(metadata: {
    analysisId: string
    metric: string
    model: string
    duration: number
    tokensUsed?: number
    success: boolean
  }) {
    this.info('LLM_REQUEST_COMPLETE', metadata)
  }

  llmRequestError(metadata: {
    analysisId: string
    metric: string
    model: string
    error: string
    retryCount: number
    promptSnippet?: string
  }) {
    this.error('LLM_REQUEST_ERROR', metadata)
  }

  modelSwitch(metadata: { from: string; to: string; reason: string; analysisId?: string }) {
    this.info('MODEL_SWITCH', metadata)
  }

  analysisStart(metadata: {
    analysisId: string
    contentLength: number
    model: string
    metricsCount: number
  }) {
    this.info('ANALYSIS_START', metadata)
  }

  analysisComplete(metadata: {
    analysisId: string
    totalDuration: number
    successfulMetrics: number
    failedMetrics: number
  }) {
    this.info('ANALYSIS_COMPLETE', metadata)
  }

  llmSuccess(metadata: { metric: string; attempt: number }) {
    this.info('LLM_SUCCESS', metadata)
  }

  llmRetry(metadata: { metric: string; attempt: number; error: string }) {
    this.warn('LLM_RETRY', metadata)
  }

  modelFallback(metadata: { metric: string; fallbackModel: string }) {
    this.info('MODEL_FALLBACK', metadata)
  }

  // Cleanup method
  async destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flush()
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for testing
export { Logger }
