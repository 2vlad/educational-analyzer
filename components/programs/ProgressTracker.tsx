'use client'

import { useEffect, useState } from 'react'
import { Pause, Play, Square, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiService, type ProgramRun } from '@/src/services/api'

interface ProgressTrackerProps {
  programId: string
  programName: string
  onComplete?: () => void
}

export default function ProgressTracker({
  programId,
  programName,
  onComplete,
}: ProgressTrackerProps) {
  const [run, setRun] = useState<ProgramRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadActiveRun()
  }, [programId])

  useEffect(() => {
    if (!run) return

    // Poll for updates if run is active
    if (run.status === 'running' || run.status === 'queued') {
      const interval = setInterval(() => {
        refreshRunStatus()
      }, 2000) // Poll every 2 seconds

      return () => clearInterval(interval)
    }

    // Notify parent when completed
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'stopped') {
      if (onComplete) {
        onComplete()
      }
    }
  }, [run?.status, run?.id])

  const loadActiveRun = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all runs for this program
      const response = await fetch(`/api/programs/${programId}/runs`)
      if (!response.ok) {
        throw new Error('Failed to fetch runs')
      }

      const { runs } = await response.json()

      // Find active run
      const activeRun = runs.find(
        (r: ProgramRun) => r.status === 'running' || r.status === 'queued' || r.status === 'paused',
      )

      if (activeRun) {
        setRun(activeRun)
      } else {
        setRun(null)
      }
    } catch (err: any) {
      console.error('Failed to load run:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const refreshRunStatus = async () => {
    if (!run) return

    try {
      const { run: updatedRun } = await apiService.getRunStatus(run.id)
      setRun(updatedRun)
    } catch (err) {
      console.error('Failed to refresh run status:', err)
    }
  }

  const handlePause = async () => {
    if (!run) return

    try {
      setActionLoading(true)
      await apiService.pauseRun(run.id)
      await refreshRunStatus()
    } catch (err: any) {
      alert(err.message || 'Не удалось приостановить')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResume = async () => {
    if (!run) return

    try {
      setActionLoading(true)
      await apiService.resumeRun(run.id)
      await refreshRunStatus()
    } catch (err: any) {
      alert(err.message || 'Не удалось возобновить')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStop = async () => {
    if (!run) return

    if (!confirm('Вы уверены, что хотите остановить анализ?')) {
      return
    }

    try {
      setActionLoading(true)
      await apiService.stopRun(run.id)
      await refreshRunStatus()
    } catch (err: any) {
      alert(err.message || 'Не удалось остановить')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm text-gray-900">Загрузка статуса...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-900">Ошибка: {error}</p>
        <Button size="sm" variant="outline" onClick={loadActiveRun} className="mt-2">
          Попробовать снова
        </Button>
      </div>
    )
  }

  if (!run) {
    return null // No active run
  }

  const progress = run.total_lessons > 0 ? Math.round((run.processed / run.total_lessons) * 100) : 0

  const getStatusColor = () => {
    switch (run.status) {
      case 'running':
        return 'bg-gray-100 border-gray-300'
      case 'paused':
        return 'bg-yellow-50 border-yellow-200'
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      case 'stopped':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getStatusText = () => {
    switch (run.status) {
      case 'queued':
        return 'В очереди'
      case 'running':
        return 'Выполняется'
      case 'paused':
        return 'Приостановлен'
      case 'completed':
        return 'Завершен'
      case 'failed':
        return 'Ошибка'
      case 'stopped':
        return 'Остановлен'
      default:
        return run.status
    }
  }

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">Анализ программы: {programName}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Статус: <span className="font-medium">{getStatusText()}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {run.status === 'running' && (
            <Button size="sm" variant="outline" onClick={handlePause} disabled={actionLoading}>
              <Pause className="w-4 h-4 mr-1" />
              Пауза
            </Button>
          )}

          {run.status === 'paused' && (
            <Button size="sm" variant="outline" onClick={handleResume} disabled={actionLoading}>
              <Play className="w-4 h-4 mr-1" />
              Продолжить
            </Button>
          )}

          {(run.status === 'running' || run.status === 'paused') && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStop}
              disabled={actionLoading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Square className="w-4 h-4 mr-1" />
              Остановить
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Прогресс</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              run.status === 'completed'
                ? 'bg-green-500'
                : run.status === 'failed'
                  ? 'bg-red-500'
                  : run.status === 'paused'
                    ? 'bg-yellow-500'
                    : 'bg-gray-1000'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-gray-900">{run.total_lessons}</div>
          <div className="text-xs text-gray-600">Всего</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-600">{run.processed}</div>
          <div className="text-xs text-gray-600">Обработано</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">{run.succeeded}</div>
          <div className="text-xs text-gray-600">Успешно</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600">{run.failed}</div>
          <div className="text-xs text-gray-600">Ошибки</div>
        </div>
      </div>

      {/* Metrics mode info */}
      <div className="mt-3 pt-3 border-t border-gray-300">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Режим метрик:</span>
          <span className="font-medium">
            {run.metrics_mode === 'lx' ? 'LX (стандартные)' : 'Пользовательские'}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mt-1">
          <span>Параллелизм:</span>
          <span className="font-medium">{run.max_concurrency} одновременно</span>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      {(run.status === 'running' || run.status === 'queued') && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Автоматическое обновление каждые 2 секунды</span>
        </div>
      )}
    </div>
  )
}
