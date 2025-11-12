'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { LessonCardWithGauge } from './LessonCardWithGauge'
import type { ProgramLesson } from '@/src/services/api'
import { toast } from 'sonner'

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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[UploadLessonsButton] File select triggered')
    const files = event.target.files
    if (!files || files.length === 0) {
      console.log('[UploadLessonsButton] No files selected')
      return
    }

    console.log(
      `[UploadLessonsButton] Selected ${files.length} files:`,
      Array.from(files).map((f) => f.name),
    )
    setUploading(true)
    const fileArray = Array.from(files)

    try {
      // Parse files and encode content as base64 to avoid JSON encoding issues
      console.log('[UploadLessonsButton] Starting file parsing...')
      const parsedFiles = await Promise.all(
        fileArray.map(async (file, index) => {
          try {
            console.log(
              `[UploadLessonsButton] Reading file ${index + 1}/${fileArray.length}: ${file.name} (${file.size} bytes)`,
            )
            const content = await file.text()
            console.log(
              `[UploadLessonsButton] Content read successfully, length: ${content.length} chars`,
            )

            // Encode to base64 to safely transfer in JSON
            console.log('[UploadLessonsButton] Encoding to base64...')
            const base64Content = window.btoa(
              encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (match, p1) =>
                String.fromCharCode(parseInt(p1, 16)),
              ),
            )
            console.log(
              `[UploadLessonsButton] Base64 encoded, length: ${base64Content.length} chars`,
            )

            return {
              fileName: file.name,
              content: base64Content,
              fileSize: file.size,
              isBase64: true,
            }
          } catch (error) {
            console.error(`[UploadLessonsButton] Error reading file ${file.name}:`, error)
            toast.error(`Не удалось прочитать файл ${file.name}`)
            return null
          }
        }),
      )

      const validFiles = parsedFiles.filter((f) => f !== null)
      console.log(`[UploadLessonsButton] Valid files: ${validFiles.length}/${parsedFiles.length}`)

      if (validFiles.length === 0) {
        console.log('[UploadLessonsButton] No valid files to upload')
        toast.error('Нет валидных файлов для загрузки')
        return
      }

      // Upload via API
      console.log(
        `[UploadLessonsButton] Uploading ${validFiles.length} files to /api/programs/${programId}/upload-lessons`,
      )
      const response = await fetch(`/api/programs/${programId}/upload-lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: validFiles }),
      })

      console.log(
        `[UploadLessonsButton] API response status: ${response.status} ${response.statusText}`,
      )

      if (!response.ok) {
        const error = await response.json()
        console.error('[UploadLessonsButton] Upload failed:', error)
        const errorMsg = error.details
          ? `${error.error}: ${error.details}`
          : error.error || 'Failed to upload'
        throw new Error(errorMsg)
      }

      const result = await response.json()
      console.log('[UploadLessonsButton] Upload successful:', result)
      toast.success(`Загружено ${result.lessonsCreated} уроков`)

      // Trigger callback
      console.log('[UploadLessonsButton] Triggering onAddLesson callback')
      if (onAddLesson) {
        onAddLesson()
      }
    } catch (error) {
      console.error('[UploadLessonsButton] Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки файлов'
      toast.error(errorMessage)
    } finally {
      console.log('[UploadLessonsButton] Cleaning up...')
      setUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        console.log('[UploadLessonsButton] File input reset')
      }
      console.log('[UploadLessonsButton] Upload process completed')
    }
  }

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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* If lessons exist - show Add button at top */}
      {lessonsWithMetrics.length > 0 && onAddLesson && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2 ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span className="text-2xl">+</span>
          <span>{uploading ? 'Загрузка...' : 'Добавить урок'}</span>
        </button>
      )}

      {/* Empty state - message and button below */}
      {lessonsWithMetrics.length === 0 && (
        <div className="text-center py-12 space-y-6">
          <p className="text-lg text-gray-600">В этой программе пока нет уроков</p>
          {onAddLesson && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span className="text-2xl">+</span>
              <span>{uploading ? 'Загрузка...' : 'Добавить урок'}</span>
            </button>
          )}
        </div>
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
