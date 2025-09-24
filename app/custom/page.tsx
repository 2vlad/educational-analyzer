'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/providers/AuthProvider'
import { MetricConfig } from '@/src/types/metrics'
import MetricListView from '@/components/settings/MetricListView'
import AddMetricForm from '@/components/settings/AddMetricForm'
import { Toaster, toast } from 'react-hot-toast'
import { Loader2, Plus } from 'lucide-react'
import ModelSelector from '@/components/ModelSelector'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import ScoreSpeedometer from '@/components/ScoreSpeedometer'
import { SimpleLoader } from '@/components/SimpleLoader'
import { apiService, type AnalysisResult as ApiAnalysisResult } from '@/src/services/api'
import PromptGuide from '@/components/settings/PromptGuide'
import { DEFAULT_STUDENT_CHARACTER, normalizeStudentCharacter } from '@/src/utils/studentCharacter'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export default function CustomMetricsPage() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<MetricConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMetric, setEditingMetric] = useState<MetricConfig | null>(null)
  const [content, setContent] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<'input' | 'loading' | 'results'>('input')
  const [analysisResult, setAnalysisResult] = useState<ApiAnalysisResult | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [studentCharacter, setStudentCharacter] = useState(DEFAULT_STUDENT_CHARACTER)
  const [initialStudentCharacter, setInitialStudentCharacter] = useState(DEFAULT_STUDENT_CHARACTER)
  const [characterLoading, setCharacterLoading] = useState(false)
  const [characterSaving, setCharacterSaving] = useState(false)
  // Prompt viewer state
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [allPrompts, setAllPrompts] = useState<Array<{ metric: string; prompt: string }>>([])
  const characterLimit = 500
  const trimmedCurrentCharacter = studentCharacter.trim()
  const trimmedInitialCharacter = initialStudentCharacter.trim()
  const hasCharacterChanges = trimmedCurrentCharacter !== trimmedInitialCharacter

  const renderStudentCharacterEditor = () => (
    <div className="mb-8">
      <div className="flex items-start justify-between mb-2">
        <label
          className="block text-[15px] font-normal text-gray-500"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Характер Лёхи
        </label>
        {characterLoading && (
          <span className="text-xs text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            Загружаем...
          </span>
        )}
      </div>
      <p
        className="text-sm text-gray-600 mb-3"
        style={{ fontFamily: 'Inter, sans-serif', lineHeight: '140%' }}
      >
        Опишите, каким тоном и в каком образе отвечает ваш Лёха. Например: «Ты — Лёха, увлечённый
        студент айти-колледжа, говоришь дружелюбно, но по делу».
      </p>
      <div className="relative">
        <textarea
          value={studentCharacter}
          disabled={characterLoading || characterSaving}
          onChange={(event) => {
            const value = event.target.value
            if (value.length <= characterLimit) {
              setStudentCharacter(value)
            }
          }}
          maxLength={characterLimit}
          placeholder="Ты — Лёха, ..."
          className="w-full min-h-[110px] bg-[#F5F5F5] rounded-[20px] px-4 py-3 text-[15px] text-black border border-transparent focus:border-black focus:outline-none focus:ring-0 transition-colors"
          style={{ fontFamily: 'Inter, sans-serif', lineHeight: '150%' }}
        />
        <div className="absolute bottom-3 right-4 text-xs text-gray-400">
          {studentCharacter.length}/{characterLimit}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {!user && (
          <span className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
            Войдите, чтобы сохранить характер и использовать его в анализе.
          </span>
        )}
        <button
          onClick={handleSaveStudentCharacter}
          disabled={!user || characterSaving || characterLoading || !hasCharacterChanges}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm transition-colors ${
            !user || characterSaving || characterLoading || !hasCharacterChanges
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800'
          }`}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {characterSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Сохраняем...
            </>
          ) : (
            'Сохранить характер'
          )}
        </button>
      </div>
    </div>
  )

  useEffect(() => {
    // Fetch metrics when component mounts or user changes
    fetchMetrics()
    loadStudentCharacter()
  }, [user])

  const fetchMetrics = async () => {
    try {
      // Only fetch user metrics if authenticated
      if (user) {
        const response = await fetch('/api/configuration')
        if (!response.ok) throw new Error('Failed to fetch metrics')
        const data = await response.json()
        setMetrics(data.configurations || [])
      } else {
        // Use default LX metrics for non-authenticated users
        setMetrics([
          {
            id: 'logic',
            name: 'Логика',
            prompt_text: 'Оцените логическую структуру и аргументацию',
            display_order: 1,
            is_active: true,
          },
          {
            id: 'practical',
            name: 'Польза',
            prompt_text: 'Оцените практическую применимость',
            display_order: 2,
            is_active: true,
          },
          {
            id: 'complexity',
            name: 'Сложность',
            prompt_text: 'Оцените глубину и сложность содержания',
            display_order: 3,
            is_active: true,
          },
          {
            id: 'interest',
            name: 'Интерес',
            prompt_text: 'Оцените вовлеченность и уровень интереса',
            display_order: 4,
            is_active: true,
          },
          {
            id: 'care',
            name: 'Забота',
            prompt_text: 'Оцените внимание к деталям и качество',
            display_order: 5,
            is_active: true,
          },
        ])
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
      // Use default metrics as fallback
      setMetrics([
        {
          id: 'logic',
          name: 'Логика',
          prompt_text: 'Оцените логическую структуру и аргументацию',
          display_order: 1,
          is_active: true,
        },
        {
          id: 'practical',
          name: 'Польза',
          prompt_text: 'Оцените практическую применимость',
          display_order: 2,
          is_active: true,
        },
        {
          id: 'complexity',
          name: 'Сложность',
          prompt_text: 'Оцените глубину и сложность содержания',
          display_order: 3,
          is_active: true,
        },
        {
          id: 'interest',
          name: 'Интерес',
          prompt_text: 'Оцените вовлеченность и уровень интереса',
          display_order: 4,
          is_active: true,
        },
        {
          id: 'care',
          name: 'Забота',
          prompt_text: 'Оцените внимание к деталям и качество',
          display_order: 5,
          is_active: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadStudentCharacter = async () => {
    setCharacterLoading(true)
    try {
      const response = await fetch('/api/profile/character')
      if (!response.ok) {
        throw new Error('Failed to load student character')
      }

      const data = await response.json()
      const normalized = normalizeStudentCharacter(data.studentCharacter)
      setStudentCharacter(normalized)
      setInitialStudentCharacter(normalized)
    } catch (error) {
      console.error('Error loading student character:', error)
      setStudentCharacter(DEFAULT_STUDENT_CHARACTER)
      setInitialStudentCharacter(DEFAULT_STUDENT_CHARACTER)
      if (user) {
        toast.error('Не удалось загрузить характер Лёхи')
      }
    } finally {
      setCharacterLoading(false)
    }
  }

  const handleReorder = async (updatedMetrics: MetricConfig[]) => {
    // Check if user is authenticated
    if (!user) {
      toast.error('Войдите в систему, чтобы изменять порядок метрик')
      return
    }

    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(updatedMetrics)

    try {
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
      toast.success('Metrics reordered successfully')
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error reordering metrics:', error)
      toast.error('Failed to reorder metrics')
    }
  }

  const handleAddMetric = async (metric: Omit<MetricConfig, 'id'>) => {
    // Check if user is authenticated
    if (!user) {
      toast.error('Войдите в систему, чтобы добавлять метрики')
      return
    }

    try {
      const response = await fetch('/api/configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add metric')
      }

      const data = await response.json()
      setMetrics([...metrics, data.configuration])
      setShowAddForm(false)
      toast.success('Metric added successfully')
    } catch (error) {
      console.error('Error adding metric:', error)
      toast.error(error.message || 'Failed to add metric')
    }
  }

  const handleUpdateMetric = async (id: string, updates: Partial<MetricConfig>) => {
    // Check if user is authenticated
    if (!user) {
      toast.error('Войдите в систему, чтобы редактировать метрики')
      return
    }

    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(metrics.map((m) => (m.id === id ? { ...m, ...updates } : m)))

    try {
      const response = await fetch(`/api/configuration/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update metric')
      toast.success('Metric updated successfully')
    } catch (error) {
      // Rollback on error
      setMetrics(previousMetrics)
      console.error('Error updating metric:', error)
      toast.error('Failed to update metric')
    }
  }

  const handleDeleteMetric = async (id: string, _hard: boolean) => {
    // Check if user is authenticated
    if (!user) {
      toast.error('Войдите в систему, чтобы удалять метрики')
      return
    }

    // Optimistic update
    const previousMetrics = [...metrics]
    setMetrics(metrics.filter((m) => m.id !== id))

    try {
      const response = await fetch(`/api/configuration/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete metric')
      toast.success('Метрика успешно удалена')
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
      const response = await fetch('/api/configuration/reset', {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to reset metrics')
      const data = await response.json()
      setMetrics(data.configurations || [])
      toast.success('Metrics reset to defaults')
    } catch (error) {
      console.error('Error resetting metrics:', error)
      toast.error('Failed to reset metrics')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveStudentCharacter = async () => {
    if (!user) {
      toast.error('Войдите в систему, чтобы сохранить характер Лёхи')
      return
    }

    if (trimmedCurrentCharacter.length < 5) {
      toast.error('Добавьте чуть больше деталей о характере Лёхи')
      return
    }

    setCharacterSaving(true)
    try {
      const response = await fetch('/api/profile/character', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCharacter: trimmedCurrentCharacter }),
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Не удалось сохранить характер' }))
        throw new Error(error.error || 'Не удалось сохранить характер')
      }

      const data = await response.json()
      const normalized = normalizeStudentCharacter(data.studentCharacter)
      setStudentCharacter(normalized)
      setInitialStudentCharacter(normalized)
      toast.success('Характер Лёхи обновлён')
    } catch (error) {
      console.error('Error updating student character:', error)
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить характер')
    } finally {
      setCharacterSaving(false)
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

      const personaForRequest = normalizeStudentCharacter(studentCharacter)

      const { analysisId } = await apiService.analyze({
        content: content.trim(),
        modelId: selectedModel,
        metricMode: 'custom',
        studentCharacter: personaForRequest,
      })

      // Poll for results
      let pollCount = 0
      const activeMetrics = metrics.filter((m) => m.is_active)
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
            <Toaster position="top-right" />
            {renderStudentCharacterEditor()}
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

          {/* Student Character Editor */}
          {renderStudentCharacterEditor()}

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
          {user ? (
            <div
              className="bg-white border border-gray-200 p-6 mb-6"
              style={{ borderRadius: '20px' }}
            >
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[20px] font-semibold text-black">Ваши метрики</h2>
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
          ) : (
            <div className="bg-[#F5F5F5] p-6 mb-6" style={{ borderRadius: '20px' }}>
              <p className="text-center text-gray-600">
                Войдите в систему, чтобы настроить собственные метрики
              </p>
            </div>
          )}

          {/* Content Analysis Section - label placed just above textarea */}
          <div className="mb-6">
            <label
              className="block text-[15px] font-normal text-gray-500 mb-1"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Контент
            </label>
            {/* Prompt link moved above; nothing here */}
            {/* Single prompt trigger kept above (underlined link). Removed duplicate button. */}

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
            />
          )}
        </div>
      </div>
    </div>
  )
}
