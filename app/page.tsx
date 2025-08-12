"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { apiService, type AnalysisResult as ApiAnalysisResult, type Model } from "@/services/api"

// Metric name mapping
const METRIC_NAMES: Record<string, string> = {
  logic: "Логика",
  practical: "Польза",
  complexity: "Уровень",
  interest: "Цепляет",
  care: "С душой"
}

// Example recommendations for each metric
const METRIC_EXAMPLES: Record<string, string[]> = {
  logic: [
    "Добавить переходные фразы между разделами",
    "Использовать нумерованные списки для последовательности",
    "Создать схему или диаграмму основных понятий",
  ],
  practical: [
    "Добавить чек-лист для практического применения",
    "Включить реальные кейсы из практики",
    "Создать шаблоны для самостоятельной работы",
  ],
  complexity: [
    "Добавить глоссарий сложных терминов",
    "Включить дополнительные материалы для продвинутых",
    "Создать систему самопроверки знаний",
  ],
  interest: [
    "Начать с интригующего вопроса или факта",
    "Добавить интерактивные элементы или опросы",
    "Использовать storytelling и личные истории",
  ],
  care: [
    "Добавить личные примеры из опыта автора",
    "Включить мотивирующие цитаты или истории успеха",
    "Создать персональные обращения к студентам",
  ],
}

const Speedometer = ({ score }: { score: number }) => {
  // Convert score (-2 to 2) to angle (0 to 180 degrees)
  const angle = ((score + 2) / 4) * 180

  // Get color based on score
  const getColor = (score: number) => {
    if (score >= 1) return "#22c55e" // green
    if (score === 0) return "#eab308" // yellow
    return "#ef4444" // red
  }

  const color = getColor(score)

  return (
    <div className="w-8 h-[37px]">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background arc */}
        <path d="M 20 80 A 30 30 0 0 1 80 80" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />

        {/* Progress arc */}
        <path
          d="M 20 80 A 30 30 0 0 1 80 80"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 94.2} 94.2`}
        />

        {/* Center dot */}
        <circle cx="50" cy="80" r="3" fill={color} />

        {/* Needle */}
        <line
          x1="50"
          y1="80"
          x2={50 + 25 * Math.cos(((180 - angle) * Math.PI) / 180)}
          y2={80 - 25 * Math.sin(((180 - angle) * Math.PI) / 180)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default function EducationalAnalyzer() {
  const [currentScreen, setCurrentScreen] = useState<"upload" | "loading" | "results">("upload")
  const [content, setContent] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisResult, setAnalysisResult] = useState<ApiAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")

  // Load available models on mount
  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const response = await apiService.getModels()
      setModels(response.models.filter(m => m.available))
      setSelectedModel(response.defaultModel)
    } catch (error) {
      console.error("Failed to load models:", error)
      // Continue with default model
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB")
        return
      }
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        // Check text length (2000 chars limit)
        if (text.length > 2000) {
          setContent(text.substring(0, 2000))
          setError("Content truncated to 2000 characters")
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
        setError("File size must be less than 10MB")
        return
      }
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        if (text.length > 2000) {
          setContent(text.substring(0, 2000))
          setError("Content truncated to 2000 characters")
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

    setIsAnalyzing(true)
    setError(null)
    setCurrentScreen("loading")
    setAnalysisProgress(0)
    setProgressMessage("Отправка на анализ...")

    try {
      // Start analysis
      const { analysisId } = await apiService.analyze({
        content: content.trim(),
        modelId: selectedModel || undefined
      })

      setProgressMessage("Анализирую метрику 1 из 5...")

      // Poll for results
      const result = await apiService.pollAnalysis(
        analysisId,
        (progress) => {
          // Calculate progress based on completed metrics
          if (progress.metrics) {
            const completed = progress.metrics.filter(m => m.duration > 0).length
            setAnalysisProgress((completed / 5) * 100)
            setProgressMessage(`Анализирую метрику ${completed + 1} из 5...`)
          }
        },
        60 // Max 60 seconds
      )

      setAnalysisResult(result)
      setCurrentScreen("results")
    } catch (error) {
      console.error("Analysis failed:", error)
      setError(error instanceof Error ? error.message : "Analysis failed")
      setCurrentScreen("upload")
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    }
  }

  if (currentScreen === "loading") {
    return (
      <div className="min-h-screen bg-white p-4 font-sans flex items-center justify-center">
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

  if (currentScreen === "results" && analysisResult) {
    return (
      <div className="min-h-screen bg-white p-4 font-sans">
        <div className="max-w-[700px] mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-black mb-2">Analysis Results</h1>
            {analysisResult.model_used && (
              <p className="text-sm text-gray-600">Model: {analysisResult.model_used}</p>
            )}
          </header>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {analysisResult.results && Object.entries(analysisResult.results).map(([metric, data]) => (
              <Card key={metric} className="border-black border-2 p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-black">{METRIC_NAMES[metric] || metric}</h3>
                    <Speedometer score={data.score} />
                  </div>
                  <p className="text-sm text-gray-700 italic">"{data.comment}"</p>
                  {data.durationMs && (
                    <p className="text-xs text-gray-500">{(data.durationMs / 1000).toFixed(1)}s</p>
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
                {analysisResult.results && Object.entries(analysisResult.results).map(([metric, data]) => (
                  <div key={metric} className="border-b border-gray-200 last:border-b-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg text-black">{METRIC_NAMES[metric] || metric}</h3>
                      <Speedometer score={data.score} />
                    </div>
                    
                    {/* Show examples from LLM if available */}
                    {data.examples && data.examples.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm text-black mb-2">Примеры из текста:</h4>
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

                    {/* Show recommendations */}
                    <div>
                      <h4 className="font-semibold text-sm text-black mb-2">Рекомендации:</h4>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {METRIC_EXAMPLES[metric]?.map((example, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Return Button */}
          <div className="text-center">
            <Button
              onClick={() => {
                setCurrentScreen("upload")
                setContent("")
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
    <div className="min-h-screen bg-white p-4 font-sans">
      <div className="max-w-[700px] mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-3xl font-bold text-black mb-2">Educational Content Analyzer</h1>
          <p className="text-gray-600">Анализ образовательного контента с помощью ИИ-студента Лёхи</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Model
              </label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full border-black">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} {model.default && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed border-black rounded-lg p-12 text-center transition-colors ${
              isDragOver ? "bg-gray-50" : "bg-white"
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
              <span className="text-sm text-gray-500">
                {content.length} / 2000
              </span>
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
                  setError("Content must be less than 2000 characters")
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
                "Analyze Content"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}