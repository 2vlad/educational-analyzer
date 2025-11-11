'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { CloudUpload, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMetricMode } from '@/src/providers/MetricModeProvider'
import ScoreSpeedometer from '@/components/ScoreSpeedometer'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  apiService,
  type AnalysisResult as ApiAnalysisResult,
  type Model,
} from '@/src/services/api'
import { SimpleLoader } from '@/components/SimpleLoader'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileUploadDropzone } from '@/components/ui/file-upload-dropzone'

// Metric name mapping
const METRIC_NAMES: Record<string, string> = {
  logic: 'Логика',
  practical: 'Польза',
  complexity: 'Сложность',
  interest: 'Интерес',
  care: 'Забота',
  cognitive_load: 'Когнитивная нагрузка',
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Speedometer = ({ score }: { score: number | undefined | null }) => {
  // Handle undefined/null/NaN cases
  if (score === undefined || score === null || isNaN(score)) {
    // Return a placeholder/loading state
    return (
      <div className="w-12 h-10 flex items-center justify-center">
        <svg width="50" height="50" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          {/* Background arc only */}
          <path
            d="M 15 73 A 40 40 0 1 1 85 73"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Loading text */}
          <text
            x="50"
            y="55"
            fontFamily="Inter, sans-serif"
            fontSize="16"
            fill="#9ca3af"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ...
          </text>
        </svg>
      </div>
    )
  }

  // Clamp score between -2 and 2
  const normalizedScore = Math.round(Math.max(-2, Math.min(2, score)))

  // Get color and dash offset based on score
  const getColorAndOffset = (score: number) => {
    switch (score) {
      case -2:
        return { color: '#ef4444', offset: 188.5 } // red, no progress
      case -1:
        return { color: '#FF9F0A', offset: 141.4 } // orange-yellow
      case 0:
        return { color: '#FFD60A', offset: 94.25 } // yellow
      case 1:
        return { color: '#A2D729', offset: 47.1 } // lime green
      case 2:
        return { color: '#30D158', offset: 11.8 } // green
      default:
        return { color: '#cccccc', offset: 188.5 }
    }
  }

  const { color, offset } = getColorAndOffset(normalizedScore)

  return (
    <div className="w-12 h-10 flex items-center justify-center">
      <svg width="50" height="50" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* Background arc */}
        <path
          d="M 15 73 A 40 40 0 1 1 85 73"
          fill="none"
          stroke="#cccccc"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d="M 15 73 A 40 40 0 1 1 85 73"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="188.5"
          strokeDashoffset={offset}
        />

        {/* Score text */}
        <text
          x="50"
          y="55"
          fontFamily="Inter, sans-serif"
          fontSize="28"
          fontWeight="bold"
          fill={color}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {normalizedScore > 0 ? '+' : ''}
          {normalizedScore}
        </text>
      </svg>
    </div>
  )
}

export default function EducationalAnalyzer() {
  const { metricMode } = useMetricMode()
  const [analysisMode, setAnalysisMode] = useState<'single' | 'batch'>('single')
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'loading' | 'results'>('upload')
  const [content, setContent] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ApiAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [maxFileSizeMB, setMaxFileSizeMB] = useState<number>(10)
  const [maxTextLength, setMaxTextLength] = useState<number>(20000)
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
  const [coherenceAnalysis, setCoherenceAnalysis] = useState<{
    score: number
    summary: string
    strengths: string[]
    issues: string[]
    suggestions: string[]
  } | null>(null)
  const [coherenceLoading, setCoherenceLoading] = useState(false)
  // Prompt viewer state
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [allPrompts, setAllPrompts] = useState<Array<{ metric: string; prompt: string }>>([])

  // Load available models and config on mount
  useEffect(() => {
    loadModels()
    fetchConfig()
  }, [])

  // Analyze coherence when batch results are all completed
  useEffect(() => {
    const analyzeCoherence = async () => {
      // Only analyze if we have batch results and they're all completed
      if (
        batchResults.length < 2 ||
        coherenceLoading ||
        coherenceAnalysis ||
        currentScreen !== 'results'
      ) {
        return
      }

      const completedResults = batchResults.filter((r) => r.status === 'completed' && r.result)
      if (completedResults.length < 2 || completedResults.length !== batchResults.length) {
        return
      }

      try {
        setCoherenceLoading(true)

        // Prepare lessons data for coherence analysis
        const lessons = completedResults.map((batch) => ({
          title:
            batch.result?.results?.lessonTitle?.comment ||
            batch.fileName.replace(/\.(txt|md)$/i, ''),
          content: batchFiles.find((f) => f.file.name === batch.fileName)?.content || '',
        }))

        // Call coherence analysis API
        const response = await fetch('/api/analyze-coherence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessons,
            modelId: selectedModel,
          }),
        })

        if (!response.ok) {
          throw new Error('Coherence analysis failed')
        }

        const data = await response.json()
        setCoherenceAnalysis(data.analysis)
      } catch (error) {
        console.error('Failed to analyze coherence:', error)
        // Silently fail - coherence is optional
      } finally {
        setCoherenceLoading(false)
      }
    }

    analyzeCoherence()
  }, [batchResults, currentScreen, coherenceLoading, coherenceAnalysis, batchFiles, selectedModel])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config')
      if (response.ok) {
        const config = await response.json()
        setMaxFileSizeMB(config.maxFileSizeMB)
        setMaxTextLength(config.maxTextLength)
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    }
  }

  const loadAllPrompts = async (metricIds: string[]) => {
    try {
      setPromptsLoading(true)
      setPromptError(null)
      const modelId = analysisResult?.model_used || selectedModel || 'yandex-gpt-pro'
      const results: Array<{ metric: string; prompt: string }> = []
      await Promise.all(
        metricIds.map(async (metric) => {
          try {
            const res = await fetch(
              `/api/prompt?metric=${encodeURIComponent(metric)}&model=${encodeURIComponent(modelId)}`,
            )
            if (res.ok) {
              const data = await res.json()
              results.push({ metric, prompt: data.prompt || '' })
            } else {
              throw new Error('not found')
            }
          } catch {
            results.push({ metric, prompt: 'Промпт не найден' })
          }
        }),
      )
      setAllPrompts(results)
    } catch (e: unknown) {
      setPromptError(e instanceof Error ? e.message : 'Ошибка загрузки промптов')
    } finally {
      setPromptsLoading(false)
    }
  }

  const loadModels = async () => {
    try {
      console.log('[DEBUG] Starting to load models...')
      const response = await apiService.getModels()
      console.log('[DEBUG] Models response:', response)
      console.log(
        '[DEBUG] Available models:',
        response.models.filter((m) => m.available),
      )
      console.log('[DEBUG] Default model:', response.defaultModel)

      const availableModels = response.models.filter((m) => m.available)
      console.log('[DEBUG] Setting models state with', availableModels.length, 'models')
      setModels(availableModels)
      setSelectedModel(response.defaultModel)
      console.log('[DEBUG] Models loaded successfully!')
    } catch (error) {
      console.error('[DEBUG] Failed to load models:', error)
      // Continue with default model
      // Set a fallback model if API fails
      setSelectedModel('claude-haiku')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size
      const maxSizeBytes = maxFileSizeMB * 1024 * 1024
      if (file.size > maxSizeBytes) {
        setError(`Размер файла должен быть менее ${maxFileSizeMB}МБ`)
        return
      }

      // Handle PDF files
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setError(null)
        setProgressMessage('Извлекаем текст из PDF...')

        try {
          const formData = new globalThis.FormData()
          formData.append('file', file)

          const response = await fetch('/api/parse-pdf', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json()
            setError(error.error || 'Failed to parse PDF')
            setProgressMessage('')
            return
          }

          const result = await response.json()
          setContent(result.text)
          setProgressMessage('')

          if (result.truncated) {
            setError(
              `PDF содержит ${result.pages} страниц. Текст обрезан до ${maxTextLength} символов`,
            )
          } else {
            setError(null)
          }
        } catch (error) {
          console.error('PDF parsing error:', error)
          setError('Failed to parse PDF file')
          setProgressMessage('')
        }
      } else {
        // Handle text files (.txt, .md)
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          // Check text length
          if (text.length > maxTextLength) {
            setContent(text.substring(0, maxTextLength))
            setError(`Содержимое обрезано до ${maxTextLength} символов`)
          } else {
            setContent(text)
            setError(null)
          }
        }
        reader.readAsText(file)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      // Check file size
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }

      // Handle PDF files
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setError(null)
        setProgressMessage('Извлекаем текст из PDF...')

        try {
          const formData = new globalThis.FormData()
          formData.append('file', file)

          const response = await fetch('/api/parse-pdf', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json()
            setError(error.error || 'Failed to parse PDF')
            setProgressMessage('')
            return
          }

          const result = await response.json()
          setContent(result.text)
          setProgressMessage('')

          if (result.truncated) {
            setError(
              `PDF содержит ${result.pages} страниц. Текст обрезан до ${maxTextLength} символов`,
            )
          } else {
            setError(null)
          }
        } catch (error) {
          console.error('PDF parsing error:', error)
          setError('Failed to parse PDF file')
          setProgressMessage('')
        }
      } else {
        // Handle text files
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          if (text.length > 20000) {
            setContent(text.substring(0, 20000))
            setError('Content truncated to 20000 characters')
          } else {
            setContent(text)
            setError(null)
          }
        }
        reader.readAsText(file)
      }
    }
  }

  // Poll for batch analysis results
  const pollBatchResults = async (
    analyses: Array<{ fileName: string; analysisId: string; status: string }>,
  ) => {
    const maxPolls = 60 // 3 minutes maximum
    let pollCount = 0

    const checkResults = async () => {
      const updatedResults = await Promise.all(
        analyses.map(async (analysis) => {
          try {
            const result = await apiService.getAnalysis(analysis.analysisId)

            if (result.status === 'completed') {
              return {
                ...analysis,
                result,
                status: 'completed' as const,
              }
            } else if (result.status === 'failed') {
              return {
                ...analysis,
                status: 'error' as const,
                error: 'Анализ не удался',
              }
            } else {
              return {
                ...analysis,
                status: 'loading' as const,
              }
            }
          } catch {
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

      if (allCompleted) {
        setCurrentScreen('results')
        setProgressMessage('')
        return
      }

      pollCount++
      if (pollCount < maxPolls) {
        window.setTimeout(checkResults, 3000)
      } else {
        setError('Превышено время ожидания результатов')
        setCurrentScreen('upload')
      }
    }

    checkResults()
  }

  const handleAnalyze = async () => {
    if (!content.trim()) return

    // Check if content is too short
    if (content.trim().length < 100) {
      setError('Content must be at least 100 characters of educational material')
      return
    }

    // Check if content has enough words
    const words = content.split(/\s+/).filter((word) => word.length > 2)
    if (words.length < 20) {
      setError('Please provide substantial educational content (at least 20 words)')
      return
    }

    // Check if it's just a URL or random text
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
    if (urlPattern.test(content.trim())) {
      setError('URLs cannot be analyzed. Please provide educational content.')
      return
    }

    // Validate model ID - prevent invalid IDs from being sent
    const validModelIds = [
      'claude-haiku',
      'claude-sonnet-4',
      'gpt-4o',
      'gemini-pro',
      'yandex-gpt-pro',
    ]
    let modelToUse = selectedModel

    if (selectedModel && !validModelIds.includes(selectedModel)) {
      console.warn('Invalid model ID detected:', selectedModel)
      console.log('Falling back to default model')
      modelToUse = 'claude-haiku'
    }

    setIsAnalyzing(true)
    setError(null)
    setCurrentScreen('loading')
    setProgressMessage('Отправка на анализ...')

    try {
      // Start analysis
      console.log('====== STARTING ANALYSIS ======')
      console.log('Model:', modelToUse)
      console.log('Content length:', content.length)
      console.log('First 100 chars:', content.substring(0, 100))

      console.log('Calling apiService.analyze...')
      console.log('Using metric mode:', metricMode)
      const { analysisId } = await apiService.analyze({
        content: content.trim(),
        modelId: modelToUse || undefined,
        metricMode: metricMode,
      })
      console.log('✅ Analysis started successfully!')
      console.log('Analysis ID:', analysisId)
      console.log('================================')

      // Simple progress simulation and polling
      let completed = 0
      const metrics = ['logic', 'practical', 'complexity', 'interest', 'care', 'cognitive_load']

      // Set progress messages
      const progressMessages = [
        'Анализ логики...',
        'Оценка практичности...',
        'Проверка сложности...',
        'Анализ интереса...',
        'Оценка качества...',
        'Оценка когнитивной нагрузки...',
      ]

      // Update progress to 15% after initial delay
      window.setTimeout(() => {
        setProgressMessage(progressMessages[0])
      }, 1000)

      // Poll for results
      let pollCount = 0
      const checkInterval = window.setInterval(async () => {
        pollCount++
        console.log(`[POLL ${pollCount}] Checking analysis status for ID: ${analysisId}`)

        try {
          const result = await apiService.getAnalysis(analysisId)
          console.log(`[POLL ${pollCount}] Result status:`, result.status)
          console.log(`[POLL ${pollCount}] Metrics:`, result.metrics)

          // Count completed metrics
          const completedNow = metrics.filter((m) => {
            const hasScore = result.results && result.results[m]?.score !== undefined
            console.log(`[POLL ${pollCount}] Metric ${m}: score exists = ${hasScore}`)
            return hasScore
          }).length

          console.log(`[POLL ${pollCount}] Completed metrics: ${completedNow}/${metrics.length}`)

          if (completedNow > completed) {
            completed = completedNow
            const newProgress = 15 + completed * 16 // Spread progress evenly
            console.log(`[POLL ${pollCount}] Updating progress to ${newProgress}%`)

            if (completed < metrics.length) {
              const nextMessage = progressMessages[completed] || 'Обработка...'
              console.log(`[POLL ${pollCount}] Setting message: ${nextMessage}`)
              setProgressMessage(nextMessage)
            }
          }

          // Check if complete
          if (result.status === 'completed' || completed === metrics.length) {
            console.log(`[POLL ${pollCount}] Analysis complete! Status: ${result.status}`)
            window.clearInterval(checkInterval)
            setProgressMessage('Готово!')
            setAnalysisResult(result)

            window.setTimeout(() => {
              setCurrentScreen('results')
              setIsAnalyzing(false)
            }, 500)
          } else if (result.status === 'failed') {
            console.error(`[POLL ${pollCount}] Analysis failed!`)
            window.clearInterval(checkInterval)
            setError('Анализ не удался. Пожалуйста, проверьте настройки API.')
            setCurrentScreen('upload')
            setIsAnalyzing(false)
          }
        } catch (error) {
          console.error(`[POLL ${pollCount}] Failed to check status:`, error)
          // Don't stop polling on error - might be temporary network issue
          if (pollCount > 30) {
            // Stop after 90 seconds
            console.error(`[POLL ${pollCount}] Giving up after 30 attempts`)
            window.clearInterval(checkInterval)
            setError('Analysis timeout. Please try again.')
            setCurrentScreen('upload')
            setIsAnalyzing(false)
          }
        }
      }, 3000) // Check every 3 seconds
    } catch (error) {
      console.error('Analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
      setCurrentScreen('upload')
      setIsAnalyzing(false)
    }
  }

  if (currentScreen === 'loading') {
    return <SimpleLoader message={progressMessage} />
  }

  // Batch results screen
  if (currentScreen === 'results' && batchResults.length > 0) {
    // Calculate overall statistics
    const completedResults = batchResults.filter((r) => r.status === 'completed' && r.result)
    const totalLessons = batchResults.length
    const completedLessons = completedResults.length

    let totalScore = 0
    let totalMaxScore = 0
    const allMetricScores: Record<string, number[]> = {}

    completedResults.forEach((batch) => {
      if (!batch.result?.results) return

      let lessonScore = 0
      let lessonMetricCount = 0

      Object.entries(batch.result.results).forEach(([key, data]) => {
        if (data && typeof data === 'object' && 'score' in data && key !== 'lessonTitle') {
          lessonScore += data.score || 0
          lessonMetricCount++

          if (!allMetricScores[key]) {
            allMetricScores[key] = []
          }
          allMetricScores[key].push(data.score || 0)
        }
      })

      const lessonMaxScore = lessonMetricCount * 5
      const lessonAdjustedScore = lessonScore + lessonMetricCount * 2

      totalScore += lessonAdjustedScore
      totalMaxScore += lessonMaxScore
    })

    const averagePercentage =
      totalMaxScore > 0 ? ((totalScore + totalMaxScore) / (totalMaxScore * 2)) * 100 : 0

    return (
      <div className="min-h-screen bg-white dark:bg-[#1a1d2e] flex flex-col transition-colors">
        <UnifiedHeader />
        <div className="flex-1 p-6">
          <div className="max-w-[660px] mx-auto">
            {/* Overall Batch Statistics */}
            <div
              className="mb-8 p-8"
              style={{
                borderRadius: '40px',
                backgroundColor: (() => {
                  if (averagePercentage < 40) return '#FFE5E5'
                  if (averagePercentage < 70) return '#FFF9E5'
                  return '#E5FFE5'
                })(),
              }}
            >
              <h2
                className="text-[32px] font-bold text-black mb-4"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Результаты анализа: {completedLessons} из {totalLessons} уроков
              </h2>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-[48px] font-bold text-black">
                    {Math.round(averagePercentage)}%
                  </div>
                  <div className="text-[14px] text-gray-700">Средний результат</div>
                </div>

                <div className="text-center">
                  <div className="text-[48px] font-bold text-black">{completedLessons}</div>
                  <div className="text-[14px] text-gray-700">Уроков проанализировано</div>
                </div>

                <div className="text-center">
                  <div className="text-[48px] font-bold text-black">
                    {Object.keys(allMetricScores).length}
                  </div>
                  <div className="text-[14px] text-gray-700">Метрик оценено</div>
                </div>
              </div>
            </div>

            {/* Coherence Analysis */}
            {coherenceLoading && (
              <div
                className="mb-8 p-8 bg-gray-50"
                style={{
                  borderRadius: '40px',
                }}
              >
                <div className="flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin mr-3 text-gray-600" />
                  <p className="text-gray-600">Анализируем связность уроков...</p>
                </div>
              </div>
            )}

            {coherenceAnalysis && (
              <div
                className="mb-8 p-8"
                style={{
                  borderRadius: '40px',
                  backgroundColor: (() => {
                    const score = coherenceAnalysis.score
                    if (score <= -1) return '#FFE5E5'
                    if (score === 0) return '#FFF9E5'
                    return '#E5FFE5'
                  })(),
                }}
              >
                <div className="flex items-center mb-4">
                  <h3
                    className="text-[24px] font-bold text-black mr-4"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Связность уроков
                  </h3>
                  <ScoreSpeedometer score={coherenceAnalysis.score + 2} maxScore={4} />
                </div>

                <p className="text-[16px] text-gray-800 mb-6">{coherenceAnalysis.summary}</p>

                {coherenceAnalysis.strengths.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-[16px] font-semibold text-green-800 mb-2">
                      ✅ Сильные стороны:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {coherenceAnalysis.strengths.map((strength, i) => (
                        <li key={i} className="text-[14px] text-gray-700">
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {coherenceAnalysis.issues.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-[16px] font-semibold text-red-800 mb-2">⚠️ Проблемы:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {coherenceAnalysis.issues.map((issue, i) => (
                        <li key={i} className="text-[14px] text-gray-700">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {coherenceAnalysis.suggestions.length > 0 && (
                  <div>
                    <h4 className="text-[16px] font-semibold text-blue-800 mb-2">
                      💡 Рекомендации:
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {coherenceAnalysis.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-[14px] text-gray-700">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Individual Lesson Results */}
            <div className="space-y-8">
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
                  return METRIC_NAMES[metricName] || metricName
                }

                return (
                  <div key={batch.analysisId} className="space-y-6">
                    {/* Lesson Title */}
                    <h2
                      className="text-[28px] font-bold text-black"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {batchIndex + 1}. {batch.fileName}
                    </h2>

                    {/* Metrics Grid */}
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
                            className="bg-[#F5F5F5] dark:bg-gray-800 p-6 flex flex-col"
                            style={{ minWidth: '320px', minHeight: '320px', borderRadius: '40px' }}
                          >
                            <div
                              className="flex justify-between items-start"
                              style={{ marginTop: '20px', marginBottom: '8px' }}
                            >
                              <h3
                                className="text-black dark:text-white"
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
                                className="text-black dark:text-white"
                              >
                                {data.score > 0 ? '+' : ''}
                                {data.score || 0}
                              </div>
                            </div>
                            <div className="flex-grow" />
                            <div className="space-y-3">
                              <p
                                className="text-[15px] text-black dark:text-gray-200"
                                style={{ lineHeight: '120%' }}
                              >
                                {getShortComment(data.comment)}
                              </p>
                              {(('suggestions' in data &&
                                Array.isArray(data.suggestions) &&
                                data.suggestions.length > 0) ||
                                ('recommendations' in data &&
                                  typeof data.recommendations === 'string')) && (
                                <div>
                                  <p className="text-[12px] font-medium text-black/60 dark:text-gray-400 mb-1">
                                    Что поправить:
                                  </p>
                                  <p
                                    className="text-[13px] text-black/80 dark:text-gray-300"
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
                setCurrentScreen('upload')
                setContent('')
                setBatchResults([])
                setBatchFiles([])
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

  if (currentScreen === 'results' && analysisResult) {
    // Calculate overall score and count metrics
    let overallScore = 0
    let metricCount = 0

    if (analysisResult.results) {
      Object.entries(analysisResult.results).forEach(([key, data]) => {
        // Skip non-metric fields like lessonTitle
        if (data && typeof data === 'object' && 'score' in data && key !== 'lessonTitle') {
          overallScore += data.score || 0
          metricCount++
        }
      })
    }

    // Calculate total possible score based on number of metrics
    const totalPossibleScore = metricCount * 5 // Range is -2 to +2, total spread is 5
    const adjustedScore = overallScore + metricCount * 2 // Shift from -2..+2 to 0..4 per metric

    // Get shortened comment for metric cards (max 150 chars)
    const getShortComment = (comment: string | undefined) => {
      if (!comment) return ''
      // Strictly enforce 150 character limit
      if (comment.length > 150) {
        // Try to cut at word boundary
        const truncated = comment.substring(0, 147)
        const lastSpace = truncated.lastIndexOf(' ')
        if (lastSpace > 100) {
          return truncated.substring(0, lastSpace) + '...'
        }
        return truncated + '...'
      }
      return comment
    }

    return (
      <div className="min-h-screen bg-white dark:bg-[#1a1d2e] flex flex-col transition-colors">
        <UnifiedHeader />
        <div className="flex-1 p-6">
          <div className="max-w-[660px] mx-auto">
            {/* Prompt dialog (global in results) */}
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
                      <div
                        key={metric}
                        className="border rounded-md bg-[#F5F5F5] dark:bg-gray-800 p-3"
                      >
                        <div className="text-xs font-medium text-gray-600 mb-2">
                          {METRIC_NAMES[metric] || metric}
                        </div>
                        <pre className="text-xs whitespace-pre-wrap text-black">{prompt}</pre>
                      </div>
                    ))
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setPromptOpen(false)}>
                    Закрыть
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {/* Prompt trigger on results */}
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
              </div>
            )}
            {/* Metrics Grid - 2x3 layout */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* Overall Result - Moved to first position */}
              <div
                className="p-6 flex flex-col items-center justify-center"
                style={{
                  minWidth: '320px',
                  minHeight: '320px',
                  borderRadius: '40px',
                  backgroundColor: (() => {
                    const percentage =
                      ((adjustedScore + totalPossibleScore) / (totalPossibleScore * 2)) * 100
                    if (percentage < 40) return '#FFE5E5' // Light pink
                    if (percentage < 70) return '#FFF9E5' // Light yellow
                    return '#E5FFE5' // Light green
                  })(),
                }}
              >
                <ScoreSpeedometer score={adjustedScore} maxScore={totalPossibleScore} />
              </div>

              {/* Logic */}
              <div
                className="bg-[#F5F5F5] dark:bg-gray-800 p-6 flex flex-col"
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
                    Логика
                  </h3>
                  <div
                    style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                    className="text-black"
                  >
                    {analysisResult.results?.logic?.score > 0 ? '+' : ''}
                    {analysisResult.results?.logic?.score || 0}
                  </div>
                </div>
                <div className="flex-grow" />
                <div className="space-y-3">
                  <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                    {getShortComment(analysisResult.results?.logic?.comment)}
                  </p>
                  {console.log(
                    'Logic full data:',
                    JSON.stringify(analysisResult.results?.logic, null, 2),
                  )}
                  {analysisResult.results?.logic?.suggestions &&
                    analysisResult.results.logic.suggestions.length > 0 && (
                      <div>
                        <p className="text-[12px] font-medium text-black/60 mb-1">Что поправить:</p>
                        <p className="text-[13px] text-black/80" style={{ lineHeight: '120%' }}>
                          → {analysisResult.results.logic.suggestions[0]}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Practical */}
              <div
                className="bg-[#F5F5F5] dark:bg-gray-800 p-6 flex flex-col"
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
                    Польза
                  </h3>
                  <div
                    style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                    className="text-black"
                  >
                    {analysisResult.results?.practical?.score > 0 ? '+' : ''}
                    {analysisResult.results?.practical?.score || 0}
                  </div>
                </div>
                <div className="flex-grow" />
                <div className="space-y-3">
                  <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                    {getShortComment(analysisResult.results?.practical?.comment)}
                  </p>
                  {console.log(
                    'Practical full data:',
                    JSON.stringify(analysisResult.results?.practical, null, 2),
                  )}
                  {analysisResult.results?.practical?.suggestions &&
                    analysisResult.results.practical.suggestions.length > 0 && (
                      <div>
                        <p className="text-[12px] font-medium text-black/60 mb-1">Что поправить:</p>
                        <p className="text-[13px] text-black/80" style={{ lineHeight: '120%' }}>
                          → {analysisResult.results.practical.suggestions[0]}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Interest */}
              <div
                className="bg-[#F5F5F5] dark:bg-gray-800 p-6 flex flex-col"
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
                    Интерес
                  </h3>
                  <div
                    style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                    className="text-black"
                  >
                    {analysisResult.results?.interest?.score > 0 ? '+' : ''}
                    {analysisResult.results?.interest?.score || 0}
                  </div>
                </div>
                <div className="flex-grow" />
                <div className="space-y-3">
                  <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                    {getShortComment(analysisResult.results?.interest?.comment)}
                  </p>
                  {console.log(
                    'Interest full data:',
                    JSON.stringify(analysisResult.results?.interest, null, 2),
                  )}
                  {analysisResult.results?.interest?.suggestions &&
                    analysisResult.results.interest.suggestions.length > 0 && (
                      <div>
                        <p className="text-[12px] font-medium text-black/60 mb-1">Что поправить:</p>
                        <p className="text-[13px] text-black/80" style={{ lineHeight: '120%' }}>
                          → {analysisResult.results.interest.suggestions[0]}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Care */}
              <div
                className="bg-[#F5F5F5] dark:bg-gray-800 p-6 flex flex-col"
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
                    Забота
                  </h3>
                  <div
                    style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                    className="text-black"
                  >
                    {analysisResult.results?.care?.score > 0 ? '+' : ''}
                    {analysisResult.results?.care?.score || 0}
                  </div>
                </div>
                <div className="flex-grow" />
                <div className="space-y-3">
                  <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                    {getShortComment(analysisResult.results?.care?.comment)}
                  </p>
                  {console.log(
                    'Care full data:',
                    JSON.stringify(analysisResult.results?.care, null, 2),
                  )}
                  {analysisResult.results?.care?.suggestions &&
                    analysisResult.results.care.suggestions.length > 0 && (
                      <div>
                        <p className="text-[12px] font-medium text-black/60 mb-1">Что поправить:</p>
                        <p className="text-[13px] text-black/80" style={{ lineHeight: '120%' }}>
                          → {analysisResult.results.care.suggestions[0]}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Complexity */}
              <div
                className="bg-[#F5F5F5] dark:bg-gray-800 p-6 flex flex-col"
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
                    Сложность
                  </h3>
                  <div
                    style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                    className="text-black"
                  >
                    {analysisResult.results?.complexity?.score > 0 ? '+' : ''}
                    {analysisResult.results?.complexity?.score || 0}
                  </div>
                </div>
                <div className="flex-grow" />
                <div className="space-y-3">
                  <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                    {getShortComment(analysisResult.results?.complexity?.comment)}
                  </p>
                  {console.log(
                    'Complexity full data:',
                    JSON.stringify(analysisResult.results?.complexity, null, 2),
                  )}
                  {analysisResult.results?.complexity?.suggestions &&
                    analysisResult.results.complexity.suggestions.length > 0 && (
                      <div>
                        <p className="text-[12px] font-medium text-black/60 mb-1">Что поправить:</p>
                        <p className="text-[13px] text-black/80" style={{ lineHeight: '120%' }}>
                          → {analysisResult.results.complexity.suggestions[0]}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Cognitive Load */}
              {analysisResult.results?.cognitive_load && (
                <div
                  className="bg-[#F5F5F5] dark:bg-gray-800 p-6 flex flex-col"
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
                      Когнитивная нагрузка
                    </h3>
                    <div
                      style={{ fontWeight: 400, fontSize: '50px', marginTop: '-30px' }}
                      className="text-black"
                    >
                      {analysisResult.results?.cognitive_load?.score > 0 ? '+' : ''}
                      {analysisResult.results?.cognitive_load?.score || 0}
                    </div>
                  </div>
                  <div className="flex-grow" />
                  <div className="space-y-3">
                    <p className="text-[15px] text-black" style={{ lineHeight: '120%' }}>
                      {getShortComment(analysisResult.results?.cognitive_load?.comment)}
                    </p>
                    {analysisResult.results?.cognitive_load &&
                      typeof analysisResult.results.cognitive_load === 'object' &&
                      'suggestions' in analysisResult.results.cognitive_load &&
                      Array.isArray(analysisResult.results.cognitive_load.suggestions) &&
                      analysisResult.results.cognitive_load.suggestions.length > 0 && (
                        <div>
                          <p className="text-[12px] font-medium text-black/60 mb-1">
                            Что поправить:
                          </p>
                          <p className="text-[13px] text-black/80" style={{ lineHeight: '120%' }}>
                            → {analysisResult.results.cognitive_load.suggestions[0]}
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Win Section */}
            <div
              className="bg-[#F5F5F5] dark:bg-gray-800 p-6 mb-8"
              style={{ width: '660px', borderRadius: '40px' }}
            >
              <h2 className="text-[20px] font-semibold text-black dark:text-white mb-3">
                Quick Win
              </h2>
              <p className="text-[14px] text-black dark:text-white leading-relaxed">
                {overallScore > 0
                  ? `Контент набрал ${overallScore > 0 ? '+' : ''}${overallScore} баллов. Материал хорошо структурирован и будет полезен для изучения.`
                  : overallScore < 0
                    ? `Контент набрал ${overallScore} баллов. Материал требует доработки для лучшего восприятия студентами.`
                    : 'Контент набрал 0 баллов. Материал имеет сбалансированные характеристики.'}
              </p>
            </div>

            {/* Detailed Analysis Sections */}
            <div className="space-y-8" style={{ width: '660px' }}>
              {analysisResult.results &&
                Object.entries(analysisResult.results).map(([metric, data]: [string, unknown]) => {
                  // Skip lessonTitle as it's not a metric
                  if (!data || data.error || metric === 'lessonTitle') return null

                  return (
                    <div key={metric} className="bg-white rounded-lg">
                      <div className="flex items-start gap-4 mb-4">
                        <h3 className="text-[24px] font-bold text-black">
                          {METRIC_NAMES[metric] || metric} ({data.score > 0 ? '+' : ''}
                          {data.score})
                        </h3>
                      </div>

                      {/* Analysis Text */}
                      {data.detailed_analysis && (
                        <div
                          className="bg-[#F5F5F5] dark:bg-gray-800 p-6 mb-4"
                          style={{ borderRadius: '40px' }}
                        >
                          <h4 className="text-[16px] font-semibold text-black dark:text-white mb-3">
                            Анализ
                          </h4>
                          {typeof data.detailed_analysis === 'string' ? (
                            <p className="text-[14px] text-black dark:text-white leading-relaxed">
                              {data.detailed_analysis}
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {Object.entries(data.detailed_analysis).map(([key, value]) => (
                                <div key={key}>
                                  <h5 className="text-[14px] font-medium text-black mb-1">
                                    {key}:
                                  </h5>
                                  <p className="text-[14px] text-black dark:text-white ml-4">
                                    {value}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Examples */}
                      {data.examples && data.examples.length > 0 && (
                        <div
                          className="bg-[#F5F5F5] dark:bg-gray-800 p-6 mb-4"
                          style={{ borderRadius: '40px' }}
                        >
                          <h4 className="text-[16px] font-semibold text-black dark:text-white mb-3">
                            Примеры из текста
                          </h4>
                          <ul className="space-y-3">
                            {data.examples.map((example: string, index: number) => (
                              <li key={index} className="flex items-start">
                                <span className="text-black mr-2">•</span>
                                <span className="text-[14px] text-black dark:text-white italic">
                                  "{example}"
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Suggestions - What to fix */}
                      {((data.suggestions && data.suggestions.length > 0) ||
                        data.recommendations) && (
                        <div
                          className="bg-[#F5F5F5] dark:bg-gray-800 p-6"
                          style={{ borderRadius: '40px' }}
                        >
                          <h4 className="text-[16px] font-semibold text-black dark:text-white mb-3">
                            Что поправить
                          </h4>
                          <ul className="space-y-3">
                            {data.suggestions
                              ? data.suggestions.map((suggestion: string, index: number) => (
                                  <li key={index} className="flex items-start">
                                    <span className="text-black mr-2">→</span>
                                    <span className="text-[14px] text-black dark:text-white">
                                      {suggestion}
                                    </span>
                                  </li>
                                ))
                              : data.recommendations
                                  ?.split(/\d+\)/)
                                  .filter(Boolean)
                                  .map((rec: string, index: number) => (
                                    <li key={index} className="flex items-start">
                                      <span className="text-black mr-2">→</span>
                                      <span className="text-[14px] text-black dark:text-white">
                                        {rec.trim()}
                                      </span>
                                    </li>
                                  ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* Return Button */}
            <div className="mt-12 text-center">
              <Button
                onClick={() => {
                  setCurrentScreen('upload')
                  setContent('')
                  setAnalysisResult(null)
                  setError(null)
                  setProgressMessage('')
                }}
                className="px-8 py-3 bg-black text-white hover:bg-gray-800 transition-colors rounded-lg"
              >
                Новый анализ
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Upload screen - New design based on Figma
  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1d2e] flex flex-col transition-colors">
      {/* Unified Header with Toggle */}
      <UnifiedHeader />

      <div className="flex-1 flex justify-center p-6">
        <div className="w-full max-w-[900px] mt-[50px]">
          <div className="w-full max-w-[660px] mx-auto">
            {/* Header with title, subtitle and image */}
            <div className="flex justify-between mb-10">
              <div>
                <h1
                  className="text-[48px] font-bold text-black dark:text-white mb-3 leading-tight transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Лёха AI
                </h1>
                <p
                  className="text-[20px] font-normal text-black dark:text-gray-300 transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif', lineHeight: '120%' }}
                >
                  оценивает качество
                  <br />
                  контента на основе
                  <br />
                  lx-метрик
                </p>
              </div>

              {/* Image positioned to the right */}
              <div className="flex items-center">
                <Image
                  src="/lekha-illustration.png"
                  alt="Лёха AI - Educational Content Analyzer"
                  width={120}
                  height={150}
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Form section */}
            <div>
              {/* Model Section */}
              <div className="mb-6">
                <label
                  className="block text-[15px] font-normal text-gray-500 dark:text-gray-400 mb-3 transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Модель
                </label>
                {models.length > 0 ? (
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    onOpenChange={setIsDropdownOpen}
                  >
                    <SelectTrigger className="relative w-full !h-14 !px-6 !pr-14 text-[20px] font-light text-black bg-white dark:bg-white hover:bg-gray-50 dark:hover:bg-gray-50 transition-colors rounded-[50px] border border-gray-200 dark:border-gray-200 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                      <SelectValue placeholder="Выберите модель" />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronRight
                          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-90' : ''}`}
                        />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white text-black rounded-2xl border-gray-200">
                      {models.map((model) => (
                        <SelectItem
                          key={model.id}
                          value={model.id}
                          className="text-[20px] text-black py-2"
                        >
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="w-full h-14 px-6 flex items-center text-[20px] font-light text-black bg-[#F2F2F2] rounded-[50px]">
                    Loading models...
                  </div>
                )}
              </div>

              {/* Mode Toggle */}
              <div className="mb-6">
                <label
                  className="block text-[15px] font-normal text-gray-500 dark:text-gray-400 mb-3 transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Режим анализа
                </label>
                <Tabs
                  value={analysisMode}
                  onValueChange={(v) => setAnalysisMode(v as 'single' | 'batch')}
                >
                  <TabsList className="grid w-full grid-cols-2 !h-14 bg-[#F2F2F2] dark:bg-gray-800 rounded-[50px] p-[3px] transition-colors">
                    <TabsTrigger
                      value="single"
                      className="text-[20px] font-light h-full rounded-[46px] text-gray-400 dark:text-gray-500 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white border-0 shadow-none transition-colors cursor-pointer"
                    >
                      Один урок
                    </TabsTrigger>
                    <TabsTrigger
                      value="batch"
                      className="text-[20px] font-light h-full rounded-[46px] text-gray-400 dark:text-gray-500 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white border-0 shadow-none transition-colors cursor-pointer"
                    >
                      Много уроков
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Prompt trigger on upload screen */}
              <div className="flex justify-end -mt-2 mb-4">
                <button
                  className="text-sm text-gray-500 underline underline-offset-2 decoration-gray-300 hover:text-gray-700 hover:decoration-gray-400"
                  onClick={() => {
                    const metricIds = Object.keys(METRIC_NAMES)
                    loadAllPrompts(metricIds)
                    setPromptOpen(true)
                  }}
                >
                  Посмотреть промпт
                </button>
              </div>

              {/* Prompt dialog on upload screen */}
              {currentScreen === 'upload' && (
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
                          <div
                            key={metric}
                            className="border rounded-md bg-[#F5F5F5] dark:bg-gray-800 p-3"
                          >
                            <div className="text-xs font-medium text-gray-600 mb-2">
                              {METRIC_NAMES[metric] || metric}
                            </div>
                            <pre className="text-xs whitespace-pre-wrap text-black">{prompt}</pre>
                          </div>
                        ))
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setPromptOpen(false)}>
                        Закрыть
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* Content Section */}
              <div className="mb-6 mt-[40px]">
                <label
                  className="block text-[15px] font-normal text-gray-500 dark:text-gray-400 mb-3 transition-colors"
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

                            try {
                              const results = []
                              for (const file of filesToAnalyze) {
                                try {
                                  const { analysisId } = await apiService.analyze({
                                    content: file.content!,
                                    modelId: selectedModel,
                                    metricMode,
                                  })
                                  results.push({
                                    fileName: file.file.name,
                                    analysisId,
                                    status: 'started',
                                  })
                                } catch (fileErr) {
                                  results.push({
                                    fileName: file.file.name,
                                    error:
                                      fileErr instanceof Error ? fileErr.message : 'Ошибка анализа',
                                    status: 'error',
                                  })
                                }
                              }

                              const successCount = results.filter(
                                (r) => r.status === 'started',
                              ).length

                              if (successCount > 0) {
                                // Store results and start polling
                                const batchData = results
                                  .filter((r) => r.status === 'started')
                                  .map((r) => ({
                                    fileName: r.fileName,
                                    analysisId: r.analysisId!,
                                    status: 'pending',
                                  }))

                                setBatchResults(batchData)
                                setCurrentScreen('loading')
                                setProgressMessage(`Анализируем ${successCount} файлов...`)

                                // Start polling for all results
                                pollBatchResults(batchData)
                              } else {
                                setError('Не удалось запустить анализ файлов')
                                setIsAnalyzing(false)
                              }
                            } catch (err) {
                              console.error('Batch analysis error:', err)
                              setError('Ошибка при запуске анализа')
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
                              Анализируем {
                                batchFiles.filter((f) => !f.error && f.content).length
                              }{' '}
                              файлов...
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-5 h-5" />
                              Проанализировать{' '}
                              {batchFiles.filter((f) => !f.error && f.content).length} файлов
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Single mode: Text Input Area with Upload Button */
                  <div
                    className={`h-[180px] px-4 py-3 rounded-[25px] bg-[#F2F2F2] dark:bg-gray-800 relative transition-all ${
                      isDragOver ? 'bg-gray-100 dark:bg-gray-700' : ''
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {progressMessage && progressMessage.includes('PDF') ? (
                      // Show loading state for PDF processing
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-black dark:text-white mb-4 transition-colors" />
                        <p
                          className="text-[18px] text-black dark:text-white dark:text-white transition-colors"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {progressMessage}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Plus/Upload Button */}
                        <button
                          onClick={() => document.getElementById('file-upload')?.click()}
                          className="absolute left-3 bottom-3 w-10 h-10 flex items-center justify-center 
                             text-black dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                          title="Загрузить файл"
                        >
                          <CloudUpload className="w-[30px] h-[30px]" />
                        </button>

                        {/* Hidden file input */}
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="file-upload"
                          accept=".txt,.md,.pdf"
                        />

                        {/* Textarea */}
                        <textarea
                          placeholder="Текст урока"
                          value={content}
                          onChange={(e) => {
                            const text = e.target.value
                            if (text.length <= maxTextLength) {
                              setContent(text)
                              setError(null)
                            } else {
                              setError(`Текст должен быть менее ${maxTextLength} символов`)
                            }
                          }}
                          className="w-full h-[140px] pl-2 pr-20 pb-24 pt-2 text-[20px] font-light text-black dark:text-white leading-relaxed 
                              bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-gray-400/60 dark:placeholder:text-gray-500/60 transition-colors"
                          maxLength={maxTextLength}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        />

                        {/* Character Counter */}
                        {content && (
                          <div className="absolute bottom-3 right-[200px] text-[12px] text-gray-400 dark:text-gray-500 transition-colors">
                            {content.length} / {maxTextLength}
                          </div>
                        )}

                        {/* Analyze Button inside textarea */}
                        <Button
                          onClick={handleAnalyze}
                          disabled={!content.trim() || isAnalyzing}
                          className="absolute bottom-3 right-3 px-8 py-3.5 h-[42px] text-[14px] font-normal bg-[#1a1a1a] dark:bg-gray-700 text-white 
                             hover:opacity-80 dark:hover:bg-gray-600
                             rounded-full transition-all duration-200 flex items-center justify-center"
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
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <Alert className="border-red-200 bg-red-50 text-red-700 mb-4 mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Illustration credit */}
            <div className="mt-8 text-center">
              <p
                className="text-[10px] text-[#9F9F9F]"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
              >
                иллюстрация
                <br />
                pinterest.com/miapasfield/
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
