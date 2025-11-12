'use client'

import { useState, useEffect, useCallback } from 'react'
import { LessonCardWithGauge } from './LessonCardWithGauge'
import type { ProgramLesson } from '@/src/services/api'

interface LessonWithMetrics extends ProgramLesson {
  analyzed: boolean
  loading: boolean
  totalScore?: number
  metrics?: Array<{
    name: string
    score: number
    comment: string
    fix?: string
  }>
}

interface LessonsCardsViewProps {
  programId: string
  lessons: ProgramLesson[]
  loading?: boolean
  analyzingLessonIds?: Set<string>
  onAnalyzeLesson?: (lessonId: string) => void
  onDeleteLesson?: (lessonId: string) => void
  onAddLesson?: () => void
}

// Mapping of metric keys to Russian names
const METRIC_NAMES: Record<string, string> = {
  interest: 'Интерес',
  logic: 'Логика',
  care: 'Забота',
  clarity: 'Понятность',
  practical: 'Практика',
  complexity: 'Сложность',
}

export function LessonsCardsView({
  programId,
  lessons,
  loading = false,
  analyzingLessonIds = new Set(),
  onAnalyzeLesson,
  onDeleteLesson,
  onAddLesson,
}: LessonsCardsViewProps) {
  const [lessonsWithMetrics, setLessonsWithMetrics] = useState<LessonWithMetrics[]>([])

  const loadLessonMetrics = useCallback(
    async (lesson: ProgramLesson) => {
      try {
        const response = await fetch(`/api/programs/${programId}/lessons/${lesson.id}/analysis`)

        if (response.ok) {
          const { analysis } = await response.json()

          if (analysis && analysis.results) {
            // Extract metrics and convert to Russian names
            const metricsData = Object.entries(analysis.results)
              .filter(([key]) => !['lessonTitle', 'hotFixes', 'quickWin'].includes(key))
              .map(([key, data]: [string, unknown]) => {
                const metricData = data as { score?: number; comment?: string }
                return {
                  name: METRIC_NAMES[key] || key, // Use Russian name if available
                  score: metricData.score || 0,
                  comment: metricData.comment || '',
                  fix: '', // TODO: extract from comment if needed
                }
              })
              .sort((a, b) => {
                // Sort by predefined order
                const order = ['Интерес', 'Логика', 'Забота', 'Понятность', 'Практика', 'Сложность']
                return order.indexOf(a.name) - order.indexOf(b.name)
              })

            // Calculate total score
            const totalScore = metricsData.reduce((sum, m) => sum + m.score, 0)

            setLessonsWithMetrics((prev) =>
              prev.map((l) =>
                l.id === lesson.id
                  ? { ...l, metrics: metricsData, totalScore, analyzed: true, loading: false }
                  : l,
              ),
            )
          } else {
            setLessonsWithMetrics((prev) =>
              prev.map((l) => (l.id === lesson.id ? { ...l, analyzed: false, loading: false } : l)),
            )
          }
        } else {
          setLessonsWithMetrics((prev) =>
            prev.map((l) => (l.id === lesson.id ? { ...l, analyzed: false, loading: false } : l)),
          )
        }
      } catch (error) {
        console.error(`Failed to load analysis for lesson ${lesson.id}:`, error)
        setLessonsWithMetrics((prev) =>
          prev.map((l) => (l.id === lesson.id ? { ...l, analyzed: false, loading: false } : l)),
        )
      }
    },
    [programId],
  )

  useEffect(() => {
    // Initialize lessons with loading state
    const initial: LessonWithMetrics[] = lessons.map((lesson) => ({
      ...lesson,
      analyzed: false,
      loading: true,
    }))

    setLessonsWithMetrics(initial)

    // Load metrics for each lesson
    lessons.forEach((lesson) => {
      loadLessonMetrics(lesson)
    })
  }, [lessons, programId, loadLessonMetrics])

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Загрузка уроков...</div>
  }

  if (lessons.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <p className="text-lg mb-4">В этой программе пока нет уроков</p>
      </div>
    )
  }

  const getColor = (
    analyzed: boolean,
    totalScore: number,
    maxScore: number,
  ): 'green' | 'amber' | 'red' | 'gray' => {
    if (!analyzed) return 'gray'

    const percentage = totalScore / maxScore
    if (percentage >= 0.6) return 'green' // 60%+ - зеленый
    if (percentage >= 0.3) return 'amber' // 30-60% - желтый
    return 'red' // <30% - красный
  }

  return (
    <div className="space-y-5">
      {/* Add lesson button */}
      {onAddLesson && (
        <button
          onClick={onAddLesson}
          className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-2xl">+</span>
          <span>Добавить урок</span>
        </button>
      )}

      {/* Lesson cards */}
      {lessonsWithMetrics.map((lesson) => (
        <LessonCardWithGauge
          key={lesson.id}
          title={lesson.title}
          metrics={lesson.metrics || []}
          totalScore={lesson.totalScore || 0}
          maxScore={30}
          color={getColor(lesson.analyzed, lesson.totalScore || 0, 30)}
          analyzed={lesson.analyzed}
          loading={lesson.loading}
          analyzing={analyzingLessonIds.has(lesson.id)}
          onAnalyze={onAnalyzeLesson ? () => onAnalyzeLesson(lesson.id) : undefined}
          onDelete={onDeleteLesson ? () => onDeleteLesson(lesson.id) : undefined}
        />
      ))}
    </div>
  )
}
