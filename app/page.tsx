'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { CloudUpload, Loader2, ChevronRight, User, Settings, History, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/src/providers/AuthProvider'
import Link from 'next/link'
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

// Metric name mapping
const METRIC_NAMES: Record<string, string> = {
  logic: 'Логика',
  practical: 'Польза',
  complexity: 'Сложность',
  interest: 'Интерес',
  care: 'Забота',
}

// User Account Header Component
const UserAccountHeader = () => {
  const { user, signOut } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (!user) {
    return (
      <div className="w-full flex justify-end p-4">
        <Link href="/login">
          <Button className="bg-black text-white hover:bg-gray-800 rounded-full px-6">
            Войти
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full flex justify-end p-4 relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-700">{user.email}</span>
        <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showMenu ? 'rotate-90' : ''}`} />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-4 top-16 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
            </div>
            
            <Link href="/settings" onClick={() => setShowMenu(false)}>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Settings className="w-4 h-4" />
                Настройки метрик
              </button>
            </Link>
            
            <Link href="/history" onClick={() => setShowMenu(false)}>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <History className="w-4 h-4" />
                История анализов
              </button>
            </Link>
            
            <button
              onClick={() => {
                setShowMenu(false)
                signOut()
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-200"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </>
      )}
    </div>
  )
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

  // Load available models on mount
  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const response = await apiService.getModels()
      console.log('Models response:', response)
      console.log(
        'Available models:',
        response.models.filter((m) => m.available),
      )
      console.log('Default model:', response.defaultModel)
      setModels(response.models.filter((m) => m.available))
      setSelectedModel(response.defaultModel)
    } catch (error) {
      console.error('Failed to load models:', error)
      // Continue with default model
      // Set a fallback model if API fails
      setSelectedModel('claude-haiku')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (10MB limit)
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
            setError(`PDF содержит ${result.pages} страниц. Текст обрезан до 20000 символов`)
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
          // Check text length (20000 chars limit)
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
            setError(`PDF содержит ${result.pages} страниц. Текст обрезан до 20000 символов`)
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
      const { analysisId } = await apiService.analyze({
        content: content.trim(),
        modelId: modelToUse || undefined,
      })
      console.log('✅ Analysis started successfully!')
      console.log('Analysis ID:', analysisId)
      console.log('================================')

      // Simple progress simulation and polling
      let completed = 0
      const metrics = ['logic', 'practical', 'complexity', 'interest', 'care']

      // Set progress messages
      const progressMessages = [
        'Анализ логики...',
        'Оценка практичности...',
        'Проверка сложности...',
        'Анализ интереса...',
        'Оценка качества...',
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
            setError('Analysis failed. Please check your API keys in .env.local file.')
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

  if (currentScreen === 'results' && analysisResult) {
    // Calculate overall score
    const overallScore = analysisResult.results
      ? Object.values(analysisResult.results).reduce((sum: number, data: any) => {
          return sum + (data?.score || 0)
        }, 0)
      : 0

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
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-[660px] mx-auto">
          {/* Header */}
          <header className="mb-8 relative">
            <div className="mb-2 relative">
              <h1 className="text-[48px] font-bold text-black">Лёха AI</h1>
              <p
                className="text-[16px] text-black absolute right-0 text-right"
                style={{ top: '0px', maxWidth: '300px', marginTop: '20px' }}
              >
                оценивает качество контента
                <br />
                на основе LX-метрик
              </p>
            </div>
            <p className="text-[14px] text-black mt-2">
              {analysisResult.results?.lessonTitle ||
                (content ? content.substring(0, 50) + '...' : 'Анализ контента')}
            </p>
          </header>

          {/* Metrics Grid - 2x3 layout */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* Logic */}
            <div
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
              <p className="text-[15px] text-black" style={{ lineHeight: '100%' }}>
                {getShortComment(analysisResult.results?.logic?.comment)}
              </p>
            </div>

            {/* Practical */}
            <div
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
              <p className="text-[15px] text-black" style={{ lineHeight: '100%' }}>
                {getShortComment(analysisResult.results?.practical?.comment)}
              </p>
            </div>

            {/* Interest */}
            <div
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
              <p className="text-[15px] text-black" style={{ lineHeight: '100%' }}>
                {getShortComment(analysisResult.results?.interest?.comment)}
              </p>
            </div>

            {/* Care */}
            <div
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
              <p className="text-[15px] text-black" style={{ lineHeight: '100%' }}>
                {getShortComment(analysisResult.results?.care?.comment)}
              </p>
            </div>

            {/* Complexity */}
            <div
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
              <p className="text-[15px] text-black" style={{ lineHeight: '100%' }}>
                {getShortComment(analysisResult.results?.complexity?.comment)}
              </p>
            </div>

            {/* Overall Result */}
            <div
              className="bg-[#C8E6C9] p-6 flex flex-col"
              style={{ minWidth: '320px', minHeight: '320px', borderRadius: '40px' }}
            >
              <div className="flex-grow flex items-center justify-center">
                <div style={{ fontWeight: 400, fontSize: '50px' }} className="text-black">
                  {overallScore + 10}/10
                </div>
              </div>
              <h3
                className="text-black"
                style={{
                  fontWeight: 600,
                  fontSize: '32px',
                  lineHeight: '90%',
                }}
              >
                Общий
                <br />
                результат
              </h3>
            </div>
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
            {analysisResult.results &&
              Object.entries(analysisResult.results).map(([metric, data]: [string, any]) => {
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
                                <p className="text-[14px] text-black ml-4">{value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Examples */}
                    {data.examples && data.examples.length > 0 && (
                      <div className="bg-[#F5F5F5] p-6" style={{ borderRadius: '40px' }}>
                        <h4 className="text-[16px] font-semibold text-black mb-3">
                          Примеры из текста
                        </h4>
                        <ul className="space-y-3">
                          {data.examples.map((example: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-black mr-2">•</span>
                              <span className="text-[14px] text-black italic">"{example}"</span>
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
    )
  }

  // Upload screen - New design based on Figma
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* User Account Header */}
      <UserAccountHeader />
      
      <div className="flex-1 flex justify-center p-6">
        <div className="w-full max-w-[450px] mt-[50px]">
        {/* Header with title, subtitle and image */}
        <div className="flex justify-between mb-10">
          <div>
            <h1
              className="text-[48px] font-bold text-black mb-3 leading-tight"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Лёха AI
            </h1>
            <p
              className="text-[20px] font-normal text-black"
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
              className="block text-[15px] font-normal text-gray-500 mb-3"
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
                <SelectTrigger className="relative w-full !h-14 !px-6 !pr-14 text-[20px] font-light text-black bg-[#F2F2F2] hover:bg-gray-100 transition-colors rounded-[50px] border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
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

          {/* Content Section */}
          <div className="mb-6 mt-[40px]">
            <label
              className="block text-[15px] font-normal text-gray-500 mb-3"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Контент
            </label>

            {/* Text Input Area with Upload Button */}
            <div
              className={`h-[180px] px-4 py-3 rounded-[25px] bg-[#F2F2F2] relative transition-all ${
                isDragOver ? 'bg-gray-100' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {progressMessage && progressMessage.includes('PDF') ? (
                // Show loading state for PDF processing
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500 mb-4" />
                  <p className="text-[18px] text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {progressMessage}
                  </p>
                </div>
              ) : (
                <>
                  {/* Plus/Upload Button */}
                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="absolute left-3 bottom-3 w-10 h-10 flex items-center justify-center 
                             text-black hover:text-gray-700 transition-colors cursor-pointer rounded-lg hover:bg-gray-200"
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
                      if (text.length <= 20000) {
                        setContent(text)
                        setError(null)
                      } else {
                        setError('Content must be less than 20000 characters')
                      }
                    }}
                    className="w-full h-[140px] pl-2 pr-20 pb-24 pt-2 text-[20px] font-light text-black leading-relaxed 
                              bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-gray-400/60"
                    maxLength={20000}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />

                  {/* Character Counter */}
                  {content && (
                    <div className="absolute bottom-3 right-[200px] text-[12px] text-gray-400">
                      {content.length} / 20000
                    </div>
                  )}

                  {/* Analyze Button inside textarea */}
                  <Button
                    onClick={handleAnalyze}
                    disabled={!content.trim() || isAnalyzing}
                    className="absolute bottom-3 right-3 px-8 py-3.5 h-[42px] text-[14px] font-normal bg-[#1a1a1a] text-white 
                             hover:opacity-80
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
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="border-red-200 bg-red-50 text-red-700 mb-4">
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
  )
}
