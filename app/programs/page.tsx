'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import ProgramsList from '@/components/programs/ProgramsList'
import { LessonsCardsView } from '@/components/programs/LessonsCardsView'
import AddProgramModal from '@/components/programs/AddProgramModal'
import ProgressTracker from '@/components/programs/ProgressTracker'
import {
  apiService,
  type Program,
  type ProgramLesson,
  type CreateProgramRequest,
} from '@/src/services/api'
import { useRouter } from 'next/navigation'

export default function ProgramsPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [lessons, setLessons] = useState<ProgramLesson[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzingLessonIds, setAnalyzingLessonIds] = useState<Set<string>>(new Set())

  // Load programs on mount
  useEffect(() => {
    loadPrograms()
  }, [])

  // Load lessons when program selected
  useEffect(() => {
    if (selectedProgram) {
      loadLessons(selectedProgram.id)
    } else {
      setLessons([])
    }
  }, [selectedProgram])

  const loadPrograms = async () => {
    try {
      setLoading(true)
      setError(null)
      const { programs: loadedPrograms } = await apiService.getPrograms()
      setPrograms(loadedPrograms)

      // Auto-select first program if available
      if (loadedPrograms.length > 0 && !selectedProgram) {
        setSelectedProgram(loadedPrograms[0])
      }
    } catch (err) {
      const error = err as Error
      console.error('Failed to load programs:', error)
      setError(error.message || 'Не удалось загрузить программы')

      // If unauthorized, redirect to login
      if (error.message.includes('Unauthorized')) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadLessons = async (programId: string) => {
    try {
      setLessonsLoading(true)
      const { lessons: loadedLessons } = await apiService.getProgramLessons(programId)
      setLessons(loadedLessons)
    } catch (err) {
      console.error('Failed to load lessons:', err)
      // Silently fail - program might not have lessons enumerated yet
      setLessons([])
    } finally {
      setLessonsLoading(false)
    }
  }

  const handleAddProgram = async (data: CreateProgramRequest) => {
    try {
      const { program } = await apiService.createProgram(data)
      setPrograms([program, ...programs])
      setSelectedProgram(program)
      setIsAddModalOpen(false)
    } catch (err) {
      const error = err as Error
      console.error('Failed to create program:', error)
      window.alert(error.message || 'Не удалось создать программу')
      throw err // Re-throw to keep modal open
    }
  }

  const handleEnumerateLessons = async (programId: string) => {
    try {
      const { count, lessons: enumeratedLessons } = await apiService.enumerateLessons(programId)
      setLessons(enumeratedLessons)
      window.alert(`Загружено ${count} уроков`)

      // Reload programs to update lesson counts
      await loadPrograms()
    } catch (err) {
      const error = err as Error
      console.error('Failed to enumerate lessons:', error)
      window.alert(error.message || 'Не удалось загрузить список уроков')
    }
  }

  const handleStartAnalysis = async (programId: string) => {
    console.log('[handleStartAnalysis] Starting analysis for program:', programId)

    try {
      const { run, message } = await apiService.createRun(programId, {
        metricsMode: 'lx',
        maxConcurrency: 3,
      })

      console.log('[handleStartAnalysis] Run created:', run.id, message)

      // Reload programs to update run status and trigger ProgressTracker
      await loadPrograms()

      console.log('[handleStartAnalysis] Programs reloaded, ProgressTracker should appear')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось запустить анализ'
      console.error('[handleStartAnalysis] Failed:', message, err)
      window.alert(message)
      throw err // Re-throw to let caller handle it
    }
  }

  const handleProgressComplete = async () => {
    // Reload programs when run completes
    await loadPrograms()
    if (selectedProgram) {
      await loadLessons(selectedProgram.id)
    }
  }

  const handleAnalyzeLesson = async (lessonId: string) => {
    if (!selectedProgram) return

    // Add to analyzing set
    setAnalyzingLessonIds((prev) => new Set(prev).add(lessonId))

    try {
      toast.info('Запускаем анализ урока...')
      await apiService.analyzeLesson(selectedProgram.id, lessonId)
      toast.success('Анализ поставлен в очередь!')

      // Reload lessons to update the card after a delay
      window.setTimeout(async () => {
        await loadLessons(selectedProgram.id)
      }, 2000)
    } catch (err) {
      const error = err as Error
      console.error('Failed to analyze lesson:', error)

      // Only show error if not already analyzing
      if (!error.message.includes('already queued')) {
        toast.error(error.message || 'Не удалось проанализировать урок')
      }
    } finally {
      // Remove from analyzing set after a delay
      window.setTimeout(() => {
        setAnalyzingLessonIds((prev) => {
          const next = new Set(prev)
          next.delete(lessonId)
          return next
        })
      }, 3000)
    }
  }

  const handleDeleteLesson = async (lessonId: string) => {
    if (!selectedProgram) return

    try {
      await apiService.deleteLesson(selectedProgram.id, lessonId)
      toast.success('Урок удален')

      // Optimistic update
      setLessons((prev) => prev.filter((l) => l.id !== lessonId))

      // Reload programs to update count
      await loadPrograms()
    } catch (err) {
      const error = err as Error
      console.error('Failed to delete lesson:', error)
      toast.error(error.message || 'Не удалось удалить урок')
      // Reload on error
      await loadLessons(selectedProgram.id)
    }
  }

  const handleAddLesson = async () => {
    if (!selectedProgram) return

    // Reload lessons and programs after file upload
    await loadLessons(selectedProgram.id)
    await loadPrograms()
  }

  const handleDeleteProgram = async (programId: string) => {
    if (!globalThis.confirm('Вы уверены, что хотите удалить эту программу?')) {
      return
    }

    try {
      await apiService.deleteProgram(programId)
      setPrograms(programs.filter((p) => p.id !== programId))

      if (selectedProgram?.id === programId) {
        setSelectedProgram(programs[0] || null)
      }
    } catch (err) {
      const error = err as Error
      console.error('Failed to delete program:', error)
      window.alert(error.message || 'Не удалось удалить программу')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <UnifiedHeader />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка программ...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <UnifiedHeader />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadPrograms}
              className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <UnifiedHeader />

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar with programs list */}
        <ProgramsList
          programs={programs.map((p) => ({
            id: p.id,
            title: p.name,
            lessonsCount: p.lastRun?.totalLessons || 0,
            completedCount: p.lastRun?.succeeded || 0,
            status:
              p.lastRun?.status === 'completed'
                ? 'completed'
                : p.lastRun?.status === 'running'
                  ? 'active'
                  : 'draft',
            sourceType: p.source_type,
          }))}
          selectedProgram={
            selectedProgram
              ? {
                  id: selectedProgram.id,
                  title: selectedProgram.name,
                  lessonsCount: selectedProgram.lastRun?.totalLessons || 0,
                  completedCount: selectedProgram.lastRun?.succeeded || 0,
                  status:
                    selectedProgram.lastRun?.status === 'completed'
                      ? 'completed'
                      : selectedProgram.lastRun?.status === 'running'
                        ? 'active'
                        : 'draft',
                  sourceType: selectedProgram.source_type,
                }
              : null
          }
          onSelectProgram={(program) => {
            const fullProgram = programs.find((p) => p.id === program.id)
            if (fullProgram) {
              setSelectedProgram(fullProgram)
            }
          }}
          onAddProgram={() => setIsAddModalOpen(true)}
          onEnumerateLessons={handleEnumerateLessons}
          onStartAnalysis={handleStartAnalysis}
          onDeleteProgram={handleDeleteProgram}
          onUploadSuccess={async () => {
            // Reload programs and lessons after successful upload
            await loadPrograms()
            if (selectedProgram) {
              await loadLessons(selectedProgram.id)
            }
          }}
          onUploadComplete={async (programId: string, lessonsCount: number) => {
            // Auto-start analysis after file upload
            console.log(
              `[Auto-Analysis] Starting analysis for program ${programId} with ${lessonsCount} lessons`,
            )
            toast.info('Запускаем автоматический анализ...', { duration: 2000 })

            try {
              await handleStartAnalysis(programId)
              toast.success('Анализ запущен успешно!')
              console.log('[Auto-Analysis] Analysis started successfully')
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
              console.error('[Auto-Analysis] Failed to start:', message, err)
              toast.error(`Не удалось запустить анализ: ${message}`)
              window.alert(
                `Уроки загружены (${lessonsCount} шт), но не удалось запустить анализ автоматически.\n\nОшибка: ${message}\n\nПопробуйте запустить анализ вручную кнопкой "Начать анализ".`,
              )
            }
          }}
        />

        {/* Main content area with progress tracker and lessons */}
        <div className="flex-1 overflow-y-auto">
          {selectedProgram && (
            <div className="p-6 space-y-6">
              {/* Progress Tracker - показываем если есть активный run */}
              {selectedProgram.lastRun &&
                ['running', 'paused', 'queued'].includes(selectedProgram.lastRun.status) && (
                  <ProgressTracker
                    programId={selectedProgram.id}
                    programName={selectedProgram.name}
                    onComplete={handleProgressComplete}
                  />
                )}

              {/* Lessons cards */}
              <LessonsCardsView
                programId={selectedProgram.id}
                lessons={lessons}
                loading={lessonsLoading}
                analyzingLessonIds={analyzingLessonIds}
                onAnalyzeLesson={handleAnalyzeLesson}
                onDeleteLesson={handleDeleteLesson}
                onAddLesson={handleAddLesson}
              />
            </div>
          )}

          {!selectedProgram && programs.length === 0 && (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">У вас пока нет программ</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                >
                  Создать первую программу
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Program Modal */}
      <AddProgramModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddProgram}
      />
    </div>
  )
}
