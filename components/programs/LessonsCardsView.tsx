'use client'

import { useState, useEffect } from 'react'
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
  onAnalyzeLesson?: (lessonId: string) => void
}

export function LessonsCardsView({
  programId,
  lessons,
  loading = false,
  onAnalyzeLesson,
}: LessonsCardsViewProps) {
  const [lessonsWithMetrics, setLessonsWithMetrics] = useState<LessonWithMetrics[]>([])

  useEffect(() => {
    // Initialize lessons with loading state
    const initial: LessonWithMetrics[] = lessons.map((lesson) => ({
      ...lesson,
      analyzed: false,
      loading: true,
    }))

    setLessonsWithMetrics(initial)

    // Load metrics for each lesson
    lessons.forEach(async (lesson) => {
      try {
        const response = await fetch(`/api/programs/${programId}/lessons/${lesson.id}/analysis`)

        if (response.ok) {
          const { analysis } = await response.json()

          if (analysis && analysis.results) {
            // Extract metrics
            const metricsData = Object.entries(analysis.results)
              .filter(([key]) => !['lessonTitle', 'hotFixes', 'quickWin'].includes(key))
              .map(([name, data]: [string, unknown]) => {
                const metricData = data as { score?: number; comment?: string }
                return {
                  name,
                  score: metricData.score || 0,
                  comment: metricData.comment || '',
                  fix: '', // TODO: extract from comment if needed
                }
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
    })
  }, [lessons, programId])

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
          onAnalyze={onAnalyzeLesson ? () => onAnalyzeLesson(lesson.id) : undefined}
        />
      ))}
    </div>
  )
}
