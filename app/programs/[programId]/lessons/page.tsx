'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import LessonCard from '@/components/lessons/LessonCard'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload } from 'lucide-react'
import { apiService } from '@/src/services/api'

interface Lesson {
  id: string
  title: string
  sort_order: number
  metrics?: Array<{
    name: string
    score: number
    comment: string | null
  }>
  analyzed: boolean
  loading?: boolean
}

interface PageProps {
  params: Promise<{ programId: string }>
}

export default function ProgramLessonsPage({ params }: PageProps) {
  const { programId } = use(params)
  const router = useRouter()
  const [programTitle, setProgramTitle] = useState('')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProgramAndLessons()
  }, [programId])

  const loadProgramAndLessons = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load program details
      const { programs } = await apiService.getPrograms()
      const program = programs.find((p) => p.id === programId)

      if (!program) {
        setError('Программа не найдена')
        return
      }

      setProgramTitle(program.name)

      // Load lessons
      const { lessons: loadedLessons } = await apiService.getProgramLessons(programId)

      // Initialize lessons with loading state
      const initialLessons: Lesson[] = loadedLessons.map((l) => ({
        id: l.id,
        title: l.title,
        sort_order: l.sort_order,
        analyzed: false,
        loading: true,
      }))

      setLessons(initialLessons)

      // Load metrics for each lesson
      loadedLessons.forEach(async (lesson) => {
        try {
          // Try to get latest analysis for this lesson
          const response = await fetch(`/api/programs/${programId}/lessons/${lesson.id}/analysis`)

          if (response.ok) {
            const { analysis } = await response.json()

            if (analysis && analysis.results) {
              // Extract metrics from analysis results
              const metrics = Object.entries(analysis.results)
                .filter(
                  ([key]) => key !== 'lessonTitle' && key !== 'hotFixes' && key !== 'quickWin',
                )
                .map(([name, data]: [string, unknown]) => {
                  const metricData = data as { score?: number; comment?: string }
                  return {
                    name,
                    score: metricData.score || 0,
                    comment: metricData.comment || null,
                  }
                })

              setLessons((prev) =>
                prev.map((l) =>
                  l.id === lesson.id ? { ...l, metrics, analyzed: true, loading: false } : l,
                ),
              )
            } else {
              // No analysis yet
              setLessons((prev) =>
                prev.map((l) =>
                  l.id === lesson.id ? { ...l, analyzed: false, loading: false } : l,
                ),
              )
            }
          } else {
            // No analysis found
            setLessons((prev) =>
              prev.map((l) => (l.id === lesson.id ? { ...l, analyzed: false, loading: false } : l)),
            )
          }
        } catch (err) {
          console.error(`Failed to load analysis for lesson ${lesson.id}:`, err)
          setLessons((prev) =>
            prev.map((l) => (l.id === lesson.id ? { ...l, analyzed: false, loading: false } : l)),
          )
        }
      })
    } catch (err) {
      const error = err as Error
      console.error('Failed to load program:', error)
      setError(error.message || 'Не удалось загрузить программу')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeLesson = async (lessonId: string) => {
    toast.info('Запуск анализа урока...')
    // TODO: implement single lesson analysis
    console.log('Analyze lesson:', lessonId)
  }

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      await apiService.deleteLesson(lessonId)

      // Optimistic update
      setLessons(lessons.filter((l) => l.id !== lessonId))

      toast.success('Урок удален')
    } catch (err) {
      const error = err as Error
      console.error('Failed to delete lesson:', error)
      toast.error(error.message || 'Не удалось удалить урок')

      // Reload on error
      await loadProgramAndLessons()
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <UnifiedHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Загрузка уроков...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col">
        <UnifiedHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/programs')}>Вернуться к программам</Button>
          </div>
        </div>
      </div>
    )
  }

  const colors: ('green' | 'beige')[] = ['green', 'beige', 'green']

  return (
    <div className="h-screen flex flex-col bg-white">
      <UnifiedHeader />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/programs')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Назад
              </Button>
              <h1 className="text-3xl font-semibold uppercase tracking-wide">{programTitle}</h1>
            </div>

            <Button onClick={() => router.push('/programs')} variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Загрузить ещё уроки
            </Button>
          </div>
        </div>

        {/* Lessons list */}
        <div className="flex-1 overflow-y-auto p-8">
          {lessons.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-600">
                <p className="text-lg mb-4">В этой программе пока нет уроков</p>
                <Button variant="outline">Загрузить файлы</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-5xl">
              {lessons.map((lesson, index) => (
                <LessonCard
                  key={lesson.id}
                  title={lesson.title}
                  metrics={lesson.metrics || []}
                  analyzed={lesson.analyzed}
                  color={colors[index % colors.length]}
                  loading={lesson.loading}
                  lessonId={lesson.id}
                  onAnalyze={handleAnalyzeLesson}
                  onDelete={handleDeleteLesson}
                  draggable={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
