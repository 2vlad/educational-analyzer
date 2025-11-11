'use client'

import { useParams, useRouter } from 'next/navigation'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ScoreSpeedometer from '@/components/ScoreSpeedometer'

// Metric name mapping
const METRIC_NAMES: Record<string, string> = {
  logic: 'Логика',
  practical: 'Польза',
  complexity: 'Сложность',
  interest: 'Интерес',
  care: 'Забота',
}

// Mock data for demonstration
const mockAnalysisResults = {
  '1-1': {
    title: 'Введение в JavaScript',
    results: {
      logic: { score: 2, feedback: 'Отличная логическая структура материала' },
      practical: { score: 1, feedback: 'Хорошая практическая применимость' },
      complexity: { score: 0, feedback: 'Сбалансированная сложность' },
      interest: { score: 2, feedback: 'Очень увлекательная подача' },
      care: { score: 1, feedback: 'Внимание к деталям' },
    },
    overallScore: 6,
  },
  '1-2': {
    title: 'Переменные и типы данных',
    results: {
      logic: { score: 1, feedback: 'Хорошая структура' },
      practical: { score: 2, feedback: 'Отличные практические примеры' },
      complexity: { score: -1, feedback: 'Слишком простой материал' },
      interest: { score: 1, feedback: 'Интересная подача' },
      care: { score: 2, feedback: 'Превосходное внимание к деталям' },
    },
    overallScore: 5,
  },
}

export default function ProgramDetailPage() {
  const params = useParams()
  const router = useRouter()
  const programId = params.programId as string

  // Get lesson ID from query params or default to first lesson
  const lessonId = '1-1' // In real app, this would come from query params or state
  const analysis = mockAnalysisResults[lessonId as keyof typeof mockAnalysisResults]

  if (!analysis) {
    return (
      <div className="min-h-screen bg-white">
        <UnifiedHeader />
        <div className="container mx-auto px-4 py-8">
          <p className="text-gray-500">Результаты анализа не найдены</p>
        </div>
      </div>
    )
  }

  const handlePreviousLesson = () => {
    // Navigate to previous lesson
    console.log('Previous lesson')
  }

  const handleNextLesson = () => {
    // Navigate to next lesson
    console.log('Next lesson')
  }

  return (
    <div className="min-h-screen bg-white">
      <UnifiedHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Back to programs */}
        <Button variant="ghost" onClick={() => router.push('/programs')} className="mb-6">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Вернуться к программам
        </Button>

        {/* Lesson title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{analysis.title}</h1>
          <p className="text-gray-600 mt-2">Результаты анализа урока</p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Object.entries(analysis.results).map(([key, data]) => (
            <div
              key={key}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{METRIC_NAMES[key] || key}</h3>
                <ScoreSpeedometer score={data.score} />
              </div>
              <p className="text-sm text-gray-600">{data.feedback}</p>
            </div>
          ))}
        </div>

        {/* Overall result */}
        <div className="bg-gradient-to-r from-gray-100 to-indigo-50 rounded-xl p-8 mb-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Общий результат</h2>
            <div className="text-5xl font-bold text-blue-600">{analysis.overallScore}/10</div>
            <p className="text-gray-600 mt-4">
              Материал урока получил высокую оценку по всем критериям
            </p>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handlePreviousLesson} disabled={lessonId === '1-1'}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Предыдущий урок
          </Button>
          <Button variant="outline" onClick={handleNextLesson}>
            Следующий урок
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
