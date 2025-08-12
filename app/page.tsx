"use client"

import type React from "react"

import { useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface AnalysisResult {
  metric: string
  score: number
  comment: string
  details: string
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
  const [currentScreen, setCurrentScreen] = useState<"upload" | "results">("upload")
  const [content, setContent] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)

  // Mock analysis results
  const analysisResults: AnalysisResult[] = [
    {
      metric: "Логика",
      score: 1,
      comment: "Норм, но мутновато",
      details:
        "Структура материала понятна, но некоторые переходы между темами могли бы быть более плавными. Логическая цепочка прослеживается, однако есть места где можно улучшить последовательность изложения.",
    },
    {
      metric: "Польза",
      score: 2,
      comment: "Сразу понял где юзать!",
      details:
        "Отличная практическая применимость! Материал содержит конкретные примеры и четкие инструкции. Студенты смогут сразу применить полученные знания в реальных задачах.",
    },
    {
      metric: "Уровень",
      score: 0,
      comment: "В самый раз",
      details:
        "Сложность материала соответствует целевой аудитории. Не слишком просто и не слишком сложно. Хороший баланс между доступностью и глубиной изложения.",
    },
    {
      metric: "Цепляет",
      score: -1,
      comment: "Можно поживее",
      details:
        "Материал информативен, но не хватает элементов, которые бы захватывали внимание. Стоит добавить больше интерактивности, примеров из жизни или неожиданных фактов.",
    },
    {
      metric: "С душой",
      score: 1,
      comment: "Чувствуется забота",
      details:
        "Видно, что автор вложил душу в создание материала. Есть личные примеры и забота о понимании студентов, но можно добавить еще больше тепла и персонализации.",
    },
  ]

  const examples = {
    Логика: [
      "Добавить переходные фразы между разделами",
      "Использовать нумерованные списки для последовательности",
      "Создать схему или диаграмму основных понятий",
    ],
    Польза: [
      "Добавить чек-лист для практического применения",
      "Включить реальные кейсы из практики",
      "Создать шаблоны для самостоятельной работы",
    ],
    Уровень: [
      "Добавить глоссарий сложных терминов",
      "Включить дополнительные материалы для продвинутых",
      "Создать систему самопроверки знаний",
    ],
    Цепляет: [
      "Начать с интригующего вопроса или факта",
      "Добавить интерактивные элементы или опросы",
      "Использовать storytelling и личные истории",
    ],
    "С душой": [
      "Добавить личные примеры из опыта автора",
      "Включить мотивирующие цитаты или истории успеха",
      "Создать персональные обращения к студентам",
    ],
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setContent(e.target?.result as string)
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
      const reader = new FileReader()
      reader.onload = (e) => {
        setContent(e.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  if (currentScreen === "upload") {
    return (
      <div className="min-h-screen bg-white p-4 font-sans">
        <div className="max-w-[700px] mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-3xl font-bold text-black mb-2">Educational Content Analyzer</h1>
          </header>

          <div className="space-y-8">
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
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".txt,.md,.doc,.docx"
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
              <Textarea
                placeholder="Paste your lesson content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm border-2 border-black focus:ring-black focus:border-black"
              />
            </div>

            {/* Analyze Button */}
            <div className="text-center">
              <Button
                onClick={() => setCurrentScreen("results")}
                disabled={!content.trim()}
                className="px-12 py-3 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
              >
                Analyze Content
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4 font-sans">
      <div className="max-w-[700px] mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Analysis Results</h1>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {analysisResults.map((result) => (
            <Card key={result.metric} className="border-black border-2 p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-black">{result.metric}</h3>
                  <Speedometer score={result.score} />
                </div>

                <p className="text-sm text-gray-700 italic">"{result.comment}"</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Detailed Analysis Section */}
        <div className="mb-8">
          <Card className="border-black border-2 p-6">
            <h2 className="text-2xl font-bold text-black mb-6 text-center">Detailed Analysis</h2>
            <div className="space-y-6">
              {analysisResults.map((result) => (
                <div key={result.metric} className="border-b border-gray-200 last:border-b-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg text-black">{result.metric}</h3>
                    <Speedometer score={result.score} />
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{result.details}</p>

                  <div>
                    <h4 className="font-semibold text-sm text-black mb-2">Примеры</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {examples[result.metric as keyof typeof examples]?.map((example, index) => (
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
