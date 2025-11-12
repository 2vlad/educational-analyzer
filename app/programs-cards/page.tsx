'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import UnifiedHeader from '@/components/layout/UnifiedHeader'
import ProgramsCardsView from '@/components/programs/ProgramsCardsView'
import AddProgramModal from '@/components/programs/AddProgramModal'
import { apiService, type CreateProgramRequest } from '@/src/services/api'
import type { Program } from '@/types/programs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function ProgramsCardsPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load programs on mount
  useEffect(() => {
    loadPrograms()
  }, [])

  const loadPrograms = async () => {
    try {
      setLoading(true)
      setError(null)
      const { programs: loadedPrograms } = await apiService.getPrograms()

      // Map API response to Program type
      const mappedPrograms: Program[] = loadedPrograms.map((p) => ({
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
      }))

      setPrograms(mappedPrograms)
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

  const handleAddProgram = async (data: CreateProgramRequest) => {
    try {
      const { program } = await apiService.createProgram(data)
      setPrograms([program, ...programs])
      setIsAddModalOpen(false)
      toast.success('Программа создана')
    } catch (err: any) {
      console.error('Failed to create program:', err)
      toast.error(err.message || 'Не удалось создать программу')
      throw err // Re-throw to keep modal open
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <UnifiedHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Загрузка программ...</div>
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
            <Button onClick={loadPrograms}>Попробовать снова</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <UnifiedHeader />

      <div className="flex-1 overflow-hidden flex flex-col">
        {programs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-gray-600 mb-4 text-lg">У вас пока нет программ</p>
              <Button onClick={() => setIsAddModalOpen(true)} size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Создать первую программу
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ProgramsCardsView programs={programs} />

            {/* Floating Add Button */}
            <div className="fixed bottom-8 right-8">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                size="lg"
                className="rounded-full shadow-lg hover:shadow-xl transition-shadow gap-2"
              >
                <Plus className="w-5 h-5" />
                Добавить программу
              </Button>
            </div>
          </>
        )}
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
