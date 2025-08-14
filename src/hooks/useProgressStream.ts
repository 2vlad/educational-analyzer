import { useEffect, useState, useCallback, useRef } from 'react'
import type { AnalysisProgress } from '@/src/services/ProgressService'

interface UseProgressStreamOptions {
  onProgress?: (progress: AnalysisProgress) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export function useProgressStream(
  analysisId: string | null,
  options: UseProgressStreamOptions = {},
) {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const eventSourceRef = useRef<globalThis.EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout>>()
  const reconnectAttemptsRef = useRef(0)

  const connect = useCallback(() => {
    if (!analysisId || eventSourceRef.current) return

    try {
      const eventSource = new globalThis.EventSource(`/api/progress/${analysisId}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        console.log('SSE connection opened for analysis:', analysisId)
      }

      eventSource.onmessage = (event) => {
        try {
          const progressData: AnalysisProgress = JSON.parse(event.data)
          setProgress(progressData)
          options.onProgress?.(progressData)

          // Check if analysis is complete
          if (progressData.overallProgress >= 100) {
            options.onComplete?.()
            eventSource.close()
          }
        } catch (err) {
          console.error('Error parsing progress data:', err)
        }
      }

      eventSource.onerror = (event) => {
        console.error('SSE error:', event)
        setIsConnected(false)
        eventSource.close()
        eventSourceRef.current = null

        // Implement exponential backoff for reconnection
        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
          reconnectAttemptsRef.current++
          
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`)
          reconnectTimeoutRef.current = globalThis.setTimeout(() => {
            connect()
          }, delay)
        } else {
          const error = new Error('Failed to establish SSE connection after 5 attempts')
          setError(error)
          options.onError?.(error)
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect to progress stream')
      setError(error)
      options.onError?.(error)
    }
  }, [analysisId, options])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      globalThis.clearTimeout(reconnectTimeoutRef.current)
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (analysisId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [analysisId, connect, disconnect])

  return {
    progress,
    isConnected,
    error,
    reconnect: connect,
    disconnect,
  }
}