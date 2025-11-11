'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/providers/AuthProvider'
import { MetricConfig } from '@/src/types/metrics'
import MetricListView from '@/components/settings/MetricListView'
import AddMetricForm from '@/components/settings/AddMetricForm'
import { Toaster, toast } from 'react-hot-toast'
import { Loader2, Plus, ChevronRight } from 'lucide-react'
import ModelSelector from '@/components/ModelSelector'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import ScoreSpeedometer from '@/components/ScoreSpeedometer'
import { SimpleLoader } from '@/components/SimpleLoader'
import { apiService, type AnalysisResult as ApiAnalysisResult } from '@/src/services/api'
import PromptGuide from '@/components/settings/PromptGuide'
import { FileUploadDropzone } from '@/components/ui/file-upload-dropzone'
import { AnalysisModeTabs } from '@/components/AnalysisModeTabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  loadGuestMetrics,
  addGuestMetric,
  updateGuestMetric,
  deleteGuestMetric,
  reorderGuestMetrics,
  resetGuestMetrics,
} from '@/src/utils/guestMetrics'

export default function CustomMetricsPage() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<MetricConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMetric, setEditingMetric] = useState<MetricConfig | null>(null)
  const [analysisMode, setAnalysisMode] = useState<'single' | 'batch'>('single')
  const [content, setContent] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<'input' | 'loading' | 'results'>('input')
  const [analysisResult, setAnalysisResult] = useState<ApiAnalysisResult | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Batch analysis state
  const [batchFiles, setBatchFiles] = useState<
    Array<{ file: globalThis.File; id: string; content?: string; error?: string }>
  >([])
  const [batchResults, setBatchResults] = useState<
    Array<{
      fileName: string
      analysisId: string
      result?: ApiAnalysisResult
      status: 'pending' | 'loading' | 'completed' | 'error'
      error?: string
    }>
  >([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [coherenceAnalysis, _setCoherenceAnalysis] = useState<{
    score: number
    summary: string
    strengths: string[]
    issues: string[]
    suggestions: string[]
  } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [coherenceLoading, _setCoherenceLoading] = useState(false)
  // Prompt viewer state
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [allPrompts, setAllPrompts] = useState<Array<{ metric: string; prompt: string }>>([])

  useEffect(() => {
    // Fetch metrics when component mounts or user changes
    fetchMetrics()
  }, [user])

  const fetchMetrics = async () => {
    try {
      // Fetch metrics based on user authentication status
      if (user) {
        // Authenticated: fetch from API
        const response = await fetch('/api/configuration')
        if (!response.ok) throw new Error('Failed to fetch metrics')
        const data = await response.json()
        setMetrics(data.configurations || [])
      } else {
        // Guest: load from LocalStorage
        const guestMetrics = loadGuestMetrics()
        setMetrics(guestMetrics)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
      // Use LocalStorage as fallback for guests
      if (!user) {
        const guestMetrics = loadGuestMetrics()
        setMetrics(guestMetrics)
      }
      toast.error('Не удалось загрузить метрики')
    } finally {
      setLoading(false)
    }
  }

  const handleReorder = async (updatedMetrics: MetricConfig[]) => {
    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(updatedMetrics)

    try {
      if (user) {
        // Authenticated: save to API
        const configurations = updatedMetrics.map((metric, index) => ({
          id: metric.id,
          display_order: index + 1,
        }))

        const response = await fetch('/api/configuration/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ configurations }),
        })

        if (!response.ok) throw new Error('Failed to reorder metrics')
        toast.success('Порядок метрик обновлен')
      } else {
        // Guest: save to LocalStorage
        reorderGuestMetrics(updatedMetrics)
        toast.success('Порядок метрик обновлен')
      }
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error reordering metrics:', error)
      toast.error('Не удалось изменить порядок метрик')
    }
  }

  const handleAddMetric = async (metric: Omit<MetricConfig, 'id'>) => {
    try {
      console.log('[CLIENT] Adding metric:', { name: metric.name, user: user?.id })

      if (user) {
        // Authenticated: save to API
        console.log('[CLIENT] User authenticated, calling API...')
        const response = await fetch('/api/configuration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metric),
        })

        console.log('[CLIENT] Response status:', response.status)

        if (!response.ok) {
          const error = await response.json()
          console.error('[CLIENT] API error response:', error)
          throw new Error(error.error || 'Failed to add metric')
        }

        const data = await response.json()
        console.log('[CLIENT] ✅ Metric created successfully:', data.configuration)
        setMetrics([...metrics, data.configuration])
        toast.success('Метрика добавлена')
      } else {
        // Guest: save to LocalStorage
        console.log('[CLIENT] Guest mode, saving to localStorage...')
        const newMetric = addGuestMetric(metric)
        setMetrics([...metrics, newMetric])
        toast.success('Метрика добавлена')
      }

      setShowAddForm(false)
    } catch (error) {
      console.error('[CLIENT] Error adding metric:', error)
      console.error('[CLIENT] Error details:', error instanceof Error ? error.message : error)
      toast.error('Не удалось добавить метрику')
    }
  }

  const handleUpdateMetric = async (id: string, updates: Partial<MetricConfig>) => {
    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(metrics.map((m) => (m.id === id ? { ...m, ...updates } : m)))

    try {
      if (user) {
        // Authenticated: save to API using PUT with id in body
        const response = await fetch('/api/configuration', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update metric')
        }
        toast.success('Метрика обновлена')
      } else {
        // Guest: save to LocalStorage
        const success = updateGuestMetric(id, updates)
        if (!success) throw new Error('Metric not found')
        toast.success('Метрика обновлена')
      }
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error updating metric:', error)
      toast.error('Не удалось обновить метрику')
    }
  }

  const handleDeleteMetric = async (id: string, _hard: boolean) => {
    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(metrics.filter((m) => m.id !== id))

    try {
      if (user) {
        // Authenticated: delete from API using query parameter
        const response = await fetch(`/api/configuration?id=${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to delete metric')
        }
        toast.success('Метрика удалена')
      } else {
        // Guest: delete from LocalStorage
        const success = deleteGuestMetric(id)
        if (!success) throw new Error('Metric not found')
        toast.success('Метрика удалена')
      }
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error deleting metric:', error)
      toast.error('Не удалось удалить метрику')
    }
  }

  const handleResetToDefaults = async () => {
    setLoading(true)
    try {
      if (user) {
        // Authenticated: reset via API
        const response = await fetch('/api/configuration/reset', {
          method: 'POST',
        })

        if (!response.ok) throw new Error('Failed to reset metrics')
        const data = await response.json()
        setMetrics(data.configurations || [])
        toast.success('Метрики сброшены к стандартным')
      } else {
        // Guest: reset LocalStorage
        const defaultMetrics = resetGuestMetrics()
        setMetrics(defaultMetrics)
        toast.success('Метрики сброшены к стандартным')
      }
    } catch (error) {
      console.error('Error resetting metrics:', error)
      toast.error('Не удалось сбросить метрики')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!content.trim() || isAnalyzing) return

    setIsAnalyzing(true)
    setError(null)
    setCurrentScreen('loading')
    setProgressMessage('Отправка на анализ...')

    try {
      // Get selected model from localStorage
      const selectedModel = globalThis.localStorage.getItem('selectedModel') || 'yandex-gpt-pro'

      // Get active metrics to send to the API
      const activeMetrics = metrics.filter((m) => m.is_active)
      console.log('Sending', activeMetrics.length, 'active metrics to API')

      const { analysisId } = await apiService.analyze({
        content: content.trim(),
        modelId: selectedModel,
        metricMode: 'custom',
        configurations: activeMetrics,
      })

      // Poll for results
      let pollCount = 0
      const progressMessages = activeMetrics.map((m) => `Анализ ${m.name.toLowerCase()}...`)
      let completed = 0

      const checkInterval = window.setInterval(async () => {
        pollCount++
        try {
          const result = await apiService.getAnalysis(analysisId)

          // Count completed metrics
          const completedNow = activeMetrics.filter((m) => {
            const metricResult = result.results?.[m.name]
            return metricResult && typeof metricResult === 'object' && 'score' in metricResult
          }).length

          if (completedNow > completed) {
            completed = completedNow
            if (completed < activeMetrics.length) {
              setProgressMessage(progressMessages[completed] || 'Обработка...')
            }
          }

          // Check if complete
          if (result.status === 'completed' || completed === activeMetrics.length) {
            window.clearInterval(checkInterval)
            setProgressMessage('Готово!')
            setAnalysisResult(result)

            window.setTimeout(() => {
              setCurrentScreen('results')
              setIsAnalyzing(false)
            }, 500)
          } else if (result.status === 'failed') {
            window.clearInterval(checkInterval)
            setError('Анализ не удался. Пожалуйста, попробуйте снова.')
            setCurrentScreen('input')
            setIsAnalyzing(false)
          }
        } catch (error) {
          console.error('Failed to check status:', error)
          if (pollCount > 30) {
            window.clearInterval(checkInterval)
            setError('Превышено время ожидания. Попробуйте снова.')
            setCurrentScreen('input')
            setIsAnalyzing(false)
          }
        }
      }, 3000)
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error(error.message || 'Failed to analyze content')
      setCurrentScreen('input')
      setIsAnalyzing(false)
    }
  }

  // Poll for batch analysis results
  const pollBatchResults = async (
    analyses: Array<{ fileName: string; analysisId: string; status: string }>,
  ) => {
    console.log('[BATCH] Starting to poll for', analyses.length, 'analyses')
    const maxPolls = 60 // 3 minutes maximum
    let pollCount = 0

    const checkResults = async () => {
      console.log('[BATCH] Poll attempt', pollCount + 1, 'of', maxPolls)

      const updatedResults = await Promise.all(
        analyses.map(async (analysis) => {
          try {
            console.log('[BATCH] Fetching status for', analysis.fileName, analysis.analysisId)
            const result = await apiService.getAnalysis(analysis.analysisId)
            console.log('[BATCH] Status for', analysis.fileName, ':', result.status)

            if (result.status === 'completed') {
              console.log('[BATCH] ✅ Completed:', analysis.fileName)
              console.log('[BATCH] Results:', result.results ? Object.keys(result.results) : 'none')
              return {
                ...analysis,
                result,
                status: 'completed' as const,
              }
            } else if (result.status === 'failed') {
              console.log('[BATCH] ❌ Failed:', analysis.fileName)
              return {
                ...analysis,
                status: 'error' as const,
                error: 'Анализ не удался',
              }
            } else {
              console.log('[BATCH] ⏳ Still processing:', analysis.fileName, result.status)
              return {
                ...analysis,
                status: 'loading' as const,
              }
            }
          } catch (error) {
            console.error('[BATCH] ❌ Error fetching result for', analysis.fileName, error)
            return {
              ...analysis,
              status: 'error' as const,
              error: 'Ошибка получения результата',
            }
          }
        }),
      )

      setBatchResults(updatedResults)

      const allCompleted = updatedResults.every(
        (r) => r.status === 'completed' || r.status === 'error',
      )

      const completedCount = updatedResults.filter((r) => r.status === 'completed').length
      const errorCount = updatedResults.filter((r) => r.status === 'error').length
      const loadingCount = updatedResults.filter((r) => r.status === 'loading').length

      console.log(
        `[BATCH] Status: ${completedCount} completed, ${errorCount} errors, ${loadingCount} loading`,
      )

      if (allCompleted) {
        console.log('[BATCH] All analyses completed! Showing results screen.')
        setCurrentScreen('results')
        setProgressMessage('')
        setIsAnalyzing(false)
        return
      }

      pollCount++
      if (pollCount < maxPolls) {
        console.log('[BATCH] Waiting 3 seconds before next check...')
        window.setTimeout(checkResults, 3000)
      } else {
        console.error('[BATCH] Timeout! Exceeded max polls.')
        setError('Превышено время ожидания результатов')
        setCurrentScreen('input')
        setIsAnalyzing(false)
      }
    }

    checkResults()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _loadPrompt = async (metric: string) => {
    try {
      setPromptsLoading(true)
      setPromptError(null)
      const modelId =
        globalThis.localStorage.getItem('selectedModel') ||
        analysisResult?.model_used ||
        'yandex-gpt-pro'
      const res = await fetch(
        `/api/prompt?metric=${encodeURIComponent(metric)}&model=${encodeURIComponent(modelId)}`,
      )
      if (!res.ok) throw new Error('Failed to load prompt')
      const data = await res.json()
      // Store prompt text if needed in the future
      console.log(data.prompt)
    } catch (e: unknown) {
      // Fallback: try local custom metric prompt_text
      const local = metrics.find((m) => m.id === metric || m.name === metric)
      if (local?.prompt_text) {
        setPromptError(null)
        // Store prompt text if needed in the future
        console.log(local.prompt_text)
      } else {
        setPromptError((e as Error)?.message || 'Ошибка загрузки промпта')
      }
    } finally {
      setPromptsLoading(false)
    }
  }

  const loadAllPrompts = async (metricIds: string[]) => {
    try {
      setPromptsLoading(true)
      setPromptError(null)
      const prompts: Array<{ metric: string; prompt: string }> = []

      for (const metricId of metricIds) {
        // Try to load from local metrics first
        const local = metrics.find((m) => m.id === metricId || m.name === metricId)
        if (local?.prompt_text) {
          prompts.push({ metric: local.name, prompt: local.prompt_text })
        }
      }

      setAllPrompts(prompts)
    } catch (e: unknown) {
      setPromptError((e as Error)?.message || 'Ошибка загрузки промптов')
    } finally {
      setPromptsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    )
  }

  if (currentScreen === 'loading') {
    return <SimpleLoader message={progressMessage} />
  }

  // Batch results screen
  if (currentScreen === 'results' && batchResults.length > 0) {
    const completedResults = batchResults.filter((r) => r.status === 'completed' && r.result)

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <UnifiedHeader />
        <div className="flex-1 p-6">
          <div className="max-w-[660px] mx-auto">
            {/* Overall Batch Statistics */}
            <div
              className="mb-8 p-8"
              style={{
                borderRadius: '40px',
                backgroundColor: '#E5FFE5',
              }}
            >
              <h2
                className="text-[32px] font-bold text-black mb-4"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Результаты анализа: {completedResults.length} из {batchResults.length} уроков
              </h2>
              <p className="text-[16px] text-gray-700">
                Анализ завершён с использованием ваших пользовательских метрик
              </p>
            </div>

            {/* Individual Lesson Results */}
            <div className="space-y-12">
              {batchResults.map((batch, batchIndex) => {
                if (batch.status === 'error') {
                  return (
                    <div
                      key={batch.analysisId}
                      className="p-6 bg-red-50 rounded-[40px] border border-red-200"
                    >
                      <h3 className="text-[20px] font-semibold text-red-900 mb-2">
                        {batch.fileName}
                      </h3>
                      <p className="text-red-700">{batch.error || 'Ошибка анализа'}</p>
                    </div>
                  )
                }

                if (!batch.result) return null

                const analysisResult = batch.result
                let overallScore = 0
                let metricCount = 0
                const metricResults: Array<{ name: string; score?: number; comment?: string }> = []

                if (analysisResult.results) {
                  Object.entries(analysisResult.results).forEach(([key, data]) => {
                    if (
                      data &&
                      typeof data === 'object' &&
                      'score' in data &&
                      key !== 'lessonTitle'
                    ) {
                      overallScore += data.score || 0
                      metricCount++
                      metricResults.push({ name: key, ...data })
                    }
                  })
                }

                const totalPossibleScore = metricCount * 5
                const adjustedScore = overallScore + metricCount * 2

                const getShortComment = (comment: string | undefined) => {
                  if (!comment) return ''
                  if (comment.length > 150) {
                    const truncated = comment.substring(0, 147)
                    const lastSpace = truncated.lastIndexOf(' ')
                    if (lastSpace > 100) {
                      return truncated.substring(0, lastSpace) + '...'
                    }
                    return truncated + '...'
                  }
                  return comment
                }

                const getMetricDisplayName = (metricName: string) => {
                  const metric = metrics.find((m) => m.name === metricName)
                  return metric?.name || metricName
                }

                return (
                  <div key={batch.analysisId} className="space-y-6">
                    <h2
                      className="text-[28px] font-bold text-black"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {batchIndex + 1}. {batch.fileName}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Overall Result */}
                      <div
                        className="p-6 flex flex-col items-center justify-center"
                        style={{
                          minWidth: '320px',
                          minHeight: '320px',
                          borderRadius: '40px',
                          backgroundColor: (() => {
                            const percentage =
                              ((adjustedScore + totalPossibleScore) / (totalPossibleScore * 2)) *
                              100
                            if (percentage < 40) return '#FFE5E5'
                            if (percentage < 70) return '#FFF9E5'
                            return '#E5FFE5'
                          })(),
                        }}
                      >
                        <ScoreSpeedometer score={adjustedScore} maxScore={totalPossibleScore} />
                      </div>

                      {/* Metric Results */}
                      {metricResults.map((result, index) => {
                        const data = analysisResult.results?.[result.name]
                        if (!data || typeof data !== 'object') return null

                        return (
                          <div
                            key={index}
                            className="bg-[#F5F5F5] p-6 flex flex-col"
                            style={{ minWidth: '320px', minHeight: '320px', borderRadius: '40px' }}
                          >
                            <div
                              className="flex justify-between items-start"
                              style={{ marginTop: '20px', marginBottom: '8px' }}
                            >
                              <h3
                                className="text-black"
                                style={{
                                  fontWeight: 600,
                                  fontSize: '32px',
                                  marginTop: '-5px',
                                  lineHeight: '90%',
                                }}
                              >
                                {getMetricDisplayName(result.name)}
                              </h3>
                              <div
                                style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                                className="text-black"
                              >
                                {data.score > 0 ? '+' : ''}
                                {data.score || 0}
                              </div>
                            </div>
                            <div className="flex-grow" />
                            <div className="space-y-3">
                              <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                                {getShortComment(data.comment)}
                              </p>
                              {(('suggestions' in data &&
                                Array.isArray(data.suggestions) &&
                                data.suggestions.length > 0) ||
                                ('recommendations' in data &&
                                  typeof data.recommendations === 'string')) && (
                                <div>
                                  <p className="text-[12px] font-medium text-black/60 mb-1">
                                    Что поправить:
                                  </p>
                                  <p
                                    className="text-[13px] text-black/80"
                                    style={{ lineHeight: '120%' }}
                                  >
                                    →{' '}
                                    {'suggestions' in data && Array.isArray(data.suggestions)
                                      ? data.suggestions[0]
                                      : 'recommendations' in data &&
                                          typeof data.recommendations === 'string'
                                        ? data.recommendations
                                            .split(/\d+\)/)
                                            .slice(1, 2)[0]
                                            ?.trim() || data.recommendations.substring(0, 150)
                                        : ''}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* New Analysis Button */}
            <button
              onClick={() => {
                setCurrentScreen('input')
                setContent('')
                setBatchResults([])
                setBatchFiles([])
                setAnalysisResult(null)
                _setCoherenceAnalysis(null)
              }}
              className="mt-12 px-8 py-3.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              Новый анализ
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentScreen === 'results' && analysisResult) {
    // Calculate overall score and count metrics
    let overallScore = 0
    let metricCount = 0
    const metricResults: { name: string; score?: number; comment?: string }[] = []

    if (analysisResult.results) {
      Object.entries(analysisResult.results).forEach(([key, data]) => {
        if (data && typeof data === 'object' && 'score' in data && key !== 'lessonTitle') {
          overallScore += data.score || 0
          metricCount++
          metricResults.push({ name: key, ...data })
        }
      })
    }

    const totalPossibleScore = metricCount * 5
    const adjustedScore = overallScore + metricCount * 2

    const getShortComment = (comment: string | undefined) => {
      if (!comment) return ''
      if (comment.length > 150) {
        const truncated = comment.substring(0, 147)
        const lastSpace = truncated.lastIndexOf(' ')
        if (lastSpace > 100) {
          return truncated.substring(0, lastSpace) + '...'
        }
        return truncated + '...'
      }
      return comment
    }

    const getMetricDisplayName = (metricName: string) => {
      const metric = metrics.find((m) => m.name === metricName)
      return metric?.name || metricName
    }

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <UnifiedHeader />
        <div className="flex-1 p-6">
          <div className="max-w-[660px] mx-auto">
            {/* Prompt link on results */}
            {currentScreen === 'results' && (
              <div className="flex justify-end mb-2">
                <button
                  className="text-sm text-gray-500 underline underline-offset-2 decoration-gray-300 hover:text-gray-700 hover:decoration-gray-400"
                  onClick={() => {
                    const metricIds = Object.keys(analysisResult?.results || {}).filter(
                      (k) => k !== 'lessonTitle',
                    )
                    loadAllPrompts(metricIds)
                    setPromptOpen(true)
                  }}
                >
                  Посмотреть промпт
                </button>
                <Dialog open={promptOpen} onOpenChange={(o) => setPromptOpen(o)}>
                  <DialogContent className="sm:max-w-[760px]">
                    <DialogHeader>
                      <DialogTitle>Промпты всех метрик</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-auto">
                      {promptsLoading ? (
                        <div className="text-sm text-gray-500">Загрузка…</div>
                      ) : promptError ? (
                        <div className="text-sm text-red-600">{promptError}</div>
                      ) : (
                        allPrompts.map(({ metric, prompt }) => (
                          <div key={metric} className="border rounded-md bg-[#F5F5F5] p-3">
                            <div className="text-xs font-medium text-gray-600 mb-2">{metric}</div>
                            <pre className="text-xs whitespace-pre-wrap text-black">{prompt}</pre>
                          </div>
                        ))
                      )}
                    </div>
                    <DialogFooter>
                      <button className="px-3 py-1.5 text-sm" onClick={() => setPromptOpen(false)}>
                        Закрыть
                      </button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* Overall Result */}
              <div
                className="p-6 flex flex-col items-center justify-center"
                style={{
                  minWidth: '320px',
                  minHeight: '320px',
                  borderRadius: '40px',
                  backgroundColor: (() => {
                    const percentage =
                      ((adjustedScore + totalPossibleScore) / (totalPossibleScore * 2)) * 100
                    if (percentage < 40) return '#FFE5E5'
                    if (percentage < 70) return '#FFF9E5'
                    return '#E5FFE5'
                  })(),
                }}
              >
                <ScoreSpeedometer score={adjustedScore} maxScore={totalPossibleScore} />
              </div>

              {/* Metric Results */}
              {metricResults.map((result, index) => {
                const data = analysisResult.results?.[result.name]
                if (!data || typeof data !== 'object') return null

                return (
                  <div
                    key={index}
                    className="bg-[#F5F5F5] p-6 flex flex-col"
                    style={{ minWidth: '320px', minHeight: '320px', borderRadius: '40px' }}
                  >
                    <div
                      className="flex justify-between items-start"
                      style={{ marginTop: '20px', marginBottom: '8px' }}
                    >
                      <h3
                        className="text-black"
                        style={{
                          fontWeight: 600,
                          fontSize: '32px',
                          marginTop: '-5px',
                          lineHeight: '90%',
                        }}
                      >
                        {getMetricDisplayName(result.name)}
                      </h3>
                      <div
                        style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                        className="text-black"
                      >
                        {data.score > 0 ? '+' : ''}
                        {data.score || 0}
                      </div>
                    </div>
                    <div className="flex-grow" />
                    <div className="space-y-3">
                      <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                        {getShortComment(data.comment)}
                      </p>
                      {(('suggestions' in data &&
                        Array.isArray(data.suggestions) &&
                        data.suggestions.length > 0) ||
                        ('recommendations' in data &&
                          typeof data.recommendations === 'string')) && (
                        <div>
                          <p className="text-[12px] font-medium text-black/60 mb-1">
                            Что поправить:
                          </p>
                          <p className="text-[13px] text-black/80" style={{ lineHeight: '120%' }}>
                            →{' '}
                            {'suggestions' in data && Array.isArray(data.suggestions)
                              ? data.suggestions[0]
                              : 'recommendations' in data &&
                                  typeof data.recommendations === 'string'
                                ? data.recommendations.split(/\d+\)/).slice(1, 2)[0]?.trim() ||
                                  data.recommendations.substring(0, 150)
                                : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick Win Section */}
            <div className="bg-[#F5F5F5] p-6 mb-8" style={{ width: '660px', borderRadius: '40px' }}>
              <h2 className="text-[20px] font-semibold text-black mb-3">Quick Win</h2>
              <p className="text-[14px] text-black leading-relaxed">
                {overallScore > 0
                  ? `Контент набрал ${overallScore > 0 ? '+' : ''}${overallScore} баллов. Материал хорошо структурирован и будет полезен для изучения.`
                  : overallScore < 0
                    ? `Контент набрал ${overallScore} баллов. Материал требует доработки для лучшего восприятия студентами.`
                    : 'Контент набрал 0 баллов. Материал имеет сбалансированные характеристики.'}
              </p>
            </div>

            {/* Detailed Analysis Sections */}
            <div className="space-y-8" style={{ width: '660px' }}>
              {metricResults.map((result, index) => {
                if (!result || !result.name) return null

                const data = analysisResult.results?.[result.name]
                if (!data || typeof data !== 'object' || !('score' in data)) return null

                return (
                  <div key={index} className="bg-white rounded-lg">
                    <div className="flex items-start gap-4 mb-4">
                      <h3 className="text-[24px] font-bold text-black">
                        {getMetricDisplayName(result.name)} ({data.score > 0 ? '+' : ''}
                        {data.score})
                      </h3>
                    </div>

                    {/* Analysis Text */}
                    {'detailed_analysis' in data && data.detailed_analysis && (
                      <div className="bg-[#F5F5F5] p-6 mb-4" style={{ borderRadius: '40px' }}>
                        <h4 className="text-[16px] font-semibold text-black mb-3">Анализ</h4>
                        {typeof data.detailed_analysis === 'string' ? (
                          <p className="text-[14px] text-black leading-relaxed">
                            {data.detailed_analysis}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {Object.entries(data.detailed_analysis).map(([key, value]) => (
                              <div key={key}>
                                <h5 className="text-[14px] font-medium text-black mb-1">{key}:</h5>
                                <p className="text-[14px] text-black ml-4">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Examples */}
                    {'examples' in data &&
                      Array.isArray(data.examples) &&
                      data.examples.length > 0 && (
                        <div className="bg-[#F5F5F5] p-6 mb-4" style={{ borderRadius: '40px' }}>
                          <h4 className="text-[16px] font-semibold text-black mb-3">
                            Примеры из текста
                          </h4>
                          <ul className="space-y-3">
                            {data.examples.map((example: string, idx: number) => (
                              <li key={idx} className="flex items-start">
                                <span className="text-black mr-2">•</span>
                                <span className="text-[14px] text-black italic">"{example}"</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Suggestions */}
                    {(('suggestions' in data &&
                      Array.isArray(data.suggestions) &&
                      data.suggestions.length > 0) ||
                      ('recommendations' in data && typeof data.recommendations === 'string')) && (
                      <div className="bg-[#F5F5F5] p-6" style={{ borderRadius: '40px' }}>
                        <h4 className="text-[16px] font-semibold text-black mb-3">Что поправить</h4>
                        <ul className="space-y-3">
                          {'suggestions' in data && Array.isArray(data.suggestions)
                            ? data.suggestions.map((suggestion: string, idx: number) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-black mr-2">→</span>
                                  <span className="text-[14px] text-black">{suggestion}</span>
                                </li>
                              ))
                            : 'recommendations' in data && typeof data.recommendations === 'string'
                              ? data.recommendations
                                  .split(/\d+\)/)
                                  .filter(Boolean)
                                  .map((rec: string, idx: number) => (
                                    <li key={idx} className="flex items-start">
                                      <span className="text-black mr-2">→</span>
                                      <span className="text-[14px] text-black">{rec.trim()}</span>
                                    </li>
                                  ))
                              : null}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => {
                setCurrentScreen('input')
                setContent('')
                setAnalysisResult(null)
              }}
              className="mt-12 px-8 py-3.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              Новый анализ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <UnifiedHeader />

      <div className="flex-1 flex justify-center p-6">
        <div className="w-full max-w-[660px] mt-[50px]">
          <Toaster position="top-right" />

          {/* Error Alert */}
          {error && currentScreen === 'input' && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Header - Лёха AI style */}
          <header className="mb-10">
            <div className="mb-4">
              <h1
                className="text-[48px] font-bold text-black mb-3 leading-tight"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Мой сет
              </h1>
              <p
                className="text-[20px] font-normal text-black"
                style={{ fontFamily: 'Inter, sans-serif', lineHeight: '120%' }}
              >
                настройте критерии оценки
                <br />
                контента под ваши
                <br />
                потребности
              </p>
            </div>
            <button
              onClick={handleResetToDefaults}
              className="px-6 py-2 text-sm text-black/60 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
            >
              Сбросить к стандартным
            </button>
          </header>

          {/* Model Selector */}
          <div className="mb-6">
            <label
              className="block text-[15px] font-normal text-gray-500 mb-3"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Модель
            </label>
            <ModelSelector />
          </div>

          {/* Main Content - Metric List */}
          <div
            className="bg-white border border-gray-200 p-6 mb-6"
            style={{ borderRadius: '20px' }}
          >
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[20px] font-semibold text-black">
                  {user ? 'Ваши метрики' : 'Мои метрики'}
                </h2>
                <div className="flex items-center gap-4">
                  <button
                    className="text-sm text-gray-500 underline underline-offset-2 decoration-gray-300 hover:text-gray-700 hover:decoration-gray-400"
                    onClick={() => {
                      const metricIds = metrics.map((m) => m.id)
                      loadAllPrompts(metricIds)
                      setPromptOpen(true)
                    }}
                  >
                    Посмотреть промпт
                  </button>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>
              </div>
              {/* Prompts dialog attached to metrics box */}
              <Dialog
                open={promptOpen && currentScreen === 'input'}
                onOpenChange={(o) => setPromptOpen(o)}
              >
                <DialogContent className="sm:max-w-[760px]">
                  <DialogHeader>
                    <DialogTitle>Промпты всех метрик</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[60vh] overflow-auto">
                    {promptsLoading ? (
                      <div className="text-sm text-gray-500">Загрузка…</div>
                    ) : promptError ? (
                      <div className="text-sm text-red-600">{promptError}</div>
                    ) : (
                      allPrompts.map(({ metric, prompt }) => (
                        <div key={metric} className="border rounded-md bg-[#F5F5F5] p-3">
                          <div className="text-xs font-medium text-gray-600 mb-2">{metric}</div>
                          <pre className="text-xs whitespace-pre-wrap text-black">{prompt}</pre>
                        </div>
                      ))
                    )}
                  </div>
                  <DialogFooter>
                    <button className="px-3 py-1.5 text-sm" onClick={() => setPromptOpen(false)}>
                      Закрыть
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <PromptGuide />
            </div>

            <MetricListView
              metrics={metrics}
              onReorder={handleReorder}
              onEdit={setEditingMetric}
              onDelete={handleDeleteMetric}
              onToggleActive={(id, active) => handleUpdateMetric(id, { is_active: active })}
            />
          </div>

          {/* Info for guests */}
          {!user && (
            <div
              className="bg-gray-100 border border-gray-200 p-4 mb-6"
              style={{ borderRadius: '20px' }}
            >
              <p className="text-sm text-gray-800">
                💡 <strong>Гостевой режим:</strong> Ваши настройки сохраняются локально в браузере.
                Войдите в систему, чтобы синхронизировать метрики между устройствами.
              </p>
            </div>
          )}

          {/* Content Analysis Section */}
          <div className="mb-6">
            {/* Analysis Mode Tabs */}
            <AnalysisModeTabs value={analysisMode} onChange={setAnalysisMode} className="mb-6" />

            <label
              className="block text-[15px] font-normal text-gray-500 mb-3"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Контент
            </label>

            {analysisMode === 'batch' ? (
              /* Batch mode: File upload dropzone */
              <>
                <FileUploadDropzone
                  onFilesSelected={(files) => setBatchFiles(files)}
                  maxFiles={50}
                  maxSizeMB={10}
                  acceptedFileTypes={['.txt', '.md', '.html', '.pdf']}
                />
                {/* Batch Analyze Button */}
                {batchFiles.filter((f) => !f.error && f.content).length > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={async () => {
                        const filesToAnalyze = batchFiles.filter((f) => !f.error && f.content)
                        if (filesToAnalyze.length === 0) {
                          setError('Нет файлов для анализа')
                          return
                        }
                        setIsAnalyzing(true)
                        setError(null)
                        setCurrentScreen('loading')
                        setProgressMessage(
                          `Запуск анализа ${filesToAnalyze.length} файлов с пользовательскими метриками...`,
                        )

                        try {
                          const selectedModel =
                            globalThis.localStorage.getItem('selectedModel') || 'yandex-gpt-pro'
                          const activeMetrics = metrics.filter((m) => m.is_active)

                          const analyses = await Promise.all(
                            filesToAnalyze.map(async (file) => {
                              try {
                                const { analysisId } = await apiService.analyze({
                                  content: file.content || '',
                                  modelId: selectedModel,
                                  metricMode: 'custom',
                                  configurations: activeMetrics,
                                })
                                return {
                                  fileName: file.file.name,
                                  analysisId,
                                  status: 'loading' as const,
                                }
                              } catch (error) {
                                console.error(`Failed to analyze ${file.file.name}:`, error)
                                return {
                                  fileName: file.file.name,
                                  analysisId: '',
                                  status: 'error' as const,
                                  error: 'Ошибка запуска анализа',
                                }
                              }
                            }),
                          )

                          setBatchResults(analyses)
                          pollBatchResults(analyses)
                        } catch (error) {
                          console.error('Batch analysis failed:', error)
                          setError('Не удалось запустить батч-анализ')
                          setCurrentScreen('input')
                          setIsAnalyzing(false)
                        }
                      }}
                      disabled={isAnalyzing}
                      className="px-10 py-4 text-[16px] font-medium bg-black text-white 
                           hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                           rounded-full transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Анализируем {batchFiles.filter((f) => !f.error && f.content).length}{' '}
                          файлов...
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-5 h-5" />
                          Проанализировать {
                            batchFiles.filter((f) => !f.error && f.content).length
                          }{' '}
                          файлов
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Single mode: Text Input Area */
              <div className="relative">
                <div className="w-full h-48 relative bg-[#F2F2F2] rounded-[50px] px-3 py-3">
                  <textarea
                    placeholder="Текст урока"
                    value={content}
                    onChange={(e) => {
                      const text = e.target.value
                      if (text.length <= 25000) {
                        setContent(text)
                      }
                    }}
                    className="w-full h-[140px] pl-2 pr-20 pb-24 pt-2 text-[20px] font-light text-black leading-relaxed 
                            bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-gray-400/60"
                    maxLength={25000}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />

                  {/* Character Counter */}
                  {content && (
                    <div className="absolute bottom-3 right-[200px] text-[12px] text-gray-400">
                      {content.length} / 25000
                    </div>
                  )}

                  {/* Analyze Button inside textarea */}
                  <button
                    onClick={handleAnalyze}
                    disabled={!content.trim() || isAnalyzing}
                    className="absolute bottom-3 right-3 px-8 py-3.5 h-[42px] text-[14px] font-normal bg-[#1a1a1a] text-white 
                           hover:opacity-80 disabled:opacity-50
                           rounded-full transition-opacity duration-200 flex items-center justify-center"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Анализируем...
                      </>
                    ) : (
                      'Проанализировать'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add Metric Modal */}
          {showAddForm && (
            <AddMetricForm
              onSubmit={handleAddMetric}
              onCancel={() => setShowAddForm(false)}
              existingNames={metrics.map((m) => m.name)}
            />
          )}

          {/* Edit Metric Modal */}
          {editingMetric && (
            <AddMetricForm
              metric={editingMetric}
              onSubmit={(updates) => handleUpdateMetric(editingMetric.id, updates)}
              onCancel={() => setEditingMetric(null)}
              existingNames={metrics.filter((m) => m.id !== editingMetric.id).map((m) => m.name)}
              isEdit={true}
            />
          )}
        </div>
      </div>
    </div>
  )
}
