'use client'

import { useState, useEffect } from 'react'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import ProgramsList from '@/components/programs/ProgramsList'
import ProgramLessons from '@/components/programs/ProgramLessons'
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
    } catch (err: any) {
      console.error('Failed to load programs:', err)
      setError(err.message || 'Не удалось загрузить программы')

      // If unauthorized, redirect to login
      if (err.message.includes('Unauthorized')) {
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
    } catch (err: any) {
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
    } catch (err: any) {
      console.error('Failed to create program:', err)
      alert(err.message || 'Не удалось создать программу')
      throw err // Re-throw to keep modal open
    }
  }

  const handleEnumerateLessons = async (programId: string) => {
    try {
      const { count, lessons: enumeratedLessons } = await apiService.enumerateLessons(programId)
      setLessons(enumeratedLessons)
      alert(`Загружено ${count} уроков`)

      // Reload programs to update lesson counts
      await loadPrograms()
    } catch (err: any) {
      console.error('Failed to enumerate lessons:', err)
      alert(err.message || 'Не удалось загрузить список уроков')
    }
  }

  const handleStartAnalysis = async (programId: string) => {
    try {
      const { run, message } = await apiService.createRun(programId, {
        metricsMode: 'lx',
        maxConcurrency: 3,
      })

      // Don't show alert, ProgressTracker will appear automatically
      console.log(message)

      // Reload programs to update run status and trigger ProgressTracker
      await loadPrograms()
    } catch (err: any) {
      console.error('Failed to start analysis:', err)
      alert(err.message || 'Не удалось запустить анализ')
    }
  }

  const handleProgressComplete = async () => {
    // Reload programs when run completes
    await loadPrograms()
    if (selectedProgram) {
      await loadLessons(selectedProgram.id)
    }
  }

  const handleDeleteProgram = async (programId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту программу?')) {
      return
    }

    try {
      await apiService.deleteProgram(programId)
      setPrograms(programs.filter((p) => p.id !== programId))

      if (selectedProgram?.id === programId) {
        setSelectedProgram(programs[0] || null)
      }
    } catch (err: any) {
      console.error('Failed to delete program:', err)
      alert(err.message || 'Не удалось удалить программу')
    }
  }

  const handleDeleteLesson = async (lessonId: string) => {
    if (!selectedProgram) return

    try {
      await apiService.deleteLesson(selectedProgram.id, lessonId)
      
      // Optimistic update: remove lesson from list
      setLessons((prev) => prev.filter((l) => l.id !== lessonId))
      
      // Update program lesson count
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === selectedProgram.id
            ? { ...p, lesson_count: Math.max(0, (p.lesson_count || 0) - 1) }
            : p,
        ),
      )
    } catch (err: any) {
      console.error('Failed to delete lesson:', err)
      alert(err.message || 'Не удалось удалить урок')
      // Reload on error to restore correct state
      await loadLessons(selectedProgram.id)
      await loadPrograms()
    }
  }

  const handleDeleteLessons = async (lessonIds: string[]) => {
    if (!selectedProgram) return

    try {
      await apiService.deleteLessons(selectedProgram.id, lessonIds)
      
      // Optimistic update: remove lessons from list
      setLessons((prev) => prev.filter((l) => !lessonIds.includes(l.id)))
      
      // Update program lesson count
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === selectedProgram.id
            ? { ...p, lesson_count: Math.max(0, (p.lesson_count || 0) - lessonIds.length) }
            : p,
        ),
      )
      
      alert(`Удалено ${lessonIds.length} уроков`)
    } catch (err: any) {
      console.error('Failed to delete lessons:', err)
      alert(err.message || 'Не удалось удалить уроки')
      // Reload on error to restore correct state
      await loadLessons(selectedProgram.id)
      await loadPrograms()
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
            console.log(`Auto-starting analysis for program ${programId} with ${lessonsCount} lessons`)
            try {
              // Small delay to ensure lessons are loaded
              await new Promise((resolve) => setTimeout(resolve, 500))
              await handleStartAnalysis(programId)
            } catch (err: any) {
              console.error('Failed to auto-start analysis:', err)
              alert(`Уроки загружены, но не удалось запустить анализ: ${err.message}`)
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

              {/* Lessons list */}
              <ProgramLessons
                program={{
                  id: selectedProgram.id,
                  title: selectedProgram.name,
                  lessonsCount: lessons.length,
                  completedCount: selectedProgram.lastRun?.succeeded || 0,
                  status:
                    selectedProgram.lastRun?.status === 'completed'
                      ? 'completed'
                      : selectedProgram.lastRun?.status === 'running'
                        ? 'active'
                        : 'draft',
                  sourceType: selectedProgram.source_type,
                }}
                lessons={lessons.map((lesson, index) => ({
                  id: lesson.id,
                  programId: lesson.program_id,
                  title: lesson.title,
                  status: 'not-started' as const, // TODO: Get actual status from analyses
                  order: lesson.sort_order,
                }))}
                loading={lessonsLoading}
                onRefresh={() => loadLessons(selectedProgram.id)}
                onDeleteLesson={handleDeleteLesson}
                onDeleteLessons={handleDeleteLessons}
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
