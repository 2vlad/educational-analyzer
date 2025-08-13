'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  apiService,
  type AnalysisResult as ApiAnalysisResult,
  type Model,
} from '@/src/services/api'

// Metric name mapping
const METRIC_NAMES: Record<string, string> = {
  logic: 'Логика',
  practical: 'Польза',
  complexity: 'Уровень',
  interest: 'Цепляет',
  care: 'С душой',
}

// Removed hardcoded examples - all content comes from LLM

const Speedometer = ({ score }: { score: number | undefined | null }) => {
  // Handle undefined/null/NaN cases
  if (score === undefined || score === null || isNaN(score)) {
    // Return a placeholder/loading state
    return (
      <div className="w-24 h-20 flex items-center justify-center">
        <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
            fontFamily="Helvetica, Arial, sans-serif"
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
    <div className="w-24 h-20 flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
          fontFamily="Helvetica, Arial, sans-serif"
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
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisResult, setAnalysisResult] = useState<ApiAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState('')

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        // Check text length (2000 chars limit)
        if (text.length > 2000) {
          setContent(text.substring(0, 2000))
          setError('Content truncated to 2000 characters')
        } else {
          setContent(text)
          setError(null)
        }
      }
      reader.readAsText(file)
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      // Check file size
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        if (text.length > 2000) {
          setContent(text.substring(0, 2000))
          setError('Content truncated to 2000 characters')
        } else {
          setContent(text)
          setError(null)
        }
      }
      reader.readAsText(file)
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
    const validModelIds = ['claude-haiku', 'claude-sonnet-4', 'gpt-4o', 'gemini-pro']
    let modelToUse = selectedModel

    if (selectedModel && !validModelIds.includes(selectedModel)) {
      console.warn('Invalid model ID detected:', selectedModel)
      console.log('Falling back to default model')
      modelToUse = 'claude-haiku'
    }

    setIsAnalyzing(true)
    setError(null)
    setCurrentScreen('loading')
    setAnalysisProgress(0)
    setProgressMessage('Отправка на анализ...')

    try {
      // Start analysis
      console.log('Starting analysis with model:', modelToUse)
      console.log('Original selected model was:', selectedModel)
      console.log('Content length:', content.length)
      const { analysisId } = await apiService.analyze({
        content: content.trim(),
        modelId: modelToUse || undefined,
      })
      console.log('Analysis started with ID:', analysisId)

      setProgressMessage('Анализирую метрику 1 из 5...')

      // Poll for results
      const result = await apiService.pollAnalysis(
        analysisId,
        (progress) => {
          // Calculate progress based on completed metrics
          if (progress.metrics) {
            const completed = progress.metrics.filter((m) => m.duration > 0).length
            setAnalysisProgress((completed / 5) * 100)
            setProgressMessage(`Анализирую метрику ${completed + 1} из 5...`)
          }
        },
        60, // Max 60 seconds
      )

      console.log('Analysis Result Received:', result)
      console.log('Results object:', result.results)
      if (result.results) {
        Object.entries(result.results).forEach(([metric, data]: [string, any]) => {
          console.log(`Metric ${metric}:`, data)
          console.log(`  Score:`, data?.score, `Type:`, typeof data?.score)
        })
      }
      setAnalysisResult(result)
      setCurrentScreen('results')
    } catch (error) {
      console.error('Analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
      setCurrentScreen('upload')
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    }
  }

  if (currentScreen === 'loading') {
    return (
      <div
        className="min-h-screen bg-white p-4 flex items-center justify-center"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif',
        }}
      >
        <div className="text-center space-y-6">
          <Loader2 className="h-16 w-16 animate-spin mx-auto text-black" />
          <div className="space-y-2">
            <p className="text-xl font-semibold text-black">{progressMessage}</p>
            <Progress value={analysisProgress} className="w-64 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  if (currentScreen === 'results' && analysisResult) {
    return (
      <div
        className="min-h-screen bg-white p-4"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif',
        }}
      >
        <div className="max-w-[700px] mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-black mb-2">Analysis Results</h1>
            {analysisResult.model_used && (
              <p className="text-sm text-gray-600">Model: {analysisResult.model_used}</p>
            )}
          </header>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {analysisResult.results &&
              Object.entries(analysisResult.results).map(([metric, data]: [string, any]) => (
                <Card key={metric} className="border-black border-2 p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg text-black">
                        {METRIC_NAMES[metric] || metric}
                      </h3>
                      <Speedometer score={data?.score} />
                    </div>
                    {data?.error ? (
                      <p className="text-sm text-red-600">Error: {data.error}</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700 italic">
                          {data?.comment ? `"${data.comment}"` : '...'}
                        </p>
                        {data?.durationMs && (
                          <p className="text-xs text-gray-500">
                            {(data.durationMs / 1000).toFixed(1)}s
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              ))}
          </div>

          {/* Detailed Analysis Section */}
          <div className="mb-8">
            <Card className="border-black border-2 p-6">
              <h2 className="text-2xl font-bold text-black mb-6 text-center">Detailed Analysis</h2>
              <div className="space-y-6">
                {analysisResult.results &&
                  Object.entries(analysisResult.results).map(([metric, data]: [string, any]) => (
                    <div
                      key={metric}
                      className="border-b border-gray-200 last:border-b-0 pb-4 last:pb-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-black">
                          {METRIC_NAMES[metric] || metric}
                        </h3>
                        <Speedometer score={data?.score} />
                      </div>

                      {data?.error && (
                        <p className="text-sm text-red-600 mb-3">Error: {data.error}</p>
                      )}

                      {/* Show detailed analysis if available */}
                      {data.detailed_analysis && (
                        <div className="mb-3">
                          <h4 className="font-semibold text-sm text-black mb-2">Анализ:</h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {data.detailed_analysis}
                          </p>
                        </div>
                      )}

                      {/* Show examples from LLM if available */}
                      {data.examples && data.examples.length > 0 && (
                        <div className="mb-3">
                          <h4 className="font-semibold text-sm text-black mb-2">
                            Примеры из текста:
                          </h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {data.examples.map((example, index) => (
                              <li key={index} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span className="italic">"{example}"</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </Card>
          </div>

          {/* Return Button */}
          <div className="text-center">
            <Button
              onClick={() => {
                setCurrentScreen('upload')
                setContent('')
                setAnalysisResult(null)
                setError(null)
              }}
              className="px-8 py-3 border border-black text-black bg-white hover:bg-black hover:text-white transition-colors"
            >
              Analyze New Content
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Upload screen
  return (
    <div
      className="min-h-screen bg-white p-4"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif',
      }}
    >
      <div className="max-w-[700px] mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-3xl font-bold text-black mb-2">Educational Content Analyzer</h1>
          <p className="text-gray-600">
            Анализ образовательного контента с помощью ИИ-студента Лёхи
          </p>
        </header>

        <div className="space-y-8">
          {/* Error Alert */}
          {error && (
            <Alert className="border-red-500 text-red-700">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Model Selector */}
          {models.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full border-black">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} {model.default && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed border-black rounded-lg p-12 text-center transition-colors ${
              isDragOver ? 'bg-gray-50' : 'bg-white'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto mb-4 h-12 w-12 text-black" />
            <p className="text-lg text-black mb-4">Drag & drop your file here</p>
            <p className="text-sm text-gray-600 mb-4">Supported: .txt, .md (max 10MB)</p>
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              accept=".txt,.md"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-2 border border-black text-black hover:bg-black hover:text-white transition-colors cursor-pointer rounded-lg"
            >
              Choose File
            </label>
          </div>

          {/* Text Area */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Or paste your content
              </label>
              <span className="text-sm text-gray-500">{content.length} / 2000</span>
            </div>
            <Textarea
              placeholder="Paste your lesson content here..."
              value={content}
              onChange={(e) => {
                const text = e.target.value
                if (text.length <= 2000) {
                  setContent(text)
                  setError(null)
                } else {
                  setError('Content must be less than 2000 characters')
                }
              }}
              className="min-h-[200px] font-mono text-sm border-2 border-black focus:ring-black focus:border-black"
              maxLength={2000}
            />
          </div>

          {/* Analyze Button */}
          <div className="text-center">
            <Button
              onClick={handleAnalyze}
              disabled={!content.trim() || isAnalyzing}
              className="px-12 py-3 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Content'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
